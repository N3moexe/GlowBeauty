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

async function startServer() {
  const app = express();
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
    next();
  });
  // Payment webhooks must verify HMAC signatures over the raw body, so they are
  // registered before the global JSON parser (each route uses express.raw()).
  registerPaymentWebhookRoutes(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Chat API with streaming and tool calling
  registerChatRoutes(app);
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
