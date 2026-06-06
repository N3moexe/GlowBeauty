import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Mail, MapPin, Phone } from "lucide-react";
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
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const listQuery = trpc.customers.list.useQuery(
    {
      query: search.trim() || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
    { placeholderData: prev => prev, refetchInterval: 30000 }
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
        header: "Customer",
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
        header: "Orders",
        cell: ({ row }) => (
          <p className="tabular-nums">{row.original.totalOrders}</p>
        ),
      },
      {
        accessorKey: "totalSpent",
        header: "Total spent",
        cell: ({ row }) => (
          <p className="tabular-nums font-medium">
            {formatCFA(row.original.totalSpent)}
          </p>
        ),
      },
      {
        id: "lastOrder",
        header: "Last order",
        cell: ({ row }) =>
          row.original.lastOrderDate
            ? toDateLabel(row.original.lastOrderDate)
            : "—",
      },
      {
        accessorKey: "createdAt",
        header: "Member since",
        cell: ({ row }) => toDateLabel(row.original.createdAt),
      },
    ],
    []
  );

  const errorMessage = listQuery.error
    ? getErrorMessage(listQuery.error, "Unable to load customers.")
    : null;

  const detail = detailQuery.data as CustomerEntity | null | undefined;

  return (
    <section className="space-y-6">
      {errorMessage ? (
        <RetryPanel
          title="Customers unavailable"
          description={errorMessage}
          onRetry={() => {
            void listQuery.refetch();
          }}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={rows}
            isLoading={listQuery.isLoading}
            searchValue={search}
            onSearchValueChange={value => {
              setSearch(value);
              setPage(0);
            }}
            searchPlaceholder="Search name, phone, email..."
            emptyTitle="No customers yet"
            emptyDescription="Customers appear here after their first order."
            onRowClick={row => setSelectedId(row.id)}
            getRowId={row => String(row.id)}
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
                Previous
              </Button>
              <span className="text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {detailQuery.isLoading
                ? "Loading…"
                : (detail?.name ?? "Customer")}
            </DialogTitle>
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
                  <p className="text-xs text-muted-foreground">Total orders</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {detail.totalOrders}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total spent</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {formatCFA(detail.totalSpent)}
                  </p>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-border/60 p-4">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{detail.phone}</span>
                </div>
                {detail.email ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{detail.email}</span>
                  </div>
                ) : null}
                {(detail.address ?? detail.city) ? (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>
                      {[detail.address, detail.city].filter(Boolean).join(", ")}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                {detail.lastOrderDate ? (
                  <div>
                    <p className="text-xs text-muted-foreground">Last order</p>
                    <p>{toDateLabel(detail.lastOrderDate)}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs text-muted-foreground">Member since</p>
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
