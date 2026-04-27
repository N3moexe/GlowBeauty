export type RecentlyViewedProduct = {
  id: number;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number | null;
  imageUrl?: string | null;
  isNew?: boolean;
  isFeatured?: boolean;
  inStock?: boolean;
  viewedAt: number;
};

export const RECENTLY_VIEWED_KEY = "sbp_recently_viewed";
const MAX_RECENTLY_VIEWED = 12;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getRecentlyViewed(limit = 8): RecentlyViewedProduct[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(RECENTLY_VIEWED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is RecentlyViewedProduct => item && typeof item.id === "number")
      .sort((a, b) => b.viewedAt - a.viewedAt)
      .slice(0, Math.max(1, limit));
  } catch {
    return [];
  }
}

export function trackRecentlyViewed(
  product: Omit<RecentlyViewedProduct, "viewedAt">
) {
  if (!canUseStorage()) return;

  const nextEntry: RecentlyViewedProduct = {
    ...product,
    viewedAt: Date.now(),
  };

  const current = getRecentlyViewed(MAX_RECENTLY_VIEWED);
  const deduped = current.filter((item) => item.id !== product.id);
  const next = [nextEntry, ...deduped].slice(0, MAX_RECENTLY_VIEWED);

  try {
    window.localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage write failures (private mode/quota)
  }
}
