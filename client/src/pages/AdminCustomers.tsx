import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { type ColumnDef } from "@tanstack/react-table";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import AdminLayout from "@/components/admin/AdminLayout";
import PageHeader from "@/components/admin/PageHeader";
import DataTable from "@/components/admin/DataTable";
import AdminNotAllowed from "@/pages/AdminNotAllowed";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { getAdminModulePath } from "@/lib/adminNavigation";
import { trpc } from "@/lib/trpc";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const CUSTOMERS_PAGE_SIZE = 50;

type CustomerRow = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  createdAt: string | Date | null;
};

function toDateLabel(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminCustomers() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const { data: permissions, isLoading: permissionsLoading } =
    trpc.rbac.me.useQuery(undefined, { enabled: !!user, retry: false });
  const canAccessCustomers =
    (permissions?.allowedModules.includes("search") ?? false) ||
    (permissions?.allowedModules.includes("orders") ?? false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const customersQuery = trpc.customers.list.useQuery(
    {
      query: debouncedSearch || undefined,
      limit: CUSTOMERS_PAGE_SIZE,
      offset: page * CUSTOMERS_PAGE_SIZE,
    },
    {
      enabled: !!user && canAccessCustomers,
      retry: 1,
      placeholderData: previous => previous,
    }
  );

  const detailQuery = trpc.customers.byId.useQuery(
    { id: selectedId ?? 0 },
    { enabled: selectedId !== null, retry: 1 }
  );

  const rows = (customersQuery.data?.items ?? []) as CustomerRow[];
  const total = customersQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / CUSTOMERS_PAGE_SIZE));

  const columns = useMemo<ColumnDef<CustomerRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Nom",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name || "—"}</span>
        ),
      },
      {
        accessorKey: "phone",
        header: "Téléphone",
        cell: ({ row }) => row.original.phone || "—",
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => row.original.email || "—",
      },
      {
        accessorKey: "city",
        header: "Ville",
        cell: ({ row }) => row.original.city || "—",
      },
      {
        accessorKey: "createdAt",
        header: "Ajouté le",
        cell: ({ row }) => toDateLabel(row.original.createdAt),
      },
    ],
    []
  );

  if (authLoading || permissionsLoading) {
    return (
      <AdminLayout
        activeModule="search"
        onModuleChange={m => setLocation(getAdminModulePath(m))}
        userName={null}
      >
        <div className="p-10 text-center text-sm text-muted-foreground">
          Chargement…
        </div>
      </AdminLayout>
    );
  }
  if (!user) {
    window.location.href = getLoginUrl();
    return null;
  }
  if (!canAccessCustomers) {
    return <AdminNotAllowed />;
  }

  const detail = detailQuery.data as CustomerRow | undefined;

  return (
    <AdminLayout
      activeModule="search"
      userName={user.name}
      onModuleChange={m => setLocation(getAdminModulePath(m))}
    >
      <PageHeader
        breadcrumbs={[{ label: "Admin" }, { label: "Clients" }]}
        title="Clients"
        description="Annuaire des clients issus des commandes (téléphone, email, ville)."
      />

      <DataTable
        columns={columns}
        data={rows}
        isLoading={customersQuery.isLoading}
        searchValue={search}
        onSearchValueChange={setSearch}
        searchPlaceholder="Nom, téléphone, email…"
        initialPageSize={CUSTOMERS_PAGE_SIZE}
        emptyTitle="Aucun client"
        emptyDescription="Aucun client ne correspond au filtre. Les clients sont créés automatiquement à la première commande."
        onRowClick={row => setSelectedId(row.id)}
      />

      <div className="mt-3 flex flex-col gap-2 rounded-xl border bg-card px-3 py-2 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-4">
        <div aria-live="polite">
          {total === 0
            ? "0 client"
            : `${page * CUSTOMERS_PAGE_SIZE + 1}–${Math.min(
                (page + 1) * CUSTOMERS_PAGE_SIZE,
                total
              )} sur ${total} clients`}
        </div>
        <div className="flex items-center gap-2">
          <span className="min-w-[96px] text-center">
            Page {page + 1} / {pageCount}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0 || customersQuery.isFetching}
          >
            Précédent
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() =>
              setPage(p => ((p + 1) * CUSTOMERS_PAGE_SIZE < total ? p + 1 : p))
            }
            disabled={
              (page + 1) * CUSTOMERS_PAGE_SIZE >= total ||
              customersQuery.isFetching
            }
          >
            Suivant
          </Button>
        </div>
      </div>

      <Sheet
        open={selectedId !== null}
        onOpenChange={open => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent side="right" className="w-[420px] sm:max-w-[420px]">
          <SheetHeader>
            <SheetTitle>{detail?.name || "Client"}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3 text-sm">
            {detailQuery.isLoading || !detail ? (
              <p className="text-muted-foreground">Chargement…</p>
            ) : (
              <>
                <DetailRow label="Téléphone" value={detail.phone || "—"} />
                <DetailRow label="Email" value={detail.email || "—"} />
                <DetailRow label="Adresse" value={detail.address || "—"} />
                <DetailRow label="Ville" value={detail.city || "—"} />
                <DetailRow
                  label="Ajouté le"
                  value={toDateLabel(detail.createdAt)}
                />
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="max-w-[65%] text-right font-medium">{value}</span>
    </div>
  );
}
