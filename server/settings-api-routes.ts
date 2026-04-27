import crypto from "node:crypto";
import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import {
  adminChatbotSettingsUpdateSchema,
  adminUserCreateSchema,
  adminUserUpdateSchema,
  auditLogListQuerySchema,
  settingsPaymentsUpdateSchema,
  settingsStoreUpdateSchema,
  shippingRateCreateSchema,
  shippingRateUpdateSchema,
  shippingZoneCreateSchema,
  shippingZoneUpdateSchema,
  type AdminUserRole,
} from "@shared/admin-settings";
import { createContext } from "./_core/context";
import * as adminSecurity from "./admin-security";
import * as db from "./db";

type AdminRequest = Request & {
  adminUser?: {
    id: number;
    name: string | null;
  };
  adminRole?: db.AdminRole;
};

const legacyUpdateSettingsSchema = z
  .object({
    storeName: z.string().min(1).max(120).optional(),
    storeContact: z.string().min(1).max(120).optional(),
    supportEmail: z.string().email().max(320).optional(),
    footerAddress: z.string().min(1).max(255).optional(),
    storeCurrency: z.string().min(1).max(20).optional(),
    deliveryText: z.string().min(1).max(255).optional(),
    paymentMethodsText: z.string().min(1).max(255).optional(),
    promoActive: z.boolean().optional(),
    promoKicker: z.string().max(120).optional(),
    promoTitle: z.string().max(180).optional(),
    promoSubtitle: z.string().max(300).optional(),
    promoLinkLabel: z.string().max(80).optional(),
    promoLinkHref: z.string().max(1000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one setting field is required.",
  });

const resetPasswordSchema = z.object({
  newPassword: z.string().min(10).max(128).optional(),
});

function sendError(res: Response, statusCode: number, message: string) {
  res.status(statusCode).json({ ok: false, error: message });
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function mapRoleToAdminRole(role: AdminUserRole): db.AdminRole {
  if (role === "admin") return "ADMIN";
  if (role === "manager") return "MANAGER";
  return "STAFF";
}

function mapAdminUserRow(row: any) {
  return {
    id: Number(row.id || row.userId),
    name: row.name || `User #${row.id || row.userId}`,
    email: row.email ?? null,
    phone: row.phone ?? null,
    role: (row.userRole || "editor") as AdminUserRole,
    isActive: Boolean(row.isActive),
    username: row.username ?? null,
    createdAt: toIso(row.createdAt) || new Date().toISOString(),
    lastLoginAt: toIso(row.lastLoginAt || row.lastSignedIn),
  };
}

function getRequestIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim().length > 0) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return req.ip || req.socket.remoteAddress || null;
}

async function writeAudit(
  req: AdminRequest,
  input: {
    action: string;
    entityType: string;
    entityId?: string | number | null;
    beforeJson?: unknown;
    afterJson?: unknown;
  }
) {
  await db.writeAuditLog({
    actorUserId: req.adminUser?.id ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    beforeJson: input.beforeJson,
    afterJson: input.afterJson,
    ip: getRequestIp(req),
    userAgent: req.headers["user-agent"] || null,
  });
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const ctx = await createContext({ req, res } as any);
    const role = await db.getEffectiveAdminRole(ctx.user);
    if (!ctx.user || !role || (role !== "ADMIN" && role !== "MANAGER")) {
      sendError(res, 403, "Admin access required");
      return;
    }
    (req as AdminRequest).adminUser = {
      id: ctx.user.id,
      name: ctx.user.name ?? null,
    };
    (req as AdminRequest).adminRole = role;
    next();
  } catch (error) {
    console.error("[Settings API] auth failed:", error);
    sendError(res, 401, "Authentication failed");
  }
}

function requireAdminOnly(req: Request, res: Response, next: NextFunction) {
  const role = (req as AdminRequest).adminRole;
  if (role !== "ADMIN") {
    sendError(res, 403, "Administrator role required");
    return;
  }
  next();
}

