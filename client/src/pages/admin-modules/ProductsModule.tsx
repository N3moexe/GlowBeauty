import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Globe,
  Image as ImageIcon,
  Loader2,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wand2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Surface } from "@/components/admin/ui/Surface";
import { Heading } from "@/components/admin/ui/Heading";
import { ShimmerBlock } from "@/pages/admin-modules/shared/ShimmerBlock";
import { RetryPanel } from "@/pages/admin-modules/shared/RetryPanel";
import { formatCFA } from "@/pages/admin-modules/shared/formatters";
import {
  moveArrayItem,
  getErrorMessage,
  slugify,
} from "@/pages/admin-modules/shared/utils";
import {
  PRODUCT_MAX_BULLETS,
  PRODUCT_MAX_ROUTINE_STEPS,
  ROUTINE_TITLE_PRESETS,
  ROUTINE_CUSTOM_VALUE,
  sanitizeBulletArray,
  sanitizeRoutineSteps,
  createDefaultRoutine,
  sanitizeRoutine,
  resolveRoutinePresetValue,
  createEmptyRoutineStep,
} from "@/pages/admin-modules/shared/productHelpers";
import { trpc } from "@/lib/trpc";
import StatusBadge from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageUpload } from "@/components/ImageUpload";
import { cn } from "@/lib/utils";
import type { ProductRoutine } from "@shared/product-content";

type ProductEntity = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  benefits?: string[] | null;
  descriptionBullets?: string[] | null;
  routine?: ProductRoutine | null;
  price: number;
  comparePrice: number | null;
  categoryId: number;
  imageUrl: string | null;
  inStock: boolean | null;
  stockQuantity: number | null;
  isFeatured: boolean | null;
  isNew: boolean | null;
  isTrending: boolean | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type CategoryEntity = {
  id: number;
  name: string;
  slug: string;
};

type ProductFormState = {
  name: string;
  slug: string;
  description: string;
  benefits: string[];
  descriptionBullets: string[];
  routine: ProductRoutine;
  price: string;
  comparePrice: string;
  categoryId: string;
  imageUrl: string;
  stockQuantity: string;
  inStock: boolean;
  isFeatured: boolean;
  isNew: boolean;
  isTrending: boolean;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  ogImage: string;
};

const EMPTY_PRODUCT_FORM: ProductFormState = {
  name: "",
  slug: "",
  description: "",
  benefits: [],
  descriptionBullets: [],
  routine: createDefaultRoutine(),
  price: "",
  comparePrice: "",
  categoryId: "",
  imageUrl: "",
  stockQuantity: "0",
  inStock: true,
  isFeatured: false,
  isNew: false,
  isTrending: false,
  metaTitle: "",
  metaDescription: "",
  metaKeywords: "",
  ogImage: "",
};

type StockFilter = "all" | "instock" | "low" | "out";
type SortKey =
  | "newest"
  | "oldest"
  | "name"
  | "price_asc"
  | "price_desc"
  | "stock";

type ProductSeoSetting = {
  key: string;
  value: string;
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
      {children}
    </p>
  );
}

function SectionDivider() {
  return <div className="my-6 h-px w-full bg-[var(--admin-divider)]" />;
}

function stockStatusFor(product: ProductEntity): "instock" | "low" | "out" {
  const qty = Number(product.stockQuantity ?? 0);
  if (product.inStock === false || qty <= 0) return "out";
  if (qty <= 10) return "low";
  return "instock";
}

