import "dotenv/config";
// Sentry must be initialized BEFORE any other module that might throw during
// startup, so we can capture boot-time crashes.
import { initSentry, Sentry, isSentryEnabled } from "../sentry";
initSentry();
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerChatRoutes } from "./chat";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerAnalyticsApiRoutes } from "../analytics-api-routes";
import { registerBannerApiRoutes } from "../banner-api-routes";
import { registerCategoryApiRoutes } from "../category-api-routes";
import { registerChatbotApiRoutes } from "../chatbot-api-routes";
import { registerCouponApiRoutes } from "../coupon-api-routes";
import { registerNewsletterApiRoutes } from "../newsletter-api-routes";
import { registerReviewApiRoutes } from "../review-api-routes";
import { registerSettingsApiRoutes } from "../settings-api-routes";
import { registerPaymentWebhookRoutes } from "../webhook-api-routes";
import { registerStorefrontCmsRoutes } from "../storefront-cms-routes";
import { registerSitemapRoutes } from "../sitemap-routes";
import { hydrateStorefrontCmsFromDb } from "../storefront-cms-store";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const DEFAULT_JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || "1mb";
const LARGE_JSON_BODY_LIMIT = process.env.LARGE_JSON_BODY_LIMIT || "16mb";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

function getExpectedOrigin(req: express.Request) {
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) {
    try {
      return new URL(appUrl).origin;
    } catch {
      if (process.env.NODE_ENV === "production") {
        throw new Error("[CSRF] APP_URL must be a valid URL in production");
      }
    }
  }

  const host = req.get("host");
  if (!host) return null;
  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  return `${protocol}://${host}`;
}

function enforceBrowserOrigin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (!UNSAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const secFetchSite = req.get("sec-fetch-site");
  if (
    secFetchSite &&
    !["same-origin", "same-site", "none"].includes(secFetchSite)
  ) {
    res.status(403).json({ ok: false, error: "Cross-site request rejected" });
    return;
  }

  const origin = req.get("origin");
  if (!origin) {
    next();
    return;
  }

  const expectedOrigin = getExpectedOrigin(req);
  if (expectedOrigin && origin !== expectedOrigin) {
    res.status(403).json({ ok: false, error: "Bad request origin" });
    return;
  }

  next();
}

function isLargeJsonBodyRoute(req: express.Request) {
  const url = req.originalUrl || req.url;
  return (
    url.includes("/api/admin/banners/optimize") ||
    url.includes("imageUpload.uploadProductImage")
  );
}

async function startServer() {
  const app = express();
  // Render (and most cloud platforms) sit behind a reverse proxy that sets
  // X-Forwarded-For. Trust exactly one proxy hop so req.ip reflects the real
  // client IP instead of the proxy's address.
  app.set("trust proxy", 1);
  const server = createServer(app);
  // Defense-in-depth security headers. nginx/Caddy in front may also set these;
  // duplicating at the app layer protects against proxy misconfig.
  app.use((_req, res, next) => {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()"
    );
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://analytics.tiktok.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https://*.ingest.sentry.io",
        "frame-src 'none'",
        "object-src 'none'",
        "base-uri 'self'",
      ].join("; ")
    );
    next();
  });
  // Payment webhooks must verify HMAC signatures over the raw body, so they are
  // registered before the global JSON parser (each route uses express.raw()).
  registerPaymentWebhookRoutes(app);
  app.use(enforceBrowserOrigin);
  app.use((req, res, next) =>
    express.json({
      limit: isLargeJsonBodyRoute(req)
        ? LARGE_JSON_BODY_LIMIT
        : DEFAULT_JSON_BODY_LIMIT,
    })(req, res, next)
  );
  app.use(
    express.urlencoded({ limit: DEFAULT_JSON_BODY_LIMIT, extended: true })
  );
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Disabled by default: the legacy chat route is unbounded and conflicts with
  // the newer rate-limited chatbot API on /api/chat.
  if (process.env.ENABLE_LEGACY_CHAT_ROUTE === "true") {
    registerChatRoutes(app);
  }
  // REST API routes for admin and storefront features
  registerAnalyticsApiRoutes(app);
  registerBannerApiRoutes(app);
  registerCategoryApiRoutes(app);
  registerChatbotApiRoutes(app);
  registerCouponApiRoutes(app);
  registerNewsletterApiRoutes(app);
  registerReviewApiRoutes(app);
  registerSettingsApiRoutes(app);
  registerStorefrontCmsRoutes(app);
  registerSitemapRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Sentry error handler must run after all routes/middleware so uncaught
  // errors land in telemetry. No-ops when DSN isn't configured.
  if (isSentryEnabled()) {
    Sentry.setupExpressErrorHandler(app);
  }

  // Load persisted storefront CMS edits (homepage layout, navigation, theme,
  // integrations) into the in-memory store. Failures fall back to seeded
  // defaults so a bad record never blocks startup.
  try {
    await hydrateStorefrontCmsFromDb();
  } catch (error) {
    console.error("[CMS] Hydration failed, using defaults", error);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(error => {
  console.error(error);
  if (isSentryEnabled()) {
    Sentry.captureException(error);
  }
});
