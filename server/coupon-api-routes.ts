import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import {
  applyCouponRequestSchema,
  cartSyncRequestSchema,
  couponPreviewRequestSchema,
  createCouponSchema,
  removeCouponRequestSchema,
  updateCouponSchema,
  type CouponErrorCode,
} from "@shared/coupons";
import { createContext } from "./_core/context";
import * as db from "./db";
import * as couponService from "./coupon-service";

type AdminRequest = Request & {
  adminUser?: {
    id: number;
    name: string | null;
  };
};

function sendError(res: Response, statusCode: number, message: string) {
  res.status(statusCode).json({ ok: false, error: message });
}

function sendCouponError(
  res: Response,
  statusCode: number,
  code: CouponErrorCode,
  message: string
) {
  res.status(statusCode).json({
    ok: false,
    error: {
      code,
      message,
    },
  });
}

function statusForCouponError(code: CouponErrorCode) {
  if (code === "CART_NOT_FOUND") return 404;
  if (code === "INVALID_CODE") return 404;
  return 400;
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
    next();
  } catch (error) {
    console.error("[Coupon API] admin auth failed:", error);
    sendError(res, 401, "Authentication failed");
  }
}

export function registerCouponApiRoutes(app: Express) {
  app.post("/api/coupons/cart/sync", async (req, res) => {
    try {
      const parsed = cartSyncRequestSchema.parse(req.body || {});
      const summary = await couponService.syncSessionCart({
        sessionId: parsed.sessionId,
        deliveryZoneId: parsed.deliveryZoneId ?? null,
        items: parsed.items,
      });
      console.info("[Coupons] cart.sync", {
        sessionId: parsed.sessionId,
        itemCount: parsed.items.length,
        deliveryZoneId: parsed.deliveryZoneId ?? null,
        total: summary.total,
      });
      res.json({ ok: true, data: summary });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Invalid cart sync payload");
        return;
      }
      console.error("[Coupon API] cart sync failed:", error);
      sendError(res, 400, error?.message || "Failed to sync cart");
    }
  });

  app.get("/api/coupons/cart", async (req, res) => {
    try {
      const query = z.object({ sessionId: z.string().trim().min(8).max(120) }).parse(req.query);
      const summary = await couponService.getSessionCartSummary(query.sessionId);
      if (!summary) {
        sendCouponError(res, 404, "CART_NOT_FOUND", "Cart session not found.");
        return;
      }
      res.json({ ok: true, data: summary });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Invalid cart query");
        return;
      }
      console.error("[Coupon API] cart read failed:", error);
      sendError(res, 500, error?.message || "Failed to read cart");
    }
  });

  app.post("/api/coupons/apply", async (req, res) => {
    try {
      const parsed = applyCouponRequestSchema.parse(req.body || {});
      const result = await couponService.applyCouponToSessionCart({
        sessionId: parsed.sessionId,
        code: parsed.code,
        shippingFee: parsed.shippingFee,
      });
      console.info("[Coupons] apply", {
        sessionId: parsed.sessionId,
        code: parsed.code.trim().toUpperCase(),
        ok: result.validation.ok,
        errorCode: result.validation.code || null,
        discountAmount: result.validation.discountAmount,
      });
      if (!result.validation.ok) {
        const code = result.validation.code || "INVALID_CODE";
        sendCouponError(
          res,
          statusForCouponError(code),
          code,
          result.validation.message
        );
        return;
      }
      res.json({
        ok: true,
        data: {
          ...result.summary,
          coupon: result.validation.coupon,
          message: result.validation.message,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Invalid coupon apply payload");
        return;
      }
      console.error("[Coupon API] apply failed:", error);
      sendError(res, 500, error?.message || "Failed to apply coupon");
    }
  });

  app.post("/api/coupons/remove", async (req, res) => {
    try {
      const parsed = removeCouponRequestSchema.parse(req.body || {});
      const summary = await couponService.removeCouponFromSessionCart(parsed.sessionId);
      console.info("[Coupons] remove", {
        sessionId: parsed.sessionId,
        removed: Boolean(summary),
      });
      if (!summary) {
        sendCouponError(res, 404, "CART_NOT_FOUND", "Cart session not found.");
        return;
      }
      res.json({ ok: true, data: summary });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Invalid coupon remove payload");
        return;
      }
      console.error("[Coupon API] remove failed:", error);
      sendError(res, 500, error?.message || "Failed to remove coupon");
    }
  });

  app.post("/api/coupons/preview", async (req, res) => {
    try {
      const parsed = couponPreviewRequestSchema.parse(req.body || {});
      const result = await couponService.previewCouponForSessionCart({
        sessionId: parsed.sessionId,
        code: parsed.code,
        shippingFee: parsed.shippingFee,
      });
      console.info("[Coupons] preview", {
        sessionId: parsed.sessionId,
        code: parsed.code.trim().toUpperCase(),
        ok: result.validation.ok,
        errorCode: result.validation.code || null,
        discountAmount: result.validation.discountAmount,
      });
      if (!result.validation.ok) {
        const code = result.validation.code || "INVALID_CODE";
        sendCouponError(
          res,
          statusForCouponError(code),
          code,
          result.validation.message
        );
        return;
      }
      res.json({
        ok: true,
        data: {
          ...result.summary,
          coupon: result.validation.coupon,
          message: result.validation.message,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Invalid coupon preview payload");
        return;
      }
      console.error("[Coupon API] preview failed:", error);
      sendError(res, 500, error?.message || "Failed to preview coupon");
    }
  });

  app.get("/api/admin/coupons", requireAdmin, async (req, res) => {
    try {
      const query = z
        .object({
          limit: z.coerce.number().int().min(1).max(500).default(200),
        })
        .parse(req.query || {});
      const data = await couponService.listAdminCoupons(query.limit);
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      res.json({ ok: true, data });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Invalid coupons query");
        return;
      }
      console.error("[Coupon API] admin list failed:", error);
      sendError(res, 500, error?.message || "Failed to load coupons");
    }
  });

  app.post("/api/admin/coupons", requireAdmin, async (req, res) => {
    try {
      const parsed = createCouponSchema.parse(req.body || {});
      const data = await couponService.createAdminCoupon(parsed);
      await writeAudit(req as AdminRequest, {
        action: "coupon.create",
        entityType: "coupon",
        entityId: data.id,
        afterJson: data,
      });
      res.status(201).json({ ok: true, data });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Invalid coupon payload");
        return;
      }
      console.error("[Coupon API] admin create failed:", error);
      sendError(res, 400, error?.message || "Failed to create coupon");
    }
  });

  app.put("/api/admin/coupons/:id", requireAdmin, async (req, res) => {
    try {
      const id = String(req.params.id || "").trim();
      if (!id) {
        sendError(res, 400, "Invalid coupon id");
        return;
      }
      const payload = updateCouponSchema.parse(req.body || {});
      const before = await couponService.listAdminCoupons(500).then((rows) => rows.find((row) => row.id === id) || null);
      const data = await couponService.updateAdminCoupon(id, payload);
      await writeAudit(req as AdminRequest, {
        action: "coupon.update",
        entityType: "coupon",
        entityId: id,
        beforeJson: before,
        afterJson: data,
      });
      res.json({ ok: true, data });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Invalid coupon update payload");
        return;
      }
      console.error("[Coupon API] admin update failed:", error);
      sendError(res, 400, error?.message || "Failed to update coupon");
    }
  });

  app.delete("/api/admin/coupons/:id", requireAdmin, async (req, res) => {
    try {
      const id = String(req.params.id || "").trim();
      if (!id) {
        sendError(res, 400, "Invalid coupon id");
        return;
      }
      const before = await couponService.listAdminCoupons(500).then((rows) => rows.find((row) => row.id === id) || null);
      const data = await couponService.deactivateAdminCoupon(id);
      await writeAudit(req as AdminRequest, {
        action: "coupon.deactivate",
        entityType: "coupon",
        entityId: id,
        beforeJson: before,
        afterJson: data,
      });
      res.json({ ok: true, data: { success: true, coupon: data } });
    } catch (error: any) {
      console.error("[Coupon API] admin delete failed:", error);
      sendError(res, 400, error?.message || "Failed to deactivate coupon");
    }
  });
}
