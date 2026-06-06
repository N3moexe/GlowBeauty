import { useCallback, useEffect, useMemo, useState } from "react";
import { GripVertical, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import EmptyState from "@/components/admin/EmptyState";
import { ShimmerBlock } from "@/pages/admin-modules/shared/ShimmerBlock";
import { RetryPanel } from "@/pages/admin-modules/shared/RetryPanel";
import { getErrorMessage } from "@/pages/admin-modules/shared/utils";
import {
  adminCardClass,
  adminCardPadding,
  adminSpacingScale,
} from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ImageUpload";
import { cn } from "@/lib/utils";

type BannerEntity = {
  id: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  buttonText: string | null;
  buttonLink: string | null;
  position: "top" | "bottom" | "sidebar" | "hero" | "custom";
  displayOn: "homepage" | "shop" | "all" | "custom";
  layout: "full-width" | "centered" | "side-by-side" | "overlay";
  isActive: boolean;
  sortOrder: number;
};

type CategoryEntity = {
  id: number;
  name: string;
  slug: string;
  sortOrder: number;
};

type HeroForm = {
  title: string;
  subtitle: string;
  backgroundImage: string;
  buttonText: string;
  buttonLink: string;
  isActive: boolean;
  sortOrder: string;
};

type PromoForm = {
  active: boolean;
  kicker: string;
  title: string;
  subtitle: string;
  linkLabel: string;
  linkHref: string;
};

const EMPTY_HERO: HeroForm = {
  title: "",
  subtitle: "",
  backgroundImage: "",
  buttonText: "Discover",
  buttonLink: "/boutique",
  isActive: true,
  sortOrder: "100",
};

const EMPTY_PROMO: PromoForm = {
  active: true,
  kicker: "Promo of the week",
  title: "Up to -40%",
  subtitle: "Launch high-converting offers with one click.",
  linkLabel: "View promotions",
  linkHref: "/boutique",
};

interface BannersModuleProps {
  canEdit: boolean;
}

export function BannersModule({ canEdit }: BannersModuleProps) {
  const utils = trpc.useUtils();

  const [heroForm, setHeroForm] = useState<HeroForm>(EMPTY_HERO);
  const [promoForm, setPromoForm] = useState<PromoForm>(EMPTY_PROMO);
  const [featuredCategoryIds, setFeaturedCategoryIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const storefrontQuery = trpc.settings.storefront.useQuery(undefined, {
    enabled: canEdit,
    retry: 1,
  });

  const homepageSettingsQuery = trpc.settings.list.useQuery(
    { prefix: "homepage." },
    { enabled: canEdit, retry: 1 }
  );

  const heroBannersQuery = trpc.banners.getAll.useQuery(undefined, {
    enabled: canEdit,
    retry: 1,
  });

  const categoriesQuery = trpc.category.list.useQuery(undefined, {
    enabled: canEdit,
    retry: 1,
  });

  const settingsSetMutation = trpc.settings.set.useMutation({
    onError: error => toast.error(error.message),
  });

  const bannerCreateMutation = trpc.banners.create.useMutation({
    onError: error => toast.error(error.message),
  });

  const bannerUpdateMutation = trpc.banners.update.useMutation({
    onError: error => toast.error(error.message),
  });

  const categoryUpdateMutation = trpc.category.update.useMutation({
    onError: error => toast.error(error.message),
  });

  const categoryRows = useMemo(
    () => (categoriesQuery.data ?? []) as CategoryEntity[],
    [categoriesQuery.data]
  );

  const heroBanner = useMemo(() => {
    const all = (heroBannersQuery.data?.banners ?? []) as BannerEntity[];
    return (
      all
        .filter(b => b.displayOn === "homepage" && b.position === "hero")
        .sort((a, b) => b.sortOrder - a.sortOrder)[0] ?? null
    );
  }, [heroBannersQuery.data?.banners]);

  const homepageSettingsMap = useMemo(() => {
    const map = new Map<string, string>();
    (
      (homepageSettingsQuery.data ?? []) as Array<{
        key: string;
        value: string;
      }>
    ).forEach(entry => map.set(entry.key, entry.value ?? ""));
    return map;
  }, [homepageSettingsQuery.data]);

  useEffect(() => {
    const defaults = {
      title: heroBanner?.title || "",
      subtitle: heroBanner?.description || "",
      backgroundImage: heroBanner?.imageUrl || "",
      buttonText: heroBanner?.buttonText || "Discover",
      buttonLink: heroBanner?.buttonLink || "/boutique",
      isActive: heroBanner?.isActive ?? true,
      sortOrder: String(heroBanner?.sortOrder ?? 100),
    };
    setHeroForm({
      title: homepageSettingsMap.get("homepage.hero.title") || defaults.title,
      subtitle:
        homepageSettingsMap.get("homepage.hero.subtitle") || defaults.subtitle,
      backgroundImage:
        homepageSettingsMap.get("homepage.hero.background") ||
        defaults.backgroundImage,
      buttonText:
        homepageSettingsMap.get("homepage.hero.buttonText") ||
        defaults.buttonText,
      buttonLink:
        homepageSettingsMap.get("homepage.hero.buttonLink") ||
        defaults.buttonLink,
      isActive:
        (
          homepageSettingsMap.get("homepage.hero.active") || ""
        ).toLowerCase() === "false"
          ? false
          : defaults.isActive,
      sortOrder:
        homepageSettingsMap.get("homepage.hero.sortOrder") ||
        defaults.sortOrder,
    });
  }, [heroBanner, homepageSettingsMap]);

  useEffect(() => {
    const settings = storefrontQuery.data;
    if (!settings) return;
    setPromoForm({
      active: settings.promoActive ?? true,
      kicker: settings.promoKicker || "",
      title: settings.promoTitle || "",
      subtitle: settings.promoSubtitle || "",
      linkLabel: settings.promoLinkLabel || "",
      linkHref: settings.promoLinkHref || "",
    });
  }, [storefrontQuery.data]);

  useEffect(() => {
    if (!categoryRows.length) return;
    const raw = homepageSettingsMap.get("homepage.featuredCategoryIds");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const ids = parsed
            .map((v: unknown) => Number(v))
            .filter((v: number) => categoryRows.some(c => c.id === v));
          if (ids.length > 0) {
            setFeaturedCategoryIds(ids);
            return;
          }
        }
      } catch {
        // ignore parse errors
      }
    }
    setFeaturedCategoryIds(prev => {
      if (prev.length > 0) return prev;
      return categoryRows.slice(0, 4).map(c => c.id);
    });
  }, [categoryRows, homepageSettingsMap]);

  const errorMessage =
    storefrontQuery.error ||
    homepageSettingsQuery.error ||
    heroBannersQuery.error ||
    categoriesQuery.error
      ? getErrorMessage(
          storefrontQuery.error ||
            homepageSettingsQuery.error ||
            heroBannersQuery.error ||
            categoriesQuery.error,
          "Unable to load homepage editor data."
        )
      : null;

  const isLoading =
    canEdit &&
    (storefrontQuery.isLoading ||
      homepageSettingsQuery.isLoading ||
      heroBannersQuery.isLoading ||
      categoriesQuery.isLoading);

  const moveFeaturedCategory = useCallback(
    (categoryId: number, direction: -1 | 1) => {
      setFeaturedCategoryIds(prev => {
        const index = prev.indexOf(categoryId);
        if (index < 0) return prev;
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= prev.length) return prev;
        const updated = [...prev];
        const [picked] = updated.splice(index, 1);
        updated.splice(nextIndex, 0, picked);
        return updated;
      });
    },
    []
  );

  const saveHomepageContent = useCallback(async () => {
    if (!canEdit) {
      toast.error("Homepage editing is not allowed");
      return;
    }
    setSaving(true);
    try {
      const settingsPayload = [
        { key: "promo.active", value: String(promoForm.active) },
        { key: "promo.kicker", value: promoForm.kicker.trim() },
        { key: "promo.title", value: promoForm.title.trim() },
        { key: "promo.subtitle", value: promoForm.subtitle.trim() },
        { key: "promo.linkLabel", value: promoForm.linkLabel.trim() },
        {
          key: "promo.linkHref",
          value: promoForm.linkHref.trim() || "/boutique",
        },
        { key: "homepage.hero.title", value: heroForm.title.trim() },
        { key: "homepage.hero.subtitle", value: heroForm.subtitle.trim() },
        {
          key: "homepage.hero.background",
          value: heroForm.backgroundImage.trim(),
        },
        { key: "homepage.hero.buttonText", value: heroForm.buttonText.trim() },
        {
          key: "homepage.hero.buttonLink",
          value: heroForm.buttonLink.trim() || "/boutique",
        },
        { key: "homepage.hero.active", value: String(heroForm.isActive) },
        {
          key: "homepage.hero.sortOrder",
          value: String(Number(heroForm.sortOrder || "100") || 100),
        },
        {
          key: "homepage.featuredCategoryIds",
          value: JSON.stringify(featuredCategoryIds),
        },
      ];

      await Promise.all(
        settingsPayload.map(entry => settingsSetMutation.mutateAsync(entry))
      );

      const imageValue = heroForm.backgroundImage.trim();
      const sortOrder = Number(heroForm.sortOrder || "100");
      const safeSort = Number.isFinite(sortOrder) ? sortOrder : 100;

      if (
        imageValue &&
        !imageValue.startsWith("http://") &&
        !imageValue.startsWith("https://") &&
        !imageValue.startsWith("data:image/")
      ) {
        throw new Error(
          "Hero image must be an http(s) URL or data:image string"
        );
      }

      if (heroBanner) {
        await bannerUpdateMutation.mutateAsync({
          id: heroBanner.id,
          title: heroForm.title.trim() || heroBanner.title || "Hero",
          description: heroForm.subtitle.trim() || undefined,
          buttonText: heroForm.buttonText.trim() || undefined,
          buttonLink: heroForm.buttonLink.trim() || "/boutique",
          isActive: heroForm.isActive,
          sortOrder: safeSort,
          ...(imageValue ? { imageUrl: imageValue } : {}),
        });
      } else if (heroForm.title.trim() || imageValue) {
        await bannerCreateMutation.mutateAsync({
          title: heroForm.title.trim() || "Hero",
          description: heroForm.subtitle.trim() || undefined,
          buttonText: heroForm.buttonText.trim() || undefined,
          buttonLink: heroForm.buttonLink.trim() || "/boutique",
          imageUrl: imageValue || undefined,
          position: "hero",
          displayOn: "homepage",
          layout: "overlay",
          sortOrder: safeSort,
        });
      }

      if (categoryRows.length > 0 && featuredCategoryIds.length > 0) {
        const selectedSet = new Set(featuredCategoryIds);
        const featured = featuredCategoryIds
          .map(id => categoryRows.find(c => c.id === id))
          .filter((c): c is CategoryEntity => Boolean(c));
        const remaining = categoryRows
          .filter(c => !selectedSet.has(c.id))
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const merged = [...featured, ...remaining];
        await Promise.all(
          merged.map((c, i) =>
            categoryUpdateMutation.mutateAsync({ id: c.id, sortOrder: i + 1 })
          )
        );
      }

      await Promise.all([
        utils.settings.storefront.invalidate(),
        utils.settings.list.invalidate(),
        utils.banners.getAll.invalidate(),
        utils.category.list.invalidate(),
      ]);
      toast.success("Homepage updated");
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : "Failed to save homepage changes";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [
    bannerCreateMutation,
    bannerUpdateMutation,
    canEdit,
    categoryRows,
    categoryUpdateMutation,
    featuredCategoryIds,
    heroBanner,
    heroForm,
    promoForm,
    settingsSetMutation,
    utils.banners.getAll,
    utils.category.list,
    utils.settings.list,
    utils.settings.storefront,
  ]);

  if (!canEdit) {
    return (
      <EmptyState
        title="Access denied"
        description="You do not have permissions to edit homepage content."
      />
    );
  }

  if (errorMessage) {
    return (
      <RetryPanel
        title="Homepage editor unavailable"
        description={errorMessage}
        onRetry={() => {
          void Promise.all([
            storefrontQuery.refetch(),
            homepageSettingsQuery.refetch(),
            heroBannersQuery.refetch(),
            categoriesQuery.refetch(),
          ]);
        }}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <div className={cn(adminCardClass, adminCardPadding, "space-y-3")}>
          <ShimmerBlock className="h-6 w-36" />
          <ShimmerBlock className="h-10 w-full" />
          <ShimmerBlock className="h-24 w-full" />
          <ShimmerBlock className="h-10 w-full" />
        </div>
        <div className={cn(adminCardClass, adminCardPadding, "space-y-3")}>
          <ShimmerBlock className="h-6 w-36" />
          <ShimmerBlock className="h-10 w-full" />
          <ShimmerBlock className="h-10 w-full" />
          <ShimmerBlock className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className={adminSpacingScale.section}>
      <div className="grid gap-4 xl:grid-cols-2">
        <div
          className={cn(
            adminCardClass,
            adminCardPadding,
            adminSpacingScale.stack
          )}
        >
          <h3 className="text-sm font-semibold">Hero content</h3>
          <div className="space-y-2">
            <Label>Hero title</Label>
            <Input
              value={heroForm.title}
              onChange={e =>
                setHeroForm(prev => ({ ...prev, title: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Hero subtitle</Label>
            <Textarea
              rows={3}
              value={heroForm.subtitle}
              onChange={e =>
                setHeroForm(prev => ({ ...prev, subtitle: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Background image URL</Label>
            <Input
              value={heroForm.backgroundImage}
              onChange={e =>
                setHeroForm(prev => ({
                  ...prev,
                  backgroundImage: e.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Upload background</Label>
            <ImageUpload
              onImageUploaded={url =>
                setHeroForm(prev => ({ ...prev, backgroundImage: url }))
              }
            />
          </div>
        </div>

        <div
          className={cn(
            adminCardClass,
            adminCardPadding,
            adminSpacingScale.stack
          )}
        >
          <h3 className="text-sm font-semibold">Promotion strip</h3>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={promoForm.active}
              onCheckedChange={checked =>
                setPromoForm(prev => ({ ...prev, active: Boolean(checked) }))
              }
            />
            <Label>Show promo on homepage</Label>
          </div>
          <Input
            value={promoForm.kicker}
            onChange={e =>
              setPromoForm(prev => ({ ...prev, kicker: e.target.value }))
            }
            placeholder="Kicker"
          />
          <Input
            value={promoForm.title}
            onChange={e =>
              setPromoForm(prev => ({ ...prev, title: e.target.value }))
            }
            placeholder="Title"
          />
          <Textarea
            rows={3}
            value={promoForm.subtitle}
            onChange={e =>
              setPromoForm(prev => ({ ...prev, subtitle: e.target.value }))
            }
            placeholder="Subtitle"
          />
          <Input
            value={promoForm.linkLabel}
            onChange={e =>
              setPromoForm(prev => ({ ...prev, linkLabel: e.target.value }))
            }
            placeholder="Link label"
          />
          <Input
            value={promoForm.linkHref}
            onChange={e =>
              setPromoForm(prev => ({ ...prev, linkHref: e.target.value }))
            }
            placeholder="Link URL"
          />
        </div>
      </div>

      <div
        className={cn(
          adminCardClass,
          adminCardPadding,
          adminSpacingScale.stack
        )}
      >
        <h3 className="text-sm font-semibold">Featured categories</h3>
        {categoryRows.length === 0 ? (
          <EmptyState
            title="No categories"
            description="Create categories before featuring them."
          />
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {categoryRows.map(category => {
              const enabled = featuredCategoryIds.includes(category.id);
              const index = featuredCategoryIds.indexOf(category.id);
              return (
                <div
                  key={category.id}
                  className={cn(
                    "rounded-xl border p-3",
                    enabled
                      ? "border-[#c9a59a] bg-[#fff7f3]"
                      : "border-border bg-white/80"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={enabled}
                        onCheckedChange={checked => {
                          setFeaturedCategoryIds(prev => {
                            if (checked) {
                              if (prev.includes(category.id)) return prev;
                              return [...prev, category.id];
                            }
                            return prev.filter(id => id !== category.id);
                          });
                        }}
                      />
                      <span className="text-sm font-medium">
                        {category.name}
                      </span>
                    </div>
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </div>
                  {enabled ? (
                    <div className="mt-2 flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2"
                        onClick={() => moveFeaturedCategory(category.id, -1)}
                        disabled={index <= 0}
                      >
                        Up
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2"
                        onClick={() => moveFeaturedCategory(category.id, 1)}
                        disabled={
                          index < 0 || index >= featuredCategoryIds.length - 1
                        }
                      >
                        Down
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => void saveHomepageContent()}
          disabled={!canEdit || saving}
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save changes
        </Button>
      </div>
    </div>
  );
}
