import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import ProductCard from "@/components/ProductCard";
import SectionReveal from "@/components/storefront/SectionReveal";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

type RailProduct = {
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
};

type ProductRailProps = {
  kicker: string;
  title: string;
  actionLabel?: string;
  actionHref?: string;
  products: RailProduct[];
  emptyMessage?: string;
};

export default function ProductRail({
  kicker,
  title,
  actionLabel,
  actionHref,
  products,
  emptyMessage = "Aucun produit disponible pour le moment.",
}: ProductRailProps) {
  return (
    <section className="container section-shell">
      <div className="ui-stack-3">
        <SectionReveal>
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-kicker text-brand-accent-2">{kicker}</p>
              <h2 className="section-title">{title}</h2>
            </div>
            {actionHref && actionLabel ? (
              <Link
                href={actionHref}
                className="link-chip border-brand-border/80 bg-white/75 text-brand-accent-2 hover:border-brand-accent/35 hover:text-brand-accent"
              >
                {actionLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </header>
        </SectionReveal>

        {products.length > 0 ? (
          <>
            <div className="sm:hidden">
              <Carousel
                opts={{ align: "start", dragFree: true }}
                className="w-full"
              >
                <CarouselContent className="-ml-3 [mask-image:linear-gradient(to_right,transparent_0,black_24px,black_calc(100%-24px),transparent_100%)]">
                  {products.map(product => (
                    <CarouselItem
                      key={`rail-mobile-${product.id}`}
                      className="basis-[78%] pl-3"
                    >
                      <ProductCard product={product} />
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>
            </div>

            <div className="hidden sm:block">
              <Carousel opts={{ align: "start" }} className="w-full">
                <CarouselContent className="-ml-4 [mask-image:linear-gradient(to_right,transparent_0,black_36px,black_calc(100%-36px),transparent_100%)]">
                  {products.map(product => (
                    <CarouselItem
                      key={`rail-desktop-${product.id}`}
                      className="basis-1/2 pl-4 md:basis-1/3 lg:basis-1/4"
                    >
                      <ProductCard product={product} />
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="-left-3 top-1/3 hidden border-brand-border/75 bg-white/90 text-brand-text md:inline-flex" />
                <CarouselNext className="-right-3 top-1/3 hidden border-brand-border/75 bg-white/90 text-brand-text md:inline-flex" />
              </Carousel>
            </div>
          </>
        ) : (
          <div className="rounded-[1.4rem] border border-brand-border/80 bg-white/78 p-8 text-center text-sm text-brand-muted">
            {emptyMessage}
          </div>
        )}
      </div>
    </section>
  );
}
