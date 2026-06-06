import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { Clock, Download, Mail, MailCheck, MailX, RefreshCw } from "lucide-react";
import DataTable from "@/components/admin/DataTable";
import StatusBadge from "@/components/admin/StatusBadge";
import { StatTile } from "@/components/admin/ui/StatTile";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RetryPanel } from "@/pages/admin-modules/shared/RetryPanel";
import { toDateLabel } from "@/pages/admin-modules/shared/formatters";
import { getErrorMessage } from "@/pages/admin-modules/shared/utils";
import {
  fetchNewsletterSubscribers,
  newsletterExportUrl,
  type NewsletterStatus,
  type NewsletterSubscriber,
} from "@/lib/adminNewsletter";

const STATUS_META: Record<NewsletterStatus, { label: string; cls: string }> = {
  SUBSCRIBED: {
    label: "Confirmé",
    cls: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  PENDING: {
    label: "En attente",
    cls: "border-amber-200 bg-amber-50 text-amber-700",
  },
  UNSUBSCRIBED: {
    label: "Désabonné",
    cls: "border-slate-200 bg-slate-50 text-slate-600",
  },
};

export function NewsletterModule() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | NewsletterStatus>(
    "all"
  );

  const query = useQuery({
    queryKey: ["admin-newsletter", "list"],
    queryFn: () => fetchNewsletterSubscribers({ limit: 500 }),
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    retry: 1,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? items.length;

  const counts = useMemo(
    () => ({
      confirmed: items.filter(s => s.status === "SUBSCRIBED").length,
      pending: items.filter(s => s.status === "PENDING").length,
      unsubscribed: items.filter(s => s.status === "UNSUBSCRIBED").length,
    }),
    [items]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter(subscriber => {
      if (statusFilter !== "all" && subscriber.status !== statusFilter) {
        return false;
      }
      if (!term) return true;
      return (
        subscriber.email.toLowerCase().includes(term) ||
        (subscriber.source || "").toLowerCase().includes(term) ||
        (subscriber.locale || "").toLowerCase().includes(term)
      );
    });
  }, [items, statusFilter, search]);

  const columns = useMemo<ColumnDef<NewsletterSubscriber, unknown>[]>(
    () => [
      {
        accessorKey: "email",
        header: "E-mail",
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {row.original.email}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Statut",
        cell: ({ row }) => {
          const meta = STATUS_META[row.original.status];
          return (
            <StatusBadge
              status={row.original.status}
              label={meta?.label}
              className={meta?.cls}
            />
          );
        },
      },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => row.original.source || "—",
      },
      {
        accessorKey: "locale",
        header: "Langue",
        cell: ({ row }) => (row.original.locale || "—").toUpperCase(),
      },
      {
        accessorKey: "confirmedAt",
        header: "Confirmé le",
        cell: ({ row }) =>
          row.original.confirmedAt ? toDateLabel(row.original.confirmedAt) : "—",
      },
      {
        accessorKey: "createdAt",
        header: "Inscrit le",
        cell: ({ row }) => toDateLabel(row.original.createdAt),
      },
    ],
    []
  );

  if (query.error && !query.data) {
    return (
      <RetryPanel
        title="Newsletter indisponible"
        description={getErrorMessage(
          query.error,
          "Impossible de charger les abonnés."
        )}
        onRetry={() => query.refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total abonnés"
          value={total}
          icon={<Mail className="h-4 w-4" />}
          accent
        />
        <StatTile
          label="Confirmés"
          value={counts.confirmed}
          sub="Double opt-in validé"
          icon={<MailCheck className="h-4 w-4" />}
        />
        <StatTile
          label="En attente"
          value={counts.pending}
          sub="Confirmation non cliquée"
          icon={<Clock className="h-4 w-4" />}
        />
        <StatTile
          label="Désabonnés"
          value={counts.unsubscribed}
          sub="Liste de suppression"
          icon={<MailX className="h-4 w-4" />}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 border-[var(--admin-border)]"
          title="Rafraîchir"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw
            className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`}
          />
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            window.open(
              newsletterExportUrl(search.trim() || undefined),
              "_blank",
              "noopener,noreferrer"
            )
          }
        >
          <Download className="mr-2 h-4 w-4" />
          Exporter CSV
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={query.isLoading}
        searchValue={search}
        onSearchValueChange={setSearch}
        searchPlaceholder="Rechercher par e-mail, source, langue…"
        filters={
          <Select
            value={statusFilter}
            onValueChange={(value: "all" | NewsletterStatus) =>
              setStatusFilter(value)
            }
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="Filtrer par statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="SUBSCRIBED">Confirmés</SelectItem>
              <SelectItem value="PENDING">En attente</SelectItem>
              <SelectItem value="UNSUBSCRIBED">Désabonnés</SelectItem>
            </SelectContent>
          </Select>
        }
        emptyTitle="Aucun abonné"
        emptyDescription="Les inscriptions à la newsletter apparaîtront ici."
        getRowId={row => row.id}
      />

      {total > items.length ? (
        <p className="text-xs text-[var(--admin-muted)]">
          Affichage des {items.length} abonnés les plus récents sur {total}.
          Utilisez l'export CSV pour la liste complète.
        </p>
      ) : null}
    </div>
  );
}
