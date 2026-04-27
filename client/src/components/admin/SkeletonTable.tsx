import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SkeletonTableProps = {
  rows?: number;
  className?: string;
};

export default function SkeletonTable({ rows = 5, className }: SkeletonTableProps) {
  return (
    <div className={cn("rounded-xl border bg-card p-3", className)}>
      <div className="mb-3 flex gap-2">
        <Skeleton className="h-8 w-40 rounded-md" />
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="grid grid-cols-12 items-center gap-2 rounded-lg border p-3">
            <Skeleton className="col-span-4 h-4 rounded" />
            <Skeleton className="col-span-3 h-4 rounded" />
            <Skeleton className="col-span-2 h-4 rounded" />
            <Skeleton className="col-span-3 h-4 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

