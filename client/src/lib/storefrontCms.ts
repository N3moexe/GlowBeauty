import type {
  HomepageLayout,
  Integrations,
  Navigation,
  StaticPage,
  ThemeConfig,
} from "@shared/storefront-cms";

type PublicIntegrations = Pick<
  Integrations,
  "metaPixelId" | "ga4MeasurementId" | "tiktokPixelId" | "whatsappNumber"
>;

export const STOREFRONT_LAYOUT_QUERY_KEY = ["storefront", "layout"] as const;
export const STOREFRONT_NAV_QUERY_KEY = ["storefront", "navigation"] as const;
export const STOREFRONT_THEME_QUERY_KEY = ["storefront", "theme"] as const;
export const STOREFRONT_INTEGRATIONS_QUERY_KEY = [
  "storefront",
  "integrations",
] as const;
export const STOREFRONT_PAGE_QUERY_KEY = (slug: string) =>
  ["storefront", "page", slug] as const;

async function fetchJson<T>(path: string): Promise<T | null> {
  const res = await fetch(path, { cache: "no-store", credentials: "include" });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as
    | { ok?: boolean; data?: T }
    | null;
  if (!body || !body.ok || typeof body.data === "undefined") return null;
  return body.data;
}

export async function fetchStorefrontLayout(): Promise<HomepageLayout | null> {
  return fetchJson<HomepageLayout>("/api/storefront/layout");
}

export async function fetchStorefrontNavigation(): Promise<Navigation | null> {
  return fetchJson<Navigation>("/api/storefront/navigation");
}

export async function fetchStorefrontTheme(): Promise<ThemeConfig | null> {
  return fetchJson<ThemeConfig>("/api/storefront/theme");
}

export async function fetchStorefrontIntegrations(): Promise<PublicIntegrations | null> {
  return fetchJson<PublicIntegrations>("/api/storefront/integrations-public");
}

export async function fetchPublicPage(slug: string): Promise<StaticPage | null> {
  return fetchJson<StaticPage>(`/api/pages/${encodeURIComponent(slug)}`);
}
