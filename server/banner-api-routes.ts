import type { Express, NextFunction, Request, Response } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";
import sharp from "sharp";
import { createContext } from "./_core/context";
import * as bannerDb from "./db-banners";
import * as db from "./db";
import { verifyImageMime } from "./upload-security";

const placementSchema = z.literal("homepage_hero");
const MAX_HERO_UPLOAD_BYTES = 5 * 1024 * 1024;
const heroAllowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const heroAllowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const heroFallbackExtByMime: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const HERO_SETTINGS_KEYS = {
  secondaryCtaText: "cms.homeHero.secondaryCtaText",
  secondaryCtaLink: "cms.homeHero.secondaryCtaLink",
  badgeText: "cms.homeHero.badgeText",
} as const;

const cmsHomeHeroUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    subtitle: z.string().trim().max(1200).optional(),
    imageUrl: z.string().trim().max(2000).optional(),
    ctaText: z.string().trim().max(100).optional(),
    ctaLink: z.string().trim().max(1000).optional(),
    secondaryCtaText: z.string().trim().max(100).optional(),
    secondaryCtaLink: z.string().trim().max(1000).optional(),
    badgeText: z.string().trim().max(120).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required",
  });

const cmsResultsSectionUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    title: z.string().trim().min(1).max(255).optional(),
    subtitle: z.string().trim().min(1).max(4000).optional(),
    beforeLabel: z.string().trim().min(1).max(50).optional(),
    afterLabel: z.string().trim().min(1).max(50).optional(),
    beforeImageUrl: z.string().trim().max(2000).nullable().optional(),
    afterImageUrl: z.string().trim().max(2000).nullable().optional(),
    stat1Value: z.string().trim().min(1).max(80).optional(),
    stat1Title: z.string().trim().min(1).max(120).optional(),
    stat1Desc: z.string().trim().min(1).max(1500).optional(),
    stat2Value: z.string().trim().min(1).max(80).optional(),
    stat2Title: z.string().trim().min(1).max(120).optional(),
    stat2Desc: z.string().trim().min(1).max(1500).optional(),
    stat3Value: z.string().trim().min(1).max(80).optional(),
    stat3Title: z.string().trim().min(1).max(120).optional(),
    stat3Desc: z.string().trim().min(1).max(1500).optional(),
    footerNote: z.string().trim().min(1).max(2500).optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required",
  });

const cmsEditorialHeroUpdateSchema = z
  .object({
    isActive: z.boolean().optional(),
    badgeText: z.string().trim().max(180).optional(),
    title: z.string().trim().max(1000).optional(),
    subtitle: z.string().trim().max(3000).optional(),
    ctaText: z.string().trim().max(180).optional(),
    ctaLink: z.string().trim().max(2000).optional(),
    backgroundImageUrl: z.string().trim().max(2000).optional(),
    overlayOpacity: z.coerce.number().int().min(0).max(90).optional(),
    cardPosition: z.enum(["left", "center", "right"]).optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required",
  });

const createBannerSchema = z.object({
  placement: placementSchema.default("homepage_hero"),
  title: z.string().min(1).max(255),
  subtitle: z.string().max(1000).default(""),
  buttonText: z.string().max(100).default("Shop now"),
  buttonLink: z.string().max(1000).default("/shop"),
  imageUrl: z.string().optional().default(""),
  imageUrlDesktop: z.string().min(1),
  imageUrlMobile: z.string().min(1),
  cropMeta: z.string().optional().nullable(),
  status: z.enum(["draft", "published"]).default("draft"),
  priority: z.coerce.number().int().min(0).max(9999).default(0),
  startAt: z.string().optional().nullable(),
  endAt: z.string().optional().nullable(),
});

