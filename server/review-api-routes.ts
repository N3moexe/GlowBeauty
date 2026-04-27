import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import {
  adminReviewUpdateSchema,
  adminReviewsQuerySchema,
  createReviewSchema,
  publicProductReviewsQuerySchema,
  reviewReplyCreateSchema,
} from "@shared/reviews";
import { createContext } from "./_core/context";
import * as db from "./db";

type AdminRequest = Request & {
  adminUser?: {
    id: number;
    name: string | null;
  };
};

const reviewWriteBuckets = new Map<string, { count: number; resetAt: number }>();

function sendError(res: Response, statusCode: number, message: string) {
  res.status(statusCode).json({ ok: false, error: message });
}

function getRequestIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim().length > 0) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return req.ip || req.socket.remoteAddress || null;
}

function isReviewSubmissionAllowed(req: Request) {
  const now = Date.now();
  const key = `${getRequestIp(req) || "unknown"}:${req.path}`;
  const bucket = reviewWriteBuckets.get(key);
  const windowMs = 10 * 60 * 1000;
  const max = 8;

  if (!bucket || now > bucket.resetAt) {
    reviewWriteBuckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  bucket.count += 1;
  return bucket.count <= max;
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
    console.error("[Review API] admin auth failed:", error);
    sendError(res, 401, "Authentication failed");
  }
}

async function writeReviewAudit(
  req: AdminRequest,
  input: {
    action: string;
    entityType: string;
    entityId?: string | number | null;
    beforeJson?: unknown;
    afterJson?: unknown;
  }
) {
  try {
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
  } catch (error) {
    console.error("[Review API] Failed to write audit log:", error);
  }
}

function parseReviewId(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    sendError(res, 400, "Invalid review id");
    return null;
  }
  return id;
}

export function registerReviewApiRoutes(app: Express) {
  app.post("/api/reviews", async (req: Request, res: Response) => {
    if (!isReviewSubmissionAllowed(req)) {
      sendError(res, 429, "Too many review submissions. Please try again later.");
      return;
    }

    try {
      const parsed = createReviewSchema.parse(req.body || {});
      if (parsed.honeypot && parsed.honeypot.trim().length > 0) {
        sendError(res, 400, "Invalid review payload.");
        return;
      }

      const product = await db.getProductById(parsed.productId);
      if (!product) {
        sendError(res, 404, "Product not found");
        return;
      }

      let isVerifiedPurchase = false;
      if (parsed.orderId) {
        const order = await db.getOrderById(parsed.orderId);
        if (order?.items?.some((item: any) => Number(item.productId) === parsed.productId)) {
          isVerifiedPurchase = true;
        }
      }

      const review = await db.createReviewRecord({
        productId: parsed.productId,
        orderId: parsed.orderId ?? null,
        customerName: parsed.customerName,
        customerEmail: parsed.customerEmail || null,
        rating: parsed.rating,
        title: parsed.title || null,
        body: parsed.body,
        images: parsed.images || [],
        status: "pending",
        isVerifiedPurchase,
      });

      res.status(201).json({ ok: true, data: review });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Invalid review payload");
        return;
      }
      console.error("[Review API] create failed:", error);
      sendError(res, 500, error?.message || "Failed to submit review");
    }
  });

  app.get("/api/products/:id/reviews", async (req: Request, res: Response) => {
    try {
      const productId = Number(req.params.id);
      if (!Number.isFinite(productId) || productId <= 0) {
        sendError(res, 400, "Invalid product id");
        return;
      }

      const query = publicProductReviewsQuerySchema.parse(req.query || {});
      const [summary, listing] = await Promise.all([
        db.getProductReviewSummary(productId),
        db.listApprovedProductReviewsByCursor({
          productId,
          limit: query.limit,
          cursor: query.cursor ?? null,
        }),
      ]);

      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      res.json({
        ok: true,
        data: {
          summary,
          reviews: listing.reviews,
          nextCursor: listing.nextCursor,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Invalid query parameters");
        return;
      }
      console.error("[Review API] public list failed:", error);
      sendError(res, 500, error?.message || "Failed to load reviews");
    }
  });

  app.get("/api/admin/reviews", requireAdmin, async (req: Request, res: Response) => {
    try {
      const query = adminReviewsQuerySchema.parse(req.query || {});
      const data = await db.listAdminReviewsByCursor(query);
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      res.json({ ok: true, data });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Invalid query parameters");
        return;
      }
      console.error("[Review API] admin list failed:", error);
      sendError(res, 500, error?.message || "Failed to load admin reviews");
    }
  });

  app.patch("/api/admin/reviews/:id", requireAdmin, async (req: Request, res: Response) => {
    const reviewId = parseReviewId(req, res);
    if (!reviewId) return;

    try {
      const payload = adminReviewUpdateSchema.parse(req.body || {});
      const before = await db.getReviewByIdRaw(reviewId);
      if (!before) {
        sendError(res, 404, "Review not found");
        return;
      }

      const updated = await db.updateReviewById(reviewId, payload);
      if (!updated) {
        sendError(res, 404, "Review not found");
        return;
      }

      const action =
        payload.status !== undefined
          ? `review.status.${payload.status}`
          : "review.content.update";

      await writeReviewAudit(req as AdminRequest, {
        action,
        entityType: "review",
        entityId: reviewId,
        beforeJson: before,
        afterJson: updated,
      });

      res.json({ ok: true, data: updated });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Invalid review update payload");
        return;
      }
      console.error("[Review API] update failed:", error);
      sendError(res, 500, error?.message || "Failed to update review");
    }
  });

  app.delete("/api/admin/reviews/:id", requireAdmin, async (req: Request, res: Response) => {
    const reviewId = parseReviewId(req, res);
    if (!reviewId) return;

    try {
      const before = await db.getReviewByIdRaw(reviewId);
      if (!before) {
        sendError(res, 404, "Review not found");
        return;
      }

      const success = await db.deleteReviewById(reviewId);
      if (!success) {
        sendError(res, 404, "Review not found");
        return;
      }

      await writeReviewAudit(req as AdminRequest, {
        action: "review.delete",
        entityType: "review",
        entityId: reviewId,
        beforeJson: before,
      });

      res.json({ ok: true, data: { success: true } });
    } catch (error: any) {
      console.error("[Review API] delete failed:", error);
      sendError(res, 500, error?.message || "Failed to delete review");
    }
  });

  app.post("/api/admin/reviews/:id/reply", requireAdmin, async (req: Request, res: Response) => {
    const reviewId = parseReviewId(req, res);
    if (!reviewId) return;

    try {
      const payload = reviewReplyCreateSchema.parse(req.body || {});
      const review = await db.getReviewByIdRaw(reviewId);
      if (!review) {
        sendError(res, 404, "Review not found");
        return;
      }

      const reply = await db.createReviewReply({
        reviewId,
        adminUserId: (req as AdminRequest).adminUser?.id ?? null,
        body: payload.body,
      });

      await writeReviewAudit(req as AdminRequest, {
        action: "review.reply.create",
        entityType: "review_reply",
        entityId: reply.id,
        afterJson: {
          reviewId,
          body: reply.body,
        },
      });

      res.status(201).json({ ok: true, data: reply });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Invalid review reply payload");
        return;
      }
      console.error("[Review API] reply failed:", error);
      sendError(res, 500, error?.message || "Failed to create reply");
    }
  });
}

