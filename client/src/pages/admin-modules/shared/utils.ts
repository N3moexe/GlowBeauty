import type { AdminModuleKey } from "@/components/admin/SidebarNav";

export const ALL_MODULES: AdminModuleKey[] = [
  "analytics",
  "orders",
  "search",
  "products",
  "categories",
  "reviews",
  "inventory",
  "coupons",
  "banners",
  "reports",
  "cms",
  "settings",
];

export function parseAdminModule(
  moduleParam: string | undefined
): AdminModuleKey {
  if (!moduleParam) return "analytics";
  if (ALL_MODULES.includes(moduleParam as AdminModuleKey)) {
    return moduleParam as AdminModuleKey;
  }
  return "analytics";
}

export function moveArrayItem<T>(items: T[], from: number, to: number) {
  if (from === to) return [...items];
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items];
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string" &&
    (error as { message: string }).message.length > 0
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizePaymentStatus(
  value: string
): "pending" | "processing" | "completed" | "failed" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "processing") return "processing";
  if (normalized === "completed" || normalized === "paid") return "completed";
  if (normalized === "failed") return "failed";
  return "pending";
}

export function computeSeoScore(page: {
  title?: string | null;
  content?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
}) {
  let score = 0;
  if ((page.title || "").trim().length >= 6) score += 25;
  if ((page.content || "").trim().length >= 120) score += 25;
  if ((page.seoTitle || "").trim().length >= 12) score += 25;
  if ((page.seoDescription || "").trim().length >= 70) score += 25;
  return score;
}
