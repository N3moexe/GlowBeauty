import { trpc } from "@/lib/trpc";
import { useSearch, Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Package,
  CheckCircle,
  Truck,
  Clock,
  XCircle,
} from "lucide-react";
import { useState, useMemo } from "react";

function formatCFA(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " CFA";
}

const statusMap: Record<
  string,
  { label: string; color: string; icon: any; step: number }
> = {
  pending: {
    label: "En attente",
    color: "text-yellow-600 bg-yellow-50",
    icon: Clock,
    step: 1,
  },
  confirmed: {
    label: "Confirmée",
    color: "text-blue-600 bg-blue-50",
    icon: CheckCircle,
    step: 2,
  },
  processing: {
    label: "En préparation",
    color: "text-purple-600 bg-purple-50",
    icon: Package,
    step: 3,
  },
  shipped: {
    label: "Expédiée",
    color: "text-orange-600 bg-orange-50",
    icon: Truck,
    step: 4,
  },
  delivered: {
    label: "Livrée",
    color: "text-green-600 bg-green-50",
    icon: CheckCircle,
    step: 5,
  },
  cancelled: {
    label: "Annulée",
    color: "text-red-600 bg-red-50",
    icon: XCircle,
    step: 0,
  },
};

const paymentStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "text-yellow-600" },
  processing: { label: "En cours", color: "text-blue-600" },
  completed: { label: "Payé", color: "text-green-600" },
  failed: { label: "Échoué", color: "text-red-600" },
};

export default function OrderTracking() {
  const searchString = useSearch();
  const params = useMemo(
    () => new URLSearchParams(searchString),
    [searchString]
  );
  const orderParam = params.get("order") || "";
  // `p` is a one-click tracking shortcut included in order confirmation and
  // status-update emails: {appUrl}/suivi?order=SBP-...&p=1234. It avoids
  // forcing customers to retype the last 4 digits of their phone.
  const phoneParam = (params.get("p") || "").replace(/\D/g, "").slice(0, 4);
  const [orderNumber, setOrderNumber] = useState(orderParam);
  const [phoneLast4, setPhoneLast4] = useState(phoneParam);
  const [searchNumber, setSearchNumber] = useState(orderParam);
  const [searchPhone, setSearchPhone] = useState(
    phoneParam.length === 4 ? phoneParam : ""
  );

  const canQuery = !!searchNumber && /^\d{4}$/.test(searchPhone);

  const {
    data: order,
    isLoading,
    error,
  } = trpc.order.byNumber.useQuery(
    { orderNumber: searchNumber, phoneLast4: searchPhone || undefined },
    { enabled: canQuery, retry: false }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchNumber(orderNumber.trim());
    setSearchPhone(phoneLast4.trim());
  };

  const status = order ? statusMap[order.status] : null;
  const paymentStatus = order ? paymentStatusMap[order.paymentStatus] : null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <div className="container py-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-center">
          Suivre ma commande
        </h1>

        <form
          onSubmit={handleSearch}
          className="flex flex-col sm:flex-row gap-2 mb-8"
        >
          <Input
            placeholder="Numéro de commande (ex: SBP-...)"
            value={orderNumber}
            onChange={e => setOrderNumber(e.target.value)}
            className="h-12 flex-1"
          />
          <Input
            placeholder="4 derniers chiffres du téléphone"
            value={phoneLast4}
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            onChange={e =>
              setPhoneLast4(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            className="h-12 sm:w-56"
            aria-label="4 derniers chiffres du téléphone utilisé à la commande"
            title="Les 4 derniers chiffres du numéro de téléphone utilisé lors de votre commande"
          />
          <Button
            type="submit"
            disabled={!orderNumber.trim() || phoneLast4.length !== 4}
            className="bg-crimson hover:bg-crimson-light text-white h-12 px-6"
          >
            <Search className="h-5 w-5" />
          </Button>
        </form>

        {isLoading && (
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-crimson border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Recherche en cours...</p>
          </div>
        )}

        {error && searchNumber && (
          <div className="text-center py-8 bg-card rounded-xl border p-6">
            <XCircle className="h-12 w-12 text-destructive/30 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Commande non trouvée</h3>
            <p className="text-sm text-muted-foreground">
              Vérifiez le numéro de commande et réessayez
            </p>
          </div>
        )}

        {order && status && (
          <div className="bg-card rounded-xl border overflow-hidden">
            {/* Header */}
            <div className="bg-crimson text-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/70">Commande</p>
                  <p className="font-bold text-lg">{order.orderNumber}</p>
                </div>
                <div
                  className={`px-3 py-1 rounded-full text-sm font-medium ${status.color}`}
                >
                  {status.label}
                </div>
              </div>
            </div>

            {/* Progress */}
            {order.status !== "cancelled" && (
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  {[
                    "En attente",
                    "Confirmée",
                    "Préparation",
                    "Expédiée",
                    "Livrée",
                  ].map((label, i) => (
                    <div key={i} className="flex flex-col items-center flex-1">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${
                          i + 1 <= status.step
                            ? "bg-green-accent text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {i + 1 <= status.step ? "✓" : i + 1}
                      </div>
                      <span className="text-[10px] text-muted-foreground text-center hidden sm:block">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Details */}
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Client</p>
                  <p className="font-medium">{order.customerName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Téléphone</p>
                  <p className="font-medium">{order.customerPhone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Paiement</p>
                  <p className={`font-medium ${paymentStatus?.color}`}>
                    {order.paymentMethod.replace("_", " ").toUpperCase()} -{" "}
                    {paymentStatus?.label}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-bold text-crimson">
                    {formatCFA(order.totalAmount)}
                  </p>
                </div>
              </div>

              {/* Items */}
              {order.items && order.items.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-sm mb-3">
                    Articles commandés
                  </h3>
                  <div className="space-y-2">
                    {order.items.map((item: any) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 text-sm"
                      >
                        <div className="w-10 h-10 rounded bg-muted overflow-hidden shrink-0">
                          {item.productImage && (
                            <img
                              src={item.productImage}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">
                            {item.productName}
                          </p>
                          <p className="text-muted-foreground">
                            {item.quantity}x {formatCFA(item.unitPrice)}
                          </p>
                        </div>
                        <span className="font-medium">
                          {formatCFA(item.totalPrice)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                Commande passée le{" "}
                {new Date(order.createdAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        )}

        {!searchNumber && !isLoading && (
          <div className="text-center py-8">
            <Package className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-muted-foreground">
              Entrez votre numéro de commande pour voir son statut
            </p>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
