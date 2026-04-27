export type CmsHomeHeroBlock = {
  id: number;
  key: "home_hero";
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaText: string;
  ctaLink: string;
  secondaryCtaText: string;
  secondaryCtaLink: string;
  badgeText: string;
  isActive: boolean;
  updatedAt: string;
};

export type CmsHomeHeroUpdateInput = Partial<
  Pick<
    CmsHomeHeroBlock,
    | "title"
    | "subtitle"
    | "imageUrl"
    | "ctaText"
    | "ctaLink"
    | "secondaryCtaText"
    | "secondaryCtaLink"
    | "badgeText"
    | "isActive"
  >
>;

export const CMS_HOME_HERO_PUBLIC_QUERY_KEY = [
  "cms",
  "home-hero",
  "public",
] as const;
export const CMS_HOME_HERO_ADMIN_QUERY_KEY = [
  "cms",
  "home-hero",
  "admin",
] as const;
export const HOME_HERO_UPDATED_EVENT = "sbp:home-hero-updated";
export const HOME_HERO_UPDATED_STORAGE_KEY = "sbp:home-hero-updated-at";

function defaultHero(imageUrl = ""): CmsHomeHeroBlock {
  return {
    id: 0,
    key: "home_hero",
    title: "Votre peau, la version qu'elle attendait.",
    subtitle:
      "Des formules choisies avec soin pour le climat de Dakar. Pas de promesses magiques — juste des actifs que votre peau reconnaît, dans une routine qui tient.",
    imageUrl,
    ctaText: "Voir la boutique",
    ctaLink: "/boutique",
    secondaryCtaText: "Trouver ma routine en 2 min",
    secondaryCtaLink: "/boutique?q=routine",
    badgeText: "Skincare, version Sénégal",
    isActive: true,
    updatedAt: new Date(0).toISOString(),
  };
}

async function parsePayload(response: Response) {
  return response.json().catch(() => null as any);
}

function parseRequestError(payload: any, fallback: string) {
  if (
    payload &&
    typeof payload.error === "string" &&
    payload.error.trim().length > 0
  ) {
    return payload.error;
  }
  return fallback;
}

export async function fetchPublicHomeHero() {
  const response = await fetch("/api/cms/home-hero", {
    cache: "no-store",
  });
  const payload = await parsePayload(response);
  if (!response.ok || payload?.ok === false) {
    throw new Error(parseRequestError(payload, "Failed to load homepage hero"));
  }
  return (payload?.hero ?? null) as CmsHomeHeroBlock | null;
}

export async function fetchAdminHomeHero() {
  const response = await fetch("/api/admin/cms/home-hero", {
    credentials: "include",
    cache: "no-store",
  });
  const payload = await parsePayload(response);
  if (!response.ok || payload?.ok === false) {
    throw new Error(parseRequestError(payload, "Failed to load homepage hero"));
  }
  return ((payload?.hero ?? null) as CmsHomeHeroBlock | null) || defaultHero();
}

export async function updateAdminHomeHero(input: CmsHomeHeroUpdateInput) {
  const response = await fetch("/api/admin/cms/home-hero", {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = await parsePayload(response);
  if (!response.ok || payload?.ok === false) {
    throw new Error(parseRequestError(payload, "Failed to save homepage hero"));
  }
  return (payload?.hero ?? null) as CmsHomeHeroBlock | null;
}

export async function uploadAdminHomeHeroImage(file: File) {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch("/api/admin/uploads/hero", {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const payload = await parsePayload(response);
  if (!response.ok || payload?.ok === false) {
    throw new Error(parseRequestError(payload, "Failed to upload hero image"));
  }
  if (!payload?.url || typeof payload.url !== "string") {
    throw new Error("Invalid upload response");
  }
  return payload.url as string;
}

export function makeHomeHeroFallback(imageUrl?: string | null) {
  return defaultHero(imageUrl || "");
}

export function notifyHomeHeroUpdated() {
  if (typeof window === "undefined") return;
  const stamp = new Date().toISOString();
  window.localStorage.setItem(HOME_HERO_UPDATED_STORAGE_KEY, stamp);
  window.dispatchEvent(
    new CustomEvent(HOME_HERO_UPDATED_EVENT, { detail: stamp })
  );
}
