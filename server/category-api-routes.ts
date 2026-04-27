import type { Express, NextFunction, Request, Response } from "express";
import path from "node:path";
import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import sharp from "sharp";
import { createContext } from "./_core/context";
import * as db from "./db";
import { verifyImageMime } from "./upload-security";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const CATEGORY_COVER_WIDTH = 1600;
const CATEGORY_COVER_HEIGHT = 1000;
const CATEGORY_COVER_WEBP_QUALITY = 88;

function getCategoriesUploadDir() {
  if (process.env.NODE_ENV === "production") {
    return path.join(process.cwd(), "dist", "public", "uploads", "categories");
  }
  return path.join(process.cwd(), "client", "public", "uploads", "categories");
}

function safeBaseName(fileName: string) {
  const rawBase = path.basename(fileName, path.extname(fileName));
  const sanitized = rawBase
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return sanitized.slice(0, 48) || "category";
}

function isFileEntry(value: FormDataEntryValue | null): value is File {
  if (!value || typeof value === "string") return false;
  return typeof value.arrayBuffer === "function";
}

async function requireAdminOrManager(req: Request, res: Response, next: NextFunction) {
  try {
    const ctx = await createContext({ req, res } as any);
    const role = await db.getEffectiveAdminRole(ctx.user);

    if (!ctx.user || !role || (role !== "ADMIN" && role !== "MANAGER")) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    next();
  } catch (error) {
    console.error("[Category API] auth failed:", error);
    res.status(401).json({ error: "Authentication failed" });
  }
}

export function registerCategoryApiRoutes(app: Express) {
  app.get("/api/categories", async (_req: Request, res: Response) => {
    try {
      const categories = await db.getAllCategories();
      res.json(categories);
    } catch (error: any) {
      console.error("[Category API] list failed:", error);
      res.status(500).json({ error: error?.message || "Failed to load categories" });
    }
  });

  app.post("/api/admin/categories/:id/upload", requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const categoryId = Number(req.params.id);
      if (!Number.isFinite(categoryId) || categoryId <= 0) {
        res.status(400).json({ error: "Invalid category id" });
        return;
      }

      const category = await db.getCategoryById(categoryId);
      if (!category) {
        res.status(404).json({ error: "Category not found" });
        return;
      }

      const webRequest = new Request("http://localhost", {
        method: req.method,
        headers: req.headers as any,
        body: req as any,
        duplex: "half",
      } as any);

      const formData = await webRequest.formData();
      const fileEntry = formData.get("file") ?? formData.get("image");

      if (!isFileEntry(fileEntry)) {
        res.status(400).json({ error: "Image file is required in form-data (field: file)" });
        return;
      }

      if (fileEntry.size > MAX_IMAGE_SIZE_BYTES) {
        res.status(400).json({ error: "Image size must be 5MB or less" });
        return;
      }

      const mimeType = fileEntry.type.toLowerCase();
      const providedExt = path.extname(fileEntry.name || "").toLowerCase();
      const fallbackExtByMime: Record<string, string> = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
      };
      const extension = allowedExtensions.has(providedExt) ? providedExt : fallbackExtByMime[mimeType];

      if (!allowedMimeTypes.has(mimeType) || !extension) {
        res.status(400).json({ error: "Unsupported format. Use jpg, png or webp" });
        return;
      }

      const fileBuffer = Buffer.from(await fileEntry.arrayBuffer());
      if (!fileBuffer.length) {
        res.status(400).json({ error: "Uploaded file is empty" });
        return;
      }
      const signatureCheck = verifyImageMime(fileBuffer, mimeType);
      if (!signatureCheck.valid) {
        res.status(400).json({ error: "File content does not match declared image format" });
        return;
      }

      const optimizedBuffer = await sharp(fileBuffer, { failOn: "none" })
        .rotate()
        .resize(CATEGORY_COVER_WIDTH, CATEGORY_COVER_HEIGHT, {
          fit: "cover",
          position: sharp.strategy.attention,
        })
        .sharpen()
        .webp({
          quality: CATEGORY_COVER_WEBP_QUALITY,
          alphaQuality: CATEGORY_COVER_WEBP_QUALITY,
          effort: 6,
        })
        .toBuffer();

      const uploadsDir = getCategoriesUploadDir();
      await fs.mkdir(uploadsDir, { recursive: true });

      const fileName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safeBaseName(fileEntry.name || "category")}.webp`;
      const diskPath = path.join(uploadsDir, fileName);
      await fs.writeFile(diskPath, optimizedBuffer);

      const publicUrl = `/uploads/categories/${fileName}`;
      await db.updateCategory(categoryId, {
        coverImageUrl: publicUrl,
        imageUrl: publicUrl,
      });

      res.json({
        success: true,
        url: publicUrl,
        categoryId,
        width: CATEGORY_COVER_WIDTH,
        height: CATEGORY_COVER_HEIGHT,
        format: "webp",
      });
    } catch (error: any) {
      console.error("[Category API] upload failed:", error);
      res.status(400).json({ error: error?.message || "Category image upload failed" });
    }
  });
}
