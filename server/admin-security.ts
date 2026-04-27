import crypto from "crypto";
import { and, eq, lt } from "drizzle-orm";
import { getDb } from "./db";
import { adminCredentials, adminSessions, twoFactorBackupCodes } from "../drizzle/schema";

const ENABLE_LOCAL_ADMIN_FALLBACK =
  process.env.ENABLE_LOCAL_ADMIN_FALLBACK === "true";
const LOCAL_ADMIN_USERNAME = process.env.LOCAL_ADMIN_USERNAME;
const LOCAL_ADMIN_PASSWORD = process.env.LOCAL_ADMIN_PASSWORD;
const ALLOW_LOCAL_ADMIN_FALLBACK =
  ENABLE_LOCAL_ADMIN_FALLBACK &&
  process.env.NODE_ENV !== "production" &&
  Boolean(LOCAL_ADMIN_USERNAME) &&
  Boolean(LOCAL_ADMIN_PASSWORD);

type LocalAdminCredential = {
  id: number;
  userId: number;
  username: string;
  passwordHash: string;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  createdAt: Date;
  updatedAt: Date;
};

let localAdminCredential: LocalAdminCredential | null = ALLOW_LOCAL_ADMIN_FALLBACK
  ? {
      id: 1,
      userId: 1,
      username: LOCAL_ADMIN_USERNAME!,
      passwordHash: hashPassword(LOCAL_ADMIN_PASSWORD!),
      twoFactorEnabled: false,
      twoFactorSecret: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  : null;

export function getLocalAdminFallbackCredentials(username: string) {
  if (!ALLOW_LOCAL_ADMIN_FALLBACK || !localAdminCredential) return undefined;
  if (username !== localAdminCredential.username) return undefined;
  return localAdminCredential;
}

const localAdminSessions = new Map<
  string,
  {
    id: number;
    adminCredentialId: number;
    sessionToken: string;
    twoFactorVerified: boolean;
    expiresAt: Date;
    createdAt: Date;
  }
>();

const localTwoFactorBackupCodes = new Map<
  number,
  Array<{ code: string; used: boolean; usedAt: Date | null }>
>();

type LoginAttemptState = {
  failures: number;
  lockedUntil: number;
};

const loginAttemptBuckets = new Map<string, LoginAttemptState>();
const LOGIN_LOCK_THRESHOLD = 8;
const LOGIN_LOCK_WINDOW_MS = 15 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 10;

function normalizeUsernameForLockout(username: string) {
  return username.trim().toLowerCase();
}

export function validatePasswordStrength(password: string): {
  ok: boolean;
  message?: string;
} {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (!/[a-z]/.test(password)) {
    return { ok: false, message: "Password must include at least one lowercase letter." };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, message: "Password must include at least one uppercase letter." };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, message: "Password must include at least one number." };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { ok: false, message: "Password must include at least one special character." };
  }
  return { ok: true };
}

export function getLoginLockState(username: string): {
  locked: boolean;
  retryAfterSeconds: number;
} {
  const key = normalizeUsernameForLockout(username);
  const state = loginAttemptBuckets.get(key);
  if (!state) {
    return { locked: false, retryAfterSeconds: 0 };
  }
  const now = Date.now();
  if (state.lockedUntil > now) {
    return {
      locked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((state.lockedUntil - now) / 1000)),
    };
  }
  if (state.lockedUntil > 0 && state.lockedUntil <= now) {
    loginAttemptBuckets.delete(key);
  }
  return { locked: false, retryAfterSeconds: 0 };
}

export function recordFailedLoginAttempt(username: string) {
  const key = normalizeUsernameForLockout(username);
  const now = Date.now();
  const current = loginAttemptBuckets.get(key);
  if (!current) {
    loginAttemptBuckets.set(key, { failures: 1, lockedUntil: 0 });
    return;
  }

  if (current.lockedUntil > 0 && current.lockedUntil <= now) {
    // Previous lock expired: start a new counting window.
    loginAttemptBuckets.set(key, { failures: 1, lockedUntil: 0 });
    return;
  }

  const failures = current.failures + 1;
  const lockedUntil = failures >= LOGIN_LOCK_THRESHOLD ? now + LOGIN_LOCK_WINDOW_MS : 0;
  loginAttemptBuckets.set(key, { failures, lockedUntil });
}