export function ProductsModule({
  canManage,
  canDelete,
  isAdmin,
}: {
  canManage: boolean;
  canDelete: boolean;
  isAdmin: boolean;
}) {
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();

  const productsQuery = trpc.product.list.useQuery(
    { limit: 1000 },
    {
      refetchInterval: 20000,
      refetchOnWindowFocus: true,
    }
  );

  const categoriesQuery = trpc.category.list.useQuery(undefined, {
    refetchOnWindowFocus: true,
  });

  const productSeoQuery = trpc.settings.list.useQuery(
    { prefix: "productSeo." },
    { enabled: isAdmin }
  );

  const productSeoById = useMemo(() => {
    const map = new Map<
      number,
      {
        metaTitle?: string;
        metaDescription?: string;
        metaKeywords?: string;
        ogImage?: string;
      }
    >();
    const data = (productSeoQuery.data ?? []) as ProductSeoSetting[];
    data.forEach(entry => {
      const match = entry.key.match(
        /^productSeo\.(\d+)\.(metaTitle|metaDescription|metaKeywords|ogImage)$/
      );
      if (!match) return;
      const id = Number(match[1]);
      const field = match[2] as
        | "metaTitle"
        | "metaDescription"
        | "metaKeywords"
        | "ogImage";
      const current = map.get(id) ?? {};
      current[field] = entry.value;
      map.set(id, current);
    });
    return map;
  }, [productSeoQuery.data]);

  const invalidateProductSurface = useCallback(async () => {
    await Promise.all([
      utils.product.list.invalidate(),
      utils.product.byId.invalidate(),
      utils.product.bySlug.invalidate(),
      utils.product.count.invalidate(),
      utils.reports.lowStock.invalidate(),
      utils.reports.bestSellers.invalidate(),
      utils.analytics.dashboard.invalidate(),
      queryClient.invalidateQueries({
        queryKey: ["admin-analytics-overview"],
      }),
    ]);
  }, [queryClient, utils]);

  const productCreateMutation = trpc.product.create.useMutation({
    onSuccess: async () => {
      toast.success("Product created");
      await invalidateProductSurface();
    },
    onError: error => toast.error(error.message),
  });

  const productUpdateMutation = trpc.product.update.useMutation({
    onSuccess: async () => {
      toast.success("Product updated");
      await invalidateProductSurface();
    },
    onError: error => toast.error(error.message),
  });

  const productDeleteMutation = trpc.product.delete.useMutation({
    onSuccess: async () => {
      toast.success("Product deleted");
      await invalidateProductSurface();
    },
    onError: error => toast.error(error.message),
  });

  const settingsSetMutation = trpc.settings.set.useMutation({
    onError: error => toast.error(error.message),
  });

  const products = (productsQuery.data?.products ?? []) as ProductEntity[];
  const categories = (categoriesQuery.data ?? []) as CategoryEntity[];

  const categoryById = useMemo(() => {
    const map = new Map<number, string>();
    categories.forEach(c => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    let rows = products.filter(product => {
      if (query) {
        const haystack = `${product.name} ${product.slug} ${
          product.description ?? ""
        }`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (
        categoryFilter !== "all" &&
        product.categoryId !== Number(categoryFilter)
      ) {
        return false;
      }
      if (stockFilter !== "all") {
        const status = stockStatusFor(product);
        if (status !== stockFilter) return false;
      }
      return true;
    });

    rows = [...rows].sort((a, b) => {
      switch (sortKey) {
        case "oldest":
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        case "name":
          return a.name.localeCompare(b.name);
        case "price_asc":
          return a.price - b.price;
        case "price_desc":
          return b.price - a.price;
        case "stock":
          return (b.stockQuantity ?? 0) - (a.stockQuantity ?? 0);
        case "newest":
        default:
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
      }
    });

    return rows;
  }, [categoryFilter, products, search, sortKey, stockFilter]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [routineTab, setRoutineTab] = useState<"am" | "pm">("am");
  const [productForm, setProductForm] =
    useState<ProductFormState>(EMPTY_PRODUCT_FORM);
  const [pendingDelete, setPendingDelete] = useState<ProductEntity | null>(
    null
  );

  const openCreateDialog = useCallback(() => {
    setEditingId(null);
    setSlugTouched(false);
    setRoutineTab("am");
    setProductForm(EMPTY_PRODUCT_FORM);
    setModalOpen(true);
  }, []);

  const openEditDialog = useCallback(
    (product: ProductEntity) => {
      const seo = productSeoById.get(product.id);
      setEditingId(product.id);
      setSlugTouched(true);
      setRoutineTab("am");
      setProductForm({
        name: product.name,
        slug: product.slug,
        description: product.description ?? "",
        benefits: sanitizeBulletArray(product.benefits, PRODUCT_MAX_BULLETS),
        descriptionBullets: sanitizeBulletArray(
          product.descriptionBullets,
          PRODUCT_MAX_BULLETS
        ),
        routine: sanitizeRoutine(product.routine),
        price: String(product.price),
        comparePrice: product.comparePrice ? String(product.comparePrice) : "",
        categoryId: String(product.categoryId),
        imageUrl: product.imageUrl ?? "",
        stockQuantity: String(product.stockQuantity ?? 0),
        inStock: product.inStock !== false,
        isFeatured: Boolean(product.isFeatured),
        isNew: Boolean(product.isNew),
        isTrending: Boolean(product.isTrending),
        metaTitle: seo?.metaTitle ?? "",
        metaDescription: seo?.metaDescription ?? "",
        metaKeywords: seo?.metaKeywords ?? "",
        ogImage: seo?.ogImage ?? product.imageUrl ?? "",
      });
      setModalOpen(true);
    },
    [productSeoById]
  );

  const closeDialog = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
    setProductForm(EMPTY_PRODUCT_FORM);
    setSlugTouched(false);
  }, []);

  const submitProductForm = useCallback(async () => {
    if (!canManage) {
      toast.error("Product editing is not allowed");
      return;
    }
    if (!productForm.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (!productForm.slug.trim()) {
      toast.error("Product slug is required");
      return;
    }
    if (!productForm.categoryId) {
      toast.error("Choose a category");
      return;
    }

    const normalizedSlug = productForm.slug.trim();
    const duplicate = products.find(
      p =>
        p.slug.toLowerCase() === normalizedSlug.toLowerCase() &&
        p.id !== editingId
    );
    if (duplicate) {
      toast.error("This slug already exists. Choose a unique slug.");
      return;
    }

    const parsedPrice = Number(productForm.price);
    const parsedStock = Number(productForm.stockQuantity || "0");
    const compareRaw = productForm.comparePrice.trim();
    const parsedComparePrice = compareRaw ? Number(compareRaw) : null;

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      toast.error("Price must be valid");
      return;
    }
    if (!Number.isFinite(parsedStock) || parsedStock < 0) {
      toast.error("Stock must be valid");
      return;
    }
    if (
      parsedComparePrice !== null &&
      (!Number.isFinite(parsedComparePrice) || parsedComparePrice < 0)
    ) {
      toast.error("Compare price must be valid");
      return;
    }
    if (parsedComparePrice !== null && parsedComparePrice <= parsedPrice) {
      toast.error("Compare price must be greater than current price");
      return;
    }

    const sanitizedBenefits = sanitizeBulletArray(
      productForm.benefits,
      PRODUCT_MAX_BULLETS
    );
    const sanitizedBullets = sanitizeBulletArray(
      productForm.descriptionBullets,
      PRODUCT_MAX_BULLETS
    );
    const sanitizedRoutine: ProductRoutine = {
      am: sanitizeRoutineSteps(productForm.routine.am, []),
      pm: sanitizeRoutineSteps(productForm.routine.pm, []),
    };

    if (!sanitizedBullets.length) {
      toast.error("Add at least one description bullet");
      return;
    }

    const payloadBase = {
      name: productForm.name.trim(),
      slug: normalizedSlug,
      description: productForm.description.trim() || undefined,
      benefits: sanitizedBenefits,
      descriptionBullets: sanitizedBullets,
      routine: sanitizedRoutine,
      price: parsedPrice,
      categoryId: Number(productForm.categoryId),
      imageUrl: productForm.imageUrl.trim() || undefined,
      inStock: productForm.inStock,
      stockQuantity: parsedStock,
      isFeatured: productForm.isFeatured,
      isNew: productForm.isNew,
      isTrending: productForm.isTrending,
    };

    try {
      let savedProductId: number | null = editingId;

      if (editingId) {
        await productUpdateMutation.mutateAsync({
          id: editingId,
          ...payloadBase,
          comparePrice: parsedComparePrice,
        });
      } else {
        const created = await productCreateMutation.mutateAsync({
          ...payloadBase,
          ...(parsedComparePrice !== null
            ? { comparePrice: parsedComparePrice }
            : {}),
        });
        const createdId = Number(
          (created as { id?: number } | undefined)?.id ?? 0
        );
        savedProductId =
          Number.isFinite(createdId) && createdId > 0 ? createdId : null;
      }

      if (isAdmin && savedProductId) {
        const seoPayload = [
          {
            key: `productSeo.${savedProductId}.metaTitle`,
            value: productForm.metaTitle.trim(),
          },
          {
            key: `productSeo.${savedProductId}.metaDescription`,
            value: productForm.metaDescription.trim(),
          },
          {
            key: `productSeo.${savedProductId}.metaKeywords`,
            value: productForm.metaKeywords.trim(),
          },
          {
            key: `productSeo.${savedProductId}.ogImage`,
            value: productForm.ogImage.trim(),
          },
        ];
        try {
          await Promise.all(
            seoPayload.map(entry => settingsSetMutation.mutateAsync(entry))
          );
          await utils.settings.list.invalidate();
        } catch (seoError) {
          toast.error(
            getErrorMessage(
              seoError,
              "Product saved, but SEO fields could not be persisted."
            )
          );
        }
      }

      closeDialog();
    } catch {
      // Errors surfaced via mutation onError toasts.
    }
  }, [
    canManage,
    closeDialog,
    editingId,
    isAdmin,
    productCreateMutation,
    productForm,
    productUpdateMutation,
    products,
    settingsSetMutation,
    utils.settings.list,
  ]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete || !canDelete) return;
    try {
      await productDeleteMutation.mutateAsync({ id: pendingDelete.id });
      setPendingDelete(null);
    } catch {
      // Errors surfaced via mutation onError toasts.
    }
  }, [canDelete, pendingDelete, productDeleteMutation]);

  useEffect(() => {
    if (slugTouched) return;
    setProductForm(prev => {
      const expected = slugify(prev.name);
      if (prev.slug === expected) return prev;
      return { ...prev, slug: expected };
    });
  }, [productForm.name, slugTouched]);

  if (productsQuery.error && !productsQuery.data) {
    return (
      <RetryPanel
        title="Products unavailable"
        description={getErrorMessage(
          productsQuery.error,
          "Unable to load products."
        )}
        onRetry={() => void productsQuery.refetch()}
      />
    );
  }

  const isLoading = productsQuery.isLoading;
  const isFetching = productsQuery.isFetching;
  const isSubmitting =
    productCreateMutation.isPending || productUpdateMutation.isPending;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Heading level={2} className="text-xl">
            Produits
          </Heading>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            {filteredProducts.length} sur {products.length} produit
            {products.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9 border-[var(--admin-border)]"
            onClick={() => void productsQuery.refetch()}
            disabled={isFetching}
            aria-label="Rafraîchir"
          >
            <RefreshCw
              className={cn("h-4 w-4", isFetching && "animate-spin")}
            />
          </Button>
          <Button
            type="button"
            onClick={openCreateDialog}
            disabled={!canManage}
            className="bg-[var(--admin-accent)] text-white hover:bg-[var(--admin-accent-hover)]"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Ajouter un produit
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-muted)]" />
          <Input
            placeholder="Rechercher (nom, slug, description)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border-[var(--admin-border)] bg-[var(--admin-bg)] pl-9 text-sm"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-9 w-[180px] border-[var(--admin-border)]">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {categories.map(c => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={stockFilter}
          onValueChange={v => setStockFilter(v as StockFilter)}
        >
          <SelectTrigger className="h-9 w-[150px] border-[var(--admin-border)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous stocks</SelectItem>
            <SelectItem value="instock">En stock</SelectItem>
            <SelectItem value="low">Stock bas</SelectItem>
            <SelectItem value="out">Rupture</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortKey} onValueChange={v => setSortKey(v as SortKey)}>
          <SelectTrigger className="h-9 w-[170px] border-[var(--admin-border)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Plus récents</SelectItem>
            <SelectItem value="oldest">Plus anciens</SelectItem>
            <SelectItem value="name">Nom (A-Z)</SelectItem>
            <SelectItem value="price_asc">Prix croissant</SelectItem>
            <SelectItem value="price_desc">Prix décroissant</SelectItem>
            <SelectItem value="stock">Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Surface className="overflow-hidden p-0">
        {isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <ShimmerBlock key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--admin-muted)]">
            <Package className="h-10 w-10 opacity-30" />
            <p className="text-sm">
              {products.length === 0
                ? "Aucun produit. Créez votre premier produit."
                : "Aucun produit ne correspond à vos filtres."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-divider)] bg-[var(--admin-surface-tint)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    Produit
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    Catégorie
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    Prix
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    Stock
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-divider)]">
                {filteredProducts.map(product => {
                  const status = stockStatusFor(product);
                  return (
                    <tr
                      key={product.id}
                      className="transition-colors hover:bg-[var(--admin-surface-tint)]"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt=""
                              className="h-10 w-10 rounded-md border border-[var(--admin-border)] object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-tint)] text-[var(--admin-muted)]">
                              <ImageIcon className="h-4 w-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[var(--admin-ink)]">
                              {product.name}
                            </p>
                            <p className="truncate text-xs text-[var(--admin-muted)]">
                              /{product.slug}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--admin-ink)]">
                        {categoryById.get(product.categoryId) ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[var(--admin-ink)]">
                        <div>{formatCFA(Number(product.price))}</div>
                        {product.comparePrice ? (
                          <div className="text-xs font-normal text-[var(--admin-muted)] line-through">
                            {formatCFA(Number(product.comparePrice))}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={status} context="stock" />
                          <span className="text-xs text-[var(--admin-muted)]">
                            {product.stockQuantity ?? 0} u.
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 border-[var(--admin-border)]"
                            onClick={() => openEditDialog(product)}
                            disabled={!canManage}
                            aria-label="Modifier"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 border-[var(--admin-border)] text-rose-600 hover:bg-rose-50"
                            onClick={() => setPendingDelete(product)}
                            disabled={!canDelete}
                            aria-label="Supprimer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Surface>

      <Dialog
        open={modalOpen}
        onOpenChange={open => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--admin-ink)] [font-family:var(--font-admin-display)]">
              {editingId ? "Modifier le produit" : "Nouveau produit"}
            </DialogTitle>
            <DialogDescription className="text-[var(--admin-muted)]">
              Toutes les opérations sont persistées via tRPC.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-1"
            onSubmit={event => {
              event.preventDefault();
              void submitProductForm();
            }}
          >
            <section className="space-y-4">
              <SectionLabel>1 · Informations</SectionLabel>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-[var(--admin-ink)]">Nom</Label>
                  <Input
                    value={productForm.name}
                    onChange={event =>
                      setProductForm(prev => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Nom du produit"
                    className="border-[var(--admin-border)] bg-[var(--admin-bg)]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[var(--admin-ink)]">Slug</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={productForm.slug}
                      onChange={event => {
                        setSlugTouched(true);
                        setProductForm(prev => ({
                          ...prev,
                          slug: slugify(event.target.value),
                        }));
                      }}
                      placeholder="produit-slug"
                      className="border-[var(--admin-border)] bg-[var(--admin-bg)]"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 shrink-0 border-[var(--admin-border)]"
                      onClick={() => {
                        setSlugTouched(true);
                        setProductForm(prev => ({
                          ...prev,
                          slug: slugify(prev.name),
                        }));
                      }}
                      aria-label="Régénérer le slug"
                    >
                      <Wand2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[var(--admin-ink)]">
                  Description longue (optionnel)
                </Label>
                <Textarea
                  rows={4}
                  value={productForm.description}
                  onChange={event =>
                    setProductForm(prev => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Texte libre pour la fiche produit"
                  className="border-[var(--admin-border)] bg-[var(--admin-bg)]"
                />
              </div>
            </section>

            <SectionDivider />

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <SectionLabel>2 · Bénéfices clés</SectionLabel>
                  <p className="mt-1 text-xs text-[var(--admin-muted)]">
                    Jusqu&apos;à {PRODUCT_MAX_BULLETS} points
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-[var(--admin-border)]"
                  onClick={() =>
                    setProductForm(prev => {
                      if (prev.benefits.length >= PRODUCT_MAX_BULLETS)
                        return prev;
                      return {
                        ...prev,
                        benefits: [...prev.benefits, ""],
                      };
                    })
                  }
                  disabled={productForm.benefits.length >= PRODUCT_MAX_BULLETS}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Ajouter
                </Button>
              </div>
              {productForm.benefits.length ? (
                <div className="space-y-2">
                  {productForm.benefits.map((bullet, index) => (
                    <div
                      key={`benefit-${index}`}
                      className="flex items-center gap-2"
                    >
                      <Input
                        value={bullet}
                        onChange={event =>
                          setProductForm(prev => ({
                            ...prev,
                            benefits: prev.benefits.map((entry, entryIndex) =>
                              entryIndex === index ? event.target.value : entry
                            ),
                          }))
                        }
                        placeholder={`Bénéfice #${index + 1}`}
                        className="border-[var(--admin-border)] bg-[var(--admin-bg)]"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 shrink-0 border-[var(--admin-border)]"
                        onClick={() =>
                          setProductForm(prev => ({
                            ...prev,
                            benefits: moveArrayItem(
                              prev.benefits,
                              index,
                              index - 1
                            ),
                          }))
                        }
                        disabled={index === 0}
                        aria-label="Monter"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 shrink-0 border-[var(--admin-border)]"
                        onClick={() =>
                          setProductForm(prev => ({
                            ...prev,
                            benefits: moveArrayItem(
                              prev.benefits,
                              index,
                              index + 1
                            ),
                          }))
                        }
                        disabled={index === productForm.benefits.length - 1}
                        aria-label="Descendre"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 shrink-0 text-rose-600 hover:bg-rose-50"
                        onClick={() =>
                          setProductForm(prev => ({
                            ...prev,
                            benefits: prev.benefits.filter(
                              (_, entryIndex) => entryIndex !== index
                            ),
                          }))
                        }
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-tint)] p-3 text-xs text-[var(--admin-muted)]">
                  Ajoutez les résultats concrets attendus par la cliente.
                </p>
              )}
            </section>

            <SectionDivider />

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <SectionLabel>3 · Routine suggérée</SectionLabel>
                  <p className="mt-1 text-xs text-[var(--admin-muted)]">
                    Matin / Soir · max {PRODUCT_MAX_ROUTINE_STEPS} étapes
                  </p>
                </div>
              </div>

              <Tabs
                value={routineTab}
                onValueChange={value =>
                  setRoutineTab(value === "pm" ? "pm" : "am")
                }
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2 bg-[var(--admin-surface-tint)]">
                  <TabsTrigger value="am">Matin</TabsTrigger>
                  <TabsTrigger value="pm">Soir</TabsTrigger>
                </TabsList>

                {(["am", "pm"] as const).map(phase => (
                  <TabsContent
                    key={phase}
                    value={phase}
                    className="mt-3 space-y-2"
                  >
                    {productForm.routine[phase].map((step, index) => {
                      const presetValue = resolveRoutinePresetValue(step.title);
                      return (
                        <div
                          key={`routine-${phase}-${index}`}
                          className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-tint)] p-3"
                        >
                          <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto] md:items-start">
                            <div className="space-y-2">
                              <Select
                                value={presetValue}
                                onValueChange={value =>
                                  setProductForm(prev => ({
                                    ...prev,
                                    routine: {
                                      ...prev.routine,
                                      [phase]: prev.routine[phase].map(
                                        (entry, entryIndex) =>
                                          entryIndex === index
                                            ? {
                                                ...entry,
                                                title:
                                                  value === ROUTINE_CUSTOM_VALUE
                                                    ? ""
                                                    : value,
                                              }
                                            : entry
                                      ),
                                    },
                                  }))
                                }
                              >
                                <SelectTrigger className="border-[var(--admin-border)] bg-[var(--admin-bg)]">
                                  <SelectValue placeholder="Choisir un titre" />
                                </SelectTrigger>
                                <SelectContent>
                                  {ROUTINE_TITLE_PRESETS.map(title => (
                                    <SelectItem
                                      key={`${phase}-title-${title}`}
                                      value={title}
                                    >
                                      {title}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value={ROUTINE_CUSTOM_VALUE}>
                                    Autre...
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              {presetValue === ROUTINE_CUSTOM_VALUE ? (
                                <Input
                                  value={step.title}
                                  onChange={event =>
                                    setProductForm(prev => ({
                                      ...prev,
                                      routine: {
                                        ...prev.routine,
                                        [phase]: prev.routine[phase].map(
                                          (entry, entryIndex) =>
                                            entryIndex === index
                                              ? {
                                                  ...entry,
                                                  title: event.target.value,
                                                }
                                              : entry
                                        ),
                                      },
                                    }))
                                  }
                                  placeholder="Titre personnalisé"
                                  className="border-[var(--admin-border)] bg-[var(--admin-bg)]"
                                />
                              ) : null}
                              <Textarea
                                rows={2}
                                value={step.text}
                                onChange={event =>
                                  setProductForm(prev => ({
                                    ...prev,
                                    routine: {
                                      ...prev.routine,
                                      [phase]: prev.routine[phase].map(
                                        (entry, entryIndex) =>
                                          entryIndex === index
                                            ? {
                                                ...entry,
                                                text: event.target.value,
                                              }
                                            : entry
                                      ),
                                    },
                                  }))
                                }
                                placeholder="Instruction concise pour cette étape"
                                className="border-[var(--admin-border)] bg-[var(--admin-bg)]"
                              />
                            </div>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-9 w-9 shrink-0 border-[var(--admin-border)]"
                              onClick={() =>
                                setProductForm(prev => ({
                                  ...prev,
                                  routine: {
                                    ...prev.routine,
                                    [phase]: moveArrayItem(
                                      prev.routine[phase],
                                      index,
                                      index - 1
                                    ),
                                  },
                                }))
                              }
                              disabled={index === 0}
                              aria-label="Monter"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-9 w-9 shrink-0 border-[var(--admin-border)]"
                              onClick={() =>
                                setProductForm(prev => ({
                                  ...prev,
                                  routine: {
                                    ...prev.routine,
                                    [phase]: moveArrayItem(
                                      prev.routine[phase],
                                      index,
                                      index + 1
                                    ),
                                  },
                                }))
                              }
                              disabled={
                                index === productForm.routine[phase].length - 1
                              }
                              aria-label="Descendre"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9 shrink-0 text-rose-600 hover:bg-rose-50"
                              onClick={() =>
                                setProductForm(prev => ({
                                  ...prev,
                                  routine: {
                                    ...prev.routine,
                                    [phase]: prev.routine[phase].filter(
                                      (_, entryIndex) => entryIndex !== index
                                    ),
                                  },
                                }))
                              }
                              aria-label="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-[var(--admin-border)]"
                      onClick={() =>
                        setProductForm(prev => {
                          if (
                            prev.routine[phase].length >=
                            PRODUCT_MAX_ROUTINE_STEPS
                          )
                            return prev;
                          return {
                            ...prev,
                            routine: {
                              ...prev.routine,
                              [phase]: [
                                ...prev.routine[phase],
                                createEmptyRoutineStep(),
                              ],
                            },
                          };
                        })
                      }
                      disabled={
                        productForm.routine[phase].length >=
                        PRODUCT_MAX_ROUTINE_STEPS
                      }
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Ajouter une étape {phase === "am" ? "matin" : "soir"}
                    </Button>
                  </TabsContent>
                ))}
              </Tabs>
            </section>

            <SectionDivider />

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <SectionLabel>4 · Description (puces)</SectionLabel>
                  <p className="mt-1 text-xs text-[var(--admin-muted)]">
                    Obligatoire · au moins 1 · max {PRODUCT_MAX_BULLETS}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-[var(--admin-border)]"
                  onClick={() =>
                    setProductForm(prev => {
                      if (prev.descriptionBullets.length >= PRODUCT_MAX_BULLETS)
                        return prev;
                      return {
                        ...prev,
                        descriptionBullets: [...prev.descriptionBullets, ""],
                      };
                    })
                  }
                  disabled={
                    productForm.descriptionBullets.length >= PRODUCT_MAX_BULLETS
                  }
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Ajouter
                </Button>
              </div>
              {productForm.descriptionBullets.length ? (
                <div className="space-y-2">
                  {productForm.descriptionBullets.map((bullet, index) => (
                    <div
                      key={`bullet-${index}`}
                      className="flex items-center gap-2"
                    >
                      <Input
                        value={bullet}
                        onChange={event =>
                          setProductForm(prev => ({
                            ...prev,
                            descriptionBullets: prev.descriptionBullets.map(
                              (entry, entryIndex) =>
                                entryIndex === index
                                  ? event.target.value
                                  : entry
                            ),
                          }))
                        }
                        placeholder={`Point #${index + 1}`}
                        className="border-[var(--admin-border)] bg-[var(--admin-bg)]"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 shrink-0 border-[var(--admin-border)]"
                        onClick={() =>
                          setProductForm(prev => ({
                            ...prev,
                            descriptionBullets: moveArrayItem(
                              prev.descriptionBullets,
                              index,
                              index - 1
                            ),
                          }))
                        }
                        disabled={index === 0}
                        aria-label="Monter"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 shrink-0 border-[var(--admin-border)]"
                        onClick={() =>
                          setProductForm(prev => ({
                            ...prev,
                            descriptionBullets: moveArrayItem(
                              prev.descriptionBullets,
                              index,
                              index + 1
                            ),
                          }))
                        }
                        disabled={
                          index === productForm.descriptionBullets.length - 1
                        }
                        aria-label="Descendre"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 shrink-0 text-rose-600 hover:bg-rose-50"
                        onClick={() =>
                          setProductForm(prev => ({
                            ...prev,
                            descriptionBullets: prev.descriptionBullets.filter(
                              (_, entryIndex) => entryIndex !== index
                            ),
                          }))
                        }
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-tint)] p-3 text-xs text-[var(--admin-muted)]">
                  Ajoutez au moins un point pour enregistrer.
                </p>
              )}
            </section>

            <SectionDivider />

            <section className="space-y-4">
              <SectionLabel>5 · Prix &amp; stock</SectionLabel>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-[var(--admin-ink)]">Prix (CFA)</Label>
                  <Input
                    value={productForm.price}
                    inputMode="numeric"
                    onChange={event =>
                      setProductForm(prev => ({
                        ...prev,
                        price: event.target.value,
                      }))
                    }
                    className="border-[var(--admin-border)] bg-[var(--admin-bg)]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[var(--admin-ink)]">
                    Prix barré (optionnel)
                  </Label>
                  <Input
                    value={productForm.comparePrice}
                    inputMode="numeric"
                    onChange={event =>
                      setProductForm(prev => ({
                        ...prev,
                        comparePrice: event.target.value,
                      }))
                    }
                    className="border-[var(--admin-border)] bg-[var(--admin-bg)]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[var(--admin-ink)]">Stock</Label>
                  <Input
                    value={productForm.stockQuantity}
                    inputMode="numeric"
                    onChange={event =>
                      setProductForm(prev => ({
                        ...prev,
                        stockQuantity: event.target.value,
                      }))
                    }
                    className="border-[var(--admin-border)] bg-[var(--admin-bg)]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[var(--admin-ink)]">Catégorie</Label>
                <Select
                  value={productForm.categoryId || undefined}
                  onValueChange={value =>
                    setProductForm(prev => ({ ...prev, categoryId: value }))
                  }
                >
                  <SelectTrigger className="border-[var(--admin-border)] bg-[var(--admin-bg)]">
                    <SelectValue placeholder="Choisir une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category.id} value={String(category.id)}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[var(--admin-ink)]">Image (URL)</Label>
                <Input
                  value={productForm.imageUrl}
                  onChange={event =>
                    setProductForm(prev => ({
                      ...prev,
                      imageUrl: event.target.value,
                    }))
                  }
                  placeholder="https://..."
                  className="border-[var(--admin-border)] bg-[var(--admin-bg)]"
                />
                <ImageUpload
                  onImageUploaded={url =>
                    setProductForm(prev => ({ ...prev, imageUrl: url }))
                  }
                />
                {productForm.imageUrl ? (
                  <img
                    src={productForm.imageUrl}
                    alt="aperçu"
                    className="h-44 w-full rounded-xl border border-[var(--admin-border)] object-cover"
                  />
                ) : null}
              </div>
            </section>

            <SectionDivider />

            <section className="space-y-3">
              <SectionLabel>6 · Visibilité</SectionLabel>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-tint)] px-3 py-2">
                  <span className="text-sm text-[var(--admin-ink)]">
                    En stock
                  </span>
                  <Switch
                    checked={productForm.inStock}
                    onCheckedChange={checked =>
                      setProductForm(prev => ({
                        ...prev,
                        inStock: Boolean(checked),
                      }))
                    }
                  />
                </label>
                <label className="flex items-center gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-tint)] px-3 py-2">
                  <Checkbox
                    checked={productForm.isFeatured}
                    onCheckedChange={checked =>
                      setProductForm(prev => ({
                        ...prev,
                        isFeatured: Boolean(checked),
                      }))
                    }
                  />
                  <span className="text-sm text-[var(--admin-ink)]">
                    Mis en avant
                  </span>
                </label>
                <label className="flex items-center gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-tint)] px-3 py-2">
                  <Checkbox
                    checked={productForm.isNew}
                    onCheckedChange={checked =>
                      setProductForm(prev => ({
                        ...prev,
                        isNew: Boolean(checked),
                      }))
                    }
                  />
                  <span className="text-sm text-[var(--admin-ink)]">
                    Nouveauté
                  </span>
                </label>
                <label className="flex items-center gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-tint)] px-3 py-2">
                  <Checkbox
                    checked={productForm.isTrending}
                    onCheckedChange={checked =>
                      setProductForm(prev => ({
                        ...prev,
                        isTrending: Boolean(checked),
                      }))
                    }
                  />
                  <span className="text-sm text-[var(--admin-ink)]">
                    Tendance
                  </span>
                </label>
              </div>
            </section>

            {isAdmin ? (
              <>
                <SectionDivider />
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-[var(--admin-accent)]" />
                    <SectionLabel>7 · SEO</SectionLabel>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-[var(--admin-ink)]">
                        Meta title
                      </Label>
                      <Input
                        value={productForm.metaTitle}
                        onChange={event =>
                          setProductForm(prev => ({
                            ...prev,
                            metaTitle: event.target.value,
                          }))
                        }
                        placeholder="Titre optimisé pour les moteurs de recherche"
                        className="border-[var(--admin-border)] bg-[var(--admin-bg)]"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-[var(--admin-ink)]">
                        Meta description
                      </Label>
                      <Textarea
                        rows={3}
                        value={productForm.metaDescription}
                        onChange={event =>
                          setProductForm(prev => ({
                            ...prev,
                            metaDescription: event.target.value,
                          }))
                        }
                        placeholder="Description affichée dans les résultats de recherche"
                        className="border-[var(--admin-border)] bg-[var(--admin-bg)]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[var(--admin-ink)]">
                        Mots-clés
                      </Label>
                      <Input
                        value={productForm.metaKeywords}
                        onChange={event =>
                          setProductForm(prev => ({
                            ...prev,
                            metaKeywords: event.target.value,
                          }))
                        }
                        placeholder="sérum, soin, éclat..."
                        className="border-[var(--admin-border)] bg-[var(--admin-bg)]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[var(--admin-ink)]">
                        Image OG
                      </Label>
                      <Input
                        value={productForm.ogImage}
                        onChange={event =>
                          setProductForm(prev => ({
                            ...prev,
                            ogImage: event.target.value,
                          }))
                        }
                        placeholder="https://.../social-preview.jpg"
                        className="border-[var(--admin-border)] bg-[var(--admin-bg)]"
                      />
                    </div>
                  </div>
                </section>
              </>
            ) : null}

            <div className="flex justify-end gap-2 pt-6">
              <Button
                type="button"
                variant="outline"
                className="border-[var(--admin-border)]"
                onClick={closeDialog}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !canManage}
                className="bg-[var(--admin-accent)] text-white hover:bg-[var(--admin-accent-hover)]"
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {editingId ? "Enregistrer" : "Créer le produit"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={open => {
          if (!open) setPendingDelete(null);
        }}
      >
        <DialogContent className="border-[var(--admin-border)] bg-[var(--admin-surface)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--admin-ink)] [font-family:var(--font-admin-display)]">
              Supprimer le produit
            </DialogTitle>
            <DialogDescription className="text-[var(--admin-muted)]">
              Cette action supprimera définitivement{" "}
              <span className="font-medium text-[var(--admin-ink)]">
                {pendingDelete?.name}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-[var(--admin-border)]"
              onClick={() => setPendingDelete(null)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={productDeleteMutation.isPending}
            >
              {productDeleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Supprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
