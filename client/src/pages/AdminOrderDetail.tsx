import { useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { getAdminModulePath } from "@/lib/adminNavigation";
import AdminLayout from "@/components/admin/AdminLayout";
import PageHeader from "@/components/admin/PageHeader";
import AdminNotAllowed from "@/pages/AdminNotAllowed";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Printer,
  RefreshCw,
} from "lucide-react";

const STATUS_OPTIONS = [
  { value: "pending", label: "En attente" },
  { value: "confirmed", label: "Confirmée" },
  { value: "processing", label: "En préparation" },
  { value: "shipped", label: "Expédiée" },
  { value: "delivered", label: "Livrée" },
  { value: "cancelled", label: "Annulée" },
];

const PAYMENT_OPTIONS = [
  { value: "pending", label: "En attente" },
  { value: "processing", label: "En cours" },
  { value: "completed", label: "Payée" },
  { value: "failed", label: "Échouée" },
];

function formatCFA(value: number | null | undefined) {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(value || 0))} CFA`;
}

function formatDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminOrderDetail() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute<{ id: string }>("/admin/orders/:id");
  const orderId = Number(params?.id);

  const { data: permissions, isLoading: permissionsLoading } =
    trpc.rbac.me.useQuery(undefined, { enabled: !!user, retry: false });
  const canAccessOrders =
    permissions?.allowedModules.includes("orders") ?? false;
  const canWriteOrders = Boolean(permissions?.canWriteOrders);

  const orderQuery = trpc.order.byId.useQuery(
    { id: orderId },
    { enabled: Number.isFinite(orderId) && !!user && canAccessOrders }
  );
  const statusMutation = trpc.order.updateStatus.useMutation({
    onSuccess: () => {
      orderQuery.refetch();
      toast.success("Statut mis à jour");
    },
    onError: error => {
      toast.error("Mise à jour impossible", { description: error.message });
    },
  });
  const paymentMutation = trpc.order.updatePayment.useMutation({
    onSuccess: () => {
      orderQuery.refetch();
      toast.success("Paiement mis à jour");
    },
    onError: error => {
      toast.error("Mise à jour impossible", { description: error.message });
    },
  });

  const order = orderQuery.data;
  const items = (order?.items ?? []) as Array<{
    id: number;
    productName: string;
    productImage?: string | null;
    unitPrice: number;
    quantity: number;
    totalPrice: number;
  }>;

  const totalItemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  if (authLoading || permissionsLoading) {
    return (
      <AdminLayout
        activeModule="orders"
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
  if (!canAccessOrders) {
    return <AdminNotAllowed />;
  }

  return (
    <AdminLayout
      activeModule="orders"
      userName={user.name}
      onModuleChange={m => setLocation(getAdminModulePath(m))}
    >
      <PageHeader
        breadcrumbs={[
          { label: "Admin" },
          { label: "Orders", href: "/admin/orders" },
          { label: order?.orderNumber || `#${orderId}` },
        ]}
        title={order?.orderNumber || "Commande"}
        description={
          order ? `Créée le ${formatDate(order.createdAt)}` : "Chargement…"
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setLocation("/admin/orders")}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Retour
            </Button>
            <Button variant="outline" onClick={() => orderQuery.refetch()}>
              <RefreshCw
                className={`mr-1.5 h-4 w-4 ${orderQuery.isFetching ? "animate-spin" : ""}`}
              />
              Actualiser
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-4 w-4" />
              Imprimer
            </Button>
          </div>
        }
      />

      {orderQuery.isLoading || !order ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
          Chargement de la commande…
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          {/* Items + totals */}
          <section className="space-y-5">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold">
                  Articles ({totalItemCount})
                </h2>
              </div>
              <div className="space-y-3">
                {items.map(item => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/10 p-3"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted/40">
                      {item.productImage ? (
                        <img
                          src={item.productImage}
                          alt={item.productName}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {item.productName}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {item.quantity} × {formatCFA(item.unitPrice)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCFA(item.totalPrice)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 border-t border-border pt-4 text-sm">
                <Row
                  label="Sous-total"
                  value={formatCFA((order as any).subtotalAmount)}
                />
                <Row
                  label="Frais de livraison"
                  value={formatCFA((order as any).shippingFee)}
                />
                {Number((order as any).discountAmount || 0) > 0 ? (
                  <Row
                    label={`Remise${(order as any).couponCode ? ` (${(order as any).couponCode})` : ""}`}
                    value={`− ${formatCFA((order as any).discountAmount)}`}
                    emphasis
                  />
                ) : null}
                <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-base font-bold">Total</span>
                  <span className="text-lg font-bold tabular-nums">
                    {formatCFA(order.totalAmount)}
                  </span>
                </div>
                <Row label="Payé" value={formatCFA((order as any).totalPaid)} />
              </div>
            </div>
          </section>

          {/* Sidebar */}
          <aside className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Statut
              </p>
              <div className="mt-2 space-y-2">
                <Select
                  value={order.status}
                  onValueChange={v => {
                    if (!canWriteOrders) return;
                    statusMutation.mutate({ id: order.id, status: v });
                  }}
                  disabled={statusMutation.isPending || !canWriteOrders}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={order.paymentStatus}
                  onValueChange={v => {
                    if (!canWriteOrders) return;
                    paymentMutation.mutate({
                      id: order.id,
                      paymentStatus: v as any,
                    });
                  }}
                  disabled={paymentMutation.isPending || !canWriteOrders}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        Paiement — {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {order.paymentStatus !== "completed" ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      if (!canWriteOrders) return;
                      paymentMutation.mutate({
                        id: order.id,
                        paymentStatus: "completed",
                        paymentReference: "manual-confirm",
                      });
                    }}
                    disabled={paymentMutation.isPending || !canWriteOrders}
                    title={!canWriteOrders ? "Lecture seule" : undefined}
                  >
                    <CheckCircle2 className="mr-1.5 h-4 w-4 text-green-600" />
                    Marquer comme payée
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Client
              </p>
              <div className="mt-2 space-y-1 text-sm">
                <p className="font-semibold">{order.customerName}</p>
                <p className="text-muted-foreground">
                  <a
                    href={`tel:${order.customerPhone}`}
                    className="hover:text-brand-accent"
                  >
                    {order.customerPhone}
                  </a>
                </p>
                {(order as any).customerEmail ? (
                  <p className="text-muted-foreground break-all">
                    <a
                      href={`mailto:${(order as any).customerEmail}`}
                      className="hover:text-brand-accent"
                    >
                      {(order as any).customerEmail}
                    </a>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Livraison
              </p>
              <div className="mt-2 space-y-1 text-sm">
                <p className="whitespace-pre-line">{order.customerAddress}</p>
                {order.customerCity ? (
                  <p className="text-muted-foreground">{order.customerCity}</p>
                ) : null}
                {(order as any).notes ? (
                  <p className="mt-2 border-t border-border/70 pt-2 text-xs italic text-muted-foreground">
                    « {(order as any).notes} »
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Paiement
              </p>
              <div className="mt-2 space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Mode :</span>{" "}
                  <Badge variant="outline" className="ml-1">
                    {order.paymentMethod}
                  </Badge>
                </p>
                {(order as any).paymentReference ? (
                  <p className="break-all">
                    <span className="text-muted-foreground">Référence :</span>{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">
                      {(order as any).paymentReference}
                    </code>
                  </p>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      )}
    </AdminLayout>
  );
}

function Row({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${emphasis ? "text-emerald-700" : ""}`}>
        {value}
      </span>
    </div>
  );
}
