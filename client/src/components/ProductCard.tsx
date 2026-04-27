import { useState } from "react";
import { Link } from "wouter";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MediaWithFallback } from "@/components/ui/media-with-fallback";

function formatCFA(amount: number) {
  return `${new Intl.NumberFormat("fr-FR").format(amount)} CFA`;
}

const benefitHints = [
  {
    label: "Hydratation",
    keywords: ["hydrat", "hyaluron", "ceramide", "aloe"],
  },
  {
    label: "Anti-imperfections",
    keywords: ["imperfection", "acne", "salicy", "niacinamide"],
  },
  {
    label: "Eclat",
    keywords: ["eclat", "vitamine c", "vitamin c", "taches", "bright"],
  },
  { label: "Protection UV", keywords: ["spf", "uv", "sunscreen", "solaire"] },
  {
    label: "Anti-age",
    keywords: ["retinol", "rides", "anti age", "peptide", "collagene"],
  },
] as const;

function normalizeForScan(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function resolveBenefitLabel(product: {
  name: string;
  description?: string | null;
}) {
  const corpus = normalizeForScan(
    `${product.name} ${product.description || ""}`
  );
  const match = benefitHints.find(hint =>
    hint.keywords.some(keyword => corpus.includes(keyword))
  );
  return match?.label ?? "Rituel quotidien";
}

type ProductCardProps = {
  product: {
    id: number;
    name: string;
    slug: string;
    price: number;
    comparePrice?: number | null;
    imageUrl?: string | null;
    description?: string | null;
    isNew?: boolean;
    isFeatured?: boolean;
    inStock?: boolean;
    stockQuantity?: number | null;
  };
};

const LOW_STOCK_THRESHOLD = 5;

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const [imageLoaded, setImageLoaded] = useState(false);

  const inStock = product.inStock !== false;
  const comparePrice =
    typeof product.comparePrice === "number" ? product.comparePrice : null;
  const hasDiscount = comparePrice !== null && comparePrice > product.price;
  const discount = hasDiscount
    ? Math.round(((comparePrice - product.price) / comparePrice) * 100)
    : 0;
  const benefitLabel = resolveBenefitLabel(product);

  const handleAddToCart = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!inStock) {
      toast.error("Produit indisponible");
      return;
    }

    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl || "",
    });
    toast.success("Ajoute au panier", { description: product.name });
  };

  return (
    <article className="surface-card-strong group relative overflow-hidden rounded-[1.25rem] border-brand-border/75 bg-white shadow-[0_20px_42px_-30px_rgba(60,36,31,0.55)] transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 hover:shadow-[0_32px_62px_-28px_rgba(60,36,31,0.8),0_0_0_1px_rgba(227,116,78,0.22)]">
      <Link href={`/produit/${product.slug}`} className="block">
        <div className="relative aspect-[5/6] overflow-hidden bg-brand-muted/8">
          <MediaWithFallback
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.08]"
            width={760}
            height={920}
            sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 24vw, (min-width: 640px) 33vw, 50vw"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageLoaded(true)}
          />

          {product.imageUrl && !imageLoaded ? (
            <div className="pointer-events-none absolute inset-0">
              <Skeleton className="h-full w-full rounded-none" />
            </div>
          ) : null}

          {/* Softer, taller gradient — reads as atmospheric, not a dark mask. */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_55%,rgba(27,16,15,0.32)_100%)] transition-opacity duration-300 group-hover:opacity-90" />

          {/* Warm halo — fades in only on hover, gives the card an "alive" feel. */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(227,116,78,0.18),transparent_62%)] opacity-0 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100" />

          {/* Concern tag — the editorial tag, positioned over the image. */}
          <div className="absolute left-3 top-3 z-10">
            <span className="inline-flex items-center rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-text backdrop-blur-sm transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-0.5 group-hover:shadow-[0_8px_18px_-10px_rgba(60,36,31,0.45)]">
              {benefitLabel}
            </span>
          </div>

          {/* Discount pill stays, but quieter — small, bottom-left, semi-transparent. */}
          {discount > 0 ? (
            <div className="absolute bottom-3 left-3 z-10">
              <span className="inline-flex items-center rounded-full bg-brand-accent/95 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                −{discount}%
              </span>
            </div>
          ) : null}

          {!inStock ? (
            <div className="absolute bottom-3 right-3 z-10">
              <span className="inline-flex items-center rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white backdrop-blur-sm">
                Rupture
              </span>
            </div>
          ) : null}
        </div>
      </Link>

      <div className="space-y-3 p-4">
        <Link href={`/produit/${product.slug}`} className="block">
          <h3 className="line-clamp-2 min-h-12 text-[1rem] font-semibold leading-snug text-brand-text transition-colors duration-200 hover:text-brand-accent">
            {product.name}
          </h3>
        </Link>

        <div className="flex items-end gap-2.5">
          <span className="text-[1.3rem] font-extrabold tracking-tight text-brand-text tabular-nums">
            {formatCFA(product.price)}
          </span>
          {hasDiscount ? (
            <span className="pb-0.5 text-xs font-medium text-brand-muted line-through tabular-nums">
              {formatCFA(comparePrice || 0)}
            </span>
          ) : null}
        </div>

        {inStock &&
        typeof product.stockQuantity === "number" &&
        product.stockQuantity > 0 &&
        product.stockQuantity <= LOW_STOCK_THRESHOLD ? (
          <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Plus que {product.stockQuantity} en stock
          </p>
        ) : null}

        <Button
          onClick={handleAddToCart}
          disabled={!inStock}
          variant={inStock ? "premium" : "surface"}
          className="h-10 w-full rounded-xl font-semibold"
        >
          <ShoppingBag className="h-4 w-4" />
          {inStock ? "Ajouter au panier" : "Rupture"}
        </Button>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <article className="surface-card-strong overflow-hidden rounded-[1.25rem] p-0">
      <Skeleton className="aspect-[5/6] w-full rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-6 w-2/5" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </article>
  );
}

export function ProductCardSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}
