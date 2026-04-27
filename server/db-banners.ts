import { eq, and, desc, or } from "drizzle-orm";
import { banners, InsertBanner, Banner } from "../drizzle/schema";
import * as db from "./db";

const now = () => new Date();
let localBannerId = 1;
const localBanners: Banner[] = [];

/**
 * Get all active banners
 */
export async function getActiveBanners(): Promise<Banner[]> {
  const database = await db.getDb();
  if (!database) {
    const current = now();
    return localBanners
      .filter((b) => {
        if (!b.isActive) return false;
        if (b.startDate && b.startDate > current) return false;
        if (b.endDate && b.endDate < current) return false;
        return true;
      })
      .sort((a, b) => b.sortOrder - a.sortOrder);
  }

  try {
    const result = await database
      .select()
      .from(banners)
      .where(eq(banners.isActive, true))
      .orderBy(desc(banners.sortOrder));

    // Filter by date range in memory
    const now = new Date();
    return result.filter((b) => {
      if (b.startDate && b.startDate > now) return false;
      if (b.endDate && b.endDate < now) return false;
      return true;
    });
  } catch (error) {
    console.error("[Database] Failed to get active banners:", error);
    return [];
  }
}

/**
 * Get banners for a specific page
 */
export async function getBannersForPage(page: "homepage" | "shop" | "all"): Promise<Banner[]> {
  const database = await db.getDb();
  if (!database) {
    const current = now();
    return localBanners
      .filter((b) => {
        if (!b.isActive) return false;
        if (page !== "all" && b.displayOn !== page && b.displayOn !== "all") return false;
        if (b.startDate && b.startDate > current) return false;
        if (b.endDate && b.endDate < current) return false;
        return true;
      })
      .sort((a, b) => b.sortOrder - a.sortOrder);
  }

  try {
    const whereClause =
      page === "all"
        ? eq(banners.isActive, true)
        : and(
          eq(banners.isActive, true),
          or(eq(banners.displayOn, page), eq(banners.displayOn, "all"))
        );

    const result = await database
      .select()
      .from(banners)
      .where(whereClause)
      .orderBy(desc(banners.sortOrder), desc(banners.updatedAt));

    // Filter by date range in memory
    const now = new Date();
    return result.filter((b) => {
      if (b.startDate && b.startDate > now) return false;
      if (b.endDate && b.endDate < now) return false;
      return true;
    });
  } catch (error) {
    console.error("[Database] Failed to get banners for page:", error);
    return [];
  }
}

/**
 * Get banners by position
 */
export async function getBannersByPosition(
  position: "top" | "bottom" | "sidebar" | "hero" | "custom"
): Promise<Banner[]> {
  const database = await db.getDb();
  if (!database) {
    const current = now();
    return localBanners
      .filter((b) => {
        if (!b.isActive || b.position !== position) return false;
        if (b.startDate && b.startDate > current) return false;
        if (b.endDate && b.endDate < current) return false;
        return true;
      })
      .sort((a, b) => b.sortOrder - a.sortOrder);
  }

  try {
    const result = await database
      .select()
      .from(banners)
      .where(and(eq(banners.isActive, true), eq(banners.position, position)))
      .orderBy(desc(banners.sortOrder));

    // Filter by date range in memory
    const now = new Date();
    return result.filter((b) => {
      if (b.startDate && b.startDate > now) return false;
      if (b.endDate && b.endDate < now) return false;
      return true;
    });
  } catch (error) {
    console.error("[Database] Failed to get banners by position:", error);
    return [];
  }
}

/**
 * Get all banners (for admin)
 */
export async function getAllBanners(): Promise<Banner[]> {
  const database = await db.getDb();
  if (!database) {
    return [...localBanners].sort((a, b) => {
      const bySort = b.sortOrder - a.sortOrder;
      if (bySort !== 0) return bySort;
      return (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0);
    });
  }

  try {
    const result = await database
      .select()
      .from(banners)
      .orderBy(desc(banners.sortOrder), desc(banners.createdAt));

    return result;
  } catch (error) {
    console.error("[Database] Failed to get all banners:", error);
    return [];
  }
}

/**
 * Get banner by ID
 */
export async function getBannerById(id: number): Promise<Banner | undefined> {
  const database = await db.getDb();
  if (!database) return localBanners.find((b) => b.id === id);

  try {
    const result = await database
      .select()
      .from(banners)
      .where(eq(banners.id, id))
      .limit(1);

    return result[0];
  } catch (error) {
    console.error("[Database] Failed to get banner:", error);
    return undefined;
  }
}

/**
 * Create a new banner
 */
