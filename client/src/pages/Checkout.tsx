import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Gift,
  Loader2,
  MapPin,
  Package,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Truck,
  User,
} from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SectionReveal from "@/components/storefront/SectionReveal";
import { useCart } from "@/contexts/CartContext";
import {
  getAnalyticsSessionId,
  trackAnalyticsEvent,
} from "@/lib/analyticsEvents";
import { trpc } from "@/lib/trpc";
import { useStorefrontSettings } from "@/hooks/useStorefrontSettings";
import {
  applySessionCoupon,
  previewSessionCoupon,
  removeSessionCoupon,
  syncSessionCart,
  type CouponApiError,
} from "@/lib/couponsApi";
import type { CartSummary } from "@shared/coupons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ProductCard from "@/components/ProductCard";
import PaymentBadgesRow from "@/components/storefront/sections/PaymentBadgesRow";

type CheckoutStep = "info" | "delivery" | "payment" | "confirm";

function formatCFA(amount: number) {
  return `${new Intl.NumberFormat("fr-FR").format(amount)} CFA`;
}

const CART_SESSION_STORAGE_KEY = "sbp_cart_session_id";

function getCartSessionId() {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(CART_SESSION_STORAGE_KEY);
  if (existing && existing.trim().length >= 8) return existing;
  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  window.localStorage.setItem(CART_SESSION_STORAGE_KEY, generated);
  return generated;
}

const paymentMethods = [
  {
    id: "cash",
    name: "Paiement a la livraison",
    desc: "Payez directement au livreur",
    icon: Truck,
    color: "text-green-600",
    requiresRemoteInit: false,
  },
  {
    id: "orange_money",
    name: "Orange Money",
    desc: "Paiement mobile Orange Money",
    icon: Smartphone,
    color: "text-orange-500",
    requiresRemoteInit: true,
    settingKey: "paymentOrangeEnabled",
  },
  {
    id: "wave",
    name: "Wave",
    desc: "Paiement mobile Wave",
    icon: Smartphone,
    color: "text-sky-500",
    requiresRemoteInit: true,
    settingKey: "paymentWaveEnabled",
  },
  {
    id: "free_money",
    name: "Free Money",
    desc: "Paiement mobile Free Money",
    icon: Smartphone,
    color: "text-red-500",
    requiresRemoteInit: true,
    settingKey: "paymentFreeMoneyEnabled",
  },
  {
    id: "card",
    name: "Carte bancaire",
    desc: "Visa / Mastercard (validation manuelle)",
    icon: CreditCard,
    color: "text-violet-500",
    requiresRemoteInit: false,
    settingKey: "paymentCardEnabled",
  },
] as const;

const stepList: {
  key: CheckoutStep;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "info", label: "Infos", icon: User },
  { key: "delivery", label: "Livraison", icon: MapPin },
  { key: "payment", label: "Paiement", icon: CreditCard },
  { key: "confirm", label: "Confirmation", icon: CheckCircle2 },
];
const CHECKOUT_FREE_SHIPPING_THRESHOLD = 75000;

function getStepIndex(step: CheckoutStep) {
  return stepList.findIndex(entry => entry.key === step);
}

