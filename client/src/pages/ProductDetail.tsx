import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  Minus,
  Moon,
  Package,
  Plus,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Star,
  Sun,
  Truck,
  Zap,
  ZoomIn,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/contexts/CartContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import ProductReviews from "@/components/ProductReviews";
import SectionReveal from "@/components/storefront/SectionReveal";
import SectionHeader from "@/components/storefront/SectionHeader";
import SeoHead from "@/components/storefront/SeoHead";
import { ProductGridSkeleton } from "@/components/storefront/Skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MediaWithFallback } from "@/components/ui/media-with-fallback";
import { trackRecentlyViewed } from "@/lib/recently-viewed";

function formatCFA(amount: number) {
  return `${new Intl.NumberFormat("fr-FR").format(amount)} CFA`;
}

function normalizeBullet(line: string) {
  return line
    .trim()
    .replace(/^[-*]+\s*/, "")
    .trim();
}

function normalizeTextList(input: unknown, maxItems = 12) {
  if (!Array.isArray(input)) return [];
  return input
    .map(entry => (typeof entry === "string" ? normalizeBullet(entry) : ""))
    .filter((entry): entry is string => entry.length > 0)
    .slice(0, maxItems);
}

function normalizeRoutineSteps(input: unknown, maxItems = 5) {
  if (!Array.isArray(input)) return [];
  return input
    .map(entry => {
      if (!entry || typeof entry !== "object") return null;
      const titleRaw = (entry as { title?: unknown }).title;
      const textRaw = (entry as { text?: unknown }).text;
      const title = typeof titleRaw === "string" ? titleRaw.trim() : "";
      const text = typeof textRaw === "string" ? textRaw.trim() : "";
      if (!title || !text) return null;
      return { title, text };
    })
    .filter((entry): entry is { title: string; text: string } => Boolean(entry))
    .slice(0, maxItems);
}

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });

  const productQuery = trpc.product.bySlug.useQuery(
    { slug: slug || "" },
    { enabled: !!slug }
  );

  const relatedQuery = trpc.product.related.useQuery(
    {
      categoryId: productQuery.data?.categoryId || 0,
      excludeId: productQuery.data?.id || 0,
      limit: 10,
    },
    { enabled: !!productQuery.data }
  );

  const trendingBackupQuery = trpc.product.list.useQuery(
    { trending: true, limit: 12 },
    { enabled: !!productQuery.data }
  );

  const reviewsQuery = trpc.reviews.list.useQuery(
    { productId: productQuery.data?.id || 0, limit: 3, offset: 0 },
    { enabled: !!productQuery.data?.id }
  );
  const averageRatingQuery = trpc.reviews.averageRating.useQuery(
    { productId: productQuery.data?.id || 0 },
    { enabled: !!productQuery.data?.id }
  );

  const { data: categories } = trpc.category.list.useQuery();
  const category = categories?.find(
    entry => entry.id === productQuery.data?.categoryId
  );

  const images = useMemo(() => {
    if (!productQuery.data) return [];
    const list: string[] = [];
    if (productQuery.data.imageUrl) list.push(productQuery.data.imageUrl);
    if (productQuery.data.images) {
      try {
        const parsed = JSON.parse(productQuery.data.images);
        if (Array.isArray(parsed)) list.push(...parsed.filter(Boolean));
      } catch {
        // Ignore malformed optional gallery payload
      }
    }
    return list.length ? list : [""];
  }, [productQuery.data]);

  useEffect(() => {
    setSelectedImage(0);
    setIsZoomed(false);
  }, [productQuery.data?.id]);

  const legacyDescriptionLines = useMemo<string[]>(() => {
    if (!productQuery.data?.description) return [];
    return productQuery.data.description
      .split("\n")
      .map((line: string) => normalizeBullet(line))
      .filter((line: string): line is string => Boolean(line));
  }, [productQuery.data?.description]);

  const benefitBullets = useMemo<string[]>(() => {
    return normalizeTextList(productQuery.data?.benefits, 10);
  }, [productQuery.data?.benefits]);

  const descriptionBullets = useMemo<string[]>(() => {
    return normalizeTextList(productQuery.data?.descriptionBullets, 12);
  }, [productQuery.data?.descriptionBullets]);

  const routine = useMemo(() => {
    const candidate = productQuery.data?.routine;
    if (!candidate || typeof candidate !== "object") {
      return { am: [], pm: [] };
    }
    const data = candidate as { am?: unknown; pm?: unknown };
    return {
      am: normalizeRoutineSteps(data.am, 5),
      pm: normalizeRoutineSteps(data.pm, 5),
    };
  }, [productQuery.data?.routine]);

  const canonicalPath = slug ? `/produit/${slug}` : "/boutique";
  const selectedImageSrc = images[selectedImage] || "";

  const productSeoDescription = useMemo(() => {
    if (descriptionBullets.length > 0)
      return descriptionBullets.slice(0, 2).join(" ");
    if (legacyDescriptionLines.length > 0)
      return legacyDescriptionLines.slice(0, 2).join(" ");
    if (productQuery.data?.name) {
      return `Decouvrez ${productQuery.data.name} sur SenBonsPlans avec livraison rapide et paiement securise.`;
    }
    return "Produit skincare et beaute disponible sur SenBonsPlans.";
  }, [descriptionBullets, legacyDescriptionLines, productQuery.data?.name]);

  const productSeoJsonLd = useMemo(() => {
    if (!productQuery.data) return null;
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://senbonsplans.com";
    const image = images.find(Boolean) || productQuery.data.imageUrl || "";
    return {
      "@context": "https://schema.org",
      "@type": "Product",
      name: productQuery.data.name,
      description: productSeoDescription,
      sku: `${productQuery.data.id}`,
      image: image ? [image] : undefined,
      url: `${baseUrl}${canonicalPath}`,
      brand: {
        "@type": "Brand",
        name: "SenBonsPlans",
      },
      offers: {
        "@type": "Offer",
        url: `${baseUrl}${canonicalPath}`,
        priceCurrency: "XOF",
        price: `${productQuery.data.price}`,
        availability:
          productQuery.data.inStock === false
            ? "https://schema.org/OutOfStock"
            : "https://schema.org/InStock",
      },
    };
  }, [canonicalPath, images, productQuery.data, productSeoDescription]);

  const discount = productQuery.data?.comparePrice
    ? Math.round(
        ((productQuery.data.comparePrice - productQuery.data.price) /
          productQuery.data.comparePrice) *
          100
      )
    : 0;

  const inStock = productQuery.data?.inStock !== false;
  const reviewCount = reviewsQuery.data?.length || 0;
  const averageRating = averageRatingQuery.data?.rating || 0;
  const crossSellProducts = useMemo(() => {
    const related = relatedQuery.data ?? [];
    const trendingPool = trendingBackupQuery.data?.products ?? [];
    const currentId = productQuery.data?.id ?? 0;
    const seen = new Set<number>([currentId]);
    const merged: typeof related = [];
    for (const product of related) {
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      merged.push(product);
      if (merged.length >= 8) break;
    }
    for (const product of trendingPool) {
      if (merged.length >= 4) break;
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      merged.push(product as (typeof related)[number]);
    }
    return merged;
  }, [
    productQuery.data?.id,
    relatedQuery.data,
    trendingBackupQuery.data?.products,
  ]);

  useEffect(() => {
    if (!productQuery.data) return;
    trackRecentlyViewed({
      id: productQuery.data.id,
      name: productQuery.data.name,
      slug: productQuery.data.slug,
      price: productQuery.data.price,
      comparePrice: productQuery.data.comparePrice,
      imageUrl: productQuery.data.imageUrl,
      isNew: productQuery.data.isNew,
      isFeatured: productQuery.data.isFeatured,
      inStock: productQuery.data.inStock,
    });
  }, [productQuery.data]);

  const handleAddToCart = () => {
    if (!productQuery.data) return;
    addItem(
      {
        productId: productQuery.data.id,
        name: productQuery.data.name,
        price: productQuery.data.price,
        imageUrl: productQuery.data.imageUrl || "",
      },
      quantity
    );
    toast.success("Ajoute au panier", {
      description: `${quantity} x ${productQuery.data.name}`,
    });
  };

  const handleBuyNow = () => {
    handleAddToCart();
    setLocation("/panier");
  };

  if (productQuery.isLoading) {
    return (
      <div className="page-shell flex min-h-screen flex-col">
        <SeoHead
          title="Chargement produit | SenBonsPlans"
          description="Chargement de la fiche produit."
          path={canonicalPath}
          robots="noindex, nofollow"
        />
        <Navbar />
        <main className="container section-shell flex-1">
          <div className="grid gap-8 lg:grid-cols-2">
            <Skeleton className="aspect-[4/5] rounded-[1.4rem]" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-10 w-1/3" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!productQuery.data) {
    return (
      <div className="page-shell flex min-h-screen flex-col">
        <SeoHead
          title="Produit introuvable | SenBonsPlans"
          description="Le produit demande est indisponible ou introuvable."
          path={canonicalPath}
          robots="noindex, nofollow"
        />
        <Navbar />
        <main className="container section-shell flex-1 text-center">
          <div className="section-frame mx-auto max-w-xl p-10">
            <Package className="mx-auto h-16 w-16 text-muted-foreground/35" />
            <h1 className="mt-4 text-2xl font-bold">Produit non trouve</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ce produit est indisponible ou a ete retire du catalogue.
            </p>
            <Link href="/boutique">
              <Button variant="soft" className="mt-6 rounded-xl">
                Retour a la boutique
              </Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="page-shell flex min-h-screen flex-col">
      <SeoHead
        title={`${productQuery.data.name} | SenBonsPlans`}
        description={productSeoDescription}
        path={canonicalPath}
        type="product"
        image={selectedImageSrc || productQuery.data.imageUrl || undefined}
        jsonLd={productSeoJsonLd || undefined}
      />
      <Navbar />

      <main className="container section-shell flex-1 pb-28 md:pb-32 lg:pb-0">
        <SectionReveal className="ui-stack-3">
          <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <Link href="/" className="transition-colors hover:text-crimson">
              Accueil
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link
              href="/boutique"
              className="transition-colors hover:text-crimson"
            >
              Boutique
            </Link>
            {category ? (
              <>
                <ChevronRight className="h-3 w-3" />
                <Link
                  href={`/boutique?cat=${category.slug}`}
                  className="transition-colors hover:text-crimson"
                >
                  {category.name}
                </Link>
              </>
            ) : null}
            <ChevronRight className="h-3 w-3" />
            <span className="max-w-full truncate font-medium text-foreground">
              {productQuery.data.name}
            </span>
          </nav>
        </SectionReveal>

        <SectionReveal className="mt-6 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="min-w-0">
            <div className="section-frame overflow-hidden p-0">
              <button
                type="button"
                onClick={() => setIsZoomed(value => !value)}
                onMouseMove={event => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const x = ((event.clientX - rect.left) / rect.width) * 100;
                  const y = ((event.clientY - rect.top) / rect.height) * 100;
                  setZoomOrigin({
                    x: Math.min(100, Math.max(0, x)),
                    y: Math.min(100, Math.max(0, y)),
                  });
                }}
                className={`group relative block aspect-[4/5] w-full overflow-hidden bg-muted/40 ${
                  isZoomed ? "cursor-zoom-out" : "cursor-zoom-in"
                }`}
                aria-label={
                  isZoomed
                    ? "Desactiver le zoom image"
                    : "Activer le zoom image"
                }
              >
                <MediaWithFallback
                  src={selectedImageSrc}
                  alt={productQuery.data.name}
                  className={`h-full w-full object-cover transition-transform duration-300 ${
                    isZoomed
                      ? "scale-[1.65]"
                      : "scale-100 group-hover:scale-[1.03]"
                  }`}
                  style={{
                    transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
                  }}
                  width={980}
                  height={1220}
                  loading="eager"
                  fetchPriority="high"
                  sizes="(min-width: 1024px) 52vw, 100vw"
                />
                <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/45 bg-black/35 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                  <ZoomIn className="h-3.5 w-3.5" />
                  {isZoomed ? "Zoom actif" : "Zoom"}
                </span>
              </button>
            </div>

            {images.length > 1 ? (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {images.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    onClick={() => {
                      setSelectedImage(index);
                      setIsZoomed(false);
                    }}
                    className={`h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition-colors ${
                      index === selectedImage
                        ? "border-crimson"
                        : "border-transparent hover:border-border"
                    }`}
                    aria-label={`Voir image ${index + 1}`}
                  >
                    <MediaWithFallback
                      src={image}
                      alt=""
                      className="h-full w-full object-cover"
                      width={80}
                      height={80}
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="ui-stack-3 lg:sticky lg:top-28 lg:self-start">
            <div className="ui-stack-2">
              <div className="flex flex-wrap items-center gap-2">
                {productQuery.data.isNew ? (
                  <Badge variant="new">Nouveau</Badge>
                ) : null}
                {discount > 0 ? (
                  <Badge variant="sale">-{discount}%</Badge>
                ) : null}
                {inStock ? (
                  typeof productQuery.data.stockQuantity === "number" &&
                  productQuery.data.stockQuantity > 0 &&
                  productQuery.data.stockQuantity <= 5 ? (
                    <Badge
                      variant="stock"
                      className="bg-amber-50 text-amber-700 hover:bg-amber-50"
                    >
                      <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Plus que {productQuery.data.stockQuantity} en stock
                    </Badge>
                  ) : (
                    <Badge variant="stock">
                      <CheckCircle2 className="h-3 w-3" />
                      En stock
                    </Badge>
                  )
                ) : (
                  <Badge variant="outofstock">Rupture</Badge>
                )}
              </div>

              <h1 className="headline-title">{productQuery.data.name}</h1>

              <div className="flex flex-wrap items-end gap-3">
                <span className="text-3xl font-extrabold text-foreground tabular-nums">
                  {formatCFA(productQuery.data.price)}
                </span>
                {productQuery.data.comparePrice ? (
                  <span className="pb-1 text-sm text-muted-foreground line-through tabular-nums">
                    {formatCFA(productQuery.data.comparePrice)}
                  </span>
                ) : null}
                <span className="pb-1 text-xs text-muted-foreground">TTC</span>
              </div>
            </div>

            {benefitBullets.length ? (
              <div className="section-frame p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-accent-2">
                  Pourquoi vous l'aimerez
                </p>
                <h2 className="mt-1 text-lg font-semibold text-brand-text">
                  Les bénéfices, vus par votre peau
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {benefitBullets.map((line, index) => (
                    <li
                      key={`${line}-${index}`}
                      className="flex items-start gap-2.5 text-sm text-foreground/86"
                    >
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-accent" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {routine.am.length || routine.pm.length ? (
              <div className="section-frame p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-accent-2">
                      La gestuelle
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-brand-text">
                      Où ce produit s'inscrit dans votre routine
                    </h2>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5" />
                    AM / PM
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <article className="rounded-xl border border-border/70 bg-white/70 p-3">
                    <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-crimson">
                      <Sun className="h-3.5 w-3.5" />
                      Matin
                    </p>
                    <ul className="mt-2 space-y-2">
                      {routine.am.map((step, index) => (
                        <li
                          key={`am-${step.title}-${index}`}
                          className="text-sm"
                        >
                          <p className="font-semibold text-foreground">
                            {step.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {step.text}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </article>
                  <article className="rounded-xl border border-border/70 bg-white/70 p-3">
                    <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-brand-accent-2">
                      <Moon className="h-3.5 w-3.5" />
                      Soir
                    </p>
                    <ul className="mt-2 space-y-2">
                      {routine.pm.map((step, index) => (
                        <li
                          key={`pm-${step.title}-${index}`}
                          className="text-sm"
                        >
                          <p className="font-semibold text-foreground">
                            {step.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {step.text}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </article>
                </div>
              </div>
            ) : null}

            {descriptionBullets.length ? (
              <div className="section-frame p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-accent-2">
                  Les actifs
                </p>
                <h2 className="mt-1 text-lg font-semibold text-brand-text">
                  Ce qu'il y a dans le flacon
                </h2>
                <ul className="mt-3 space-y-2">
                  {descriptionBullets.map((line, index) => (
                    <li
                      key={`${line}-${index}`}
                      className="flex items-start gap-2 text-sm text-foreground/86"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-crimson" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : productQuery.data.description ? (
              <div className="section-frame p-4">
                <h2 className="text-sm font-semibold">Description</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {productQuery.data.description}
                </p>
              </div>
            ) : null}

            <div className="section-frame p-4">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center rounded-xl border border-border/70 bg-white">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="px-3 py-2 transition-colors hover:bg-muted"
                    aria-label="Diminuer quantite"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-10 px-2 text-center text-sm font-semibold">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(q => q + 1)}
                    className="px-3 py-2 transition-colors hover:bg-muted"
                    aria-label="Augmenter quantite"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Total article: {formatCFA(productQuery.data.price * quantity)}
                </p>
              </div>

              <div className="mt-4 grid gap-2">
                <Button
                  onClick={handleAddToCart}
                  disabled={!inStock}
                  variant="premium"
                  className="h-11 rounded-xl"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Ajouter au panier
                </Button>
                <Button
                  onClick={handleBuyNow}
                  disabled={!inStock}
                  variant="brand"
                  className="h-11 rounded-xl"
                >
                  <Zap className="h-4 w-4" />
                  Acheter maintenant
                </Button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Truck className="h-4 w-4" />
                  Livraison 24h/72h
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" />
                  Paiement securise
                </span>
                <button
                  onClick={() => {
                    if (
                      typeof navigator !== "undefined" &&
                      navigator.clipboard?.writeText
                    ) {
                      void navigator.clipboard.writeText(window.location.href);
                      toast.success("Lien copie");
                    } else {
                      toast.error("Copie non disponible");
                    }
                  }}
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                >
                  <Share2 className="h-4 w-4" />
                  Partager
                </button>
              </div>
            </div>

            {averageRating > 0 || reviewCount > 0 ? (
              <div className="section-frame p-4">
                <h2 className="text-sm font-semibold">Preuve sociale</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2.5">
                  <span className="text-2xl font-extrabold text-foreground">
                    {averageRating > 0 ? averageRating.toFixed(1) : "N/A"}
                  </span>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star
                        key={index}
                        className={`h-4 w-4 ${
                          index < Math.round(averageRating)
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/35"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {reviewCount} avis publie{reviewCount > 1 ? "s" : ""}
                  </span>
                </div>
                {reviewsQuery.data?.length ? (
                  <ul className="mt-3 space-y-2">
                    {reviewsQuery.data.slice(0, 2).map(review => (
                      <li
                        key={review.id}
                        className="rounded-xl border border-border/70 bg-white/70 p-2.5"
                      >
                        <p className="text-xs font-semibold text-foreground">
                          {review.title}
                        </p>
                        {review.comment ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {review.comment}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </section>
        </SectionReveal>

        <ProductReviews
          productId={productQuery.data.id}
          productName={productQuery.data.name}
        />

        <SectionReveal className="mt-12 ui-stack-3">
          <SectionHeader
            kicker="Cross-sell"
            title="Completez votre routine"
            subtitle="Associez ce produit avec des formules complementaires pour AM et PM."
            actionHref="/boutique"
            actionLabel="Voir la boutique"
          />

          {relatedQuery.isLoading ? (
            <ProductGridSkeleton count={8} />
          ) : crossSellProducts.length ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {crossSellProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="section-frame p-8 text-center text-sm text-muted-foreground">
              Aucun produit associe pour le moment.
            </div>
          )}
        </SectionReveal>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-white/95 backdrop-blur lg:hidden">
        <div className="container flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">
              {productQuery.data.name}
            </p>
            <p className="text-base font-extrabold text-foreground">
              {formatCFA(productQuery.data.price * quantity)}
            </p>
          </div>
          <Button
            onClick={handleAddToCart}
            disabled={!inStock}
            variant="soft"
            className="h-10 rounded-xl px-3"
          >
            <ShoppingCart className="h-4 w-4" />
            Panier
          </Button>
          <Button
            onClick={handleBuyNow}
            disabled={!inStock}
            variant="premium"
            className="h-10 rounded-xl px-3"
          >
            <Zap className="h-4 w-4" />
            Acheter
          </Button>
        </div>
      </div>

      <Footer />
    </div>
  );
}
