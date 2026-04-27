import { describe, expect, it, vi } from "vitest";
import { uploadProductImage, validateImageFile } from "./image-upload";

// Mock the storage module
vi.mock("./storage", () => ({
  storagePut: vi.fn(async (key: string, data: Buffer, contentType: string) => ({
    key,
    url: `https://cdn.example.com/${key}`,
  })),
}));

describe("Image Upload Service", () => {
  describe("validateImageFile", () => {
    it("should validate correct image files", () => {
      const buffer = Buffer.from("fake image data");
      const result = validateImageFile(buffer, "test.jpg", 5);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject oversized files", () => {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
      const result = validateImageFile(largeBuffer, "test.jpg", 5);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("moins de 5MB");
    });

    it("should reject unsupported file formats", () => {
      const buffer = Buffer.from("fake image data");
      const result = validateImageFile(buffer, "test.txt", 5);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Format non supporte");
    });

    it("should accept PNG, WebP, and JPEG formats", () => {
      const buffer = Buffer.from("fake image data");
      
      expect(validateImageFile(buffer, "test.png", 5).valid).toBe(true);
      expect(validateImageFile(buffer, "test.webp", 5).valid).toBe(true);
      expect(validateImageFile(buffer, "test.jpeg", 5).valid).toBe(true);
    });
  });

  describe("uploadProductImage", () => {
    it("should upload image and return S3 URL", async () => {
      const buffer = Buffer.from("fake image data");
      const url = await uploadProductImage(buffer, "test-product.jpg", "image/jpeg");
      
      expect(url).toContain("https://cdn.example.com/products/");
      expect(url).toContain("test-product.jpg");
    });

    it("should generate unique S3 keys for same filename", async () => {
      const buffer = Buffer.from("fake image data");
      const url1 = await uploadProductImage(buffer, "product.jpg", "image/jpeg");
      const url2 = await uploadProductImage(buffer, "product.jpg", "image/jpeg");
      
      expect(url1).not.toBe(url2);
    });

    it("should sanitize file names", async () => {
      const buffer = Buffer.from("fake image data");
      const url = await uploadProductImage(
        buffer,
        "My Product Image @#$.jpg",
        "image/jpeg"
      );
      
      expect(url).toContain("my-product-image");
      expect(url).not.toContain("@");
      expect(url).not.toContain("#");
    });
  });
});
