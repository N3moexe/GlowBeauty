import type { Express, NextFunction, Request, Response } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { createContext } from "./_core/context";
import * as db from "./db";

const analyticsOverviewQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

const analyticsEventSchema = z.object({
  type: z.enum(["page_view", "add_to_cart", "checkout_start", "purchase"]),
  path: z.string().trim().min(1).max(500),
  meta: z.record(z.string(), z.unknown()).optional(),
  sessionId: z.string().trim().min(8).max(100).optional(),
});

function buildSessionId() {
  return crypto.randomBytes(16).toString("hex");
}

function sendError(res: Response, status: number, message: string) {
  res.status(status).json({ ok: false, error: message });
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const ctx = await createContext({ req, res } as any);
    const role = await db.getEffectiveAdminRole(ctx.user);

    if (!ctx.user || !role || (role !== "ADMIN" && role !== "MANAGER")) {
      sendError(res, 403, "Admin access required");
      return;
    }

    (req as any).adminUser = ctx.user;
    next();
  } catch (error) {
    console.error("[Analytics API] auth failed:", error);
    sendError(res, 401, "Authentication failed");
  }
}

export function registerAnalyticsApiRoutes(app: Express) {
  app.get("/api/admin/analytics/overview", requireAdmin, async (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

    try {
      const query = analyticsOverviewQuerySchema.parse(req.query || {});
      const days = query.days;
      const overview = await db.getAdminAnalyticsOverview(days);
      const data = {
        rangeDays: overview.rangeDays,
        revenue: overview.revenue,
        orders: overview.orders,
        customers: overview.customers,
        aov: overview.aov,
        conversionRate: overview.conversionRate,
        bestSellers: overview.bestSellers,
        ordersByStatus: overview.ordersByStatus,
        revenueSeries: overview.revenueSeries,
        lowStock: overview.lowStock,
        failedPayments: overview.failedPayments,
        recentOrders: overview.recentOrders,
        topCustomers: overview.topCustomers,
      };
      res.json({
        ok: true,
        data,
        ...data,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Invalid analytics query payload");
        return;
      }
      console.error("[Analytics API] overview failed:", error);
      sendError(res, 500, error?.message || "Failed to load analytics overview");
    }
  });

  app.post("/api/analytics/event", async (req, res) => {
    try {
      const parsed = analyticsEventSchema.parse(req.body || {});
      const ctx = await createContext({ req, res } as any);
      const sessionId = parsed.sessionId || req.headers["x-session-id"]?.toString() || buildSessionId();

      await db.recordAnalyticsEvent({
        type: parsed.type,
        sessionId,
        userId: ctx.user?.id || null,
        path: parsed.path,
        meta: parsed.meta || null,
      });

      res.json({ ok: true, sessionId });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Invalid analytics event payload");
        return;
      }
      console.error("[Analytics API] event write failed:", error);
      sendError(res, 500, error?.message || "Failed to record analytics event");
    }
  });
}
