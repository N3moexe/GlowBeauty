import { lazy, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Droplets,
  FlaskConical,
  ShieldCheck,
  Sparkles,
  Sun,
  Truck,
  type LucideIcon,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BannerContainer from "@/components/BannerContainer";
import SectionReveal from "@/components/storefront/SectionReveal";
import SeoHead from "@/components/storefront/SeoHead";
import { ProductGridSkeleton } from "@/components/storefront/Skeletons";
import {
  fetchStorefrontLayout,
  STOREFRONT_LAYOUT_QUERY_KEY,
} from "@/lib/storefrontCms";
import type {
  ConcernsSection,
  HomepageLayout,
  HomepageSection,
  NewsletterSection,
  ProductRailSection,
  RichTextSection,
  TrustSection,
} from "@shared/storefront-cms";
import { defaultHomepageLayout } from "@shared/storefront-cms";
// Editable storefront layout replaces the single-hero CMS.
// Legacy home-hero / results-section CMS query keys are no longer used — the
// admin "Storefront Builder" owns those values now.
import { trpc } from "@/lib/trpc";
import {
  getRecentlyViewed,
  RECENTLY_VIEWED_KEY,
  type RecentlyViewedProduct,
} from "@/lib/recently-viewed";
import { useStorefrontSettings } from "@/hooks/useStorefrontSettings";
import StorefrontEditorialHero from "@/components/storefront/sections/EditorialHero";
import TrustBadgesRow from "@/components/storefront/sections/TrustBadgesRow";
import GridShowcaseSection from "@/components/storefront/sections/GridShowcaseSection";
import ProductRail from "@/components/storefront/sections/ProductRail";
import NewsletterStrip from "@/components/storefront/sections/NewsletterStrip";
import RitualSection from "@/components/storefront/sections/RitualSection";

const LazyEmailSubscription = lazy(
  () => import("@/components/EmailSubscription")
);

type CategoryEntity = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  coverImageUrl?: string | null;
};

type ProductEntity = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  comparePrice?: number | null;
  categoryId: number;
  imageUrl?: string | null;
  isNew?: boolean;
  isFeatured?: boolean;
  inStock?: boolean;
};

type Universe = {
  id: string;
  title: string;
  subtitle: string;
  query: string;
  icon: LucideIcon;
  keywords: string[];
};

const universes: Universe[] = [
  {
    id: "hydration",
    title: "Hydratation",
    subtitle:
      "Textures repulpantes, confort longue duree et barriere respectee.",
    query: "hydratant",
    icon: Droplets,
    keywords: ["hydrat", "hyaluron", "ceramide", "aloe"],
  },
  {
    id: "clarity",
    title: "Imperfections",
    subtitle: "Formules ciblees pour lisser, clarifier et reguler la peau.",
    query: "niacinamide",
    icon: FlaskConical,
    keywords: ["imperfection", "acne", "salicy", "niacinamide", "pores"],
  },
  {
    id: "glow",
    title: "Glow / Eclat",
    subtitle: "Actifs illuminateurs pour reveiller l'eclat du teint.",
    query: "vitamine c",
    icon: Sparkles,
    keywords: ["eclat", "vitamine c", "bright", "pigment"],
  },
  {
    id: "spf",
    title: "Protection UV",
    subtitle:
      "SPF quotidien haute protection contre UV et photo-vieillissement.",
    query: "spf",
    icon: Sun,
    keywords: ["spf", "uv", "solaire", "sunscreen"],
  },
];