const updateBannerSchema = createBannerSchema
  .partial()
  .omit({ placement: true })
  .refine(data => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

const publishSchema = z.object({
  status: z.enum(["draft", "published"]).optional(),
});

const optimizeImageSchema = z.object({
  desktopImageData: z.string().min(1),
  mobileImageData: z.string().min(1),
  desktop: z.object({
    width: z.coerce.number().int().min(400).max(4000),
    height: z.coerce.number().int().min(300).max(4000),
  }).default({ width: 1920, height: 800 }),
  mobile: z.object({
    width: z.coerce.number().int().min(400).max(3000),
    height: z.coerce.number().int().min(400).max(4000),
  }).default({ width: 1080, height: 1350 }),
  quality: z.coerce.number().int().min(50).max(95).default(80),
});

function parseOptionalDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date format");
  }
  return parsed;
}

function parseDataUrl(dataUrl: string) {
  const match = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Invalid image payload. Expected data URL.");
  }
  return Buffer.from(match[2], "base64");
}

async function optimizeAndStore(
  imageData: string,
  width: number,
  height: number,
  quality: number,
  variant: "desktop" | "mobile"
) {
  const inputBuffer = parseDataUrl(imageData);
  const optimized = await sharp(inputBuffer)
    .rotate()
    .resize(width, height, {
      fit: "cover",
      position: "centre",
      withoutEnlargement: false,
    })
    .sharpen({ sigma: 1, m1: 0.8, m2: 2, x1: 2, y2: 10, y3: 20 })
    .webp({ quality })
    .toBuffer();

  const fileName = `${Date.now()}-${variant}-${crypto.randomBytes(4).toString("hex")}.webp`;
  const uploadsDir = process.env.NODE_ENV === "production"
    ? path.join(process.cwd(), "dist", "public", "uploads", "banners")
    : path.join(process.cwd(), "client", "public", "uploads", "banners");

  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(path.join(uploadsDir, fileName), optimized);
  return `/uploads/banners/${fileName}`;
}

function getHeroUploadDir() {
  if (process.env.NODE_ENV === "production") {
    return path.join(process.cwd(), "dist", "public", "uploads", "hero");
  }
  return path.join(process.cwd(), "client", "public", "uploads", "hero");
}

function safeUploadBaseName(fileName: string) {
  const rawBase = path.basename(fileName, path.extname(fileName));
  const sanitized = rawBase
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return sanitized.slice(0, 48) || "hero";
}

function isFileEntry(value: FormDataEntryValue | null): value is File {
  if (!value || typeof value === "string") return false;
  return typeof value.arrayBuffer === "function";
}

function sendCmsError(res: Response, statusCode: number, message: string) {
  res.status(statusCode).json({ ok: false, error: message });
}