export default function Checkout() {
  const { items, totalPrice, addItem, clearCart } = useCart();
  const { settings } = useStorefrontSettings();
  const shouldReduceMotion = useReducedMotion();
  const sessionId = useMemo(
    () => getCartSessionId() || getAnalyticsSessionId(),
    []
  );

  const [step, setStep] = useState<CheckoutStep>("info");
  const [orderNumber, setOrderNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponApplying, setCouponApplying] = useState(false);
  const [couponRemoving, setCouponRemoving] = useState(false);
  const [couponPreviewing, setCouponPreviewing] = useState(false);
  const [couponPreviewMessage, setCouponPreviewMessage] = useState<
    string | null
  >(null);
  const [couponPreviewError, setCouponPreviewError] = useState<string | null>(
    null
  );
  const [cartSyncing, setCartSyncing] = useState(false);
  const [cartSummary, setCartSummary] = useState<CartSummary>({
    sessionId,
    subtotal: totalPrice,
    shippingFee: 0,
    discountAmount: 0,
    discountType: null,
    couponCode: null,
    total: totalPrice,
  });

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "Dakar",
    notes: "",
  });

  const zonesQuery = trpc.deliveryZone.list.useQuery();
  const checkoutUpsellQuery = trpc.product.list.useQuery({
    trending: true,
    limit: 10,
  });
  const availablePaymentMethods = useMemo(
    () =>
      paymentMethods.filter(method => {
        if (!("settingKey" in method) || !method.settingKey) return true;
        return Boolean(
          (settings as Record<string, unknown>)[method.settingKey]
        );
      }),
    [settings]
  );
  const zones = zonesQuery.data || [];
  const selectedZoneData = zones.find(zone => zone.id === selectedZone);
  const cartProductIds = useMemo(
    () => new Set(items.map(item => item.productId)),
    [items]
  );
  const checkoutUpsells = useMemo(
    () =>
      (checkoutUpsellQuery.data?.products ?? [])
        .filter(
          product =>
            !cartProductIds.has(product.id) && product.inStock !== false
        )
        .slice(0, 2),
    [cartProductIds, checkoutUpsellQuery.data?.products]
  );

  useEffect(() => {
    if (!paymentMethod) return;
    const stillAvailable = availablePaymentMethods.some(
      method => method.id === paymentMethod
    );
    if (!stillAvailable) {
      setPaymentMethod("");
    }
  }, [availablePaymentMethods, paymentMethod]);

  useEffect(() => {
    let active = true;
    const sync = async () => {
      if (items.length === 0) {
        if (!active) return;
        setCartSummary({
          sessionId,
          subtotal: 0,
          shippingFee: 0,
          discountAmount: 0,
          discountType: null,
          couponCode: null,
          total: 0,
        });
        setCouponMessage(null);
        setCouponError(null);
        setCouponPreviewMessage(null);
        setCouponPreviewError(null);
        return;
      }

      try {
        setCartSyncing(true);
        const summary = await syncSessionCart({
          sessionId,
          deliveryZoneId: selectedZone ?? null,
          items: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        });
        if (!active) return;
        setCartSummary(summary);
        if (summary.couponCode) {
          setCouponCodeInput(summary.couponCode);
        }
      } catch (error: any) {
        if (!active) return;
        const message =
          error?.message || "Impossible de synchroniser le panier.";
        setCouponError(message);
      } finally {
        if (active) {
          setCartSyncing(false);
        }
      }
    };

    void sync();
    return () => {
      active = false;
    };
  }, [items, selectedZone, sessionId]);

  useEffect(() => {
    const code = couponCodeInput.trim().toUpperCase();
    if (!code || code.length < 2 || items.length === 0) {
      setCouponPreviewMessage(null);
      setCouponPreviewError(null);
      setCouponPreviewing(false);
      return;
    }
    if (cartSummary.couponCode && code === cartSummary.couponCode) {
      setCouponPreviewMessage(null);
      setCouponPreviewError(null);
      setCouponPreviewing(false);
      return;
    }
    if (couponApplying || couponRemoving || cartSyncing) {
      setCouponPreviewing(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setCouponPreviewing(true);
        try {
          const preview = await previewSessionCoupon({
            sessionId,
            code,
            shippingFee: cartSummary.shippingFee,
          });
          if (cancelled) return;
          setCouponPreviewMessage(
            preview.message ||
              `Reduction estimee: ${formatCFA(preview.discountAmount)}. Total: ${formatCFA(preview.total)}`
          );
          setCouponPreviewError(null);
        } catch (error: any) {
          if (cancelled) return;
          const couponApiError = error as CouponApiError;
          setCouponPreviewError(couponApiError?.message || "Coupon invalide.");
          setCouponPreviewMessage(null);
        } finally {
          if (!cancelled) {
            setCouponPreviewing(false);
          }
        }
      })();
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    cartSummary.couponCode,
    cartSummary.shippingFee,
    couponApplying,
    couponCodeInput,
    couponRemoving,
    cartSyncing,
    items.length,
    sessionId,
  ]);

  const totalWithDelivery = cartSummary.total;
  const deliveryFee = cartSummary.shippingFee;
  const amountToFreeShipping = Math.max(
    0,
    CHECKOUT_FREE_SHIPPING_THRESHOLD - cartSummary.subtotal
  );

  const handleApplyCoupon = async () => {
    const code = couponCodeInput.trim().toUpperCase();
    if (!code) {
      setCouponError("Entrez un code coupon.");
      return;
    }

    setCouponApplying(true);
    setCouponError(null);
    setCouponMessage(null);
    setCouponPreviewMessage(null);
    setCouponPreviewError(null);
    try {
      const response = await applySessionCoupon({
        sessionId,
        code,
        shippingFee: cartSummary.shippingFee,
      });
      setCartSummary(response);
      setCouponCodeInput(response.couponCode || code);
      setCouponMessage(response.message || `Coupon ${code} applique.`);
      toast.success("Coupon applique", {
        description: response.message || `${code} actif pour cette commande.`,
      });
    } catch (error: any) {
      const couponError = error as CouponApiError;
      const message =
        couponError?.message || "Impossible d'appliquer ce coupon.";
      setCouponError(message);
      setCouponMessage(null);
      toast.error("Coupon invalide", { description: message });
    } finally {
      setCouponApplying(false);
    }
  };

  const handleRemoveCoupon = async () => {
    setCouponRemoving(true);
    setCouponError(null);
    setCouponMessage(null);
    setCouponPreviewMessage(null);
    setCouponPreviewError(null);
    try {
      const summary = await removeSessionCoupon(sessionId);
      setCartSummary(summary);
      setCouponCodeInput("");
      toast.success("Coupon retire");
    } catch (error: any) {
      const message = error?.message || "Impossible de retirer le coupon.";
      setCouponError(message);
      toast.error("Suppression du coupon impossible", { description: message });
    } finally {
      setCouponRemoving(false);
    }
  };

  const initiatePayment = trpc.payment.initiate.useMutation();
  const createOrder = trpc.order.create.useMutation({
    onSuccess: async data => {
      setOrderNumber(data.orderNumber);

      trackAnalyticsEvent({
        type: "purchase",
        path: "/commande",
        meta: {
          orderNumber: data.orderNumber,
          paymentMethod,
          totalAmount: cartSummary.total,
          items: items.length,
        },
      });

      const selectedPayment = availablePaymentMethods.find(
        method => method.id === paymentMethod
      );
      const requiresRemoteInit = Boolean(selectedPayment?.requiresRemoteInit);

      if (requiresRemoteInit) {
        let paymentInitiated = false;
        try {
          const result = await initiatePayment.mutateAsync({
            orderNumber: data.orderNumber,
            paymentMethod: paymentMethod as
              | "orange_money"
              | "wave"
              | "free_money",
          });

          if (result.success) {
            paymentInitiated = true;
            toast.success("Paiement initialise", {
              description: result.message,
            });
          } else {
            toast.error("Paiement non initialise", {
              description:
                result.message ||
                "Reessayez ou choisissez un autre mode de paiement.",
            });
          }
        } catch (error: any) {
          toast.error("Erreur de paiement", {
            description:
              error?.message || "Impossible d'initialiser le paiement",
          });
        }

        if (!paymentInitiated) {
          // Leave cart + payment step intact so the customer can retry.
          return;
        }
      } else if (paymentMethod === "card") {
        toast.success("Commande enregistree", {
          description: "Paiement carte a confirmer par notre equipe.",
        });
      }

      clearCart();
      setStep("confirm");
    },
    onError: error => {
      toast.error("Erreur lors de la commande", { description: error.message });
    },
  });

  const validateInfo = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Le nom est requis";
    if (!form.phone.trim()) {
      nextErrors.phone = "Le numero de telephone est requis";
    } else if (!/^(\+?221)?[0-9]{9}$/.test(form.phone.replace(/\s/g, ""))) {
      nextErrors.phone = "Numero invalide (ex: 77 123 45 67)";
    }
    if (form.email.trim()) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(form.email.trim())) {
        nextErrors.email = "Adresse email invalide";
      }
    }
    if (!form.address.trim()) nextErrors.address = "L'adresse est requise";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateDelivery = () => {
    if (!selectedZone) {
      toast.error("Veuillez selectionner une zone de livraison");
      return false;
    }
    return true;
  };

  const validatePayment = () => {
    if (!paymentMethod) {
      toast.error("Veuillez selectionner un mode de paiement");
      return false;
    }
    const isAvailable = availablePaymentMethods.some(
      method => method.id === paymentMethod
    );
    if (!isAvailable) {
      toast.error("Ce mode de paiement est indisponible actuellement");
      return false;
    }
    return true;
  };

  const submitOrder = () => {
    if (!validatePayment()) return;

    createOrder.mutate({
      customerName: form.name,
      customerPhone: form.phone,
      customerEmail: form.email.trim() || undefined,
      customerAddress: form.address,
      customerCity: form.city,
      sessionId,
      deliveryZoneId: selectedZone || undefined,
      paymentMethod,
      notes: form.notes,
      items: items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    });
  };

  if (items.length === 0 && step === "info") {
    const rescueProducts = (checkoutUpsellQuery.data?.products ?? [])
      .filter(product => product.inStock !== false)
      .slice(0, 4);
    return (
      <div className="page-shell flex min-h-screen flex-col">
        <Navbar />
        <main className="container section-shell flex-1">
          <div className="section-frame mx-auto max-w-xl p-10 text-center">
            <h1 className="text-2xl font-bold">
              Votre panier est calme pour l'instant
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ajoutez quelques essentiels — on s'occupe du reste.
            </p>
            <Link href="/boutique">
              <Button variant="soft" className="mt-6 rounded-xl">
                Continuer les achats
              </Button>
            </Link>
          </div>

          {rescueProducts.length > 0 ? (
            <div className="mt-12 ui-stack-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-1">
                  <p className="section-kicker">Best-sellers</p>
                  <h2 className="headline-title">
                    Commencez par nos essentiels
                  </h2>
                  <p className="section-description">
                    Les favoris de la communauté pour démarrer votre routine.
                  </p>
                </div>
                <Link
                  href="/boutique"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-accent hover:underline"
                >
                  Voir toute la boutique
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {rescueProducts.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          ) : null}
        </main>
        <Footer />
      </div>
    );
  }

  const isSubmitting =
    createOrder.isPending ||
    initiatePayment.isPending ||
    cartSyncing ||
    couponApplying ||
    couponRemoving;
  const currentStepIndex = getStepIndex(step);

  return (
    <div className="page-shell flex min-h-screen flex-col">
      <Navbar />

      <main className="container section-shell flex-1">
        <SectionReveal className="ui-stack-3">
          <nav className="text-sm text-muted-foreground">
            <Link
              href="/panier"
              className="inline-flex items-center gap-1 transition-colors hover:text-crimson"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour au panier
            </Link>
          </nav>

          <header className="ui-stack-1">
            <p className="section-kicker">Checkout securise</p>
            <h1 className="headline-title">Finaliser votre commande</h1>
            <p className="section-description">
              Processus simple en 3 etapes: informations, livraison, paiement.
            </p>
          </header>

          <div className="section-frame p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <article className="rounded-2xl border border-border/70 bg-white/85 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Paiement
                </p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-crimson" />
                  Transactions securisees
                </p>
              </article>
              <article className="rounded-2xl border border-border/70 bg-white/85 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Livraison
                </p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Truck className="h-4 w-4 text-crimson" />
                  Delai estime 24h/72h
                </p>
              </article>
              <article className="rounded-2xl border border-border/70 bg-white/85 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Avantage panier
                </p>
                {amountToFreeShipping > 0 ? (
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Gift className="h-4 w-4 text-crimson" />
                    Plus {formatCFA(amountToFreeShipping)} pour livraison
                    offerte
                  </p>
                ) : (
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Livraison offerte activee
                  </p>
                )}
              </article>
            </div>
          </div>

          <div className="section-frame p-4 md:p-5">
            <div className="grid grid-cols-4 gap-2">
              {stepList.map((entry, index) => {
                const isDone = currentStepIndex >= index;
                const Icon = entry.icon;
                return (
                  <div key={entry.key} className="flex items-center gap-2">
                    <div
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold ${
                        isDone
                          ? "border-crimson bg-crimson text-white"
                          : "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="hidden min-w-0 sm:block">
                      <p
                        className={`truncate text-xs font-semibold ${
                          isDone ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {entry.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </SectionReveal>

        <SectionReveal className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { duration: 0.2, ease: "easeOut" }
                }
              >
                {step === "info" ? (
                  <div className="section-frame p-5 md:p-6">
                    <h2 className="inline-flex items-center gap-2 text-xl font-bold">
                      <User className="h-5 w-5" />
                      Informations personnelles
                    </h2>

                    <div className="mt-5 space-y-4">
                      <div>
                        <Label htmlFor="checkout-name">Nom complet *</Label>
                        <Input
                          id="checkout-name"
                          value={form.name}
                          onChange={event =>
                            setForm(prev => ({
                              ...prev,
                              name: event.target.value,
                            }))
                          }
                          placeholder="Ex: Fatou Diallo"
                          className={`mt-1 h-11 rounded-xl ${errors.name ? "border-destructive" : ""}`}
                        />
                        {errors.name ? (
                          <p className="mt-1 text-xs text-destructive">
                            {errors.name}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <Label htmlFor="checkout-phone">
                          Numero de telephone *
                        </Label>
                        <Input
                          id="checkout-phone"
                          value={form.phone}
                          onChange={event =>
                            setForm(prev => ({
                              ...prev,
                              phone: event.target.value,
                            }))
                          }
                          placeholder="Ex: 77 123 45 67"
                          className={`mt-1 h-11 rounded-xl ${errors.phone ? "border-destructive" : ""}`}
                        />
                        {errors.phone ? (
                          <p className="mt-1 text-xs text-destructive">
                            {errors.phone}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <Label htmlFor="checkout-email">
                          Email (optionnel)
                        </Label>
                        <Input
                          id="checkout-email"
                          type="email"
                          value={form.email}
                          onChange={event =>
                            setForm(prev => ({
                              ...prev,
                              email: event.target.value,
                            }))
                          }
                          placeholder="Ex: vous@email.com"
                          className={`mt-1 h-11 rounded-xl ${errors.email ? "border-destructive" : ""}`}
                        />
                        {errors.email ? (
                          <p className="mt-1 text-xs text-destructive">
                            {errors.email}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Nous enverrons la confirmation de commande par
                            email.
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="checkout-address">
                          Adresse de livraison *
                        </Label>
                        <Textarea
                          id="checkout-address"
                          value={form.address}
                          onChange={event =>
                            setForm(prev => ({
                              ...prev,
                              address: event.target.value,
                            }))
                          }
                          placeholder="Ex: Rue 12, Medina, Dakar"
                          className={`mt-1 min-h-24 rounded-xl ${errors.address ? "border-destructive" : ""}`}
                        />
                        {errors.address ? (
                          <p className="mt-1 text-xs text-destructive">
                            {errors.address}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <Label htmlFor="checkout-notes">
                          Notes (optionnel)
                        </Label>
                        <Textarea
                          id="checkout-notes"
                          value={form.notes}
                          onChange={event =>
                            setForm(prev => ({
                              ...prev,
                              notes: event.target.value,
                            }))
                          }
                          placeholder="Instructions de livraison..."
                          className="mt-1 min-h-20 rounded-xl"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2">
                        <Link href="/panier">
                          <Button variant="outline" className="rounded-xl">
                            <ArrowLeft className="h-4 w-4" />
                            Retour
                          </Button>
                        </Link>
                        <Button
                          variant="premium"
                          className="flex-1 rounded-xl"
                          onClick={() => {
                            if (validateInfo()) setStep("delivery");
                          }}
                        >
                          Continuer vers livraison
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {step === "delivery" ? (
                  <div className="section-frame p-5 md:p-6">
                    <h2 className="inline-flex items-center gap-2 text-xl font-bold">
                      <MapPin className="h-5 w-5" />
                      Choisir la zone de livraison
                    </h2>

                    <div className="mt-5 space-y-3">
                      {zonesQuery.isLoading ? (
                        <div className="space-y-2">
                          {[...Array(3)].map((_, index) => (
                            <div
                              key={index}
                              className="h-24 animate-pulse rounded-xl border border-border/70 bg-muted/40"
                            />
                          ))}
                        </div>
                      ) : (
                        zones.map(zone => (
                          <button
                            key={zone.id}
                            onClick={() => setSelectedZone(zone.id)}
                            className={`w-full rounded-xl border-2 p-4 text-left transition-colors ${
                              selectedZone === zone.id
                                ? "border-crimson bg-crimson/5"
                                : "border-border/70 hover:border-crimson/40"
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <h3 className="font-semibold">{zone.name}</h3>
                                <p className="mt-0.5 text-sm text-muted-foreground">
                                  {zone.description}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Delai estime: {zone.deliveryDays} jour
                                  {zone.deliveryDays > 1 ? "s" : ""}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-base font-extrabold">
                                  {formatCFA(zone.deliveryFee)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Frais livraison
                                </p>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => setStep("info")}
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Retour
                      </Button>
                      <Button
                        variant="premium"
                        className="flex-1 rounded-xl"
                        onClick={() => {
                          if (validateDelivery()) setStep("payment");
                        }}
                      >
                        Continuer vers paiement
                      </Button>
                    </div>
                  </div>
                ) : null}

                {step === "payment" ? (
                  <div className="section-frame p-5 md:p-6">
                    <h2 className="inline-flex items-center gap-2 text-xl font-bold">
                      <CreditCard className="h-5 w-5" />
                      Selectionner votre paiement
                    </h2>

                    <div className="mt-5 space-y-3">
                      {availablePaymentMethods.length === 0 ? (
                        <div className="rounded-xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
                          Aucun mode de paiement n'est actif. Contactez le
                          support ou revenez plus tard.
                        </div>
                      ) : (
                        availablePaymentMethods.map(method => {
                          const Icon = method.icon;
                          return (
                            <button
                              key={method.id}
                              onClick={() => setPaymentMethod(method.id)}
                              className={`w-full rounded-xl border-2 p-4 text-left transition-colors ${
                                paymentMethod === method.id
                                  ? "border-crimson bg-crimson/5"
                                  : "border-border/70 hover:border-crimson/40"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted ${method.color}`}
                                >
                                  <Icon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-semibold">
                                    {method.name}
                                  </h3>
                                  <p className="text-sm text-muted-foreground">
                                    {method.desc}
                                  </p>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => setStep("delivery")}
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Retour
                      </Button>
                      <Button
                        variant="premium"
                        className="flex-1 rounded-xl"
                        disabled={isSubmitting}
                        onClick={submitOrder}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Traitement...
                          </>
                        ) : (
                          "Confirmer la commande"
                        )}
                      </Button>
                    </div>

                    <div className="mt-4 flex justify-center">
                      <PaymentBadgesRow />
                    </div>
                  </div>
                ) : null}

                {step === "confirm" ? (
                  <div className="section-frame p-8 text-center">
                    <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" />
                    <h2 className="mt-3 text-2xl font-bold">
                      Commande confirmee
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Votre commande a ete enregistree avec succes.
                    </p>

                    <div className="mx-auto mt-5 max-w-xs rounded-xl border border-border/70 bg-muted/40 p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        Numero de commande
                      </p>
                      <p className="mt-2 text-xl font-extrabold">
                        {orderNumber}
                      </p>
                    </div>

                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                      <Link href="/boutique">
                        <Button variant="soft" className="rounded-xl">
                          Continuer les achats
                        </Button>
                      </Link>
                      <Link href={`/track?order=${orderNumber}`}>
                        <Button variant="premium" className="rounded-xl">
                          Suivre ma commande
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </section>

          {step === "info" || step === "delivery" || step === "payment" ? (
            <aside className="lg:sticky lg:top-32 lg:self-start">
              <div className="section-frame p-5">
                <h2 className="text-lg font-bold">Resume commande</h2>

                <div className="mt-4 space-y-2">
                  {items.map(item => (
                    <div
                      key={item.productId}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <span className="line-clamp-2 text-muted-foreground">
                        {item.name} x {item.quantity}
                      </span>
                      <span className="shrink-0 font-medium">
                        {formatCFA(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-2 border-t border-border/70 pt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Sous-total</span>
                    <span>{formatCFA(cartSummary.subtotal)}</span>
                  </div>
                  {step !== "info" ? (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Livraison{" "}
                        {selectedZoneData ? `(${selectedZoneData.name})` : ""}
                      </span>
                      <span>{formatCFA(deliveryFee)}</span>
                    </div>
                  ) : null}
                  {cartSummary.discountAmount > 0 ? (
                    <div className="flex items-center justify-between text-emerald-700">
                      <span>
                        Reduction{" "}
                        {cartSummary.couponCode
                          ? `(${cartSummary.couponCode})`
                          : ""}
                      </span>
                      <span>- {formatCFA(cartSummary.discountAmount)}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between border-t border-border/70 pt-3 text-base font-bold">
                    <span>Total</span>
                    <span>{formatCFA(totalWithDelivery)}</span>
                  </div>
                </div>

                <div className="mt-4 border-t border-border/70 pt-4">
                  <Label htmlFor="checkout-coupon-input">Coupon</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      id="checkout-coupon-input"
                      value={couponCodeInput}
                      onChange={event =>
                        setCouponCodeInput(event.target.value.toUpperCase())
                      }
                      placeholder="SEN10"
                      disabled={couponApplying || couponRemoving || cartSyncing}
                      className="h-10"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        void handleApplyCoupon();
                      }}
                      disabled={
                        cartSyncing ||
                        couponApplying ||
                        couponRemoving ||
                        couponCodeInput.trim().length === 0
                      }
                    >
                      {couponApplying ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Appliquer"
                      )}
                    </Button>
                  </div>
                  {cartSummary.couponCode ? (
                    <div className="mt-2 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      <span>Coupon actif: {cartSummary.couponCode}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-emerald-800 hover:bg-emerald-100"
                        onClick={() => {
                          void handleRemoveCoupon();
                        }}
                        disabled={
                          couponRemoving || couponApplying || cartSyncing
                        }
                      >
                        {couponRemoving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Retirer"
                        )}
                      </Button>
                    </div>
                  ) : null}
                  {couponMessage ? (
                    <p className="mt-2 text-xs text-emerald-700">
                      {couponMessage}
                    </p>
                  ) : null}
                  {couponError ? (
                    <p className="mt-2 text-xs text-destructive">
                      {couponError}
                    </p>
                  ) : null}
                  {couponPreviewing ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Verification du coupon...
                    </p>
                  ) : null}
                  {!couponPreviewing && couponPreviewMessage ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {couponPreviewMessage}
                    </p>
                  ) : null}
                  {!couponPreviewing && couponPreviewError ? (
                    <p className="mt-2 text-xs text-destructive">
                      {couponPreviewError}
                    </p>
                  ) : null}
                </div>

                <div className="mt-5 space-y-2 border-t border-border/70 pt-4 text-xs text-muted-foreground">
                  <p className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    Paiement securise
                  </p>
                  <p className="inline-flex items-center gap-1.5">
                    <Truck className="h-4 w-4" />
                    Livraison rapide 24h/72h
                  </p>
                </div>

                {checkoutUpsells.length > 0 ? (
                  <div className="mt-5 border-t border-border/70 pt-4">
                    <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5 text-crimson" />
                      Ajout rapide avant paiement
                    </p>
                    <div className="mt-3 space-y-2.5">
                      {checkoutUpsells.map(product => (
                        <article
                          key={product.id}
                          className="rounded-xl border border-border/70 bg-card p-2.5"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted/45">
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                  decoding="async"
                                  width={56}
                                  height={56}
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                  <Package className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 text-xs font-semibold text-foreground">
                                {product.name}
                              </p>
                              <p className="mt-0.5 text-sm font-extrabold text-foreground">
                                {formatCFA(product.price)}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="soft"
                            className="mt-2 h-8 w-full rounded-lg text-xs"
                            onClick={() => {
                              addItem({
                                productId: product.id,
                                name: product.name,
                                price: product.price,
                                imageUrl: product.imageUrl || "",
                              });
                              toast.success("Produit ajoute", {
                                description: product.name,
                              });
                            }}
                          >
                            Ajouter
                          </Button>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </aside>
          ) : null}
        </SectionReveal>
      </main>

      <Footer />
    </div>
  );
}