export function clearFailedLoginAttempts(username: string) {
  const key = normalizeUsernameForLockout(username);
  loginAttemptBuckets.delete(key);
}

/**
 * Hash a password using PBKDF2
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha256")
    .toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Constant-time comparison of two strings. Returns false if the lengths differ.
 * Used for password hashes, TOTP codes, and backup codes so a remote attacker
 * cannot learn the secret byte-by-byte by measuring response latency.
 */
function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(password: string, hash: string): boolean {
  const [salt, storedHash] = hash.split(":");
  if (!salt || !storedHash) return false;
  const testHash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha256")
    .toString("hex");
  return timingSafeEqualStr(testHash, storedHash);
}

/**
 * Generate a random session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Generate backup codes for 2FA (10 codes of 8 characters each)
 */
export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase()
      .substring(0, 8);
    codes.push(code);
  }
  return codes;
}

/**
 * Generate a TOTP secret (base64-encoded random bytes)
 */
export function generateTwoFactorSecret(): string {
  return crypto.randomBytes(32).toString("base64");
}

function getTotpCode(secret: Buffer, unixStep: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(unixStep));

  const hmac = crypto
    .createHmac("sha1", secret)
    .update(counterBuffer)
    .digest();

  const offset = hmac[hmac.length - 1] & 0x0f;
  const binaryCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binaryCode % 1_000_000).padStart(6, "0");
}

function verifyTotpCodeForSecret(secretBase64: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;

  let secret: Buffer;
  try {
    secret = Buffer.from(secretBase64, "base64");
  } catch {
    return false;
  }
  if (!secret.length) return false;

  const nowStep = Math.floor(Date.now() / 30_000);
  // Allow a +/-1 step window to absorb minor clock skew. Use a timing-safe
  // compare so the TOTP window can't be probed one digit at a time.
  let matched = false;
  for (let stepOffset = -1; stepOffset <= 1; stepOffset++) {
    if (timingSafeEqualStr(getTotpCode(secret, nowStep + stepOffset), code)) {
      matched = true;
    }
  }
  return matched;
}

/**
 * Create admin credentials for a user
 */
export async function createAdminCredentials(
  userId: number,
  username: string,
  password: string
): Promise<number> {
  const strength = validatePasswordStrength(password);
  if (!strength.ok) {
    throw new Error(strength.message || "Password does not meet complexity policy.");
  }

  const db = await getDb();
  if (!db) {
    if (!ALLOW_LOCAL_ADMIN_FALLBACK) {
      throw new Error(
        "Database not available and local admin fallback is disabled"
      );
    }
    const existing = localAdminCredential;
    localAdminCredential = {
      id: existing?.id ?? 1,
      userId,
      username,
      passwordHash: hashPassword(password),
      twoFactorEnabled: existing?.twoFactorEnabled ?? false,
      twoFactorSecret: existing?.twoFactorSecret ?? null,
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
    };
    return localAdminCredential.id;
  }

  const passwordHash = hashPassword(password);
  const result = await db.insert(adminCredentials).values({
    userId,
    username,
    passwordHash,
  });
  return result[0].insertId;
}

/**
 * Get admin credentials by username
 */
export async function getAdminCredentialsByUsername(username: string) {
  const db = await getDb();
  if (!db) {
    return localAdminCredential && username === localAdminCredential.username
      ? localAdminCredential
      : undefined;
  }
  const result = await db
    .select()
    .from(adminCredentials)
    .where(eq(adminCredentials.username, username))
    .limit(1);

  if (result[0]) return result[0];

  if (
    ALLOW_LOCAL_ADMIN_FALLBACK &&
    localAdminCredential &&
    username === localAdminCredential.username
  ) {
    return localAdminCredential;
  }

  return undefined;
}

/**
 * Get admin credentials by user ID
 */
