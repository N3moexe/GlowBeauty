import type {
  HomepageLayout,
  Integrations,
  MediaAsset,
  MediaAssetCreate,
  Navigation,
  StaticPage,
  StaticPageCreate,
  StaticPageUpdate,
  ThemeConfig,
  EmailTemplate,
  EmailTemplateKey,
} from "@shared/storefront-cms";

async function handleJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null as any);
  if (!res.ok || !body?.ok) {
    const message = body?.error || `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return body.data as T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include", cache: "no-store" });
  return handleJson<T>(res);
}

async function send<T>(
  method: "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleJson<T>(res);
}

export const adminCms = {
  // Layout
  getLayout: () => get<HomepageLayout>("/api/admin/storefront/layout"),
  saveLayout: (layout: Omit<HomepageLayout, "updatedAt">) =>
    send<HomepageLayout>("PUT", "/api/admin/storefront/layout", layout),

  // Navigation
  getNavigation: () => get<Navigation>("/api/admin/storefront/navigation"),
  saveNavigation: (nav: Omit<Navigation, "updatedAt">) =>
    send<Navigation>("PUT", "/api/admin/storefront/navigation", nav),

  // Theme
  getTheme: () => get<ThemeConfig>("/api/admin/storefront/theme"),
  saveTheme: (theme: Omit<ThemeConfig, "updatedAt">) =>
    send<ThemeConfig>("PUT", "/api/admin/storefront/theme", theme),

  // Integrations
  getIntegrations: () =>
    get<Integrations>("/api/admin/storefront/integrations"),
  saveIntegrations: (integrations: Omit<Integrations, "updatedAt">) =>
    send<Integrations>(
      "PUT",
      "/api/admin/storefront/integrations",
      integrations
    ),

  // Pages
  listPages: () => get<StaticPage[]>("/api/admin/pages"),
  getPage: (id: number) => get<StaticPage>(`/api/admin/pages/${id}`),
  createPage: (input: StaticPageCreate) =>
    send<StaticPage>("POST", "/api/admin/pages", input),
  updatePage: (input: StaticPageUpdate) =>
    send<StaticPage>("PUT", `/api/admin/pages/${input.id}`, input),
  deletePage: (id: number) =>
    send<{ id: number }>("DELETE", `/api/admin/pages/${id}`),

  // Email templates
  listEmailTemplates: () => get<EmailTemplate[]>("/api/admin/email-templates"),
  updateEmailTemplate: (
    key: EmailTemplateKey,
    input: { subject?: string; body?: string }
  ) => send<EmailTemplate>("PUT", `/api/admin/email-templates/${key}`, input),
  testSendEmailTemplate: (key: EmailTemplateKey, recipient: string) =>
    send<{ recipient: string; mode: string }>(
      "POST",
      `/api/admin/email-templates/${key}/test-send`,
      { recipient }
    ),

  // Media library
  listMedia: () => get<MediaAsset[]>("/api/admin/media"),
  createMediaAsset: (input: MediaAssetCreate) =>
    send<MediaAsset>("POST", "/api/admin/media", input),
  deleteMediaAsset: (id: number) =>
    send<{ id: number }>("DELETE", `/api/admin/media/${id}`),
};

export const ADMIN_LAYOUT_QUERY_KEY = [
  "admin",
  "storefront",
  "layout",
] as const;
export const ADMIN_NAVIGATION_QUERY_KEY = [
  "admin",
  "storefront",
  "navigation",
] as const;
export const ADMIN_THEME_QUERY_KEY = ["admin", "storefront", "theme"] as const;
export const ADMIN_INTEGRATIONS_QUERY_KEY = [
  "admin",
  "storefront",
  "integrations",
] as const;
export const ADMIN_PAGES_QUERY_KEY = ["admin", "pages"] as const;
export const ADMIN_EMAIL_TEMPLATES_QUERY_KEY = [
  "admin",
  "email-templates",
] as const;
export const ADMIN_MEDIA_QUERY_KEY = ["admin", "media"] as const;