// Warm palette — all four tones stay in the cream/peach/honey/rose family.
// No cool lavender: it was the one off-brand note on the previous homepage.
const categoryFallbackGradients = [
  "linear-gradient(135deg,#fcebdd 0%,#f5d9cf 42%,#f1cab9 100%)", // peach
  "linear-gradient(135deg,#f6efe2 0%,#f0e0c4 50%,#e8d3a8 100%)", // honey
  "linear-gradient(135deg,#faeede 0%,#f5dbc7 48%,#ecc3a8 100%)", // amber
  "linear-gradient(135deg,#f8e2dc 0%,#f1cfc7 46%,#e6b4ab 100%)", // rose
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function Home() {
  const { settings } = useStorefrontSettings();
  const categoriesQuery = trpc.category.list.useQuery();
  const productsQuery = trpc.product.list.useQuery({ limit: 30 });
  const bestQuery = trpc.product.list.useQuery({ trending: true, limit: 10 });
  const newQuery = trpc.product.list.useQuery({ limit: 10 });
  const featuredQuery = trpc.product.list.useQuery({
    featured: true,
    limit: 10,
  });

  const layoutQuery = useQuery({
    queryKey: STOREFRONT_LAYOUT_QUERY_KEY,
    queryFn: fetchStorefrontLayout,
    staleTime: 15_000,
  });

  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedProduct[]>(
    []
  );

  useEffect(() => {
    const load = () => setRecentlyViewed(getRecentlyViewed(8));
    load();
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === RECENTLY_VIEWED_KEY) load();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", load);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", load);
    };
  }, []);

  const categories = (categoriesQuery.data ?? []) as CategoryEntity[];
  const allProducts = (productsQuery.data?.products ?? []) as ProductEntity[];
  const bestProducts = ((bestQuery.data?.products?.length
    ? bestQuery.data.products
    : allProducts.slice(0, 10)) ?? []) as ProductEntity[];
  const newProducts = (newQuery.data?.products ?? []) as ProductEntity[];
  const featuredProducts = (featuredQuery.data?.products ??
    []) as ProductEntity[];
  const heroProduct = bestProducts[0] ?? allProducts[0] ?? null;

  const storeName = settings.storeName || "SenBonsPlans";
  const layout: HomepageLayout = layoutQuery.data ?? defaultHomepageLayout();

  const defaultConcernCards = useMemo(() => {
    return universes.map((universe, index) => {
      const categoryMatch = categories.find(category => {
        const corpus = normalize(
          `${category.name} ${category.description || ""}`
        );
        return universe.keywords.some(keyword => corpus.includes(keyword));
      });

      const image =
        categoryMatch?.coverImageUrl ||
        categoryMatch?.imageUrl ||
        allProducts.find(product =>
          universe.keywords.some(keyword =>
            normalize(`${product.name} ${product.description || ""}`).includes(
              keyword
            )
          )
        )?.imageUrl ||
        null;

      return {
        id: universe.id,
        title: universe.title,
        subtitle: universe.subtitle,
        href: categoryMatch
          ? `/boutique?cat=${categoryMatch.slug}`
          : `/boutique?q=${encodeURIComponent(universe.query)}`,
        ctaLabel: "Explorer la sélection",
        imageUrl: image,
        gradient:
          categoryFallbackGradients[index % categoryFallbackGradients.length],
        icon: universe.icon,
      };
    });
  }, [allProducts, categories]);

  const pickProductsForRail = (
    source: ProductRailSection["source"],
    limit: number
  ) => {
    const pool =
      source === "trending"
        ? bestProducts
        : source === "featured"
          ? featuredProducts
          : source === "new"
            ? newProducts
            : source === "best_sellers"
              ? bestProducts
              : bestProducts;
    return pool.slice(0, limit);
  };

  const iconForTrust = (icon: string) => {
    switch (icon) {
      case "shield":
        return ShieldCheck;
      case "sparkles":
        return Sparkles;
      case "truck":
      default:
        return Truck;
    }
  };

  const seo = useMemo(() => {
    const base =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://senbonsplans.com";
    return [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: storeName,
        url: base,
      },
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Skincare premium",
        url: `${base}/boutique`,
        mainEntity: {
          "@type": "ItemList",
          itemListElement: bestProducts.slice(0, 8).map((product, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: `${base}/produit/${product.slug}`,
            name: product.name,
          })),
        },
      },
    ];
  }, [bestProducts, storeName]);

  return (
    <div className="page-shell flex min-h-screen flex-col">
      <SeoHead
        title="SenBonsPlans | Boutique skincare premium au Senegal"
        description="Routines skincare premium en CFA: hydratation, eclat, SPF et formules cibles avec livraison rapide au Senegal."
        path="/"
        type="website"
        jsonLd={seo}
      />

      <Navbar />

      <main className="flex-1">
        {settings.promoActive ? (
          <section className="border-b border-brand-border/65 bg-[linear-gradient(90deg,#f8ebe2_0%,#f4e6f4_100%)]">
            <div className="container flex flex-col gap-2 py-2.5 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-accent-2">
                  {settings.promoKicker || "Edition limitee"}
                </p>
                <p className="truncate text-sm font-semibold text-brand-text">
                  {settings.promoTitle}
                </p>
                <p className="line-clamp-1 text-xs text-brand-muted">
                  {settings.promoSubtitle}
                </p>
              </div>
              <Link
                href={settings.promoLinkHref || "/boutique"}
                className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand-accent-2 transition-colors hover:text-brand-accent"
              >
                {settings.promoLinkLabel || "Voir l'offre"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        ) : null}

        <BannerContainer
          page="homepage"
          position="top"
          className="container pt-4"
        />

        {layout.sections
          .filter(section => section.enabled !== false)
          .map(section =>
            renderSection({
              section,
              heroProduct,
              defaultConcernCards,
              iconForTrust,
              pickProductsForRail,
              bestQueryLoading: bestQuery.isLoading && productsQuery.isLoading,
              LazyEmailSubscription,
            })
          )}

        <RitualSection imageUrl={heroProduct?.imageUrl} />

        {recentlyViewed.length > 0 ? (
          <ProductRail
            kicker="Récemment vus"
            title="Reprenez votre rituel en un clic"
            actionLabel="Voir la boutique"
            actionHref="/boutique"
            products={recentlyViewed}
          />
        ) : null}

        <BannerContainer
          page="homepage"
          position="bottom"
          className="container section-shell-sm"
        />
      </main>

      <Footer />
    </div>
  );
}

