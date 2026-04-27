import type { Express, Request, Response } from "express";
import { requireRole } from "./authz";
import {
  createMediaAsset,
  createPage,
  deleteMediaAsset,
  deletePage,
  getHomepageLayout,
  getIntegrations,
  getNavigation,
  getPageBySlug,
  getPageById,
  getTheme,
  listEmailTemplates,
  listMediaAssets,
  listPages,
  setEmailTemplate,
  setHomepageLayout,
  setIntegrations,
  setNavigation,
  setTheme,
  updatePage,
} from "./storefront-cms-store";
import { EMAIL_TEMPLATE_KEYS } from "../shared/storefront-cms";
import { sendTemplatePreviewEmail } from "./email-service";

// Basic RFC-compliant enough sanity check — the real validation happens at the
// SMTP layer. We just stop obviously-malformed inputs at the edge.
const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sendError(res: Response, status: number, message: string) {
  res.status(status).json({ ok: false, error: message });
}

function sendOk(res: Response, payload: unknown) {
  res.status(200).json({ ok: true, data: payload });
}

function asyncHandler<TReq extends Request = Request>(
  handler: (req: TReq, res: Response) => Promise<void> | void
) {
  return (req: Request, res: Response) => {
    Promise.resolve(handler(req as TReq, res)).catch(error => {
      console.error("[Storefront CMS] handler error:", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Internal error";
      // zod errors have a useful message already — surface it to the admin UI.
      sendError(res, 400, message);
    });
  };
}

export function registerStorefrontCmsRoutes(app: Express) {
  const adminGuard = requireRole(["ADMIN", "MANAGER"]);

  // ─── Public reads — storefront consumes these ───

  app.get(
    "/api/storefront/layout",
    asyncHandler((_req, res) => {
      sendOk(res, getHomepageLayout());
    })
  );

  app.get(
    "/api/storefront/navigation",
    asyncHandler((_req, res) => {
      sendOk(res, getNavigation());
    })
  );

  app.get(
    "/api/storefront/theme",
    asyncHandler((_req, res) => {
      sendOk(res, getTheme());
    })
  );

  app.get(
    "/api/storefront/integrations-public",
    asyncHandler((_req, res) => {
      // Only surface non-secret fields to the storefront.
      const integrations = getIntegrations();
      sendOk(res, {
        metaPixelId: integrations.metaPixelId,
        ga4MeasurementId: integrations.ga4MeasurementId,
        tiktokPixelId: integrations.tiktokPixelId,
        whatsappNumber: integrations.whatsappNumber,
      });
    })
  );

  app.get(
    "/api/pages/:slug",
    asyncHandler((req, res) => {
      const page = getPageBySlug(req.params.slug);
      if (!page || page.status !== "published") {
        sendError(res, 404, "Page not found");
        return;
      }
      sendOk(res, page);
    })
  );

  app.get(
    "/api/pages",
    asyncHandler((_req, res) => {
      sendOk(res, listPages(false));
    })
  );

  // ─── Admin reads/writes (require ADMIN or MANAGER) ───

  app.get(
    "/api/admin/storefront/layout",
    adminGuard,
    asyncHandler((_req, res) => {
      sendOk(res, getHomepageLayout());
    })
  );

  app.put(
    "/api/admin/storefront/layout",
    adminGuard,
    asyncHandler((req, res) => {
      const next = setHomepageLayout(req.body);
      sendOk(res, next);
    })
  );

  app.get(
    "/api/admin/storefront/navigation",
    adminGuard,
    asyncHandler((_req, res) => {
      sendOk(res, getNavigation());
    })
  );

  app.put(
    "/api/admin/storefront/navigation",
    adminGuard,
    asyncHandler((req, res) => {
      const next = setNavigation(req.body);
      sendOk(res, next);
    })
  );

  app.get(
    "/api/admin/storefront/theme",
    adminGuard,
    asyncHandler((_req, res) => {
      sendOk(res, getTheme());
    })
  );

  app.put(
    "/api/admin/storefront/theme",
    adminGuard,
    asyncHandler((req, res) => {
      const next = setTheme(req.body);
      sendOk(res, next);
    })
  );

  app.get(
    "/api/admin/storefront/integrations",
    adminGuard,
    asyncHandler((_req, res) => {
      sendOk(res, getIntegrations());
    })
  );

  app.put(
    "/api/admin/storefront/integrations",
    adminGuard,
    asyncHandler((req, res) => {
      const next = setIntegrations(req.body);
      sendOk(res, next);
    })
  );

  // Pages — admin CRUD (includes drafts)
  app.get(
    "/api/admin/pages",
    adminGuard,
    asyncHandler((_req, res) => {
      sendOk(res, listPages(true));
    })
  );

  app.get(
    "/api/admin/pages/:id",
    adminGuard,
    asyncHandler((req, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        sendError(res, 400, "Invalid id");
        return;
      }
      const page = getPageById(id);
      if (!page) {
        sendError(res, 404, "Page not found");
        return;
      }
      sendOk(res, page);
    })
  );

  app.post(
    "/api/admin/pages",
    adminGuard,
    asyncHandler((req, res) => {
      const next = createPage(req.body);
      sendOk(res, next);
    })
  );

  app.put(
    "/api/admin/pages/:id",
    adminGuard,
    asyncHandler((req, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        sendError(res, 400, "Invalid id");
        return;
      }
      const next = updatePage({ ...req.body, id });
      sendOk(res, next);
    })
  );

  app.delete(
    "/api/admin/pages/:id",
    adminGuard,
    asyncHandler((req, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        sendError(res, 400, "Invalid id");
        return;
      }
      const deleted = deletePage(id);
      if (!deleted) {
        sendError(res, 404, "Page not found");
        return;
      }
      sendOk(res, { id });
    })
  );

  // Media library
  app.get(
    "/api/admin/media",
    adminGuard,
    asyncHandler((_req, res) => {
      sendOk(res, listMediaAssets());
    })
  );

  app.post(
    "/api/admin/media",
    adminGuard,
    asyncHandler((req, res) => {
      const next = createMediaAsset(req.body);
      sendOk(res, next);
    })
  );

  app.delete(
    "/api/admin/media/:id",
    adminGuard,
    asyncHandler((req, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        sendError(res, 400, "Invalid id");
        return;
      }
      const deleted = deleteMediaAsset(id);
      if (!deleted) {
        sendError(res, 404, "Media asset not found");
        return;
      }
      sendOk(res, { id });
    })
  );

  // Email templates
  app.get(
    "/api/admin/email-templates",
    adminGuard,
    asyncHandler((_req, res) => {
      sendOk(res, listEmailTemplates());
    })
  );

  app.put(
    "/api/admin/email-templates/:key",
    adminGuard,
    asyncHandler((req, res) => {
      const key = req.params.key;
      if (
        !EMAIL_TEMPLATE_KEYS.includes(
          key as (typeof EMAIL_TEMPLATE_KEYS)[number]
        )
      ) {
        sendError(res, 404, "Template not found");
        return;
      }
      const next = setEmailTemplate({
        key: key as (typeof EMAIL_TEMPLATE_KEYS)[number],
        subject: req.body?.subject,
        body: req.body?.body,
      });
      sendOk(res, next);
    })
  );

  app.post(
    "/api/admin/email-templates/:key/test-send",
    adminGuard,
    asyncHandler(async (req, res) => {
      const key = req.params.key;
      if (
        !EMAIL_TEMPLATE_KEYS.includes(
          key as (typeof EMAIL_TEMPLATE_KEYS)[number]
        )
      ) {
        sendError(res, 404, "Template introuvable");
        return;
      }
      const recipient =
        typeof req.body?.recipient === "string"
          ? req.body.recipient.trim()
          : "";
      if (!recipient || !SIMPLE_EMAIL_RE.test(recipient)) {
        sendError(res, 400, "Adresse email invalide");
        return;
      }
      const result = await sendTemplatePreviewEmail(
        key as (typeof EMAIL_TEMPLATE_KEYS)[number],
        recipient
      );
      if (!result.success) {
        sendError(res, 502, result.error || "Envoi impossible");
        return;
      }
      sendOk(res, { recipient, mode: result.mode });
    })
  );
}
