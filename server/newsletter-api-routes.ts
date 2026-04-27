import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import { createContext } from "./_core/context";
import * as db from "./db";
import { isValidEmail, normalizeEmail } from "./newsletter-utils";
import { sendNewsletterConfirmationEmail } from "./email-service";

function getAppUrl(req: Request) {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");
  const protocol =
    (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  const host = req.get("host") || "localhost";
  return `${protocol}://${host}`;
}

function renderNewsletterStatusPage(
  kind: "ok" | "error",
  message: string
): string {
  const safeMessage = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const accent = kind === "ok" ? "#1b5e20" : "#b71c1c";
  const title =
    kind === "ok" ? "Inscription confirmée" : "Confirmation impossible";
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — SenBonsPlans</title>
<style>
  body { font-family: -apple-system, Segoe UI, Arial, sans-serif; background: #faf7f3; color: #2b2b2b; margin: 0; padding: 48px 16px; }
  main { max-width: 520px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  h1 { margin: 0 0 16px; font-size: 22px; color: ${accent}; }
  a.button { display: inline-block; margin-top: 20px; background: #C2185B; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: 600; }
</style>
</head>
<body>
<main>
  <h1>${title}</h1>
  <p>${safeMessage}</p>
  <a class="button" href="/">Retour à la boutique</a>
</main>
</body>
</html>`;
}

type AdminRequest = Request & {
  adminUser?: {
    id: number;
    name: string | null;
  };
};

type RateBucket = {
  count: number;
  resetAt: number;
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const newsletterRateBuckets = new Map<string, RateBucket>();

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

function getRequestUserAgent(req: Request) {
  const header = req.get("user-agent");
  if (!header) return null;
  const trimmed = header.trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}

function inferLocale(req: Request, locale?: string) {
  if (locale && locale.trim().length > 0) {
    return locale.trim().slice(0, 16);
  }
  const acceptLanguage = String(req.headers["accept-language"] || "").trim();
  if (!acceptLanguage) return "fr";
  const primary = acceptLanguage.split(",")[0]?.trim() || "fr";
  const normalized = primary.split("-")[0]?.trim().toLowerCase() || "fr";
  return normalized.slice(0, 16);
}

function isRateLimited(key: string) {
  const now = Date.now();
  const bucket = newsletterRateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    newsletterRateBuckets.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX_REQUESTS;
}

function escapeCsv(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
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
    console.error("[Newsletter API] admin auth failed:", error);
    sendError(res, 401, "Authentication failed");
  }
}

const subscribeSchema = z.object({
  email: z.string().trim().min(3).max(320),
  source: z.string().trim().min(1).max(64).optional(),
  locale: z.string().trim().min(2).max(16).optional(),
});

const unsubscribeSchema = z.object({
  email: z.string().trim().min(3).max(320),
});

const adminListQuerySchema = z.object({
  search: z.string().trim().max(320).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const adminExportQuerySchema = z.object({
  search: z.string().trim().max(320).optional(),
});

export function registerNewsletterApiRoutes(app: Express) {
  app.post("/api/newsletter/subscribe", async (req, res) => {
    try {
      const payload = subscribeSchema.parse(req.body || {});
      const email = normalizeEmail(payload.email);
      if (!isValidEmail(email)) {
        sendError(res, 400, "Email invalide.");
        return;
      }

      const requestIp = getRequestIp(req) || "unknown";
      if (
        isRateLimited(`newsletter:subscribe:ip:${requestIp}`) ||
        isRateLimited(`newsletter:subscribe:email:${email}`)
      ) {
        sendError(res, 429, "Trop de requetes. Reessayez dans une minute.");
        return;
      }

      const locale = inferLocale(req, payload.locale);
      const source = payload.source?.trim() || "homepage";
      const result = await db.subscribeNewsletter({
        email,
        source,
        locale,
        ip: requestIp,
        userAgent: getRequestUserAgent(req),
      });
      console.info("[Newsletter] subscribe", {
        email,
        source,
        locale,
        ip: requestIp,
        already: result.already,
        pending: result.pending,
      });
      // RGPD: never silently subscribe — if a confirmation token was issued,
      // send the opt-in email before responding.
      if (result.pending && result.confirmationToken) {
        const appUrl = getAppUrl(req);
        const confirmUrl = `${appUrl}/api/newsletter/confirm?token=${encodeURIComponent(result.confirmationToken)}`;
        void sendNewsletterConfirmationEmail(email, confirmUrl);
      }
      res.json({
        ok: true,
        already: result.already,
        pending: !!result.pending,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Payload invalide");
        return;
      }
      console.error("[Newsletter API] subscribe failed:", error);
      sendError(res, 500, "Impossible de traiter l'inscription.");
    }
  });

  app.get("/api/newsletter/confirm", async (req, res) => {
    try {
      const token = typeof req.query.token === "string" ? req.query.token : "";
      if (!token || token.length > 256) {
        res
          .status(400)
          .type("html")
          .send(
            renderNewsletterStatusPage("error", "Lien invalide ou manquant.")
          );
        return;
      }
      const result = await db.confirmNewsletter(token);
      if (!result.ok) {
        const message =
          result.reason === "expired"
            ? "Ce lien a expiré. Renvoyez une demande d'inscription depuis notre site."
            : "Lien inconnu ou déjà utilisé.";
        res
          .status(410)
          .type("html")
          .send(renderNewsletterStatusPage("error", message));
        return;
      }
      console.info("[Newsletter] confirm", { email: result.email });
      res
        .status(200)
        .type("html")
        .send(
          renderNewsletterStatusPage(
            "ok",
            "Inscription confirmée. Merci — vous recevrez nos prochaines actualités."
          )
        );
    } catch (error: any) {
      console.error("[Newsletter API] confirm failed:", error);
      res
        .status(500)
        .type("html")
        .send(
          renderNewsletterStatusPage(
            "error",
            "Impossible de confirmer l'inscription pour le moment."
          )
        );
    }
  });

  app.post("/api/newsletter/unsubscribe", async (req, res) => {
    try {
      const payload = unsubscribeSchema.parse(req.body || {});
      const email = normalizeEmail(payload.email);
      if (!isValidEmail(email)) {
        sendError(res, 400, "Email invalide.");
        return;
      }

      const requestIp = getRequestIp(req) || "unknown";
      if (
        isRateLimited(`newsletter:unsubscribe:ip:${requestIp}`) ||
        isRateLimited(`newsletter:unsubscribe:email:${email}`)
      ) {
        sendError(res, 429, "Trop de requetes. Reessayez dans une minute.");
        return;
      }

      await db.unsubscribeNewsletter(email);
      console.info("[Newsletter] unsubscribe", {
        email,
        ip: requestIp,
      });
      res.json({ ok: true });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Payload invalide");
        return;
      }
      console.error("[Newsletter API] unsubscribe failed:", error);
      sendError(res, 500, "Impossible de traiter la desinscription.");
    }
  });

  app.get("/api/admin/newsletter", requireAdmin, async (req, res) => {
    try {
      const query = adminListQuerySchema.parse(req.query || {});
      const data = await db.listNewsletterSubscribers({
        search: query.search,
        limit: query.limit,
        offset: query.offset,
      });
      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, max-age=0"
      );
      res.json({ ok: true, data });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Query invalide");
        return;
      }
      console.error("[Newsletter API] admin list failed:", error);
      sendError(res, 500, "Impossible de charger les abonnes.");
    }
  });

  app.get("/api/admin/newsletter/export", requireAdmin, async (req, res) => {
    try {
      const query = adminExportQuerySchema.parse(req.query || {});
      const rows = await db.exportNewsletterSubscribers(query.search);
      const header = [
        "email",
        "status",
        "source",
        "locale",
        "ip",
        "userAgent",
        "createdAt",
        "unsubscribedAt",
      ].join(",");
      const body = rows
        .map((row: any) =>
          [
            escapeCsv(row.email),
            escapeCsv(row.status),
            escapeCsv(row.source),
            escapeCsv(row.locale),
            escapeCsv(row.ip),
            escapeCsv(row.userAgent),
            escapeCsv(
              row.createdAt ? new Date(row.createdAt).toISOString() : ""
            ),
            escapeCsv(
              row.unsubscribedAt
                ? new Date(row.unsubscribedAt).toISOString()
                : ""
            ),
          ].join(",")
        )
        .join("\n");
      const csv = `${header}\n${body}`;
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=\"newsletter-subscribers-${stamp}.csv\"`
      );
      res.status(200).send(csv);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Query invalide");
        return;
      }
      console.error("[Newsletter API] admin export failed:", error);
      sendError(res, 500, "Impossible d'exporter les abonnes.");
    }
  });
}
