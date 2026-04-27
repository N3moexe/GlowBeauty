export type CmsResultsSection = {
  id: number;
  enabled: boolean;
  title: string;
  subtitle: string;
  beforeLabel: string;
  afterLabel: string;
  beforeImageUrl: string | null;
  afterImageUrl: string | null;
  stat1Value: string;
  stat1Title: string;
  stat1Desc: string;
  stat2Value: string;
  stat2Title: string;
  stat2Desc: string;
  stat3Value: string;
  stat3Title: string;
  stat3Desc: string;
  footerNote: string;
  updatedAt: string;
};

export type CmsResultsSectionUpdateInput = Partial<
  Omit<CmsResultsSection, "id" | "updatedAt">
>;

export const CMS_RESULTS_SECTION_PUBLIC_QUERY_KEY = [
  "cms",
  "results-section",
  "public",
] as const;
export const CMS_RESULTS_SECTION_ADMIN_QUERY_KEY = [
  "cms",
  "results-section",
  "admin",
] as const;
export const RESULTS_SECTION_UPDATED_EVENT = "sbp:results-section-updated";
export const RESULTS_SECTION_UPDATED_STORAGE_KEY = "sbp:results-section-updated-at";

function defaultResultsSection(): CmsResultsSection {
  return {
    id: 0,
    enabled: true,
    title: "Des routines pensees pour des resultats visibles",
    subtitle:
      "Notre composition associe actifs performants, textures agreables et protocoles simples.",
    beforeLabel: "AVANT",
    afterLabel: "APRES",
    beforeImageUrl: null,
    afterImageUrl: null,
    stat1Value: "+42%",
    stat1Title: "Hydratation",
    stat1Desc: "Confort percu apres 28 jours d'utilisation reguliere.",
    stat2Value: "-37%",
    stat2Title: "Imperfections visibles",
    stat2Desc: "Routine niacinamide + nettoyant doux chez nos clientes test.",
    stat3Value: "+Glow",
    stat3Title: "Uniformite du teint",
    stat3Desc: "Association vitamine C + SPF pour prevenir les marques.",
    footerNote:
      "Dermatologiquement testee. Actifs references: niacinamide, acide hyaluronique, ceramides et SPF.",
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

function parseResultsResponse(payload: any) {
  return (payload?.data ?? null) as CmsResultsSection | null;
}

export async function fetchPublicResultsSection() {
  const response = await fetch("/api/cms/results-section", {
    cache: "no-store",
  });
  const payload = await parsePayload(response);
  if (!response.ok || payload?.ok === false) {
    throw new Error(parseRequestError(payload, "Failed to load results section"));
  }
  return parseResultsResponse(payload);
}

export async function fetchAdminResultsSection() {
  const response = await fetch("/api/cms/results-section", {
    credentials: "include",
    cache: "no-store",
  });
  const payload = await parsePayload(response);
  if (!response.ok || payload?.ok === false) {
    throw new Error(parseRequestError(payload, "Failed to load results section"));
  }
  return parseResultsResponse(payload) || defaultResultsSection();
}

export async function updateAdminResultsSection(input: CmsResultsSectionUpdateInput) {
  const response = await fetch("/api/admin/cms/results-section", {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = await parsePayload(response);
  if (!response.ok || payload?.ok === false) {
    throw new Error(parseRequestError(payload, "Failed to save results section"));
  }
  return parseResultsResponse(payload);
}

export async function uploadAdminResultsSectionImage(file: File) {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch("/api/admin/uploads/hero", {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const payload = await parsePayload(response);
  if (!response.ok || payload?.ok === false) {
    throw new Error(parseRequestError(payload, "Failed to upload results image"));
  }
  if (!payload?.url || typeof payload.url !== "string") {
    throw new Error("Invalid upload response");
  }
  return payload.url as string;
}

export function makeResultsSectionFallback() {
  return defaultResultsSection();
}

export function notifyResultsSectionUpdated() {
  if (typeof window === "undefined") return;
  const stamp = new Date().toISOString();
  window.localStorage.setItem(RESULTS_SECTION_UPDATED_STORAGE_KEY, stamp);
  window.dispatchEvent(new CustomEvent(RESULTS_SECTION_UPDATED_EVENT, { detail: stamp }));
}
