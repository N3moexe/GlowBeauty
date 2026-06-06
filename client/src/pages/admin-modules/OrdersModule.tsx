import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Surface } from "@/components/admin/ui/Surface";
import { Heading } from "@/components/admin/ui/Heading";
import { ShimmerBlock } from "@/pages/admin-modules/shared/ShimmerBlock";
import { RetryPanel } from "@/pages/admin-modules/shared/RetryPanel";
import {
  formatCFA,
  toDateLabel,
} from "@/pages/admin-modules/shared/formatters";
import { normalizePaymentStatus } from "@/pages/admin-modules/shared/utils";
import StatusBadge from "@/components/admin/StatusBadge";
import { MediaWithFallback } from "@/components/ui/media-with-fallback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Package,
  RefreshCw,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

const ORDER_STATUSES = [
  { value: "all", label: "Tous les statuts" },
  { value: "pending", label: "En attente" },
  { value: "confirmed", label: "Confirmée" },
  { value: "processing", label: "En traitement" },
  { value: "shipped", label: "Expédiée" },
  { value: "delivered", label: "Livrée" },
  { value: "cancelled", label: "Annulée" },
];

const PAYMENT_STATUSES = [
  { value: "all", label: "Tous les paiements" },
  { value: "pending", label: "En attente" },
  { value: "processing", label: "En cours" },
  { value: "completed", label: "Complété" },
  { value: "failed", label: "Échoué" },
];

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = String(value ?? "");
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function downloadCsv(rows: Order[], filename: string) {
  const headers = [
    "Numéro",
    "Client",
    "Téléphone",
    "Montant",
    "Paiement",
    "Statut",
    "Date",
  ];
  const lines = rows.map(r =>
    [
      r.orderNumber,
      r.customerName,
      r.customerPhone,
      r.totalAmount,
      r.paymentStatus,
      r.status,
      toDateLabel(r.createdAt),
    ]
      .map(escapeCsvCell)
      .join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Order = {
  id: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  createdAt: string | Date;
};

type OrderItem = {
  id: number;
  productId: number;
  productName: string;
  productImage: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

type OrderDetail = Order & {
  items?: OrderItem[];
  customerAddress?: string | null;
  customerCity?: string | null;
  subtotalAmount?: number;
  shippingFee?: number;
  couponCode?: string | null;
  discountAmount?: number;
  totalPaid?: number;
  paymentReference?: string | null;
  notes?: string | null;
};

function OrderDetailDialog({
  orderId,
  canManage,
  open,
  onOpenChange,
  onMutated,
}: {
  orderId: number;
  canManage: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onMutated: () => void;
}) {
  const orderQuery = trpc.order.byId.useQuery(
    { id: orderId },
    { enabled: open }
  );
  const updateStatusMut = trpc.order.updateStatus.useMutation({
    onSuccess: () => {
      onMutated();
    },
  });
  const updatePaymentMut = trpc.order.updatePayment.useMutation({
    onSuccess: () => {
      onMutated();
    },
  });

  const order = orderQuery.data as OrderDetail | undefined;
  const [nextStatus, setNextStatus] = useState("");
  const [nextPayStatus, setNextPayStatus] = useState("");
  const [payRef, setPayRef] = useState("");

  useEffect(() => {
    if (order) {
      setNextStatus(order.status);
      setNextPayStatus(normalizePaymentStatus(order.paymentStatus));
      setPayRef("");
    }
  }, [order]);

  const busyStatus = updateStatusMut.isPending;
  const busyPayment = updatePaymentMut.isPending;

  function handleStatusSave() {
    if (!order || nextStatus === order.status) return;
    updateStatusMut.mutate({ id: order.id, status: nextStatus });
  }

  function handlePaymentSave() {
    if (!order) return;
    const normalized = normalizePaymentStatus(nextPayStatus);
    updatePaymentMut.mutate({
      id: order.id,
      paymentStatus: normalized,
      paymentReference: payRef.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--admin-ink)] [font-family:var(--font-admin-display)]">
            {order ? order.orderNumber : "Chargement…"}
          </DialogTitle>
        </DialogHeader>

        {orderQuery.isLoading && (
          <div className="space-y-3 py-2">
            {[1, 2, 3].map(i => (
              <ShimmerBlock key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        )}

        {order && (
          <div className="space-y-5 text-sm text-[var(--admin-ink)]">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-[var(--admin-muted)]">Client</p>
                <p className="font-medium">{order.customerName}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--admin-muted)]">Téléphone</p>
                <p className="font-medium">{order.customerPhone}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--admin-muted)]">Montant</p>
                <p className="font-semibold text-[var(--admin-accent)]">
                  {formatCFA(Number(order.totalAmount))}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--admin-muted)]">Date</p>
                <p>{toDateLabel(order.createdAt)}</p>
              </div>
            </div>

            {order.customerAddress ? (
              <p className="text-sm">
                <span className="text-xs text-[var(--admin-muted)]">
                  Adresse :{" "}
                </span>
                {[order.customerAddress, order.customerCity]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            ) : null}

            <div className="h-px bg-[var(--admin-divider)]" />

            {order.items && order.items.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                  Produits commandés
                </p>
                <div className="space-y-2.5">
                  {order.items.map(item => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[var(--admin-border)]">
                        <MediaWithFallback
                          src={item.productImage}
                          alt={item.productName}
                          fit="contain"
                          className="h-full w-full"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-[var(--admin-ink)]">
                          {item.productName}
                        </p>
                        <p className="text-xs text-[var(--admin-muted)]">
                          {item.quantity} × {formatCFA(Number(item.unitPrice))}
                        </p>
                      </div>
                      <p className="shrink-0 font-semibold text-[var(--admin-ink)]">
                        {formatCFA(Number(item.totalPrice))}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-1 space-y-1 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-tint)] p-3 text-sm">
                  <div className="flex justify-between text-[var(--admin-muted)]">
                    <span>Sous-total</span>
                    <span className="tabular-nums">
                      {formatCFA(
                        Number(
                          order.subtotalAmount ??
                            order.items.reduce(
                              (sum, it) => sum + Number(it.totalPrice),
                              0
                            )
                        )
                      )}
                    </span>
                  </div>
                  {Number(order.shippingFee) > 0 ? (
                    <div className="flex justify-between text-[var(--admin-muted)]">
                      <span>Livraison</span>
                      <span className="tabular-nums">
                        {formatCFA(Number(order.shippingFee))}
                      </span>
                    </div>
                  ) : null}
                  {Number(order.discountAmount) > 0 ? (
                    <div className="flex justify-between text-[var(--admin-accent)]">
                      <span>
                        Remise
                        {order.couponCode ? ` (${order.couponCode})` : ""}
                      </span>
                      <span className="tabular-nums">
                        −{formatCFA(Number(order.discountAmount))}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex justify-between border-t border-[var(--admin-divider)] pt-1 font-semibold text-[var(--admin-ink)]">
                    <span>Total</span>
                    <span className="tabular-nums">
                      {formatCFA(Number(order.totalAmount))}
                    </span>
                  </div>
                  {Number(order.totalPaid) > 0 ? (
                    <div className="flex justify-between text-xs text-[var(--admin-muted)]">
                      <span>Payé</span>
                      <span className="tabular-nums">
                        {formatCFA(Number(order.totalPaid))}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {order.notes ? (
              <p className="rounded-lg bg-[var(--admin-surface-tint)] p-3 text-sm italic text-[var(--admin-muted)]">
                {order.notes}
              </p>
            ) : null}

            <div className="h-px bg-[var(--admin-divider)]" />

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                Statut commande
              </p>
              <div className="flex items-center gap-2">
                <Select
                  value={nextStatus}
                  onValueChange={setNextStatus}
                  disabled={!canManage || busyStatus}
                >
                  <SelectTrigger className="flex-1 border-[var(--admin-border)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUSES.filter(s => s.value !== "all").map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {canManage && (
                  <Button
                    size="sm"
                    disabled={busyStatus || nextStatus === order.status}
                    onClick={handleStatusSave}
                    className="bg-[var(--admin-accent)] text-white hover:bg-[var(--admin-accent-hover)]"
                  >
                    {busyStatus ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Sauv."
                    )}
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                Statut paiement
              </p>
              <div className="flex items-center gap-2">
                <Select
                  value={nextPayStatus}
                  onValueChange={setNextPayStatus}
                  disabled={!canManage || busyPayment}
                >
                  <SelectTrigger className="flex-1 border-[var(--admin-border)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUSES.filter(s => s.value !== "all").map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {canManage && (
                  <Button
                    size="sm"
                    disabled={busyPayment}
                    onClick={handlePaymentSave}
                    className="bg-[var(--admin-accent)] text-white hover:bg-[var(--admin-accent-hover)]"
                  >
                    {busyPayment ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Sauv."
                    )}
                  </Button>
                )}
              </div>
              {canManage && (
                <Input
                  placeholder="Référence de paiement (optionnel)"
                  value={payRef}
                  onChange={e => setPayRef(e.target.value)}
                  className="border-[var(--admin-border)] bg-[var(--admin-bg)] text-sm"
                />
              )}
            </div>

            {updateStatusMut.isError && (
              <p className="text-xs text-rose-600">
                {updateStatusMut.error?.message ??
                  "Erreur lors de la mise à jour du statut."}
              </p>
            )}
            {updatePaymentMut.isError && (
              <p className="text-xs text-rose-600">
                {updatePaymentMut.error?.message ??
                  "Erreur lors de la mise à jour du paiement."}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <ShimmerBlock key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function OrdersModule({ canManage }: { canManage: boolean }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const queryInput = {
    query: debouncedSearch || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    paymentStatus: paymentFilter !== "all" ? paymentFilter : undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  const listQuery = trpc.order.list.useQuery(queryInput, {
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const orders: Order[] =
    (listQuery.data as { orders?: Order[] } | undefined)?.orders ?? [];
  const total: number =
    (listQuery.data as { total?: number } | undefined)?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleMutated() {
    void listQuery.refetch();
    setSelectedId(null);
  }

  function handleExport() {
    if (orders.length === 0) return;
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(orders, `commandes-${date}.csv`);
  }

  if (listQuery.error && !listQuery.data) {
    return (
      <RetryPanel
        title="Commandes indisponibles"
        description={
          listQuery.error instanceof Error
            ? listQuery.error.message
            : "Impossible de charger les commandes."
        }
        onRetry={() => void listQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading level={2} className="text-xl">
          Commandes
        </Heading>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-[var(--admin-border)]"
            onClick={handleExport}
            disabled={orders.length === 0}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9 border-[var(--admin-border)]"
            onClick={() => void listQuery.refetch()}
            disabled={listQuery.isFetching}
          >
            <RefreshCw
              className={cn("h-4 w-4", listQuery.isFetching && "animate-spin")}
            />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-muted)]" />
          <Input
            placeholder="Rechercher (nom, n°, téléphone)…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border-[var(--admin-border)] bg-[var(--admin-bg)] pl-9 text-sm"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={v => {
            setStatusFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="h-9 w-[180px] border-[var(--admin-border)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDER_STATUSES.map(s => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={paymentFilter}
          onValueChange={v => {
            setPaymentFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="h-9 w-[190px] border-[var(--admin-border)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_STATUSES.map(s => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Surface className="p-0 overflow-hidden">
        {listQuery.isLoading ? (
          <div className="p-5">
            <TableSkeleton />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--admin-muted)]">
            <Package className="h-10 w-10 opacity-30" />
            <p className="text-sm">Aucune commande trouvée.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-divider)] bg-[var(--admin-surface-tint)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    N° commande
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    Client
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    Montant
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    Paiement
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-divider)]">
                {orders.map(order => (
                  <tr
                    key={order.id}
                    className="cursor-pointer transition-colors hover:bg-[var(--admin-surface-tint)]"
                    onClick={() => setSelectedId(order.id)}
                  >
                    <td className="px-4 py-3 font-medium text-[var(--admin-accent)]">
                      {order.orderNumber}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--admin-ink)]">
                        {order.customerName}
                      </p>
                      <p className="text-xs text-[var(--admin-muted)]">
                        {order.customerPhone}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[var(--admin-ink)]">
                      {formatCFA(Number(order.totalAmount))}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={order.paymentStatus}
                        context="payment"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} context="order" />
                    </td>
                    <td className="px-4 py-3 text-[var(--admin-muted)]">
                      {toDateLabel(order.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!listQuery.isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--admin-divider)] px-4 py-3">
            <p className="text-xs text-[var(--admin-muted)]">
              {total} commande{total !== 1 ? "s" : ""} · page {page + 1}/
              {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 border-[var(--admin-border)]"
                disabled={page === 0}
                onClick={() => setPage(p => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 border-[var(--admin-border)]"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Surface>

      {selectedId !== null && (
        <OrderDetailDialog
          orderId={selectedId}
          canManage={canManage}
          open={selectedId !== null}
          onOpenChange={open => {
            if (!open) setSelectedId(null);
          }}
          onMutated={handleMutated}
        />
      )}
    </div>
  );
}
