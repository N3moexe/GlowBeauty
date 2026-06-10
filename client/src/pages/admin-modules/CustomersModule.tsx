import { useEffect, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Mail, MapPin, Phone, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import DataTable from "@/components/admin/DataTable";
import { RetryPanel } from "@/pages/admin-modules/shared/RetryPanel";
import { ShimmerBlock } from "@/pages/admin-modules/shared/ShimmerBlock";
import {
  formatCFA,
  toDateLabel,
} from "@/pages/admin-modules/shared/formatters";
import { getErrorMessage } from "@/pages/admin-modules/shared/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CustomerEntity = {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const PAGE_SIZE = 50;

export function CustomersModule() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Debounce search so we don't hit the API on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  const listQuery = trpc.customers.list.useQuery(
    {
      query: debouncedSearch || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
    { placeholderData: prev => prev, refetchInterval: 30000, retry: 1 }
  );

  const detailQuery = trpc.customers.byId.useQuery(
    { id: selectedId ?? 0 },
    { enabled: selectedId !== null }
  );

  const rows = useMemo(
    () => (listQuery.data?.items ?? []) as CustomerEntity[],
    [listQuery.data?.items]
  );

  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns = useMemo<ColumnDef<CustomerEntity>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Client",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-medium">{row.original.name}</p>
            {row.original.city ? (
              <p className="text-xs text-muted-foreground">
                {row.original.city}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: "contact",
        header: "Contact",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="text-sm">{row.original.phone}</p>
            {row.original.email ? (
              <p className="text-xs text-muted-foreground">
                {row.original.email}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "totalOrders",
        header: "Commandes",
        cell: ({ row }) => (
          <p className="tabular-nums">{row.original.totalOrders}</p>
        ),
      },
      {
        accessorKey: "totalSpent",
        header: "Total dépensé",
        cell: ({ row }) => (
          <p className="tabular-nums font-medium">
            {formatCFA(row.original.totalSpent)}
          </p>
        ),
      },
      {
        id: "lastOrder",
        header: "Dernière commande",
        cell: ({ row }) =>
          row.original.lastOrderDate
            ? toDateLabel(row.original.lastOrderDate)
            : "—",
      },
      {
        accessorKey: "createdAt",
        header: "Client depuis",
        cell: ({ row }) => toDateLabel(row.original.createdAt),
      },
    ],
    []
  );

  const errorMessage = listQuery.error
    ? getErrorMessage(listQuery.error, "Impossible de charger les clients.")
    : null;

  const detail = detailQuery.data as CustomerEntity | null | undefined;

  return (
    <section className="space-y-6">
      {errorMessage ? (
        <RetryPanel
          title="Clients indisponibles"
          description={errorMessage}
          onRetry={() => {
            void listQuery.refetch();
          }}
        />
      ) : (
        <>
          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 border-[var(--admin-border)]"
              title="Rafraîchir"
              onClick={() => void listQuery.refetch()}
              disabled={listQuery.isFetching}
            >
              <RefreshCw
                className={`h-4 w-4 ${listQuery.isFetching ? "animate-spin" : ""}`}
              />
            </Button>
          </div>

          <DataTable
            columns={columns}
            data={rows}
            isLoading={listQuery.isLoading}
            searchValue={search}
            onSearchValueChange={setSearch}
            searchPlaceholder="Rechercher nom, téléphone, e-mail…"
            emptyTitle="Aucun client"
            emptyDescription="Les clients apparaissent ici après leur première commande."
            onRowClick={row => setSelectedId(row.id)}
            getRowId={row => String(row.id)}
            csvExport={{
              filenameBase: "clients",
              columns: [
                { header: "Nom", value: r => r.name },
                { header: "Téléphone", value: r => r.phone },
                { header: "E-mail", value: r => r.email ?? "" },
                { header: "Ville", value: r => r.city ?? "" },
                { header: "Adresse", value: r => r.address ?? "" },
                { header: "Commandes", value: r => r.totalOrders },
                { header: "Total dépensé (CFA)", value: r => r.totalSpent },
                {
                  header: "Dernière commande",
                  value: r =>
                    r.lastOrderDate
                      ? new Date(r.lastOrderDate).toLocaleDateString("fr-FR")
                      : "",
                },
              ],
            }}
          />

          {totalPages > 1 ? (
            <div className="flex items-center justify-end gap-2 text-sm">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Précédent
              </Button>
              <span className="text-[var(--admin-muted)]">
                Page {page + 1} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Suivant
              </Button>
            </div>
          ) : null}
        </>
      )}

      <Dialog
        open={selectedId !== null}
        onOpenChange={open => {
          if (!open) setSelectedId(null);
        }}
      >
        <DialogContent className="border-[var(--admin-border)] bg-[var(--admin-surface)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="[font-family:var(--font-admin-display)]">
              {detailQuery.isLoading
                ? "Chargement…"
                : (detail?.name ?? "Client")}
            </DialogTitle>
            <DialogDescription>
              Historique d'achat et coordonnées du client.
            </DialogDescription>
          </DialogHeader>

          {detailQuery.isLoading ? (
            <div className="space-y-3">
              <ShimmerBlock className="h-5 w-48" />
              <ShimmerBlock className="h-5 w-36" />
              <ShimmerBlock className="h-5 w-56" />
            </div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[var(--admin-muted)]">
                    Commandes totales
                  </p>
                  <p className="text-xl font-semibold tabular-nums">
                    {detail.totalOrders}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--admin-muted)]">
                    Total dépensé
                  </p>
                  <p className="text-xl font-semibold tabular-nums">
                    {formatCFA(detail.totalSpent)}
                  </p>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-[var(--admin-border)] p-4">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3.5 w-3.5 text-[var(--admin-muted)]" />
                  <span>{detail.phone}</span>
                </div>
                {detail.email ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 text-[var(--admin-muted)]" />
                    <span>{detail.email}</span>
                  </div>
                ) : null}
                {(detail.address ?? detail.city) ? (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--admin-muted)]" />
                    <span>
                      {[detail.address, detail.city].filter(Boolean).join(", ")}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                {detail.lastOrderDate ? (
                  <div>
                    <p className="text-xs text-[var(--admin-muted)]">
                      Dernière commande
                    </p>
                    <p>{toDateLabel(detail.lastOrderDate)}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs text-[var(--admin-muted)]">
                    Client depuis
                  </p>
                  <p>{toDateLabel(detail.createdAt)}</p>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
