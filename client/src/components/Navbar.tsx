import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ChevronRight,
  Loader2,
  LogOut,
  Menu,
  Minus,
  Package,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  Truck,
  User,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { useStorefrontSettings } from "@/hooks/useStorefrontSettings";
import { useCart } from "@/contexts/CartContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function formatCFA(amount: number) {
  return `${new Intl.NumberFormat("fr-FR").format(amount)} CFA`;
}

function toWebpCandidate(src: string) {
  if (!src) return null;
  if (src.includes(".webp")) return src;
  if (/\.(jpg|jpeg|png)(\?.*)?$/i.test(src)) {
    return src.replace(/\.(jpg|jpeg|png)(\?.*)?$/i, ".webp$2");
  }
  return null;
}

function commandHintLabel() {
  if (
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform)
  ) {
    return "Cmd+K";
  }
  return "Ctrl+K";
}

function toTelHref(value: string) {
  const normalized = value.replace(/[^\d+]/g, "");
  return normalized ? `tel:${normalized}` : "tel:+221788911010";
}

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { settings } = useStorefrontSettings();
  const { data: categories } = trpc.category.list.useQuery();
  const { items, totalItems, totalPrice, removeItem, updateQuantity } =
    useCart();
  const [, setLocation] = useLocation();
  const shouldReduceMotion = useReducedMotion();
  const searchFieldId = useId();
  const desktopListboxId = `${searchFieldId}-desktop-suggestions`;
  const mobileListboxId = `${searchFieldId}-mobile-suggestions`;

  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchSurface, setSearchSurface] = useState<
    "desktop" | "mobile" | null
  >(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const desktopSearchRef = useRef<HTMLDivElement | null>(null);
  const mobileSearchRef = useRef<HTMLFormElement | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const storeName = settings.storeName || "SenBonsPlans";
  const storeContact = settings.storeContact || "+221 78 891 10 10";

  const loginHref = useMemo(() => {
    try {
      return getLoginUrl();
    } catch {
      return "/admin-login";
    }
  }, []);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    const queryString = params.toString();
    setSearchFocused(false);
    setSearchSurface(null);
    setActiveSuggestionIndex(-1);
    setLocation(queryString ? `/boutique?${queryString}` : "/boutique");
    setMobileOpen(false);
  };

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setActiveSuggestionIndex(-1);
    }, 180);
    return () => window.clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 14);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideDesktop = desktopSearchRef.current?.contains(target);
      const clickedInsideMobile = mobileSearchRef.current?.contains(target);
      if (!clickedInsideDesktop && !clickedInsideMobile) {
        setSearchFocused(false);
        setSearchSurface(null);
      }
    };
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  const { data: suggestionResult, isFetching: suggestionsLoading } =
    trpc.product.list.useQuery(
      { search: debouncedSearch, limit: 6 },
      { enabled: debouncedSearch.length >= 2 }
    );

  const searchSuggestions = suggestionResult?.products ?? [];
  const suggestionPanelOpen = searchFocused && debouncedSearch.length >= 2;
  const showSuggestions = suggestionPanelOpen && searchSuggestions.length > 0;
  const showSuggestionStatePanel = suggestionPanelOpen;
  const activeListboxId =
    searchSurface === "mobile" ? mobileListboxId : desktopListboxId;
  const activeOptionId =
    activeSuggestionIndex >= 0
      ? `${activeListboxId}-option-${activeSuggestionIndex}`
      : undefined;

  const handleSuggestionNavigate = (slug: string) => {
    setSearchFocused(false);
    setSearchSurface(null);
    setMobileOpen(false);
    setActiveSuggestionIndex(-1);
    setLocation(`/produit/${slug}`);
  };

  const onSearchInputKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (!showSuggestions) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex(prev => (prev + 1) % searchSuggestions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex(prev =>
        prev <= 0 ? searchSuggestions.length - 1 : prev - 1
      );
      return;
    }

    if (event.key === "Escape") {
      setSearchFocused(false);
      setSearchSurface(null);
      setActiveSuggestionIndex(-1);
      return;
    }

    if (event.key === "Enter" && activeSuggestionIndex >= 0) {
      event.preventDefault();
      handleSuggestionNavigate(searchSuggestions[activeSuggestionIndex].slug);
    }
  };

  return (
    <motion.header
      initial={shouldReduceMotion ? false : { y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { duration: 0.25, ease: "easeOut" }
      }
      className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-all duration-300 supports-[backdrop-filter]:bg-background/85 ${
        isScrolled
          ? "border-brand-accent/15 bg-background/97 shadow-[0_18px_44px_-30px_rgba(36,18,12,0.32)] backdrop-saturate-150 backdrop-blur-2xl"
          : "border-border/70 bg-background/92"
      }`}
    >
      <div
        className={`hidden overflow-hidden border-b border-border/60 bg-gradient-to-r from-slate-50 via-white to-rose-50/45 transition-all duration-300 md:block ${
          isScrolled
            ? "max-h-0 -translate-y-1 opacity-0"
            : "max-h-10 translate-y-0 opacity-100"
        }`}
      >
        <div className="container flex h-10 items-center justify-between text-xs">
          <div className="flex items-center gap-4 text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-crimson" />
              Livraison 24h/72h
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-green-accent" />
              Paiement securise
            </span>
          </div>

          <div className="flex items-center gap-4 text-muted-foreground">
            <a
              href={toTelHref(storeContact)}
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <Phone className="h-3.5 w-3.5" />
              {storeContact}
            </a>
            <Link
              href="/track"
              className="transition-colors hover:text-foreground"
            >
              Suivi commande
            </Link>
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <span className="font-medium text-foreground">
                  {user?.name || "Compte"}
                </span>
                {user?.role === "admin" && (
                  <Link
                    href="/admin"
                    className="transition-colors hover:text-crimson"
                  >
                    Admin
                  </Link>
                )}
                <button
                  onClick={logout}
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-crimson"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Deconnexion
                </button>
              </div>
            ) : (
              <a
                href={loginHref}
                className="inline-flex items-center gap-1.5 transition-colors hover:text-crimson"
              >
                <User className="h-3.5 w-3.5" />
                Connexion
              </a>
            )}
          </div>
        </div>
      </div>

      <div
        className={`container transition-all duration-300 ${isScrolled ? "py-2.5 md:py-3" : "py-3.5 md:py-[1.125rem]"}`}
      >
        <div className="flex items-center gap-3 md:gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            {settings.storeLogo ? (
              <img
                src={settings.storeLogo}
                alt={storeName}
                className={`w-auto max-w-[152px] rounded-lg border border-border/70 bg-white p-1 object-contain shadow-sm transition-all duration-300 ${
                  isScrolled ? "h-9 md:h-10" : "h-10 md:h-[2.9rem]"
                }`}
                width={152}
                height={44}
                loading="eager"
                decoding="async"
              />
            ) : (
              <div className="rounded-lg bg-gradient-to-r from-crimson to-crimson-light px-3 py-1.5 text-xs font-extrabold leading-none text-white shadow-sm md:text-sm">
                SENBONSPLANS
              </div>
            )}
            <div className="hidden md:block">
              <p className="text-sm font-semibold tracking-tight text-foreground">
                {storeName}
              </p>
              <p className="text-xs tracking-wide text-muted-foreground">
                Premium deals et essentials
              </p>
            </div>
          </Link>

          <form
            onSubmit={handleSearch}
            className="hidden flex-1 items-center gap-2 rounded-2xl border border-border/70 bg-card/90 p-1.5 shadow-sm backdrop-blur lg:flex"
          >
            <div className="relative flex-1" ref={desktopSearchRef}>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id={searchFieldId}
                type="text"
                placeholder="Rechercher un produit, une marque..."
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                onFocus={() => {
                  setSearchFocused(true);
                  setSearchSurface("desktop");
                }}
                onKeyDown={onSearchInputKeyDown}
                className="h-10 w-full rounded-xl border border-border/60 bg-white pl-9 pr-14 text-sm font-medium text-foreground outline-none transition-colors focus:border-crimson/45"
                aria-label="Recherche produits"
                role="combobox"
                aria-expanded={suggestionPanelOpen}
                aria-controls={desktopListboxId}
                aria-autocomplete="list"
                aria-activedescendant={
                  searchSurface === "desktop" ? activeOptionId : undefined
                }
                aria-busy={suggestionsLoading}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border/70 bg-muted/70 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground xl:block">
                {commandHintLabel()}
              </span>
              <AnimatePresence>
                {showSuggestionStatePanel ? (
                  <motion.div
                    id={desktopListboxId}
                    role="listbox"
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, y: 4 }}
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { duration: 0.16, ease: "easeOut" }
                    }
                    className="absolute inset-x-0 top-[calc(100%+0.4rem)] z-30 overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-xl backdrop-blur"
                  >
                    {suggestionsLoading ? (
                      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Recherche en cours...
                      </div>
                    ) : searchSuggestions.length > 0 ? (
                      searchSuggestions.map((product, index) => (
                        <button
                          id={`${desktopListboxId}-option-${index}`}
                          key={product.id}
                          type="button"
                          role="option"
                          aria-selected={index === activeSuggestionIndex}
                          onMouseDown={event => event.preventDefault()}
                          onClick={() => handleSuggestionNavigate(product.slug)}
                          className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                            index === activeSuggestionIndex
                              ? "bg-muted text-foreground"
                              : "text-foreground hover:bg-muted/70"
                          }`}
                        >
                          <span className="line-clamp-1 font-medium">
                            {product.name}
                          </span>
                          <span className="text-xs font-semibold text-muted-foreground">
                            {formatCFA(product.price)}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        Aucun produit trouve.
                      </div>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
            <Button
              type="submit"
              variant="premium"
              className="h-10 rounded-xl px-5"
            >
              Rechercher
            </Button>
          </form>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/track" className="hidden lg:block">
              <Button variant="soft" className="h-10 rounded-xl">
                Suivre commande
              </Button>
            </Link>

            <Sheet open={cartOpen} onOpenChange={setCartOpen}>
              <SheetTrigger asChild>
                <motion.div
                  whileHover={
                    shouldReduceMotion ? undefined : { y: -1, scale: 1.01 }
                  }
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { duration: 0.18, ease: "easeOut" }
                  }
                >
                  <Button
                    variant="soft"
                    className="relative h-10 rounded-xl border-border/70 bg-white/95 px-3 text-foreground shadow-sm hover:bg-muted/60"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    <span className="hidden text-sm font-semibold sm:inline">
                      {formatCFA(totalPrice)}
                    </span>
                    {totalItems > 0 && (
                      <Badge
                        variant="sale"
                        className="absolute -right-2 -top-2 min-w-5 px-1.5"
                      >
                        {totalItems}
                      </Badge>
                    )}
                  </Button>
                </motion.div>
              </SheetTrigger>

              <SheetContent className="w-full p-0 sm:max-w-lg">
                <div className="flex h-full flex-col">
                  <SheetHeader className="border-b border-border/70 bg-gradient-to-r from-white via-white to-rose-50/40 px-6 py-5 text-left">
                    <SheetTitle className="text-lg font-bold">
                      Votre panier
                    </SheetTitle>
                    <SheetDescription>
                      {totalItems} article(s) - Sous-total{" "}
                      {formatCFA(totalPrice)}
                    </SheetDescription>
                  </SheetHeader>

                  <div className="flex-1 overflow-y-auto bg-muted/15 px-4 py-4">
                    {items.length > 0 ? (
                      <div className="space-y-3">
                        {items.map(item => (
                          <div
                            key={item.productId}
                            className="surface-card flex gap-3 p-3"
                          >
                            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted/50">
                              {item.imageUrl ? (
                                <picture>
                                  {toWebpCandidate(item.imageUrl) && (
                                    <source
                                      srcSet={
                                        toWebpCandidate(item.imageUrl) ||
                                        undefined
                                      }
                                      type="image/webp"
                                    />
                                  )}
                                  <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    className="h-full w-full object-cover"
                                    width={96}
                                    height={96}
                                    loading="lazy"
                                    decoding="async"
                                  />
                                </picture>
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                  <Package className="h-5 w-5" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1 space-y-2">
                              <p className="line-clamp-2 text-sm font-semibold text-foreground">
                                {item.name}
                              </p>
                              <p className="text-sm font-bold text-foreground">
                                {formatCFA(item.price)}
                              </p>
                              <div className="flex items-center justify-between">
                                <div className="inline-flex items-center rounded-lg border border-border/70 bg-white">
                                  <button
                                    onClick={() =>
                                      updateQuantity(
                                        item.productId,
                                        item.quantity - 1
                                      )
                                    }
                                    className="px-2.5 py-1.5 transition-colors hover:bg-muted/70"
                                    aria-label="Diminuer la quantite"
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>
                                  <span className="px-2 text-sm font-semibold">
                                    {item.quantity}
                                  </span>
                                  <button
                                    onClick={() =>
                                      updateQuantity(
                                        item.productId,
                                        item.quantity + 1
                                      )
                                    }
                                    className="px-2.5 py-1.5 transition-colors hover:bg-muted/70"
                                    aria-label="Augmenter la quantite"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <button
                                  onClick={() => removeItem(item.productId)}
                                  className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Retirer
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                        <div className="rounded-full border border-border/70 p-4">
                          <ShoppingCart className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="mt-4 text-base font-semibold">
                          Votre panier est calme pour l'instant
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Quelques essentiels, et votre routine prend forme.
                        </p>
                        <Button
                          variant="premium"
                          className="mt-4"
                          onClick={() => {
                            setCartOpen(false);
                            setLocation("/boutique");
                          }}
                        >
                          Voir la boutique
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border/70 bg-white px-6 py-5">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Total panier
                      </p>
                      <p className="text-lg font-extrabold">
                        {formatCFA(totalPrice)}
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Link href="/cart" onClick={() => setCartOpen(false)}>
                        <Button variant="soft" className="w-full">
                          Voir le panier
                        </Button>
                      </Link>
                      <Link href="/checkout" onClick={() => setCartOpen(false)}>
                        <Button variant="premium" className="w-full">
                          Passer a la caisse
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <motion.div
                  whileHover={
                    shouldReduceMotion ? undefined : { y: -1, scale: 1.01 }
                  }
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { duration: 0.18, ease: "easeOut" }
                  }
                >
                  <Button
                    variant="soft"
                    size="icon"
                    className="shadow-sm lg:hidden"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </motion.div>
              </SheetTrigger>
              <SheetContent side="left" className="w-full p-0 sm:max-w-sm">
                <SheetHeader className="border-b border-border/70 px-5 py-4 text-left">
                  <SheetTitle>{storeName}</SheetTitle>
                  <SheetDescription>Navigation boutique</SheetDescription>
                </SheetHeader>

                <form
                  onSubmit={handleSearch}
                  className="space-y-2 border-b border-border/70 p-4"
                >
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={event => setSearchQuery(event.target.value)}
                      className="h-10 w-full rounded-xl border border-border/60 bg-white pl-9 pr-3 text-sm outline-none transition-colors focus:border-crimson/45"
                      onFocus={() => {
                        setSearchFocused(true);
                        setSearchSurface("mobile");
                      }}
                      onKeyDown={onSearchInputKeyDown}
                    />
                  </div>
                  <Button type="submit" variant="premium" className="w-full">
                    Rechercher
                  </Button>
                </form>

                <nav className="space-y-1 p-4">
                  <Link
                    href="/boutique"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted/60"
                  >
                    Tous les produits
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                  <Link
                    href="/track"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted/60"
                  >
                    Suivre commande
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                  {categories?.map(category => (
                    <Link
                      key={category.id}
                      href={`/boutique?cat=${category.slug}`}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted/60"
                    >
                      {category.name}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </nav>

                <div className="mt-auto border-t border-border/70 p-4">
                  {isAuthenticated ? (
                    <button
                      onClick={logout}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/70 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/60"
                    >
                      <LogOut className="h-4 w-4" />
                      Deconnexion
                    </button>
                  ) : (
                    <a
                      href={loginHref}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/70 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/60"
                    >
                      <User className="h-4 w-4" />
                      Connexion
                    </a>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <form
          onSubmit={handleSearch}
          ref={mobileSearchRef}
          className="relative mt-3 flex items-center gap-2 rounded-xl border border-border/70 bg-card/90 p-1.5 shadow-sm lg:hidden"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher un produit..."
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              onFocus={() => {
                setSearchFocused(true);
                setSearchSurface("mobile");
              }}
              onKeyDown={onSearchInputKeyDown}
              className="h-10 w-full rounded-lg border border-border/60 bg-white pl-9 pr-3 text-sm font-medium outline-none transition-colors focus:border-crimson/45"
              role="combobox"
              aria-expanded={suggestionPanelOpen}
              aria-controls={mobileListboxId}
              aria-autocomplete="list"
              aria-activedescendant={
                searchSurface === "mobile" ? activeOptionId : undefined
              }
              aria-busy={suggestionsLoading}
            />
          </div>
          <Button
            type="submit"
            variant="premium"
            className="h-10 rounded-lg px-4"
          >
            OK
          </Button>

          <AnimatePresence>
            {showSuggestionStatePanel ? (
              <motion.div
                id={mobileListboxId}
                role="listbox"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: 4 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { duration: 0.16, ease: "easeOut" }
                }
                className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-30 overflow-hidden rounded-xl border border-border/70 bg-card shadow-lg"
              >
                {suggestionsLoading ? (
                  <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Recherche en cours...
                  </div>
                ) : searchSuggestions.length > 0 ? (
                  searchSuggestions.map((product, index) => (
                    <button
                      id={`${mobileListboxId}-option-${index}`}
                      key={product.id}
                      type="button"
                      role="option"
                      aria-selected={index === activeSuggestionIndex}
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => handleSuggestionNavigate(product.slug)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                        index === activeSuggestionIndex
                          ? "bg-muted text-foreground"
                          : "text-foreground hover:bg-muted/70"
                      }`}
                    >
                      <span className="line-clamp-1 font-medium">
                        {product.name}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {formatCFA(product.price)}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Aucun produit trouve.
                  </div>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </form>
      </div>

      <div className="hidden border-t border-border/60 bg-card/60 lg:block">
        <div className="container">
          <nav className="flex items-center gap-1 overflow-x-auto py-2.5">
            <Link href="/boutique" className="link-chip">
              Tous les produits <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            {categories?.slice(0, 8).map(category => (
              <Link
                key={category.id}
                href={`/boutique?cat=${category.slug}`}
                className="link-chip"
              >
                {category.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </motion.header>
  );
}
