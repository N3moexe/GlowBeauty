import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Compass,
  LayoutGrid,
  Search,
  ShoppingCart,
  Store,
  Truck,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";

function isMacPlatform() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

const STATIC_LINKS = [
  { label: "Accueil", href: "/", icon: Compass, shortcut: "G H" },
  { label: "Boutique", href: "/boutique", icon: Store, shortcut: "G B" },
  { label: "Panier", href: "/panier", icon: ShoppingCart, shortcut: "G C" },
  { label: "Suivi commande", href: "/track", icon: Truck, shortcut: "G T" },
] as const;

export default function CommandPalette() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 160);
    return () => window.clearTimeout(handler);
  }, [query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches) {
        return;
      }
      const isCommandTrigger = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!isCommandTrigger) return;
      event.preventDefault();
      setOpen((prev) => !prev);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const categoriesQuery = trpc.category.list.useQuery(undefined, {
    enabled: open,
  });

  const productSearchQuery = trpc.product.list.useQuery(
    { search: debouncedQuery, limit: 7 },
    { enabled: open && debouncedQuery.length >= 2 }
  );

  const hint = isMacPlatform() ? "Cmd+K" : "Ctrl+K";
  const categories = categoriesQuery.data || [];
  const products = productSearchQuery.data?.products || [];

  const topCategories = useMemo(() => categories.slice(0, 6), [categories]);

  const navigateAndClose = (href: string) => {
    setOpen(false);
    setQuery("");
    setDebouncedQuery("");
    setLocation(href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Recherche rapide"
      description="Naviguez rapidement vers un produit, une categorie ou une page."
      className="max-w-2xl rounded-2xl border-border/70"
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={`Rechercher un produit, une categorie, une page... (${hint})`}
      />
      <CommandList>
        <CommandEmpty>
          Aucun resultat. Essayez un autre mot-cle.
        </CommandEmpty>

        <CommandGroup heading="Navigation">
          {STATIC_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <CommandItem
                key={link.href}
                value={link.label}
                onSelect={() => navigateAndClose(link.href)}
              >
                <Icon className="h-4 w-4" />
                <span>{link.label}</span>
                <CommandShortcut>{link.shortcut}</CommandShortcut>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandGroup heading="Categories">
          {topCategories.map((category) => (
            <CommandItem
              key={category.id}
              value={`${category.name} ${category.slug}`}
              onSelect={() => navigateAndClose(`/boutique?cat=${category.slug}`)}
            >
              <LayoutGrid className="h-4 w-4" />
              <span>{category.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading={debouncedQuery.length >= 2 ? "Produits" : "Produits (tapez 2 lettres min)"}>
          {debouncedQuery.length < 2 ? (
            <CommandItem disabled>
              <Search className="h-4 w-4" />
              <span>Commencez a taper pour rechercher des produits</span>
            </CommandItem>
          ) : (
            products.map((product) => (
              <CommandItem
                key={product.id}
                value={`${product.name} ${product.slug}`}
                onSelect={() => navigateAndClose(`/produit/${product.slug}`)}
              >
                <Search className="h-4 w-4" />
                <span className="line-clamp-1">{product.name}</span>
                <CommandShortcut>
                  {new Intl.NumberFormat("fr-FR").format(product.price)} CFA
                </CommandShortcut>
              </CommandItem>
            ))
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

