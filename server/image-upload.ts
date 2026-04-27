// Image upload service using S3 storage
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storagePut } from "./storage";
import { ENV } from "./_core/env";

// Anchor the dev fallback to this source file's location so the uploads dir
// resolves correctly regardless of where the process was launched from.
const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

/**
 * Upload an image to S3 storage
 * @param fileBuffer The image file buffer
 * @param fileName The original file name
 * @param contentType The MIME type of the image
 * @returns The S3 URL of the uploaded image
 */
export async function uploadProductImage(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string = "image/jpeg"
): Promise<string> {
  // Generate a unique key for the image
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  const cleanFileName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/-+/g, "-");

  const s3Key = `products/${timestamp}-${randomId}-${cleanFileName}`;

  try {
    const { url } = await storagePut(s3Key, fileBuffer, contentType);
    return url;
  } catch (error) {
    // Local/dev fallback when storage proxy is not configured: write the file
    // to client/public/uploads so Vite serves it at /uploads/<name>. Returning
    // a base64 data URL would blow past the 2000-char limit on settings like
    // store.logo and break the save flow.
    if (!ENV.isProduction) {
      const uploadsDir = path.join(PROJECT_ROOT, "client", "public", "uploads");
      await fs.mkdir(uploadsDir, { recursive: true });
      const localName = s3Key.split("/").pop() ?? `${Date.now()}-image`;
      await fs.writeFile(path.join(uploadsDir, localName), fileBuffer);
      return `/uploads/${localName}`;
    }

    console.error("[Image Upload] Failed to upload image:", error);
    throw new Error("Erreur lors de l'upload de l'image. Veuillez reessayer.");
  }
}

/**
 * Validate image file
 * @param fileBuffer The image file buffer
 * @param fileName The file name
 * @param maxSizeMB Maximum file size in MB
 */
export function validateImageFile(
  fileBuffer: Buffer,
  fileName: string,
  maxSizeMB: number = 5
): { valid: boolean; error?: string } {
  // Check file size
  const sizeMB = fileBuffer.length / (1024 * 1024);
  if (sizeMB > maxSizeMB) {
    return {
      valid: false,
      error: `L'image doit faire moins de ${maxSizeMB}MB. Taille actuelle: ${sizeMB.toFixed(2)}MB`,
    };
  }

  // Check file extension
  const validExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"];
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf("."));
  if (!validExtensions.includes(ext)) {
    return {
      valid: false,
      error: "Format non supporte. Utilisez JPG, PNG, WebP, GIF ou BMP.",
    };
  }

  return { valid: true };
}