export async function createBanner(data: InsertBanner): Promise<Banner | null> {
  const database = await db.getDb();
  if (!database) {
    const banner: Banner = {
      id: localBannerId++,
      title: data.title,
      description: data.description ?? null,
      imageUrl: data.imageUrl ?? null,
      imageUrlDesktop: data.imageUrlDesktop ?? null,
      imageUrlMobile: data.imageUrlMobile ?? null,
      cropMeta: data.cropMeta ?? null,
      backgroundColor: data.backgroundColor ?? "#C41E3A",
      textColor: data.textColor ?? "#FFFFFF",
      buttonText: data.buttonText ?? null,
      buttonLink: data.buttonLink ?? null,
      position: data.position ?? "top",
      displayOn: data.displayOn ?? "all",
      layout: data.layout ?? "full-width",
      isActive: data.isActive ?? true,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      sortOrder: data.sortOrder ?? 0,
      createdAt: now(),
      updatedAt: now(),
    };
    localBanners.push(banner);
    return banner;
  }

  try {
    const insertResult = await database.insert(banners).values(data);
    const insertId = Number((insertResult as any)?.[0]?.insertId ?? 0);
    if (!insertId) {
      console.error("[Database] Banner insert did not return insertId", { title: data.title });
      return null;
    }

    const banner = await getBannerById(insertId);
    if (!banner) {
      console.error("[Database] Banner created but could not be reloaded", { id: insertId });
      return null;
    }

    console.info("[Database] Banner created", { id: banner.id, title: banner.title, isActive: banner.isActive });
    return banner;
  } catch (error) {
    console.error("[Database] Failed to create banner:", error);
    return null;
  }
}

/**
 * Update a banner
 */
export async function updateBanner(
  id: number,
  data: Partial<InsertBanner>
): Promise<Banner | null> {
  const database = await db.getDb();
  if (!database) {
    const index = localBanners.findIndex((b) => b.id === id);
    if (index < 0) return null;
    localBanners[index] = {
      ...localBanners[index],
      ...data,
      updatedAt: now(),
    } as Banner;
    return localBanners[index];
  }

  try {
    await database.update(banners).set(data).where(eq(banners.id, id));
    const banner = await getBannerById(id);
    if (banner) {
      console.info("[Database] Banner updated", { id: banner.id, isActive: banner.isActive });
    }
    return banner || null;
  } catch (error) {
    console.error("[Database] Failed to update banner:", error);
    return null;
  }
}

/**
 * Delete a banner
 */
