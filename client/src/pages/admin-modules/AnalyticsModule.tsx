import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchAdminAnalyticsOverview,
  type AdminAnalyticsOverviewPayload,
} from "@/lib/adminAnalytics";
import { StatTile } from "@/components/admin/ui/StatTile";
import { Surface } from "@/components/admin/ui/Surface";
import { Heading } from "@/components/admin/ui/Heading";
import { ShimmerBlock } from "@/pages/admin-modules/shared/ShimmerBlock";
import { RetryPanel } from "@/pages/admin-modules/shared/RetryPanel";
import {
  formatCFA,
  formatPercent,
} from "@/pages/admin-modules/shared/formatters";
import StatusBadge from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BarChart3,
  CreditCard,
  Package,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const STATUS_PALETTE = ["#e3744e", "#b58dcc", "#6dbf8a", "#f0a050", "#7bb3d4"];

type RangeDays = 7 | 30 | 90;

function KpiSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Surface key={i} className="space-y-2 p-5">
          <ShimmerBlock className="h-3 w-20" />
          <ShimmerBlock className="h-8 w-28" />
          <ShimmerBlock className="h-3 w-16" />
        </Surface>
      ))}
    </div>
  );
}

function ChartCard({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Surface className={cn("p-5", className)}>
      <Heading level={3} className="mb-4 text-base">
        {title}
      </Heading>
      {children}
    </Surface>
  );
}

function BestSellersTable({
  rows,
}: {
  rows: AdminAnalyticsOverviewPayload["bestSellers"];
}) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--admin-muted)]">
        Aucune vente sur la période.
      </p>
    );
  }
  return (
    <div className="divide-y divide-[var(--admin-divider)]">
      {rows.map((item, index) => (
        <div
          key={item.productId}
          className="flex items-center gap-3 py-2.5 first:pt-1 last:pb-1"
        >
          <span className="w-5 shrink-0 text-right text-xs font-semibold text-[var(--admin-muted)]">
            {index + 1}
          </span>
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt=""
              className="h-8 w-8 shrink-0 rounded-lg bg-white object-contain"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-accent-soft)]">
              <Package className="h-4 w-4 text-[var(--admin-accent)]" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--admin-ink)]">
              {item.name}
            </p>
            <p className="text-xs text-[var(--admin-muted)]">
              {item.soldQty} vendu{item.soldQty !== 1 ? "s" : ""}
            </p>
          </div>
          <p className="shrink-0 text-sm font-semibold text-[var(--admin-ink)]">
            {formatCFA(item.revenue)}
          </p>
        </div>
      ))}
    </div>
  );
}

function LowStockTable({
  rows,
}: {
  rows: AdminAnalyticsOverviewPayload["lowStock"];
}) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--admin-muted)]">
        Tous les stocks sont suffisants.
      </p>
    );
  }
  return (
    <div className="divide-y divide-[var(--admin-divider)]">
      {rows.map(item => (
        <div
          key={item.productId}
          className="flex items-center gap-3 py-2.5 first:pt-1 last:pb-1"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="min-w-0 flex-1 truncate text-sm text-[var(--admin-ink)]">
            {item.name}
          </p>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
              item.stock === 0
                ? "bg-rose-50 text-rose-600"
                : "bg-amber-50 text-amber-600"
            )}
          >
            {item.stock === 0
              ? "Rupture"
              : `${item.stock} restant${item.stock !== 1 ? "s" : ""}`}
          </span>
        </div>
      ))}
    </div>
  );
}

