export type CmsEditorialHeroCardPosition = "left" | "center" | "right";

export type CmsEditorialHeroBlock = {
  id: number;
  isActive: boolean;
  badgeText: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  backgroundImageUrl: string;
  overlayOpacity: number;
  cardPosition: CmsEditorialHeroCardPosition;
  updatedAt: string;
};

export type CmsEditorialHeroUpdateInput = Partial<
  Omit<CmsEditorialHeroBlock, "id" | "updatedAt">
>;

export const CMS_EDITORIAL_HERO_PUBLIC_QUERY_KEY = [
  "cms",
  "editorial-hero",
  "public",
] as const;
export const CMS_EDITORIAL_HERO_ADMIN_QUERY_KEY = [
  "cms",
  "editorial-hero",
  "admin",
] as const;
export const EDITORIAL_HERO_UPDATED_EVENT = "sbp:editorial-hero-updated";
export const EDITORIAL_HERO_UPDATED_STORAGE_KEY = "sbp:editorial-hero-updated-at";

function defaultEditorialHero(): CmsEditorialHeroBlock {
  return {
    id: 1,
    isActive: true,
    badgeText: "RITUEL SIGNATURE",
    title: "Un rituel skincare elegant, pense pour votre peau.",
    subtitle:
      "Des actifs premium, une routine simple et des resultats visibles, jour apres jour.",
    ctaText: "Decouvrir la routine",
    ctaLink: "/boutique",
    backgroundImageUrl: "",
    overlayOpacity: 55,
    cardPosition: "left",
    updatedAt: new Date(0).toISOString(),
  };
}

async function parsePayload(response: Response) {
  return response.json().catch(() => null as any);
}

function parseRequestError(payload: any, fallback: string) {
  if (payload && typeof payload.error === "string" && payload.error.trim().length > 0) {
    return payload.error;
  }
  return fallback;
}

function parseEditorialHeroPayload(payload: any): CmsEditorialHeroBlock | null {
  return (payload?.hero ?? null) as CmsEditorialHeroBlock | null;
}

export async function fetchPublicEditorialHero() {
  const response = await fetch("/api/cms/editorial-hero", {
    cache: "no-store",
  });
  const payload = await parsePayload(response);
  if (!response.ok || payload?.ok === false) {
    throw new Error(parseRequestError(payload, "Failed to load editorial hero"));
  }
  return parseEditorialHeroPayload(payload);
}

export async function fetchAdminEditorialHero() {
  const response = await fetch("/api/cms/editorial-hero", {
    credentials: "include",
    cache: "no-store",
  });
  const payload = await parsePayload(response);
  if (!response.ok || payload?.ok === false) {
    throw new Error(parseRequestError(payload, "Failed to load editorial hero"));
  }
  return parseEditorialHeroPayload(payload) || defaultEditorialHero();
}

export async function updateAdminEditorialHero(input: CmsEditorialHeroUpdateInput) {
  const response = await fetch("/api/admin/cms/editorial-hero", {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = await parsePayload(response);
  if (!response.ok || payload?.ok === false) {
    throw new Error(parseRequestError(payload, "Failed to save editorial hero"));
  }
  return parseEditorialHeroPayload(payload);
}

export async function uploadAdminEditorialHeroImage(file: File) {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch("/api/admin/upload", {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const payload = await parsePayload(response);
  if (!response.ok || payload?.ok === false) {
    throw new Error(parseRequestError(payload, "Failed to upload editorial hero image"));
  }
  if (!payload?.url || typeof payload.url !== "string") {
    throw new Error("Invalid upload response");
  }
  return payload.url as string;
}

export function makeEditorialHeroFallback() {
  return defaultEditorialHero();
}

export function notifyEditorialHeroUpdated() {
  if (typeof window === "undefined") return;
  const stamp = new Date().toISOString();
  window.localStorage.setItem(EDITORIAL_HERO_UPDATED_STORAGE_KEY, stamp);
  window.dispatchEvent(new CustomEvent(EDITORIAL_HERO_UPDATED_EVENT, { detail: stamp }));
}