// ─── Dynamic section renderer ───
// Renders each admin-configured section. Disabled sections are filtered out
// before we reach this function. Unknown types are ignored (null) so adding a
// new section type on the server is always safe.
type RenderDeps = {
  section: HomepageSection;
  heroProduct: ProductEntity | null;
  defaultConcernCards: Array<{
    id: string;
    title: string;
    subtitle: string;
    href: string;
    ctaLabel: string;
    imageUrl: string | null;
    gradient: string;
    icon: LucideIcon;
  }>;
  iconForTrust: (icon: string) => LucideIcon;
  pickProductsForRail: (
    source: ProductRailSection["source"],
    limit: number
  ) => ProductEntity[];
  bestQueryLoading: boolean;
  LazyEmailSubscription: React.LazyExoticComponent<
    React.ComponentType<{
      variant?: "inline" | "card";
      title?: string;
      description?: string;
    }>
  >;
};

function renderSection(deps: RenderDeps): React.ReactNode {
  const { section } = deps;
  switch (section.type) {
    case "hero":
      return (
        <StorefrontEditorialHero
          key={section.id}
          badgeText={section.badge || "Skincare, version Sénégal"}
          title={section.title || "Votre peau, la version qu'elle attendait."}
          subtitle={
            section.subtitle ||
            "Des formules choisies avec soin pour le climat de Dakar."
          }
          primaryCta={{
            label: section.primaryCtaLabel || "Voir la boutique",
            href: section.primaryCtaHref || "/boutique",
          }}
          secondaryCta={{
            label: section.secondaryCtaLabel || "Trouver ma routine en 2 min",
            href: section.secondaryCtaHref || "/boutique?q=routine",
          }}
          mediaAlt={section.title || "Routine skincare premium"}
          mediaImageUrl={section.imageUrl || deps.heroProduct?.imageUrl || ""}
          overlay={{
            kicker: section.overlayKicker || "Routine du moment",
            title:
              section.overlayTitle ||
              "Des routines pensées pour des résultats visibles",
            description:
              section.overlayDescription ||
              "Matin, soir, semaine. On vous guide pas à pas.",
            href: section.overlayCtaHref || "/boutique?q=routine",
            ctaLabel: section.overlayCtaLabel || "Voir le rituel",
            icon: Sparkles,
          }}
        />
      );

    case "trust": {
      const trust = section as TrustSection;
      return (
        <TrustBadgesRow
          key={section.id}
          items={trust.items.map(item => ({
            title: item.title,
            subtitle: item.subtitle,
            icon: deps.iconForTrust(item.icon),
          }))}
        />
      );
    }

    case "concerns": {
      const concerns = section as ConcernsSection;
      const items =
        concerns.items.length > 0
          ? concerns.items.map((tile, index) => ({
              id: tile.id,
              title: tile.title,
              subtitle: tile.subtitle,
              href: tile.href,
              ctaLabel: "Explorer la sélection",
              imageUrl: null,
              gradient:
                tile.gradient ||
                deps.defaultConcernCards[
                  index % deps.defaultConcernCards.length
                ]?.gradient ||
                "",
              icon:
                deps.defaultConcernCards[
                  index % deps.defaultConcernCards.length
                ]?.icon ?? Sparkles,
            }))
          : deps.defaultConcernCards;
      return (
        <GridShowcaseSection
          key={section.id}
          kicker={concerns.kicker || "Par objectif peau"}
          title={concerns.title || "Qu'est-ce que votre peau vous demande ?"}
          subtitle={concerns.subtitle || ""}
          actionHref={concerns.actionHref || "/boutique"}
          actionLabel={concerns.actionLabel || "Voir toute la boutique"}
          items={items}
        />
      );
    }

    case "product_rail": {
      const rail = section as ProductRailSection;
      const products = deps.pickProductsForRail(rail.source, rail.limit);
      if (deps.bestQueryLoading) {
        return (
          <section key={section.id} className="container section-shell">
            <div className="ui-stack-3">
              <div>
                <p className="section-kicker text-brand-accent-2">
                  {rail.kicker || "Best sellers"}
                </p>
                <h2 className="section-title">
                  {rail.title || "Les essentiels les plus demandés"}
                </h2>
              </div>
              <ProductGridSkeleton count={rail.limit} />
            </div>
          </section>
        );
      }
      return (
        <ProductRail
          key={section.id}
          kicker={rail.kicker || "Best sellers"}
          title={rail.title || "Les essentiels les plus demandés"}
          actionLabel={rail.actionLabel || "Voir plus"}
          actionHref={rail.actionHref || "/boutique"}
          products={products}
        />
      );
    }

    case "newsletter": {
      const newsletter = section as NewsletterSection;
      return (
        <NewsletterStrip
          key={section.id}
          title={newsletter.title || "−10 % sur votre première commande"}
          subtitle={
            newsletter.subtitle ||
            "Inscrivez-vous et recevez votre code par email. Plus nos sélections skincare du samedi."
          }
          lazyEmailSubscription={deps.LazyEmailSubscription}
        />
      );
    }

    case "rich_text": {
      const rich = section as RichTextSection;
      return (
        <section key={section.id} className="container section-shell-sm">
          <SectionReveal className="ui-stack-2">
            {rich.kicker ? (
              <p className="section-kicker text-brand-accent-2">
                {rich.kicker}
              </p>
            ) : null}
            {rich.title ? (
              <h2 className="section-title">{rich.title}</h2>
            ) : null}
            {rich.body ? (
              <p className="section-description max-w-3xl">{rich.body}</p>
            ) : null}
            {rich.ctaLabel && rich.ctaHref ? (
              <Link
                href={rich.ctaHref}
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-accent-2 transition-colors hover:text-brand-accent"
              >
                {rich.ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </SectionReveal>
        </section>
      );
    }
  }
  return null;
}