export async function getAdminCredentialsByUserId(userId: number) {
  const db = await getDb();
  if (!db) {
    return localAdminCredential && userId === localAdminCredential.userId
      ? localAdminCredential
      : undefined;
  }
  const result = await db
    .select()
    .from(adminCredentials)
    .where(eq(adminCredentials.userId, userId))
    .limit(1);

  if (result[0]) return result[0];

  if (
    ALLOW_LOCAL_ADMIN_FALLBACK &&
    localAdminCredential &&
    userId === localAdminCredential.userId
  ) {
    return localAdminCredential;
  }

  return undefined;
}

/**
 * Update admin password
 */
export async function updateAdminPassword(
  adminCredentialId: number,
  newPassword: string
): Promise<void> {
  const strength = validatePasswordStrength(newPassword);
  if (!strength.ok) {
    throw new Error(strength.message || "Password does not meet complexity policy.");
  }

  const db = await getDb();
  if (!db) {
    if (!localAdminCredential || adminCredentialId !== localAdminCredential.id)
      return;
    localAdminCredential = {
      ...localAdminCredential,
      passwordHash: hashPassword(newPassword),
      updatedAt: new Date(),
    };
    return;
  }

  const passwordHash = hashPassword(newPassword);
  await db
    .update(adminCredentials)
    .set({ passwordHash })
    .where(eq(adminCredentials.id, adminCredentialId));
}

/**
 * Enable 2FA for an admin account and return backup codes
 */
export async function enableTwoFactor(
  adminCredentialId: number,
  secret: string
): Promise<string[]> {
  const db = await getDb();
  if (!db) {
    if (!localAdminCredential || localAdminCredential.id !== adminCredentialId) {
      throw new Error("Admin credential not found");
    }

    localAdminCredential = {
      ...localAdminCredential,
      twoFactorEnabled: true,
      twoFactorSecret: secret,
      updatedAt: new Date(),
    };

    const backupCodes = generateBackupCodes();
    localTwoFactorBackupCodes.set(
      adminCredentialId,
      backupCodes.map((code) => ({ code, used: false, usedAt: null }))
    );
    return backupCodes;
  }

  const backupCodes = generateBackupCodes();

  // Update admin credentials to enable 2FA
  await db
    .update(adminCredentials)
    .set({ twoFactorEnabled: true, twoFactorSecret: secret })
    .where(eq(adminCredentials.id, adminCredentialId));

  // Insert backup codes
  await db.insert(twoFactorBackupCodes).values(
    backupCodes.map((code) => ({
      adminCredentialId,
      code,
    }))
  );

  return backupCodes;
}

/**
 * Disable 2FA for an admin account
 */
export async function disableTwoFactor(
  adminCredentialId: number
): Promise<void> {
  const db = await getDb();
  if (!db) {
    if (!localAdminCredential || localAdminCredential.id !== adminCredentialId) return;
    localAdminCredential = {
      ...localAdminCredential,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      updatedAt: new Date(),
    };
    localTwoFactorBackupCodes.delete(adminCredentialId);
    return;
  }

  await db
    .update(adminCredentials)
    .set({ twoFactorEnabled: false, twoFactorSecret: null })
    .where(eq(adminCredentials.id, adminCredentialId));

  // Delete all backup codes
  await db
    .delete(twoFactorBackupCodes)
    .where(eq(twoFactorBackupCodes.adminCredentialId, adminCredentialId));
}

/**
 * Verify and use a backup code
 */
export async function verifyAndUseBackupCode(
  adminCredentialId: number,
  code: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    const codes = localTwoFactorBackupCodes.get(adminCredentialId);
    if (!codes) return false;
    // Timing-safe scan: always compare against every unused code so the time
    // we take is independent of which (if any) code matched.
    let matched: typeof codes[number] | null = null;
    for (const item of codes) {
      if (item.used) continue;
      if (timingSafeEqualStr(item.code, code) && !matched) {
        matched = item;
      }
    }
    if (!matched) return false;
    matched.used = true;
    matched.usedAt = new Date();
    return true;
  }

  // Fetch all unused codes for this admin and scan in constant time.
  const candidates = await db
    .select()
    .from(twoFactorBackupCodes)
    .where(
      and(
        eq(twoFactorBackupCodes.adminCredentialId, adminCredentialId),
        eq(twoFactorBackupCodes.used, false)
      )
    );

  let match: typeof candidates[number] | null = null;
  for (const candidate of candidates) {
    if (timingSafeEqualStr(candidate.code, code) && !match) {
      match = candidate;
    }
  }
  if (!match) return false;

  // Mark code as used
  await db
    .update(twoFactorBackupCodes)
    .set({ used: true, usedAt: new Date() })
    .where(eq(twoFactorBackupCodes.id, match.id));

  return true;
}

