import { Sparkles, Loader } from "lucide-react";
import { trpc } from "@/lib/trpc";
import ProductCard from "@/components/ProductCard";

interface AIRecommendationsProps {
  productId?: number;
  categoryId?: number;
  title?: string;
  limit?: number;
}

export default function AIRecommendations({
  productId,
  categoryId,
  title = "Recommandations IA",
  limit = 8,
}: AIRecommendationsProps) {
  const { data, isLoading } = trpc.ai.recommendations.getRecommendations.useQuery({
    productId,
    categoryId,
    limit,
  });

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <Loader className="h-8 w-8 animate-spin text-crimson mx-auto" />
      </div>
    );
  }

  if (!data || data.count === 0) {
    return null;
  }

  return (
    <section className="py-12 bg-muted/30">
      <div className="container">
        <div className="flex items-center gap-2 mb-8">
          <Sparkles className="h-6 w-6 text-yellow-500" />
          <h2 className="text-2xl font-bold">{title}</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {data.recommendations.map((product: any) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
