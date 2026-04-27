import { useMemo } from "react";
import ProductCard from "@/components/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface ProductRecommendationsProps {
  productId?: number;
  categoryId?: number;
  limit?: number;
  title?: string;
}

export default function ProductRecommendations({
  productId,
  categoryId,
  limit = 8,
  title = "Produits recommandes",
}: ProductRecommendationsProps) {
  const { data: allProducts, isLoading } = trpc.product.list.useQuery({
    categoryId,
    limit: limit * 2,
  });

  const recommendations = useMemo(() => {
    if (!allProducts?.products) return [];
    
    let filtered = [...allProducts.products];
    
    // Exclude current product
    if (productId) {
      filtered = filtered.filter(p => p.id !== productId);
    }

    // Shuffle and limit
    return filtered.sort(() => Math.random() - 0.5).slice(0, limit);
  }, [allProducts?.products, productId, limit]);

  if (isLoading) {
    return (
      <section className="mt-12 pt-8 border-t">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-yellow-500" />
          {title}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-square rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  return (
    <section className="mt-12 pt-8 border-t">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-yellow-500" />
        {title}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {recommendations.map(p => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