async function persistLegacyMappedSettings(input: z.infer<typeof legacyUpdateSettingsSchema>) {
  const updates: Array<{ key: string; value: string }> = [];

  if (input.storeName !== undefined) updates.push({ key: "store.name", value: input.storeName });
  if (input.storeContact !== undefined) updates.push({ key: "store.contact", value: input.storeContact });
  if (input.supportEmail !== undefined) updates.push({ key: "store.email", value: input.supportEmail });
  if (input.footerAddress !== undefined) updates.push({ key: "store.address", value: input.footerAddress });
  if (input.storeCurrency !== undefined) updates.push({ key: "store.currency", value: input.storeCurrency });
  if (input.deliveryText !== undefined) updates.push({ key: "store.deliveryText", value: input.deliveryText });
  if (input.paymentMethodsText !== undefined) updates.push({ key: "store.paymentMethodsText", value: input.paymentMethodsText });
  if (input.promoActive !== undefined) updates.push({ key: "promo.active", value: String(input.promoActive) });
  if (input.promoKicker !== undefined) updates.push({ key: "promo.kicker", value: input.promoKicker });
  if (input.promoTitle !== undefined) updates.push({ key: "promo.title", value: input.promoTitle });
  if (input.promoSubtitle !== undefined) updates.push({ key: "promo.subtitle", value: input.promoSubtitle });
  if (input.promoLinkLabel !== undefined) updates.push({ key: "promo.linkLabel", value: input.promoLinkLabel });
  if (input.promoLinkHref !== undefined) updates.push({ key: "promo.linkHref", value: input.promoLinkHref });

  await Promise.all(updates.map((item) => db.setStoreSetting(item.key, item.value)));
  return updates.length;
}