function RecentOrdersTable({
  rows,
}: {
  rows: NonNullable<AdminAnalyticsOverviewPayload["recentOrders"]>;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--admin-muted)]">
        Aucune commande récente.
      </p>
    );
  }
  return (
    <div className="divide-y divide-[var(--admin-divider)]">
      {rows.map(order => (
        <div key={order.orderId} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--admin-ink)]">
              {order.orderNumber}
            </p>
            <p className="truncate text-xs text-[var(--admin-muted)]">
              {order.customerName}
            </p>
          </div>
          <StatusBadge status={order.status} context="order" />
          <p className="shrink-0 text-sm font-semibold text-[var(--admin-ink)]">
            {formatCFA(order.totalAmount)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsModule() {
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);

  const overviewQuery = useQuery({
    queryKey: ["admin-analytics-overview", rangeDays],
    queryFn: () => fetchAdminAnalyticsOverview(rangeDays),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const data = overviewQuery.data;
  const lineData = useMemo(() => data?.revenueSeries ?? [], [data]);
  const statusData = useMemo(() => data?.ordersByStatus ?? [], [data]);
  const bestSellers = data?.bestSellers ?? [];
  const lowStock = data?.lowStock ?? [];
  const recentOrders = data?.recentOrders ?? [];

  // Period-over-period deltas. Prefer the backend's `previous` block (true
  // prior window of equal length). Fall back to intra-period momentum derived
  // from revenueSeries when the API doesn't supply previous totals.
  const pct = (prev: number, curr: number) => {
    if (prev <= 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };
  const deltas = useMemo(() => {
    if (data?.previous) {
      const p = data.previous;
      return {
        revenue: pct(Number(p.revenue || 0), Number(data.revenue || 0)),
        orders: pct(Number(p.orders || 0), Number(data.orders || 0)),
        customers: pct(Number(p.customers || 0), Number(data.customers || 0)),
        aov: pct(Number(p.aov || 0), Number(data.aov || 0)),
      };
    }
    if (lineData.length < 4) return null;
    const mid = Math.floor(lineData.length / 2);
    const first = lineData.slice(0, mid);
    const second = lineData.slice(mid);
    const sum = (
      rows: Array<{ revenue: number; orders: number }>,
      key: "revenue" | "orders"
    ) => rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
    return {
      revenue: pct(sum(first, "revenue"), sum(second, "revenue")),
      orders: pct(sum(first, "orders"), sum(second, "orders")),
      customers: null as number | null,
      aov: null as number | null,
    };
  }, [data, lineData]);

  const deltaLabel = "vs période précédente";

  if (overviewQuery.error && !data) {
    return (
      <RetryPanel
        title="Analytics indisponible"
        description={
          overviewQuery.error instanceof Error
            ? overviewQuery.error.message
            : "Impossible de charger les données."
        }
        onRetry={() => void overviewQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--admin-muted)]">
          Métriques en temps réel — commandes, stock et activité client.
        </p>
        <div className="flex items-center gap-2">
          <Select
            value={String(rangeDays)}
            onValueChange={v => setRangeDays(Number(v) as RangeDays)}
          >
            <SelectTrigger className="h-9 w-[120px] border-[var(--admin-border)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 jours</SelectItem>
              <SelectItem value="30">30 jours</SelectItem>
              <SelectItem value="90">90 jours</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9 border-[var(--admin-border)]"
            onClick={() => void overviewQuery.refetch()}
            disabled={overviewQuery.isFetching}
          >
            <RefreshCw
              className={cn(
                "h-4 w-4",
                overviewQuery.isFetching && "animate-spin"
              )}
            />
          </Button>
        </div>
      </div>

      {overviewQuery.isLoading ? (
        <KpiSkeleton />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatTile
            label={`Revenus (${data?.rangeDays ?? rangeDays}j)`}
            value={formatCFA(Number(data?.revenue ?? 0))}
            delta={
              deltas ? { pct: deltas.revenue, label: deltaLabel } : null
            }
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <StatTile
            label="Commandes"
            value={String(data?.orders ?? 0)}
            delta={deltas ? { pct: deltas.orders, label: deltaLabel } : null}
            icon={<ShoppingCart className="h-5 w-5" />}
          />
          <StatTile
            label="Clients"
            value={String(data?.customers ?? 0)}
            delta={
              deltas && deltas.customers != null
                ? { pct: deltas.customers, label: deltaLabel }
                : null
            }
            icon={<Users className="h-5 w-5" />}
          />
          <StatTile
            label="Panier moyen"
            value={formatCFA(Number(data?.aov ?? 0))}
            delta={
              deltas && deltas.aov != null
                ? { pct: deltas.aov, label: deltaLabel }
                : null
            }
            icon={<CreditCard className="h-5 w-5" />}
          />
          <StatTile
            label="Conversion"
            value={
              data?.conversionRate != null
                ? formatPercent(data.conversionRate)
                : "—"
            }
            icon={<BarChart3 className="h-5 w-5" />}
          />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Tendance revenus">
          {overviewQuery.isLoading ? (
            <ShimmerBlock className="h-64 w-full rounded-xl" />
          ) : lineData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-[var(--admin-muted)]">
              Aucune donnée pour cette période.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8dccf" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={v =>
                      new Date(v).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                      })
                    }
                    tick={{ fontSize: 11, fill: "#8a7f76" }}
                    stroke="#e2d5c6"
                  />
                  <YAxis
                    tickFormatter={v =>
                      new Intl.NumberFormat("fr-FR", {
                        maximumFractionDigits: 0,
                      }).format(Number(v))
                    }
                    tick={{ fontSize: 11, fill: "#8a7f76" }}
                    stroke="#e2d5c6"
                  />
                  <RechartsTooltip
                    formatter={(value: number, name: string) =>
                      name === "revenue"
                        ? [formatCFA(Number(value)), "Revenus"]
                        : [Number(value), "Commandes"]
                    }
                    labelFormatter={(label: string) =>
                      new Date(label).toLocaleDateString("fr-FR")
                    }
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid #e2d5c6",
                      background: "#ffffff",
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#e3744e"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4, fill: "#e3744e" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="orders"
                    stroke="#b58dcc"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3, fill: "#b58dcc" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Commandes par statut">
          {overviewQuery.isLoading ? (
            <ShimmerBlock className="h-64 w-full rounded-xl" />
          ) : statusData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-[var(--admin-muted)]">
              Aucune donnée de statut.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="count"
                    nameKey="status"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {statusData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={STATUS_PALETTE[index % STATUS_PALETTE.length]}
                      />
                    ))}
                  </Pie>
                  <Legend
                    formatter={v => (
                      <span style={{ fontSize: 12, color: "#2a2622" }}>
                        {v}
                      </span>
                    )}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid #e2d5c6",
                      background: "#ffffff",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Meilleures ventes">
          {overviewQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <ShimmerBlock key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <BestSellersTable rows={bestSellers} />
          )}
        </ChartCard>

        <ChartCard title="Alertes stock">
          {overviewQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <ShimmerBlock key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <LowStockTable rows={lowStock} />
          )}
        </ChartCard>

        <ChartCard title="Commandes récentes">
          {overviewQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <ShimmerBlock key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <RecentOrdersTable rows={recentOrders} />
          )}
        </ChartCard>
      </div>
    </div>
  );
}