async function handleAdminCmsImageUpload(req: Request, res: Response) {
  try {
    const webRequest = new Request("http://localhost", {
      method: req.method,
      headers: req.headers as any,
      body: req as any,
      duplex: "half",
    } as any);

    const formData = await webRequest.formData();
    const fileEntry = formData.get("file") ?? formData.get("image");

    if (!isFileEntry(fileEntry)) {
      sendCmsError(res, 400, "Image file is required in form-data (field: file)");
      return;
    }

    if (fileEntry.size > MAX_HERO_UPLOAD_BYTES) {
      sendCmsError(res, 400, "Image size must be 5MB or less");
      return;
    }

    const mimeType = fileEntry.type.toLowerCase();
    const providedExt = path.extname(fileEntry.name || "").toLowerCase();
    const extension = heroAllowedExtensions.has(providedExt)
      ? providedExt
      : heroFallbackExtByMime[mimeType];

    if (!heroAllowedMimeTypes.has(mimeType) || !extension) {
      sendCmsError(res, 400, "Unsupported format. Use jpg, png or webp");
      return;
    }

    const fileBuffer = Buffer.from(await fileEntry.arrayBuffer());
    if (!fileBuffer.length) {
      sendCmsError(res, 400, "Uploaded file is empty");
      return;
    }
    const signatureCheck = verifyImageMime(fileBuffer, mimeType);
    if (!signatureCheck.valid) {
      sendCmsError(res, 400, "File content does not match declared image format");
      return;
    }

    const optimized = await sharp(fileBuffer, { failOn: "none" })
      .rotate()
      .resize(2200, 1400, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .sharpen()
      .webp({
        quality: 86,
        alphaQuality: 86,
        effort: 6,
      })
      .toBuffer();

    const uploadsDir = getHeroUploadDir();
    await fs.mkdir(uploadsDir, { recursive: true });

    const fileName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safeUploadBaseName(fileEntry.name || "hero")}.webp`;
    await fs.writeFile(path.join(uploadsDir, fileName), optimized);

    res.json({
      url: `/uploads/hero/${fileName}`,
    });
  } catch (error: any) {
    console.error("[CMS Upload API] upload failed:", error);
    sendCmsError(res, 400, error?.message || "Image upload failed");
  }
}

async function getHomeHeroExtras() {
  const [secondaryCtaText, secondaryCtaLink, badgeText] = await Promise.all([
    db.getStoreSetting(HERO_SETTINGS_KEYS.secondaryCtaText),
    db.getStoreSetting(HERO_SETTINGS_KEYS.secondaryCtaLink),
    db.getStoreSetting(HERO_SETTINGS_KEYS.badgeText),
  ]);

  return {
    secondaryCtaText: secondaryCtaText || "",
    secondaryCtaLink: secondaryCtaLink || "",
    badgeText: badgeText || "",
  };
}

async function setHomeHeroExtras(payload: {
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
  badgeText?: string;
}) {
  const updates: Array<Promise<void>> = [];
  if (payload.secondaryCtaText !== undefined) {
    updates.push(db.setStoreSetting(HERO_SETTINGS_KEYS.secondaryCtaText, payload.secondaryCtaText));
  }
  if (payload.secondaryCtaLink !== undefined) {
    updates.push(db.setStoreSetting(HERO_SETTINGS_KEYS.secondaryCtaLink, payload.secondaryCtaLink));
  }
  if (payload.badgeText !== undefined) {
    updates.push(db.setStoreSetting(HERO_SETTINGS_KEYS.badgeText, payload.badgeText));
  }
  if (updates.length > 0) {
    await Promise.all(updates);
  }
}

function pickPrimaryHeroBanner(
  banners: bannerDb.HomepageHeroBanner[]
): bannerDb.HomepageHeroBanner | null {
  if (banners.length === 0) return null;
  return banners.find((item) => item.status === "published") || banners[0];
}

async function ensurePrimaryHeroBanner() {
  const existing = pickPrimaryHeroBanner(await bannerDb.listHomepageHeroBanners());
  if (existing) return existing;

  const created = await bannerDb.createHomepageHeroBanner({
    placement: "homepage_hero",
    title: "Votre peau, la version qu'elle attendait.",
    subtitle:
      "Des formules choisies avec soin pour le climat de Dakar. Pas de promesses magiques — juste des actifs que votre peau reconnaît.",
    buttonText: "Commencer ma routine",
    buttonLink: "/boutique",
    imageUrl: "",
    imageUrlDesktop: "",
    imageUrlMobile: "",
    status: "published",
    priority: 100,
    startAt: null,
    endAt: null,
  });

  if (!created) {
    throw new Error("Unable to initialize homepage hero block");
  }

  return created;
}

async function mapCmsHeroResponse(banner: bannerDb.HomepageHeroBanner | null) {
  if (!banner) return null;
  const extras = await getHomeHeroExtras();
  return {
    id: banner.id,
    key: "home_hero" as const,
    title: banner.title,
    subtitle: banner.subtitle || "",
    imageUrl: banner.imageUrl || banner.imageUrlDesktop || banner.imageUrlMobile || "",
    ctaText: banner.buttonText || "",
    ctaLink: banner.buttonLink || "",
    secondaryCtaText: extras.secondaryCtaText,
    secondaryCtaLink: extras.secondaryCtaLink,
    badgeText: extras.badgeText,
    isActive: banner.status === "published",
    updatedAt: banner.updatedAt.toISOString(),
  };
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const ctx = await createContext({ req, res } as any);
    const role = await db.getEffectiveAdminRole(ctx.user);
    if (!ctx.user || !role || (role !== "ADMIN" && role !== "MANAGER")) {
      res.status(403).json({ ok: false, error: "Admin access required" });
      return;
    }
    (req as any).adminUser = ctx.user;
    next();
  } catch (error) {
    console.error("[Banner API] admin auth failed:", error);
    res.status(401).json({ ok: false, error: "Authentication failed" });
  }
}

function resolveRequestIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim().length > 0) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return req.ip || req.socket.remoteAddress || null;
}

async function writeBannerAudit(
  req: Request,
  input: {
    action: string;
    entityType: string;
    entityId?: string | number | null;
    beforeJson?: unknown;
    afterJson?: unknown;
  }
) {
  try {
    const adminUser = (req as any).adminUser;
    await db.writeAuditLog({
      actorUserId: adminUser?.id ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      beforeJson: input.beforeJson,
      afterJson: input.afterJson,
      ip: resolveRequestIp(req),
      userAgent: req.headers["user-agent"] || null,
    });
  } catch (error) {
    console.error("[Banner API] Failed to write audit log:", error);
  }
}

function mapBannerForResponse(banner: bannerDb.HomepageHeroBanner) {
  return {
    ...banner,
    startAt: banner.startAt ? banner.startAt.toISOString() : null,
    endAt: banner.endAt ? banner.endAt.toISOString() : null,
    createdAt: banner.createdAt.toISOString(),
    updatedAt: banner.updatedAt.toISOString(),
  };
}

export function registerBannerApiRoutes(app: Express) {
  app.get("/api/cms/editorial-hero", async (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

    try {
      const hero = await db.getCmsEditorialHero();
      res.json({ ok: true, hero });
    } catch (error: any) {
      console.error("[CMS Editorial Hero API] public read failed:", error);
      sendCmsError(res, 500, error?.message || "Failed to load editorial hero");
    }
  });

  app.get("/api/cms/home-hero", async (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

    try {
      let banner = await bannerDb.getPublishedHomepageHeroBanner();
      if (!banner) {
        const all = await bannerDb.listHomepageHeroBanners();
        if (all.length === 0) {
          banner = await ensurePrimaryHeroBanner();
        }
      }
      const hero = await mapCmsHeroResponse(banner);
      res.json({ ok: true, hero });
    } catch (error: any) {
      console.error("[CMS Hero API] public read failed:", error);
      sendCmsError(res, 500, error?.message || "Failed to load homepage hero");
    }
  });

  app.get("/api/cms/results-section", async (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

    try {
      const data = await db.getCmsResultsSection();
      res.json({ ok: true, data });
    } catch (error: any) {
      console.error("[CMS Results API] public read failed:", error);
      sendCmsError(res, 500, error?.message || "Failed to load results section");
    }
  });

  app.get("/api/admin/cms/home-hero", requireAdmin, async (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

    try {
      const banner = await ensurePrimaryHeroBanner();
      const hero = await mapCmsHeroResponse(banner);
      res.json({ ok: true, hero });
    } catch (error: any) {
      console.error("[CMS Hero API] admin read failed:", error);
      sendCmsError(res, 500, error?.message || "Failed to load homepage hero for admin");
    }
  });

  app.put("/api/admin/cms/editorial-hero", requireAdmin, async (req: Request, res: Response) => {
    try {
      const input = cmsEditorialHeroUpdateSchema.parse(req.body || {});
      const before = await db.getCmsEditorialHero();
      const updated = await db.updateCmsEditorialHero({
        isActive: input.isActive,
        badgeText: input.badgeText?.trim(),
        title: input.title?.trim(),
        subtitle: input.subtitle?.trim(),
        ctaText: input.ctaText?.trim(),
        ctaLink: input.ctaLink?.trim(),
        backgroundImageUrl: input.backgroundImageUrl?.trim(),
        overlayOpacity: input.overlayOpacity,
        cardPosition: input.cardPosition,
      });

      await writeBannerAudit(req, {
        action: "cms.editorial_hero.update",
        entityType: "cms_editorial_hero",
        entityId: updated.id,
        beforeJson: before,
        afterJson: updated,
      });

      res.json({ ok: true, hero: updated });
    } catch (error: any) {
      console.error("[CMS Editorial Hero API] admin update failed:", error);
      sendCmsError(res, 400, error?.message || "Failed to update editorial hero");
    }
  });

  app.put("/api/admin/cms/home-hero", requireAdmin, async (req: Request, res: Response) => {
    try {
      const input = cmsHomeHeroUpdateSchema.parse(req.body || {});
      const target = await ensurePrimaryHeroBanner();
      const beforeHero = await mapCmsHeroResponse(target);
      const allBanners = await bannerDb.listHomepageHeroBanners();
      const nextStatus =
        input.isActive === undefined
          ? target.status
          : input.isActive
            ? "published"
            : "draft";

      if (nextStatus === "published") {
        await Promise.all(
          allBanners
            .filter((item) => item.id !== target.id && item.status === "published")
            .map((item) => bannerDb.setHomepageHeroBannerPublishState(item.id, "draft"))
        );
      }

      const imageUrl = input.imageUrl?.trim();
      const updated = await bannerDb.updateHomepageHeroBanner(target.id, {
        title: input.title?.trim(),
        subtitle: input.subtitle?.trim(),
        buttonText: input.ctaText?.trim(),
        buttonLink: input.ctaLink?.trim(),
        imageUrl,
        imageUrlDesktop: imageUrl,
        imageUrlMobile: imageUrl,
        status: nextStatus,
      });

      if (!updated) {
        sendCmsError(res, 500, "Failed to save homepage hero");
        return;
      }

      await setHomeHeroExtras({
        secondaryCtaText: input.secondaryCtaText?.trim(),
        secondaryCtaLink: input.secondaryCtaLink?.trim(),
        badgeText: input.badgeText?.trim(),
      });

      const hero = await mapCmsHeroResponse(updated);
      await writeBannerAudit(req, {
        action: "cms.home_hero.update",
        entityType: "cms_home_hero",
        entityId: updated.id,
        beforeJson: beforeHero,
        afterJson: hero,
      });
      res.json({ ok: true, hero });
    } catch (error: any) {
      console.error("[CMS Hero API] admin update failed:", error);
      sendCmsError(res, 400, error?.message || "Failed to update homepage hero");
    }
  });

  app.put("/api/admin/cms/results-section", requireAdmin, async (req: Request, res: Response) => {
    try {
      const input = cmsResultsSectionUpdateSchema.parse(req.body || {});
      const before = await db.getCmsResultsSection();
      const updated = await db.updateCmsResultsSection({
        enabled: input.enabled,
        title: input.title?.trim(),
        subtitle: input.subtitle?.trim(),
        beforeLabel: input.beforeLabel?.trim(),
        afterLabel: input.afterLabel?.trim(),
        beforeImageUrl:
          input.beforeImageUrl === undefined
            ? undefined
            : input.beforeImageUrl
              ? input.beforeImageUrl.trim()
              : null,
        afterImageUrl:
          input.afterImageUrl === undefined
            ? undefined
            : input.afterImageUrl
              ? input.afterImageUrl.trim()
              : null,
        stat1Value: input.stat1Value?.trim(),
        stat1Title: input.stat1Title?.trim(),
        stat1Desc: input.stat1Desc?.trim(),
        stat2Value: input.stat2Value?.trim(),
        stat2Title: input.stat2Title?.trim(),
        stat2Desc: input.stat2Desc?.trim(),
        stat3Value: input.stat3Value?.trim(),
        stat3Title: input.stat3Title?.trim(),
        stat3Desc: input.stat3Desc?.trim(),
        footerNote: input.footerNote?.trim(),
      });

      await writeBannerAudit(req, {
        action: "cms.results_section.update",
        entityType: "cms_results_section",
        entityId: updated.id,
        beforeJson: before,
        afterJson: updated,
      });
      res.json({ ok: true, data: updated });
    } catch (error: any) {
      console.error("[CMS Results API] admin update failed:", error);
      sendCmsError(res, 400, error?.message || "Failed to update results section");
    }
  });

  app.post("/api/admin/upload", requireAdmin, handleAdminCmsImageUpload);
  app.post("/api/admin/uploads/hero", requireAdmin, handleAdminCmsImageUpload);

  app.get("/api/admin/banners", requireAdmin, async (req: Request, res: Response) => {
    try {
      const placement = placementSchema.parse(req.query.placement || "homepage_hero");
      const banners = await bannerDb.listHomepageHeroBanners();
      console.info("[Banner API] list", {
        placement,
        count: banners.length,
        userId: (req as any).adminUser?.id,
      });
      res.json({
        banners: banners.map(mapBannerForResponse),
      });
    } catch (error: any) {
      console.error("[Banner API] list failed:", error);
      res.status(400).json({ error: error?.message || "Failed to list banners" });
    }
  });

  app.post("/api/admin/banners", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = createBannerSchema.parse(req.body);
      const startAt = parseOptionalDate(parsed.startAt);
      const endAt = parseOptionalDate(parsed.endAt);
      const created = await bannerDb.createHomepageHeroBanner({
        placement: parsed.placement,
        title: parsed.title,
        subtitle: parsed.subtitle,
        buttonText: parsed.buttonText,
        buttonLink: parsed.buttonLink,
        imageUrl: parsed.imageUrl,
        imageUrlDesktop: parsed.imageUrlDesktop,
        imageUrlMobile: parsed.imageUrlMobile,
        cropMeta: parsed.cropMeta,
        status: parsed.status,
        priority: parsed.priority,
        startAt,
        endAt,
      });

      if (!created) {
        res.status(500).json({ error: "Banner was not saved to database" });
        return;
      }

      console.info("[Banner API] created", {
        id: created.id,
        status: created.status,
        userId: (req as any).adminUser?.id,
      });

      await writeBannerAudit(req, {
        action: "banner.create",
        entityType: "banner",
        entityId: created.id,
        afterJson: mapBannerForResponse(created),
      });

      res.status(201).json({ banner: mapBannerForResponse(created) });
    } catch (error: any) {
      console.error("[Banner API] create failed:", error);
      res.status(400).json({ error: error?.message || "Failed to create banner" });
    }
  });

  app.get("/api/admin/banners/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        res.status(400).json({ error: "Invalid banner id" });
        return;
      }

      const banner = await bannerDb.getHomepageHeroBannerById(id);
      if (!banner) {
        res.status(404).json({ error: "Banner not found" });
        return;
      }

      res.json({ banner: mapBannerForResponse(banner) });
    } catch (error: any) {
      console.error("[Banner API] detail failed:", error);
      res.status(400).json({ error: error?.message || "Failed to load banner" });
    }
  });

  app.put("/api/admin/banners/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        res.status(400).json({ error: "Invalid banner id" });
        return;
      }

      const parsed = updateBannerSchema.parse(req.body);
      const before = await bannerDb.getHomepageHeroBannerById(id);
      const updated = await bannerDb.updateHomepageHeroBanner(id, {
        title: parsed.title,
        subtitle: parsed.subtitle,
        buttonText: parsed.buttonText,
        buttonLink: parsed.buttonLink,
        imageUrl: parsed.imageUrl,
        imageUrlDesktop: parsed.imageUrlDesktop,
        imageUrlMobile: parsed.imageUrlMobile,
        cropMeta: parsed.cropMeta,
        status: parsed.status,
        priority: parsed.priority,
        startAt: parsed.startAt !== undefined ? parseOptionalDate(parsed.startAt) : undefined,
        endAt: parsed.endAt !== undefined ? parseOptionalDate(parsed.endAt) : undefined,
      });

      if (!updated) {
        res.status(404).json({ error: "Banner not found or not homepage hero" });
        return;
      }

      console.info("[Banner API] updated", {
        id: updated.id,
        status: updated.status,
        userId: (req as any).adminUser?.id,
      });

      await writeBannerAudit(req, {
        action: "banner.update",
        entityType: "banner",
        entityId: updated.id,
        beforeJson: before ? mapBannerForResponse(before) : null,
        afterJson: mapBannerForResponse(updated),
      });

      res.json({ banner: mapBannerForResponse(updated) });
    } catch (error: any) {
      console.error("[Banner API] update failed:", error);
      res.status(400).json({ error: error?.message || "Failed to update banner" });
    }
  });

  app.post("/api/admin/banners/optimize", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = optimizeImageSchema.parse(req.body);
      const [imageUrlDesktop, imageUrlMobile] = await Promise.all([
        optimizeAndStore(
          parsed.desktopImageData,
          parsed.desktop.width,
          parsed.desktop.height,
          parsed.quality,
          "desktop"
        ),
        optimizeAndStore(
          parsed.mobileImageData,
          parsed.mobile.width,
          parsed.mobile.height,
          parsed.quality,
          "mobile"
        ),
      ]);

      console.info("[Banner API] optimize success", {
        userId: (req as any).adminUser?.id,
        imageUrlDesktop,
        imageUrlMobile,
      });

      res.json({ imageUrlDesktop, imageUrlMobile });
    } catch (error: any) {
      console.error("[Banner API] optimize failed:", error);
      res.status(400).json({ error: error?.message || "Image optimization failed" });
    }
  });

  app.post("/api/admin/banners/:id/publish", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        res.status(400).json({ error: "Invalid banner id" });
        return;
      }

      const parsed = publishSchema.parse(req.body || {});
      const before = await bannerDb.getHomepageHeroBannerById(id);
      const updated = await bannerDb.setHomepageHeroBannerPublishState(id, parsed.status);

      if (!updated) {
        res.status(404).json({ error: "Banner not found or not homepage hero" });
        return;
      }

      console.info("[Banner API] publish toggle", {
        id: updated.id,
        status: updated.status,
        userId: (req as any).adminUser?.id,
      });

      await writeBannerAudit(req, {
        action: "banner.publish_toggle",
        entityType: "banner",
        entityId: updated.id,
        beforeJson: before ? mapBannerForResponse(before) : null,
        afterJson: mapBannerForResponse(updated),
      });

      res.json({ banner: mapBannerForResponse(updated) });
    } catch (error: any) {
      console.error("[Banner API] publish toggle failed:", error);
      res.status(400).json({ error: error?.message || "Failed to update publish status" });
    }
  });

  app.get("/api/public/banners", async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

    try {
      const placement = placementSchema.parse(req.query.placement || "homepage_hero");
      if (placement !== "homepage_hero") {
        res.json({ banner: null });
        return;
      }

      const banner = await bannerDb.getPublishedHomepageHeroBanner();
      console.info("[Banner API] public hero fetch", {
        found: Boolean(banner),
      });

      res.json({ banner: banner ? mapBannerForResponse(banner) : null });
    } catch (error: any) {
      console.error("[Banner API] public fetch failed:", error);
      res.status(400).json({ error: error?.message || "Failed to load public banner" });
    }
  });
}