export function registerSettingsApiRoutes(app: Express) {
  app.get("/api/settings", async (_req: Request, res: Response) => {
    try {
      const settings = await db.getStorefrontSettings();
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      res.json({ settings });
    } catch (error: any) {
      console.error("[Settings API] public read failed:", error);
      sendError(res, 500, error?.message || "Failed to load settings");
    }
  });

  app.get("/api/admin/settings", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const settings = await db.getStorefrontSettings();
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      res.json({ settings });
    } catch (error: any) {
      console.error("[Settings API] admin read failed:", error);
      sendError(res, 500, error?.message || "Failed to load admin settings");
    }
  });

  app.put("/api/admin/settings", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = legacyUpdateSettingsSchema.parse(req.body || {});
      const updatedCount = await persistLegacyMappedSettings(parsed);
      const settings = await db.getStorefrontSettings();
      res.json({
        success: true,
        updatedCount,
        settings,
      });
    } catch (error: any) {
      console.error("[Settings API] admin update failed:", error);
      sendError(res, 400, error?.message || "Failed to update settings");
    }
  });

  app.get("/api/admin/settings/store", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const data = await db.getAdminSettingsStore();
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      res.json({ ok: true, data });
    } catch (error: any) {
      console.error("[Settings API] store read failed:", error);
      sendError(res, 500, error?.message || "Failed to load store settings");
    }
  });

  app.put("/api/admin/settings/store", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = settingsStoreUpdateSchema.parse(req.body || {});
      const before = await db.getAdminSettingsStore();
      const data = await db.updateAdminSettingsStore(parsed);
      await writeAudit(req as AdminRequest, {
        action: "settings.store.update",
        entityType: "settings_store",
        entityId: "singleton",
        beforeJson: before,
        afterJson: data,
      });
      res.json({ ok: true, data });
    } catch (error: any) {
      console.error("[Settings API] store update failed:", error);
      sendError(res, 400, error?.message || "Failed to update store settings");
    }
  });

  app.get("/api/admin/settings/payments", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const data = await db.getAdminSettingsPayments();
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      res.json({ ok: true, data });
    } catch (error: any) {
      console.error("[Settings API] payments read failed:", error);
      sendError(res, 500, error?.message || "Failed to load payment settings");
    }
  });

  app.put("/api/admin/settings/payments", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = settingsPaymentsUpdateSchema.parse(req.body || {});
      const before = await db.getAdminSettingsPayments();
      const data = await db.updateAdminSettingsPayments(parsed);
      await writeAudit(req as AdminRequest, {
        action: "settings.payments.update",
        entityType: "settings_payments",
        entityId: "singleton",
        beforeJson: before,
        afterJson: data,
      });
      res.json({ ok: true, data });
    } catch (error: any) {
      console.error("[Settings API] payments update failed:", error);
      sendError(res, 400, error?.message || "Failed to update payment settings");
    }
  });

  app.get("/api/admin/settings/chatbot", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const data = await db.getAdminChatbotSettings();
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      res.json({ ok: true, data });
    } catch (error: any) {
      console.error("[Settings API] chatbot read failed:", error);
      sendError(res, 500, error?.message || "Failed to load chatbot settings");
    }
  });

  app.put("/api/admin/settings/chatbot", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = adminChatbotSettingsUpdateSchema.parse(req.body || {});
      const before = await db.getAdminChatbotSettings();
      const data = await db.updateAdminChatbotSettings(parsed);
      await writeAudit(req as AdminRequest, {
        action: "settings.chatbot.update",
        entityType: "settings_chatbot",
        entityId: "singleton",
        beforeJson: before,
        afterJson: data,
      });
      res.json({ ok: true, data });
    } catch (error: any) {
      console.error("[Settings API] chatbot update failed:", error);
      sendError(res, 400, error?.message || "Failed to update chatbot settings");
    }
  });

  app.get("/api/admin/shipping/zones", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const data = await db.listShippingZonesWithRates();
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      res.json({ ok: true, data });
    } catch (error: any) {
      console.error("[Settings API] shipping zones read failed:", error);
      sendError(res, 500, error?.message || "Failed to load shipping zones");
    }
  });

  app.post("/api/admin/shipping/zones", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = shippingZoneCreateSchema.parse(req.body || {});
      const data = await db.createShippingZone(parsed);
      await writeAudit(req as AdminRequest, {
        action: "shipping.zone.create",
        entityType: "shipping_zone",
        entityId: data.id,
        afterJson: data,
      });
      res.status(201).json({ ok: true, data });
    } catch (error: any) {
      console.error("[Settings API] shipping zone create failed:", error);
      sendError(res, 400, error?.message || "Failed to create shipping zone");
    }
  });

  app.put("/api/admin/shipping/zones/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        sendError(res, 400, "Invalid zone id");
        return;
      }
      const parsed = shippingZoneUpdateSchema.parse(req.body || {});
      const before = (await db.listShippingZonesWithRates()).find((zone) => zone.id === id) || null;
      const data = await db.updateShippingZone(id, parsed);
      if (!data) {
        sendError(res, 404, "Shipping zone not found");
        return;
      }
      await writeAudit(req as AdminRequest, {
        action: "shipping.zone.update",
        entityType: "shipping_zone",
        entityId: id,
        beforeJson: before,
        afterJson: data,
      });
      res.json({ ok: true, data });
    } catch (error: any) {
      console.error("[Settings API] shipping zone update failed:", error);
      sendError(res, 400, error?.message || "Failed to update shipping zone");
    }
  });

  app.delete("/api/admin/shipping/zones/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        sendError(res, 400, "Invalid zone id");
        return;
      }
      const before = (await db.listShippingZonesWithRates()).find((zone) => zone.id === id) || null;
      const success = await db.deleteShippingZone(id);
      if (!success) {
        sendError(res, 404, "Shipping zone not found");
        return;
      }
      await writeAudit(req as AdminRequest, {
        action: "shipping.zone.delete",
        entityType: "shipping_zone",
        entityId: id,
        beforeJson: before,
      });
      res.json({ ok: true, data: { success: true } });
    } catch (error: any) {
      console.error("[Settings API] shipping zone delete failed:", error);
      sendError(res, 400, error?.message || "Failed to delete shipping zone");
    }
  });

  app.get("/api/admin/shipping/rates", requireAdmin, async (req: Request, res: Response) => {
    try {
      const zoneId = Number(req.query.zoneId);
      if (!Number.isFinite(zoneId) || zoneId <= 0) {
        sendError(res, 400, "zoneId query parameter is required");
        return;
      }
      const data = await db.listShippingRates(zoneId);
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      res.json({ ok: true, data });
    } catch (error: any) {
      console.error("[Settings API] shipping rates read failed:", error);
      sendError(res, 500, error?.message || "Failed to load shipping rates");
    }
  });

  app.post("/api/admin/shipping/rates", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = shippingRateCreateSchema.parse(req.body || {});
      const data = await db.createShippingRate(parsed);
      await writeAudit(req as AdminRequest, {
        action: "shipping.rate.create",
        entityType: "shipping_rate",
        entityId: data.id,
        afterJson: data,
      });
      res.status(201).json({ ok: true, data });
    } catch (error: any) {
      console.error("[Settings API] shipping rate create failed:", error);
      sendError(res, 400, error?.message || "Failed to create shipping rate");
    }
  });

  app.put("/api/admin/shipping/rates/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        sendError(res, 400, "Invalid rate id");
        return;
      }
      const parsed = shippingRateUpdateSchema.parse(req.body || {});
      const allZones = await db.listShippingZonesWithRates();
      const before = allZones.flatMap((zone) => zone.rates).find((rate) => rate.id === id) || null;
      const data = await db.updateShippingRate(id, parsed);
      if (!data) {
        sendError(res, 404, "Shipping rate not found");
        return;
      }
      await writeAudit(req as AdminRequest, {
        action: "shipping.rate.update",
        entityType: "shipping_rate",
        entityId: id,
        beforeJson: before,
        afterJson: data,
      });
      res.json({ ok: true, data });
    } catch (error: any) {
      console.error("[Settings API] shipping rate update failed:", error);
      sendError(res, 400, error?.message || "Failed to update shipping rate");
    }
  });

  app.delete("/api/admin/shipping/rates/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        sendError(res, 400, "Invalid rate id");
        return;
      }
      const allZones = await db.listShippingZonesWithRates();
      const before = allZones.flatMap((zone) => zone.rates).find((rate) => rate.id === id) || null;
      const success = await db.deleteShippingRate(id);
      if (!success) {
        sendError(res, 404, "Shipping rate not found");
        return;
      }
      await writeAudit(req as AdminRequest, {
        action: "shipping.rate.delete",
        entityType: "shipping_rate",
        entityId: id,
        beforeJson: before,
      });
      res.json({ ok: true, data: { success: true } });
    } catch (error: any) {
      console.error("[Settings API] shipping rate delete failed:", error);
      sendError(res, 400, error?.message || "Failed to delete shipping rate");
    }
  });

  app.get("/api/admin/users", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const users = await db.listAdminUsers(500, 0);
      const data = users.map(mapAdminUserRow);
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      res.json({ ok: true, data });
    } catch (error: any) {
      console.error("[Settings API] users list failed:", error);
      sendError(res, 500, error?.message || "Failed to load users");
    }
  });

  app.post("/api/admin/users", requireAdmin, requireAdminOnly, async (req: Request, res: Response) => {
    try {
      const parsed = adminUserCreateSchema.parse(req.body || {});
      const explicitPassword =
        typeof parsed.password === "string" && parsed.password.trim().length > 0
          ? parsed.password.trim()
          : null;
      if (explicitPassword) {
        const policy = adminSecurity.validatePasswordStrength(explicitPassword);
        if (!policy.ok) {
          sendError(res, 400, policy.message || "Password does not meet security policy.");
          return;
        }
      }
      const inviteCreated = Boolean(parsed.inviteOnly || !explicitPassword);
      const tempPassword = explicitPassword || `SBP-${crypto.randomBytes(5).toString("hex")}`;
      const passwordHash = adminSecurity.hashPassword(tempPassword);
      const data = await db.createAdminPanelUser({
        ...parsed,
        passwordHash,
      });
      await writeAudit(req as AdminRequest, {
        action: "user.create",
        entityType: "user",
        entityId: data.id,
        afterJson: {
          ...data,
          inviteCreated,
          password: "[REDACTED]",
        },
      });
      res.status(201).json({
        ok: true,
        data: {
          ...data,
          inviteCreated,
          tempPassword: inviteCreated ? tempPassword : undefined,
        },
      });
    } catch (error: any) {
      console.error("[Settings API] user create failed:", error);
      sendError(res, 400, error?.message || "Failed to create user");
    }
  });

  app.put("/api/admin/users/:id", requireAdmin, requireAdminOnly, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        sendError(res, 400, "Invalid user id");
        return;
      }
      const parsed = adminUserUpdateSchema.parse(req.body || {});
      const before = await db.getAdminUserById(id);
      if (!before) {
        sendError(res, 404, "User not found");
        return;
      }
      const nextRole = parsed.role || before.role;
      const nextActive = parsed.isActive ?? before.isActive;
      await db.updateAdminUserRole(id, mapRoleToAdminRole(nextRole), nextActive);
      const data = await db.getAdminUserById(id);
      await writeAudit(req as AdminRequest, {
        action: "user.update",
        entityType: "user",
        entityId: id,
        beforeJson: before,
        afterJson: data,
      });
      res.json({ ok: true, data });
    } catch (error: any) {
      console.error("[Settings API] user update failed:", error);
      sendError(res, 400, error?.message || "Failed to update user");
    }
  });

  app.post("/api/admin/users/:id/reset-password", requireAdmin, requireAdminOnly, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        sendError(res, 400, "Invalid user id");
        return;
      }
      const parsed = resetPasswordSchema.parse(req.body || {});
      const target = await db.getAdminUserById(id);
      if (!target) {
        sendError(res, 404, "User not found");
        return;
      }
      const tempPassword = parsed.newPassword || `SBP-${crypto.randomBytes(5).toString("hex")}`;
      if (parsed.newPassword) {
        const policy = adminSecurity.validatePasswordStrength(parsed.newPassword);
        if (!policy.ok) {
          sendError(res, 400, policy.message || "Password does not meet security policy.");
          return;
        }
      }
      const passwordHash = adminSecurity.hashPassword(tempPassword);
      await db.resetAdminUserPasswordHash(id, passwordHash);
      await writeAudit(req as AdminRequest, {
        action: "user.reset_password",
        entityType: "user",
        entityId: id,
        beforeJson: { userId: id },
        afterJson: { userId: id, reset: true },
      });
      res.json({
        ok: true,
        data: {
          userId: id,
          tempPassword,
        },
      });
    } catch (error: any) {
      console.error("[Settings API] user reset-password failed:", error);
      sendError(res, 400, error?.message || "Failed to reset password");
    }
  });

  app.get("/api/admin/audit-logs", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = auditLogListQuerySchema.parse(req.query || {});
      const data = await db.listAuditLogsByCursor(parsed);
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      res.json({ ok: true, data });
    } catch (error: any) {
      console.error("[Settings API] audit logs read failed:", error);
      sendError(res, 400, error?.message || "Failed to load audit logs");
    }
  });
}
