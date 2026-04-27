import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Droplets,
  FlaskConical,
  Filter,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BannerContainer from "@/components/BannerContainer";
import ProductCard from "@/components/ProductCard";
import SectionReveal from "@/components/storefront/SectionReveal";
import SeoHead from "@/components/storefront/SeoHead";
import { ProductGridSkeleton } from "@/components/storefront/Skeletons";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";

function formatCFA(amount: number) {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(amount))} CFA`;
}

function normalizeForMatch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const SORT_OPTIONS = [
  { value: "newest", label: "Plus recents" },
  { value: "price-low", label: "Prix croissant" },
  { value: "price-high", label: "Prix decroissant" },
] as const;

type SortOption = (typeof SORT_OPTIONS)[number]["value"];

const QUICK_CONCERN_FILTERS = [
  { id: "hydration", label: "Hydratation", query: "hydratant", icon: Droplets },
  { id: "imperfections", label: "Imperfections", query: "acne", icon: FlaskConical },
  { id: "eclat", label: "Eclat", query: "eclat", icon: Sparkles },
  { id: "protection", label: "Protection UV", query: "spf", icon: Sun },
  { id: "sensitive", label: "Peau sensible", query: "peau sensible", icon: ShieldCheck },
] as const;

const FALLBACK_PRICE_MIN = 0;
const FALLBACK_PRICE_MAX = 1_000_000;
const PRICE_STEP = 500;

type ActiveFilterTag = {
  key: string;
  label: string;
  onRemove: () => void;
};

export default function Shop() {
  const shouldReduceMotion = useReducedMotion();
  const searchString = useSearch();
  const params = useMemo(() => new URLSearchParams(searchString), [searchString]);

  const parsedFilters = useMemo(() => {
    const parsedSort = (params.get("sort") || "newest") as SortOption;
    const sort = SORT_OPTIONS.some(option => option.value === parsedSort) ? parsedSort : "newest";
    const rawMin = params.get("minPrice");
    const rawMax = params.get("maxPrice");
    const parsedMin = rawMin != null ? Number(rawMin) : null;
    const parsedMax = rawMax != null ? Number(rawMax) : null;

    return {
      query: params.get("q")?.trim() || "",
      categorySlug: params.get("cat")?.trim() || "",
      sortBy: sort,
      // Null = "no URL filter" — fall back to computed priceBounds once products load.
      minPrice: parsedMin != null && Number.isFinite(parsedMin) ? parsedMin : null,
      maxPrice: parsedMax != null && Number.isFinite(parsedMax) ? parsedMax : null,
    };
  }, [params]);

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [search, setSearch] = useState(parsedFilters.query);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState(parsedFilters.categorySlug);
  const [sortBy, setSortBy] = useState<SortOption>(parsedFilters.sortBy);
  const [priceRange, setPriceRange] = useState<[number, number]>([
    parsedFilters.minPrice ?? FALLBACK_PRICE_MIN,
    parsedFilters.maxPrice ?? FALLBACK_PRICE_MAX,
  ]);

  useEffect(() => {
    setSearch(parsedFilters.query);
    setSelectedCategorySlug(parsedFilters.categorySlug);
    setSortBy(parsedFilters.sortBy);
  }, [parsedFilters]);

  const { data: categories } = trpc.category.list.useQuery();
  const productsQuery = trpc.product.list.useQuery({ limit: 300 });

  const allProducts = productsQuery.data?.products || [];
  const selectedCategory = categories?.find(category => category.slug === selectedCategorySlug);

  const priceBounds = useMemo(() => {
    if (allProducts.length === 0) {
      return { min: FALLBACK_PRICE_MIN, max: FALLBACK_PRICE_MAX };
    }

    const prices = allProducts
      .map(product => Number(product.price))
      .filter(value => Number.isFinite(value) && value >= 0);

    if (prices.length === 0) {
      return { min: FALLBACK_PRICE_MIN, max: FALLBACK_PRICE_MAX };
    }

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const normalizedMin = Math.max(0, Math.floor((minPrice * 0.9) / PRICE_STEP) * PRICE_STEP);
    const normalizedMax = Math.max(
      normalizedMin + PRICE_STEP,
      Math.ceil((maxPrice * 1.1) / PRICE_STEP) * PRICE_STEP
    );

    return { min: normalizedMin, max: normalizedMax };
  }, [allProducts]);

  useEffect(() => {
    // When priceBounds update (products loaded) or URL filters change, snap
    // priceRange to the URL value if present, otherwise to the full computed
    // bounds — never a stale fallback that shows zero products.
    const urlMin = parsedFilters.minPrice;
    const urlMax = parsedFilters.maxPrice;
    const targetMin = urlMin != null ? clamp(urlMin, priceBounds.min, priceBounds.max) : priceBounds.min;
    const targetMax = urlMax != null ? clamp(urlMax, targetMin, priceBounds.max) : priceBounds.max;
    setPriceRange(([currentMin, currentMax]) => {
      if (currentMin === targetMin && currentMax === targetMax) return [currentMin, currentMax];
      return [targetMin, targetMax];
    });
  }, [priceBounds.max, priceBounds.min, parsedFilters.minPrice, parsedFilters.maxPrice]);

  const normalizedSearch = normalizeForMatch(search.trim());
  const hasSearchTerm = normalizedSearch.length > 0;

  const categoryCounts = useMemo(() => {
    const countsByCategory = new Map<number, number>();
    let total = 0;

    allProducts.forEach(product => {
      const inPriceRange = product.price >= priceRange[0] && product.price <= priceRange[1];
      if (!inPriceRange) return;

      if (hasSearchTerm) {
        const corpus = normalizeForMatch(`${product.name} ${product.description ?? ""}`);
        if (!corpus.includes(normalizedSearch)) return;
      }

      total += 1;
      countsByCategory.set(product.categoryId, (countsByCategory.get(product.categoryId) || 0) + 1);
    });

    return { total, countsByCategory };
  }, [allProducts, hasSearchTerm, normalizedSearch, priceRange]);

  const filteredProducts = useMemo(() => {
    const categoryId = selectedCategory?.id;

    const visible = allProducts.filter(product => {
      if (categoryId && product.categoryId !== categoryId) return false;
      if (product.price < priceRange[0] || product.price > priceRange[1]) return false;

      if (hasSearchTerm) {
        const corpus = normalizeForMatch(`${product.name} ${product.description ?? ""}`);
        if (!corpus.includes(normalizedSearch)) return false;
      }

      return true;
    });

    const sorted = [...visible];

    if (sortBy === "price-low") {
      sorted.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-high") {
      sorted.sort((a, b) => b.price - a.price);
    } else {
      sorted.sort((a, b) => {
        const dateA = new Date(a.createdAt as any).getTime();
        const dateB = new Date(b.createdAt as any).getTime();
        return dateB - dateA;
      });
    }

    return sorted;
  }, [allProducts, hasSearchTerm, normalizedSearch, priceRange, selectedCategory?.id, sortBy]);

  const activeFilterTags = useMemo<ActiveFilterTag[]>(() => {
    const tags: ActiveFilterTag[] = [];

    if (selectedCategorySlug) {
      tags.push({
        key: "category",
        label: `Categorie: ${selectedCategory?.name || selectedCategorySlug}`,
        onRemove: () => setSelectedCategorySlug(""),
      });
    }

    if (search.trim()) {
      tags.push({
        key: "search",
        label: `Recherche: ${search.trim()}`,
        onRemove: () => setSearch(""),
      });
    }

    if (priceRange[0] !== priceBounds.min || priceRange[1] !== priceBounds.max) {
      tags.push({
        key: "price",
        label: `Prix: ${formatCFA(priceRange[0])} - ${formatCFA(priceRange[1])}`,
        onRemove: () => setPriceRange([priceBounds.min, priceBounds.max]),
      });
    }

    if (sortBy !== "newest") {
      tags.push({
        key: "sort",
        label: `Tri: ${SORT_OPTIONS.find(option => option.value === sortBy)?.label || sortBy}`,
        onRemove: () => setSortBy("newest"),
      });
    }

    return tags;
  }, [priceBounds.max, priceBounds.min, priceRange, search, selectedCategory?.name, selectedCategorySlug, sortBy]);

  const activeFilterCount = activeFilterTags.length;

  const clearFilters = () => {
    setSearch("");
    setSelectedCategorySlug("");
    setSortBy("newest");
    setPriceRange([priceBounds.min, priceBounds.max]);
    setMobileFiltersOpen(false);
  };

  const canonicalPath = useMemo(() => {
    const query = new URLSearchParams();
    if (search.trim()) query.set("q", search.trim());
    if (selectedCategorySlug) query.set("cat", selectedCategorySlug);
    if (priceRange[0] !== priceBounds.min) query.set("minPrice", String(priceRange[0]));
    if (priceRange[1] !== priceBounds.max) query.set("maxPrice", String(priceRange[1]));
    if (sortBy !== "newest") query.set("sort", sortBy);
    const queryString = query.toString();
    return queryString ? `/boutique?${queryString}` : "/boutique";
  }, [priceBounds.max, priceBounds.min, priceRange, search, selectedCategorySlug, sortBy]);

  const seoTitle = selectedCategory
    ? `${selectedCategory.name} | Boutique skincare | SenBonsPlans`
    : search.trim()
      ? `${search.trim()} | Recherche skincare | SenBonsPlans`
      : "Boutique skincare | SenBonsPlans";

  const seoDescription = selectedCategory
    ? `Explorez la categorie ${selectedCategory.name} avec livraison rapide et paiement securise sur SenBonsPlans.`
    : search.trim()
      ? `Resultats pour ${search.trim()}. Comparez les meilleurs produits skincare et beaute disponibles maintenant.`
      : "Parcourez la boutique SenBonsPlans: soins visage, corps, routines beaute et offres du moment.";

  const shopSeoJsonLd = useMemo(() => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://senbonsplans.com";
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: selectedCategory ? `Categorie ${selectedCategory.name}` : "Boutique SenBonsPlans",
      url: `${baseUrl}${canonicalPath}`,
      mainEntity: {
        "@type": "ItemList",
        itemListElement: filteredProducts.slice(0, 20).map((product, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${baseUrl}/produit/${product.slug}`,
          name: product.name,
        })),
      },
    };
  }, [canonicalPath, filteredProducts, selectedCategory]);

  const renderFilterPanel = () => (
    <div className="space-y-4">
      <motion.section
        initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
        className="rounded-2xl border border-border/70 bg-white/85 p-4 shadow-sm backdrop-blur"
      >
        <h3 className="mb-2 inline-flex items-center gap-2 text-sm font-semibold">
          <Search className="h-4 w-4 text-crimson" />
          Recherche
        </h3>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Produit, marque, actif..."
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="h-11 w-full rounded-xl border border-border/70 bg-white pl-9 pr-3 text-sm outline-none transition-colors focus:border-crimson/40"
          />
        </div>
      </motion.section>

      <motion.section
        initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: "easeOut", delay: 0.03 }}
        className="rounded-2xl border border-border/70 bg-white/85 p-4 shadow-sm backdrop-blur"
      >
        <h3 className="mb-3 text-sm font-semibold">Categories</h3>
        <div className="space-y-2">
          <motion.button
            type="button"
            whileHover={shouldReduceMotion ? undefined : { y: -1 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
            onClick={() => setSelectedCategorySlug("")}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${
              selectedCategorySlug === ""
                ? "bg-gradient-to-r from-crimson to-crimson-light text-white shadow-sm"
                : "bg-white hover:bg-muted"
            }`}
          >
            <span>Toutes</span>
            <span className="text-xs opacity-85">{categoryCounts.total}</span>
          </motion.button>

          {categories?.map(category => {
            const isActive = selectedCategorySlug === category.slug;
            const count = categoryCounts.countsByCategory.get(category.id) || 0;

            return (
              <motion.button
                key={category.id}
                type="button"
                whileHover={shouldReduceMotion ? undefined : { y: -1 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                onClick={() => setSelectedCategorySlug(category.slug)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-gradient-to-r from-crimson to-crimson-light text-white shadow-sm"
                    : "bg-white hover:bg-muted"
                }`}
              >
                <span>{category.name}</span>
                <span className="text-xs opacity-85">{count}</span>
              </motion.button>
            );
          })}
        </div>
      </motion.section>

      <motion.section
        initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: "easeOut", delay: 0.05 }}
        className="rounded-2xl border border-border/70 bg-white/85 p-4 shadow-sm backdrop-blur"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Prix</h3>
          <span className="text-xs text-muted-foreground">Instantane</span>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          {formatCFA(priceRange[0])} - {formatCFA(priceRange[1])}
        </p>
        <Slider
          min={priceBounds.min}
          max={priceBounds.max}
          step={PRICE_STEP}
          value={[priceRange[0], priceRange[1]]}
          onValueChange={values => {
            if (!Array.isArray(values) || values.length < 2) return;
            const min = Math.min(values[0], values[1]);
            const max = Math.max(values[0], values[1]);
            setPriceRange([min, max]);
          }}
          className="[&_[data-slot=slider-range]]:bg-gradient-to-r [&_[data-slot=slider-range]]:from-crimson [&_[data-slot=slider-range]]:to-crimson-light [&_[data-slot=slider-thumb]]:border-crimson"
        />
      </motion.section>

      <motion.section
        initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.24, ease: "easeOut", delay: 0.07 }}
        className="rounded-2xl border border-border/70 bg-white/85 p-4 shadow-sm backdrop-blur"
      >
        <h3 className="mb-2 text-sm font-semibold">Trier</h3>
        <div className="grid grid-cols-1 gap-2">
          {SORT_OPTIONS.map(option => {
            const active = sortBy === option.value;
            return (
              <motion.button
                key={option.value}
                type="button"
                whileHover={shouldReduceMotion ? undefined : { y: -1 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                onClick={() => setSortBy(option.value)}
                className={`rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-gradient-to-r from-crimson to-crimson-light text-white shadow-sm"
                    : "bg-white hover:bg-muted"
                }`}
              >
                {option.label}
              </motion.button>
            );
          })}
        </div>
      </motion.section>

      {activeFilterCount > 0 ? (
        <Button variant="outline" onClick={clearFilters} className="w-full rounded-xl border-crimson/35 text-crimson hover:bg-crimson/5">
          <X className="mr-2 h-4 w-4" />
          Clear all
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="page-shell flex min-h-screen flex-col">
      <SeoHead
        title={seoTitle}
        description={seoDescription}
        path={canonicalPath}
        type="website"
        jsonLd={shopSeoJsonLd}
      />
      <Navbar />
      <BannerContainer page="shop" position="top" className="container pt-4" />

      <main className="container section-shell flex-1">
        <SectionReveal className="ui-stack-3">
          <nav className="text-sm text-muted-foreground">
            <Link href="/" className="transition-colors hover:text-crimson">
              Accueil
            </Link>
            <span className="mx-2">/</span>
            <span className="font-medium text-foreground">
              {selectedCategory ? selectedCategory.name : "Boutique"}
            </span>
          </nav>

          <header className="flex flex-wrap items-end justify-between gap-3">
            <div className="ui-stack-1">
              <p className="section-kicker">Catalogue</p>
              <h1 className="headline-title">
                {selectedCategory
                  ? selectedCategory.name
                  : search.trim()
                    ? `Resultats pour "${search.trim()}"`
                    : "Tous les produits"}
              </h1>
              <p className="section-description">
                {filteredProducts.length} produit{filteredProducts.length > 1 ? "s" : ""} - tri:{" "}
                {SORT_OPTIONS.find(option => option.value === sortBy)?.label.toLowerCase()}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                <SheetTrigger asChild>
                  <Button variant="soft" className="rounded-xl lg:hidden">
                    <Filter className="h-4 w-4" />
                    Filtres
                    {activeFilterCount > 0 ? (
                      <span className="rounded-full bg-crimson px-1.5 py-0.5 text-[10px] text-white">
                        {activeFilterCount}
                      </span>
                    ) : null}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-full p-0 sm:max-w-sm">
                  <SheetHeader className="border-b border-border/70 text-left">
                    <SheetTitle>Filtres boutique</SheetTitle>
                    <SheetDescription>
                      Mise a jour instantanee des produits.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="p-4">{renderFilterPanel()}</div>
                </SheetContent>
              </Sheet>
            </div>
          </header>

          <div className="rounded-2xl border border-border/70 bg-white/75 p-3 backdrop-blur">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtres actifs
            </div>
            <div className="flex flex-wrap gap-2">
              <AnimatePresence mode="popLayout">
                {activeFilterTags.map(tag => (
                  <motion.button
                    key={tag.key}
                    type="button"
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4, scale: 0.94 }}
                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: "easeOut" }}
                    onClick={tag.onRemove}
                    className="inline-flex items-center gap-1.5 rounded-full border border-crimson/30 bg-crimson/8 px-3 py-1.5 text-xs font-medium text-crimson hover:bg-crimson/14"
                  >
                    {tag.label}
                    <X className="h-3 w-3" />
                  </motion.button>
                ))}
              </AnimatePresence>
              {activeFilterTags.length === 0 ? (
                <span className="text-sm text-muted-foreground">
                  Aucun filtre applique.
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Skincare rapide
            </span>
            {QUICK_CONCERN_FILTERS.map(filter => {
              const active = normalizeForMatch(search).includes(normalizeForMatch(filter.query));
              return (
                <motion.button
                  key={filter.id}
                  type="button"
                  whileHover={shouldReduceMotion ? undefined : { y: -1 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                  onClick={() => setSearch(filter.query)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "border-crimson/40 bg-gradient-to-r from-crimson to-crimson-light text-white"
                      : "border-border/70 bg-white text-foreground hover:border-crimson/35 hover:text-crimson"
                  }`}
                >
                  <filter.icon className="h-3.5 w-3.5" />
                  {filter.label}
                </motion.button>
              );
            })}
          </div>
        </SectionReveal>

        <SectionReveal className="mt-6 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-32">{renderFilterPanel()}</div>
          </aside>

          <section className="min-w-0">
            {productsQuery.isLoading ? (
              <ProductGridSkeleton count={10} />
            ) : filteredProducts.length > 0 ? (
              <motion.div layout className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                <AnimatePresence mode="popLayout">
                  {filteredProducts.map(product => (
                    <motion.div
                      key={product.id}
                      layout
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
                      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
                    >
                      <ProductCard product={product} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
              <div className="section-frame p-10 text-center">
                <Sparkles className="mx-auto h-11 w-11 text-muted-foreground/55" />
                <h2 className="mt-4 text-xl font-bold">Aucun produit trouve</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ajustez la recherche, le prix ou les categories pour retrouver des produits.
                </p>
                <Button variant="soft" onClick={clearFilters} className="mt-5 rounded-xl">
                  Reinitialiser les filtres
                </Button>
              </div>
            )}
          </section>
        </SectionReveal>

        <BannerContainer page="shop" position="bottom" className="mt-8" />
      </main>

      <Footer />
    </div>
  );
}
