import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Loader2,
  PackageX,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { Surface } from "@/components/admin/ui/Surface";
import { Heading } from "@/components/admin/ui/Heading";
import { StatTile } from "@/components/admin/ui/StatTile";
import { ShimmerBlock } from "@/pages/admin-modules/shared/ShimmerBlock";
import { RetryPanel } from "@/pages/admin-modules/shared/RetryPanel";
import { getErrorMessage } from "@/pages/admin-modules/shared/utils";
import { trpc } from "@/lib/trpc";
import StatusBadge from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ProductRow = {
  id: number;
  name: string;
  slug: string;
  categoryId: number;
  stockQuantity: number | null;
  inStock: boolean | null;
};

type CategoryRow = {
  id: number;
  name: string;
};

function stockStatusFor(product: ProductRow): "instock" | "low" | "out" {
  const qty = Number(product.stockQuantity ?? 0);
  if (product.inStock === false || qty <= 0) return "out";
  if (qty <= 10) return "low";
  return "instock";
}

export function InventoryModule({ canManage }: { canManage: boolean }) {
  const utils = trpc.useUtils();

  const productsQuery = trpc.product.list.useQuery(
    { limit: 1000 },
    {
      refetchInterval: 20000,
      refetchOnWindowFocus: true,
    }
  );

  const categoriesQuery = trpc.category.list.useQuery(undefined);

  const productUpdateMutation = trpc.product.update.useMutation({
    onSuccess: async () => {
      toast.success("Stock mis à jour");
      await Promise.all([
        utils.product.list.invalidate(),
        utils.product.byId.invalidate(),
        utils.product.bySlug.invalidate(),
        utils.product.count.invalidate(),
        utils.reports.lowStock.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const products = (productsQuery.data?.products ?? []) as ProductRow[];
  const categories = (categoriesQuery.data ?? []) as CategoryRow[];

  const categoryById = useMemo(() => {
    const map = new Map<number, string>();
    categories.forEach(c => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const stats = useMemo(() => {
    let lowCount = 0;
    let outCount = 0;
    products.forEach(product => {
      const status = stockStatusFor(product);
      if (status === "low") lowCount += 1;
      else if (status === "out") outCount += 1;
    });
    return {
      total: products.length,
      low: lowCount,
      out: outCount,
    };
  }, [products]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter(product => {
      const haystack = `${product.name} ${product.slug}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [products, search]);

  const handleSave = useCallback(
    async (product: ProductRow) => {
      if (!canManage) {
        toast.error("Mise à jour du stock non autorisée");
        return;
      }
      const raw = drafts[product.id] ?? String(product.stockQuantity ?? 0);
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        toast.error("Le stock doit être un nombre positif");
        return;
      }
      setSavingId(product.id);
      try {
        await productUpdateMutation.mutateAsync({
          id: product.id,
          stockQuantity: parsed,
          inStock: parsed > 0,
        });
        setDrafts(prev => ({ ...prev, [product.id]: String(parsed) }));
      } catch {
        // Errors handled via mutation onError toasts.
      } finally {
        setSavingId(null);
      }
    },
    [canManage, drafts, productUpdateMutation]
  );

  if (productsQuery.error && !productsQuery.data) {
    return (
      <RetryPanel
        title="Inventaire indisponible"
        description={getErrorMessage(
          productsQuery.error,
          "Impossible de charger l'inventaire."
        )}
        onRetry={() => void productsQuery.refetch()}
      />
    );
  }

  const isLoading = productsQuery.isLoading;
  const isFetching = productsQuery.isFetching;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Heading level={2} className="text-xl">
            Inventaire
          </Heading>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            Pilotez les niveaux de stock SKU par SKU.
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-9 w-9 border-[var(--admin-border)]"
          onClick={() => void productsQuery.refetch()}
          disabled={isFetching}
          aria-label="Rafraîchir"
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatTile
          label="SKU total"
          value={isLoading ? "—" : stats.total}
          icon={<Boxes className="h-5 w-5" />}
        />
        <StatTile
          label="Stock bas"
          value={isLoading ? "—" : stats.low}
          sub="0 < quantité ≤ 10"
          icon={<AlertTriangle className="h-5 w-5" />}
          accent={stats.low > 0}
        />
        <StatTile
          label="Rupture"
          value={isLoading ? "—" : stats.out}
          sub="Quantité ≤ 0 ou indisponible"
          icon={<PackageX className="h-5 w-5" />}
        />
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-muted)]" />
        <Input
          placeholder="Rechercher (nom, slug)..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border-[var(--admin-border)] bg-[var(--admin-bg)] pl-9 text-sm"
        />
      </div>

      <Surface className="overflow-hidden p-0">
        {isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <ShimmerBlock key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--admin-muted)]">
            <Boxes className="h-10 w-10 opacity-30" />
            <p className="text-sm">
              {products.length === 0
                ? "Aucun produit en inventaire."
                : "Aucun résultat pour cette recherche."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-divider)] bg-[var(--admin-surface-tint)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    Produit
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    Catégorie
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    Stock actuel
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    Nouveau stock
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-divider)]">
                {filteredRows.map(product => {
                  const status = stockStatusFor(product);
                  const draftValue =
                    drafts[product.id] ?? String(product.stockQuantity ?? 0);
                  const isSavingRow = savingId === product.id;
                  return (
                    <tr
                      key={product.id}
                      className="transition-colors hover:bg-[var(--admin-surface-tint)]"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--admin-ink)]">
                          {product.name}
                        </p>
                        <p className="text-xs text-[var(--admin-muted)]">
                          /{product.slug}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-[var(--admin-ink)]">
                        {categoryById.get(product.categoryId) ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[var(--admin-ink)]">
                        {product.stockQuantity ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={status} context="stock" />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          value={draftValue}
                          inputMode="numeric"
                          onChange={event =>
                            setDrafts(prev => ({
                              ...prev,
                              [product.id]: event.target.value,
                            }))
                          }
                          disabled={!canManage || isSavingRow}
                          className="h-9 w-28 border-[var(--admin-border)] bg-[var(--admin-bg)]"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void handleSave(product)}
                          disabled={!canManage || isSavingRow}
                          className="bg-[var(--admin-accent)] text-white hover:bg-[var(--admin-accent-hover)]"
                        >
                          {isSavingRow ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Enregistrer
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
    </div>
  );
}