export async function getAdminCredentialById(adminCredentialId: number) {
  const db = await getDb();
  if (!db) {
    if (localAdminCredential?.id === adminCredentialId) {
      return localAdminCredential;
    }
    return undefined;
  }

  const result = await db
    .select()
    .from(adminCredentials)
    .where(eq(adminCredentials.id, adminCredentialId))
    .limit(1);

  return result[0];
}

export async function verifyTotpCode(
  adminCredentialId: number,
  code: string
): Promise<boolean> {
  const credential = await getAdminCredentialById(adminCredentialId);
  if (!credential || !credential.twoFactorEnabled || !credential.twoFactorSecret) {
    return false;
  }
  return verifyTotpCodeForSecret(credential.twoFactorSecret, code);
}

/**
 * Create an admin session
 */
export async function createAdminSession(
  adminCredentialId: number,
  twoFactorVerified: boolean = false,
  expirationHours: number = 24
): Promise<string> {
  const db = await getDb();

  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);

  if (!db) {
    localAdminSessions.set(sessionToken, {
      id: Date.now(),
      adminCredentialId,
      sessionToken,
      twoFactorVerified,
      expiresAt,
      createdAt: new Date(),
    });
    return sessionToken;
  }

  await db.insert(adminSessions).values({
    adminCredentialId,
    sessionToken,
    twoFactorVerified,
    expiresAt,
  });

  return sessionToken;
}

/**
 * Get admin session by token
 */
export async function getAdminSessionByToken(sessionToken: string) {
  const db = await getDb();
  if (!db) {
    const session = localAdminSessions.get(sessionToken);
    if (!session) return undefined;
    if (session.expiresAt < new Date()) {
      localAdminSessions.delete(sessionToken);
      return undefined;
    }
    return session;
  }

  const result = await db
    .select()
    .from(adminSessions)
    .where(eq(adminSessions.sessionToken, sessionToken))
    .limit(1);

  if (!result[0]) return undefined;

  // Check if session is expired
  if (result[0].expiresAt < new Date()) {
    await db
      .delete(adminSessions)
      .where(eq(adminSessions.id, result[0].id));
    return undefined;
  }

  return result[0];
}

/**
 * Verify 2FA for a session
 */
export async function verifySessionTwoFactor(
  sessionToken: string
): Promise<void> {
  const db = await getDb();
  if (!db) {
    const session = localAdminSessions.get(sessionToken);
    if (!session) return;
    localAdminSessions.set(sessionToken, {
      ...session,
      twoFactorVerified: true,
    });
    return;
  }

  await db
    .update(adminSessions)
    .set({ twoFactorVerified: true })
    .where(eq(adminSessions.sessionToken, sessionToken));
}

/**
 * Invalidate an admin session
 */
export async function invalidateAdminSession(sessionToken: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    localAdminSessions.delete(sessionToken);
    return;
  }

  await db
    .delete(adminSessions)
    .where(eq(adminSessions.sessionToken, sessionToken));
}

/**
 * Clean up expired admin sessions
 */
export async function cleanupExpiredSessions(): Promise<void> {
  const db = await getDb();
  if (!db) {
    const now = new Date();
    localAdminSessions.forEach((session, token) => {
      if (session.expiresAt < now) {
        localAdminSessions.delete(token);
      }
    });
    return;
  }

  await db
    .delete(adminSessions)
    .where(lt(adminSessions.expiresAt, new Date()));
}