export async function deleteBanner(id: number): Promise<boolean> {
  const database = await db.getDb();
  if (!database) {
    const before = localBanners.length;
    const next = localBanners.filter((b) => b.id !== id);
    localBanners.length = 0;
    localBanners.push(...next);
    return next.length !== before;
  }

  try {
    await database.delete(banners).where(eq(banners.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete banner:", error);
    return false;
  }
}

/**
 * Toggle banner active status
 */
export async function toggleBannerStatus(id: number): Promise<Banner | null> {
  const database = await db.getDb();
  if (!database) {
    const banner = localBanners.find((b) => b.id === id);
    if (!banner) return null;
    banner.isActive = !banner.isActive;
    banner.updatedAt = now();
    return banner;
  }

  try {
    const banner = await getBannerById(id);
    if (!banner) return null;

    const result = await updateBanner(id, { isActive: !banner.isActive });
    return result || null;
  } catch (error) {
    console.error("[Database] Failed to toggle banner status:", error);
    return null;
  }
}

export type HomepageHeroBannerPlacement = "homepage_hero";
export type HomepageHeroBannerStatus = "draft" | "published";

export type HomepageHeroBanner = {
  id: number;
  placement: HomepageHeroBannerPlacement;
  title: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
  imageUrl: string;
  imageUrlDesktop: string;
  imageUrlMobile: string;
  cropMeta: string | null;
  status: HomepageHeroBannerStatus;
  priority: number;
  startAt: Date | null;
  endAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertHomepageHeroBannerInput = {
  placement: HomepageHeroBannerPlacement;
  title: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
  imageUrl: string;
  imageUrlDesktop: string;
  imageUrlMobile: string;
  cropMeta?: string | null;
  status: HomepageHeroBannerStatus;
  priority: number;
  startAt?: Date | null;
  endAt?: Date | null;
};

export type UpdateHomepageHeroBannerInput = Partial<Omit<UpsertHomepageHeroBannerInput, "placement">>;

function isHomepageHeroBanner(row: Banner) {
  return row.displayOn === "homepage" && row.position === "hero";
}

function isWithinSchedule(row: Banner, current: Date) {
  if (row.startDate && row.startDate > current) return false;
  if (row.endDate && row.endDate < current) return false;
  return true;
}

function toHomepageHeroBanner(row: Banner): HomepageHeroBanner {
  const imageUrlDesktop = row.imageUrlDesktop || row.imageUrl || "";
  const imageUrlMobile = row.imageUrlMobile || row.imageUrlDesktop || row.imageUrl || "";
  return {
    id: row.id,
    placement: "homepage_hero",
    title: row.title,
    subtitle: row.description || "",
    buttonText: row.buttonText || "",
    buttonLink: row.buttonLink || "",
    imageUrl: row.imageUrl || imageUrlDesktop || imageUrlMobile,
    imageUrlDesktop,
    imageUrlMobile,
    cropMeta: row.cropMeta ?? null,
    status: row.isActive ? "published" : "draft",
    priority: row.sortOrder || 0,
    startAt: row.startDate ?? null,
    endAt: row.endDate ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listHomepageHeroBanners(): Promise<HomepageHeroBanner[]> {
  const rows = await getAllBanners();
  return rows
    .filter(isHomepageHeroBanner)
    .map(toHomepageHeroBanner)
    .sort((left, right) => {
      if (right.priority !== left.priority) return right.priority - left.priority;
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
}

export async function getHomepageHeroBannerById(id: number): Promise<HomepageHeroBanner | null> {
  const row = await getBannerById(id);
  if (!row || !isHomepageHeroBanner(row)) return null;
  return toHomepageHeroBanner(row);
}

export async function createHomepageHeroBanner(input: UpsertHomepageHeroBannerInput): Promise<HomepageHeroBanner | null> {
  const created = await createBanner({
    title: input.title,
    description: input.subtitle,
    buttonText: input.buttonText,
    buttonLink: input.buttonLink,
    imageUrl: input.imageUrl || input.imageUrlDesktop,
    imageUrlDesktop: input.imageUrlDesktop,
    imageUrlMobile: input.imageUrlMobile,
    cropMeta: input.cropMeta ?? null,
    displayOn: "homepage",
    position: "hero",
    layout: "overlay",
    backgroundColor: "#111111",
    textColor: "#FFFFFF",
    isActive: input.status === "published",
    sortOrder: input.priority,
    startDate: input.startAt ?? null,
    endDate: input.endAt ?? null,
  });
  if (!created) return null;
  return toHomepageHeroBanner(created);
}

export async function updateHomepageHeroBanner(
  id: number,
  input: UpdateHomepageHeroBannerInput
): Promise<HomepageHeroBanner | null> {
  const current = await getBannerById(id);
  if (!current || !isHomepageHeroBanner(current)) return null;

  const updates: Partial<InsertBanner> = {
    displayOn: "homepage",
    position: "hero",
    layout: "overlay",
  };

  if (input.title !== undefined) updates.title = input.title;
  if (input.subtitle !== undefined) updates.description = input.subtitle;
  if (input.buttonText !== undefined) updates.buttonText = input.buttonText;
  if (input.buttonLink !== undefined) updates.buttonLink = input.buttonLink;
  if (input.imageUrl !== undefined) updates.imageUrl = input.imageUrl;
  if (input.imageUrlDesktop !== undefined) updates.imageUrlDesktop = input.imageUrlDesktop;
  if (input.imageUrlMobile !== undefined) updates.imageUrlMobile = input.imageUrlMobile;
  if (input.cropMeta !== undefined) updates.cropMeta = input.cropMeta ?? null;
  if (input.status !== undefined) updates.isActive = input.status === "published";
  if (input.priority !== undefined) updates.sortOrder = input.priority;
  if (input.startAt !== undefined) updates.startDate = input.startAt ?? null;
  if (input.endAt !== undefined) updates.endDate = input.endAt ?? null;

  const updated = await updateBanner(id, updates);
  if (!updated) return null;
  return toHomepageHeroBanner(updated);
}

export async function setHomepageHeroBannerPublishState(
  id: number,
  nextStatus?: HomepageHeroBannerStatus
): Promise<HomepageHeroBanner | null> {
  const current = await getBannerById(id);
  if (!current || !isHomepageHeroBanner(current)) return null;

  const isPublished = nextStatus
    ? nextStatus === "published"
    : !current.isActive;

  const updated = await updateBanner(id, { isActive: isPublished });
  if (!updated) return null;
  return toHomepageHeroBanner(updated);
}

export async function getPublishedHomepageHeroBanner(): Promise<HomepageHeroBanner | null> {
  const rows = await getAllBanners();
  const current = now();

  const match = rows
    .filter(row => isHomepageHeroBanner(row))
    .filter(row => row.isActive)
    .filter(row => isWithinSchedule(row, current))
    .sort((left, right) => {
      if ((right.sortOrder || 0) !== (left.sortOrder || 0)) {
        return (right.sortOrder || 0) - (left.sortOrder || 0);
      }
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    })[0];

  return match ? toHomepageHeroBanner(match) : null;
}
