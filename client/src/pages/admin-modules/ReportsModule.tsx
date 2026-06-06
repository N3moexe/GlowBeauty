import { useMemo } from "react";
import { AlertTriangle, Package, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { RetryPanel } from "@/pages/admin-modules/shared/RetryPanel";
import { ShimmerBlock } from "@/pages/admin-modules/shared/ShimmerBlock";
import { formatCFA } from "@/pages/admin-modules/shared/formatters";
import { getErrorMessage } from "@/pages/admin-modules/shared/utils";
import { cn } from "@/lib/utils";

type BestSellerRow = {
  product: {
    id: number;
    name: string;
    imageUrl?: string | null;
    price: number;
  };
  totalSold: number;
  totalRevenue: number;
};

type LowStockRow = {
  id: number;
  name: string;
  stockQuantity: number | null;
  inStock: boolean;
};

type SalesByCategoryRow = {
  category: { id: number; name: string };
  totalSales: number;
  totalOrders: number;
};

const CARD =
  "rounded-2xl border border-[var(--admin-border,theme(colors.border/60))] bg-white/90 shadow-sm";
const CARD_PAD = "p-4 md:p-5";

export function ReportsModule() {
  const bestSellersQuery = trpc.reports.bestSellers.useQuery(
    { limit: 10 },
    { refetchInterval: 60000 }
  );
  const lowStockQuery = trpc.reports.lowStock.useQuery(
    { threshold: 10 },
    { refetchInterval: 60000 }
  );
  const salesByCategoryQuery = trpc.reports.salesByCategory.useQuery(
    undefined,
    { refetchInterval: 60000 }
  );

  const bestSellers = useMemo(
    () => (bestSellersQuery.data ?? []) as BestSellerRow[],
    [bestSellersQuery.data]
  );
  const lowStock = useMemo(
    () => (lowStockQuery.data ?? []) as LowStockRow[],
    [lowStockQuery.data]
  );
  const salesByCategory = useMemo(
    () => (salesByCategoryQuery.data ?? []) as SalesByCategoryRow[],
    [salesByCategoryQuery.data]
  );

  const firstError =
    bestSellersQuery.error ?? lowStockQuery.error ?? salesByCategoryQuery.error;

  if (firstError) {
    return (
      <RetryPanel
        title="Reports unavailable"
        description={getErrorMessage(firstError, "Unable to load reports.")}
        onRetry={() => {
          void Promise.all([
            bestSellersQuery.refetch(),
            lowStockQuery.refetch(),
            salesByCategoryQuery.refetch(),
          ]);
        }}
      />
    );
  }

  const isLoading =
    bestSellersQuery.isLoading ||
    lowStockQuery.isLoading ||
    salesByCategoryQuery.isLoading;

  const maxSales =
    salesByCategory.reduce(
      (acc, r) => Math.max(acc, Number(r.totalSales) || 0),
      0
    ) || 1;

  return (
    <section className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Best sellers */}
        <div className={cn(CARD, CARD_PAD, "space-y-3")}>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[var(--admin-accent,#e3744e)]" />
            <h3 className="text-sm font-semibold">Best sellers</h3>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <ShimmerBlock key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : bestSellers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No sales data yet.
            </p>
          ) : (
            <div className="divide-y divide-border/50">
              {bestSellers.map((row, index) => (
                <div
                  key={row.product.id}
                  className="flex items-center gap-3 py-2.5 first:pt-1 last:pb-1"
                >
                  <span className="w-5 shrink-0 text-right text-xs font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                  {row.product.imageUrl ? (
                    <img
                      src={row.product.imageUrl}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-accent-soft,#fdeee7)]">
                      <Package className="h-4 w-4 text-[var(--admin-accent,#e3744e)]" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {row.product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.totalSold} sold
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold">
                    {formatCFA(row.totalRevenue)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low stock */}
        <div className={cn(CARD, CARD_PAD, "space-y-3")}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold">
              Low stock
              {lowStock.length > 0 ? (
                <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                  {lowStock.length}
                </span>
              ) : null}
            </h3>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <ShimmerBlock key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : lowStock.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              All stock levels are sufficient.
            </p>
          ) : (
            <div className="divide-y divide-border/50">
              {lowStock.map(product => {
                const qty = product.stockQuantity ?? 0;
                return (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 py-2.5 first:pt-1 last:pb-1"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                    <p className="min-w-0 flex-1 truncate text-sm">
                      {product.name}
                    </p>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                        qty === 0
                          ? "bg-rose-50 text-rose-600"
                          : "bg-amber-50 text-amber-600"
                      )}
                    >
                      {qty === 0 ? "Out of stock" : `${qty} left`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sales by category */}
      <div className={cn(CARD, CARD_PAD, "space-y-4")}>
        <h3 className="text-sm font-semibold">Sales by category</h3>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <ShimmerBlock key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : salesByCategory.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No category data yet.
          </p>
        ) : (
          <div className="space-y-3">
            {[...salesByCategory]
              .sort(
                (a, b) =>
                  (Number(b.totalSales) || 0) - (Number(a.totalSales) || 0)
              )
              .map(row => {
                const sales = Number(row.totalSales) || 0;
                const pct = Math.round((sales / maxSales) * 100);
                return (
                  <div key={row.category.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{row.category.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatCFA(sales)}{" "}
                        <span className="text-xs">
                          ({row.totalOrders} order
                          {Number(row.totalOrders) !== 1 ? "s" : ""})
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40">
                      <div
                        className="h-full rounded-full bg-[var(--admin-accent,#e3744e)] transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </section>
  );
}
