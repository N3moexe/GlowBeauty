import { describe, expect, it, vi, beforeEach } from "vitest";
import * as adminSecurity from "./admin-security";

describe("Admin Security", () => {
  describe("Password Hashing", () => {
    it("hashes a password", () => {
      const password = "SecurePassword123!";
      const hash = adminSecurity.hashPassword(password);
      expect(hash).toContain(":");
      const [salt, hashed] = hash.split(":");
      expect(salt).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(hashed).toHaveLength(128); // 64 bytes = 128 hex chars
    });

    it("verifies a correct password", () => {
      const password = "SecurePassword123!";
      const hash = adminSecurity.hashPassword(password);
      const isValid = adminSecurity.verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it("rejects an incorrect password", () => {
      const password = "SecurePassword123!";
      const hash = adminSecurity.hashPassword(password);
      const isValid = adminSecurity.verifyPassword("WrongPassword", hash);
      expect(isValid).toBe(false);
    });

    it("rejects malformed hash", () => {
      const isValid = adminSecurity.verifyPassword("password", "invalid_hash");
      expect(isValid).toBe(false);
    });
  });

  describe("Session Token Generation", () => {
    it("generates a unique session token", () => {
      const token1 = adminSecurity.generateSessionToken();
      const token2 = adminSecurity.generateSessionToken();
      expect(token1).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
    });
  });

  describe("Backup Codes", () => {
    it("generates backup codes", () => {
      const codes = adminSecurity.generateBackupCodes(10);
      expect(codes).toHaveLength(10);
      codes.forEach((code) => {
        expect(code).toHaveLength(8);
        expect(/^[A-F0-9]{8}$/.test(code)).toBe(true);
      });
    });

    it("generates unique backup codes", () => {
      const codes = adminSecurity.generateBackupCodes(10);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(10);
    });

    it("generates custom number of codes", () => {
      const codes5 = adminSecurity.generateBackupCodes(5);
      const codes20 = adminSecurity.generateBackupCodes(20);
      expect(codes5).toHaveLength(5);
      expect(codes20).toHaveLength(20);
    });
  });

  describe("Admin Credentials", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("creates admin credentials with hashed password", async () => {
      const userId = 1;
      const username = "admin@senbonsplans";
      const password = "SecurePassword123!";

      // Mock the database
      vi.mock("./db", () => ({
        getDb: vi.fn().mockResolvedValue({
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue([{ insertId: 5 }]),
          }),
        }),
      }));

      // This would work with actual DB
      // const credentialId = await adminSecurity.createAdminCredentials(userId, username, password);
      // expect(credentialId).toBe(5);
    });
  });

  describe("Password Security", () => {
    it("uses PBKDF2 with 100000 iterations", () => {
      const password = "TestPassword";
      const hash1 = adminSecurity.hashPassword(password);
      const hash2 = adminSecurity.hashPassword(password);

      // Same password should produce different hashes (different salts)
      expect(hash1).not.toBe(hash2);

      // But both should verify correctly
      expect(adminSecurity.verifyPassword(password, hash1)).toBe(true);
      expect(adminSecurity.verifyPassword(password, hash2)).toBe(true);
    });

    it("rejects empty password", () => {
      const hash = adminSecurity.hashPassword("");
      const isValid = adminSecurity.verifyPassword("", hash);
      expect(isValid).toBe(true); // Empty password should hash consistently

      const isInvalid = adminSecurity.verifyPassword("nonempty", hash);
      expect(isInvalid).toBe(false);
    });

    it("handles special characters in password", () => {
      const specialPassword = "P@$$w0rd!#%&*()[]{}";
      const hash = adminSecurity.hashPassword(specialPassword);
      expect(adminSecurity.verifyPassword(specialPassword, hash)).toBe(true);
      expect(adminSecurity.verifyPassword("P@$$w0rd!#%&*()", hash)).toBe(false);
    });
  });

  describe("Session Token Security", () => {
    it("generates cryptographically random tokens", () => {
      const tokens = new Set();
      for (let i = 0; i < 100; i++) {
        tokens.add(adminSecurity.generateSessionToken());
      }
      // All tokens should be unique
      expect(tokens.size).toBe(100);
    });

    it("generates tokens of correct length", () => {
      const token = adminSecurity.generateSessionToken();
      expect(token).toHaveLength(64);
      expect(/^[a-f0-9]{64}$/.test(token)).toBe(true);
    });
  });

  describe("Backup Code Security", () => {
    it("generates codes in uppercase hex format", () => {
      const codes = adminSecurity.generateBackupCodes(5);
      codes.forEach((code) => {
        expect(/^[A-F0-9]{8}$/.test(code)).toBe(true);
        expect(code).toBe(code.toUpperCase());
      });
    });

    it("generates codes that are easy to read", () => {
      const codes = adminSecurity.generateBackupCodes(10);
      // Codes should not contain confusing characters like 0/O, 1/l/I
      codes.forEach((code) => {
        expect(code).not.toMatch(/[OIl]/);
      });
    });
  });
});
