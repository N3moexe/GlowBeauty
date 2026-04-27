import { Skeleton } from "@/components/ui/skeleton";

export function ProductCardSkeleton() {
  return (
    <div className="surface-card overflow-hidden p-0">
      <Skeleton className="aspect-[4/5] w-full rounded-none" />
      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
        <Skeleton className="h-6 w-2/5" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function SectionSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-10 w-72 max-w-full" />
      <Skeleton className="h-4 w-full max-w-xl" />
    </div>
  );
}

export function TrustStripSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="surface-card p-4">
          <Skeleton className="mb-3 h-9 w-9 rounded-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-2 h-3 w-full" />
        </div>
      ))}
    </div>
  );
}

export function CategoryGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="surface-card overflow-hidden p-0">
          <Skeleton className="aspect-[5/3] w-full rounded-none" />
          <div className="space-y-3 p-4">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <section className="relative min-h-[66vh] w-full overflow-hidden">
      <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
      <div className="container relative z-10 flex min-h-[66vh] items-center">
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-14 w-full max-w-2xl" />
          <Skeleton className="h-6 w-4/5" />
          <Skeleton className="h-12 w-44 rounded-xl" />
        </div>
      </div>
    </section>
  );
}

export function PromoStripSkeleton() {
  return (
    <div className="section-frame overflow-hidden p-6 md:p-8">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-10 w-3/4" />
      <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
      <Skeleton className="mt-6 h-11 w-40 rounded-xl" />
    </div>
  );
}
