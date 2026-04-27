import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Gift,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Trash2,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SectionReveal from "@/components/storefront/SectionReveal";
import { useCart } from "@/contexts/CartContext";
import { trackAnalyticsEvent } from "@/lib/analyticsEvents";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/ProductCard";

function formatCFA(amount: number) {
  return `${new Intl.NumberFormat("fr-FR").format(amount)} CFA`;
}

const FREE_SHIPPING_THRESHOLD = 75000;

export default function Cart() {
  const { items, addItem, removeItem, updateQuantity, totalItems, totalPrice } =
    useCart();
  const [, setLocation] = useLocation();
  const upsellQuery = trpc.product.list.useQuery({ trending: true, limit: 12 });

  const cartProductIds = useMemo(
    () => new Set(items.map(item => item.productId)),
    [items]
  );
  const upsellProducts = useMemo(
    () =>
      (upsellQuery.data?.products ?? [])
        .filter(
          product =>
            !cartProductIds.has(product.id) && product.inStock !== false
        )
        .slice(0, 4),
    [cartProductIds, upsellQuery.data?.products]
  );
  const amountToFreeShipping = Math.max(
    0,
    FREE_SHIPPING_THRESHOLD - totalPrice
  );
  const freeShippingProgress = Math.min(
    100,
    Math.round((totalPrice / FREE_SHIPPING_THRESHOLD) * 100)
  );

  return (
    <div className="page-shell flex min-h-screen flex-col">
      <Navbar />

      <main className="container section-shell flex-1">
        <SectionReveal className="ui-stack-3">
          <nav className="text-sm text-muted-foreground">
            <Link href="/" className="transition-colors hover:text-crimson">
              Accueil
            </Link>
            <span className="mx-2">/</span>
            <span className="font-medium text-foreground">Panier</span>
          </nav>

          <header className="flex flex-wrap items-end justify-between gap-3">
            <div className="ui-stack-1">
              <p className="section-kicker">Checkout</p>
              <h1 className="headline-title">
                Mon panier ({totalItems} article{totalItems > 1 ? "s" : ""})
              </h1>
              <p className="section-description">
                Verifiez vos quantites puis passez a une commande rapide et
                securisee.
              </p>
            </div>
          </header>
        </SectionReveal>

        {items.length === 0 ? (
          <>
            <SectionReveal className="mt-8">
              <div className="section-frame mx-auto max-w-xl p-10 text-center">
                <ShoppingCart className="mx-auto h-16 w-16 text-muted-foreground/30" />
                <h2 className="mt-4 text-xl font-bold">
                  Votre panier est vide
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Ajoutez vos produits favoris pour commencer votre commande.
                </p>
                <Link href="/boutique">
                  <Button variant="soft" className="mt-6 rounded-xl">
                    <ArrowLeft className="h-4 w-4" />
                    Continuer mes achats
                  </Button>
                </Link>
              </div>
            </SectionReveal>

            {upsellProducts.length > 0 ? (
              <SectionReveal className="mt-12 ui-stack-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="space-y-1">
                    <p className="section-kicker">Best-sellers</p>
                    <h2 className="headline-title">
                      Les essentiels de la boutique
                    </h2>
                    <p className="section-description">
                      Commencez par les produits préférés de la communauté.
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
                  {upsellProducts.map(product => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </SectionReveal>
            ) : null}
          </>
        ) : (
          <>
            <SectionReveal className="mt-8">
              <div className="section-frame p-4 md:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      Avantage livraison
                    </p>
                    {amountToFreeShipping > 0 ? (
                      <p className="mt-1 text-sm font-medium text-foreground">
                        Plus{" "}
                        <span className="font-extrabold text-crimson">
                          {formatCFA(amountToFreeShipping)}
                        </span>{" "}
                        pour debloquer la livraison offerte.
                      </p>
                    ) : (
                      <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-green-700">
                        <CheckCircle2 className="h-4 w-4" />
                        Livraison offerte activee pour votre panier.
                      </p>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-white px-3 py-1.5 text-xs font-semibold text-foreground">
                    <Gift className="h-3.5 w-3.5 text-crimson" />
                    Seuil: {formatCFA(FREE_SHIPPING_THRESHOLD)}
                  </span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-crimson to-green-accent transition-[width] duration-300"
                    style={{ width: `${freeShippingProgress}%` }}
                    aria-hidden
                  />
                </div>
              </div>
            </SectionReveal>

            <SectionReveal className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <section className="space-y-3">
                {items.map(item => (
                  <article key={item.productId} className="section-frame p-4">
                    <div className="flex gap-4">
                      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted/45">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="h-full w-full object-cover"
                            width={96}
                            height={96}
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <Package className="h-6 w-6" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h2 className="line-clamp-2 text-sm font-semibold text-foreground">
                          {item.name}
                        </h2>
                        <p className="mt-1 text-lg font-extrabold text-foreground">
                          {formatCFA(item.price)}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="inline-flex items-center rounded-xl border border-border/70 bg-white">
                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.productId,
                                  item.quantity - 1
                                )
                              }
                              className="px-2.5 py-2 transition-colors hover:bg-muted"
                              aria-label="Diminuer quantite"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-8 px-2 text-center text-sm font-semibold">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.productId,
                                  item.quantity + 1
                                )
                              }
                              className="px-2.5 py-2 transition-colors hover:bg-muted"
                              aria-label="Augmenter quantite"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold">
                              {formatCFA(item.price * item.quantity)}
                            </span>
                            <button
                              onClick={() => removeItem(item.productId)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                              aria-label="Retirer du panier"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </section>

              <aside className="lg:sticky lg:top-32 lg:self-start">
                <div className="section-frame p-5">
                  <h2 className="text-lg font-bold">Resume de commande</h2>

                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>
                        Sous-total ({totalItems} article
                        {totalItems > 1 ? "s" : ""})
                      </span>
                      <span className="font-medium text-foreground">
                        {formatCFA(totalPrice)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Livraison</span>
                      <span>Calculee a l'etape suivante</span>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-border/70 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-semibold">Total</span>
                      <span className="text-xl font-extrabold text-foreground">
                        {formatCFA(totalPrice)}
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      trackAnalyticsEvent({
                        type: "checkout_start",
                        path: "/commande",
                        meta: {
                          totalItems,
                          totalPrice,
                        },
                      });
                      setLocation("/commande");
                    }}
                    variant="premium"
                    className="mt-5 h-11 w-full rounded-xl"
                  >
                    Passer la commande
                    <ArrowRight className="h-4 w-4" />
                  </Button>

                  <Link href="/boutique">
                    <Button
                      variant="ghost-brand"
                      className="mt-2 w-full rounded-xl"
                    >
                      Continuer mes achats
                    </Button>
                  </Link>

                  <div className="mt-5 space-y-2 border-t border-border/70 pt-4 text-xs text-muted-foreground">
                    <p className="inline-flex items-center gap-1.5">
                      <Truck className="h-4 w-4" />
                      Livraison 24h/72h
                    </p>
                    <p className="inline-flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4" />
                      Paiement securise (Wave, Orange Money, Free Money)
                    </p>
                  </div>
                </div>
              </aside>
            </SectionReveal>

            {upsellProducts.length > 0 ? (
              <SectionReveal className="mt-8 ui-stack-3">
                <header className="flex flex-wrap items-end justify-between gap-3">
                  <div className="ui-stack-1">
                    <p className="section-kicker">Routine complete</p>
                    <h2 className="section-title">
                      Ajoutez un best seller avant de payer
                    </h2>
                    <p className="section-description">
                      Recommandations rapides pour augmenter les resultats de
                      votre routine.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-white px-3 py-1.5 text-xs font-semibold text-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-crimson" />
                    Ajout en un clic
                  </span>
                </header>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {upsellProducts.map(product => (
                    <article key={product.id} className="section-frame p-3">
                      <Link href={`/produit/${product.slug}`} className="block">
                        <div className="aspect-[4/3] overflow-hidden rounded-xl bg-muted/50">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                              decoding="async"
                              width={320}
                              height={240}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <Package className="h-6 w-6" />
                            </div>
                          )}
                        </div>
                        <h3 className="mt-3 line-clamp-2 text-sm font-semibold text-foreground transition-colors hover:text-crimson">
                          {product.name}
                        </h3>
                      </Link>

                      <p className="mt-1 text-base font-extrabold text-foreground">
                        {formatCFA(product.price)}
                      </p>
                      <Button
                        className="mt-3 w-full rounded-xl"
                        variant="soft"
                        onClick={() => {
                          addItem({
                            productId: product.id,
                            name: product.name,
                            price: product.price,
                            imageUrl: product.imageUrl || "",
                          });
                          toast.success("Ajoute au panier", {
                            description: product.name,
                          });
                        }}
                      >
                        Ajouter a mon panier
                      </Button>
                    </article>
                  ))}
                </div>
              </SectionReveal>
            ) : null}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
