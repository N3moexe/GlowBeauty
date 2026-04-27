import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import AdminLayout from "@/components/admin/AdminLayout";
import EmptyState from "@/components/admin/EmptyState";
import PageHeader from "@/components/admin/PageHeader";
import AdminNotAllowed from "@/pages/AdminNotAllowed";
import { trpc } from "@/lib/trpc";
import { getAdminModulePath } from "@/lib/adminNavigation";
import type { AdminModuleKey } from "@/components/admin/SidebarNav";
import { Button } from "@/components/ui/button";
import { Loader2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type CategoryItem = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  coverImageUrl?: string | null;
  sortOrder?: number;
};

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageBytes = 5 * 1024 * 1024;

function normalizeCategoriesPayload(payload: unknown): CategoryItem[] {
  if (Array.isArray(payload)) return payload as CategoryItem[];
  if (payload && typeof payload === "object" && Array.isArray((payload as any).categories)) {
    return (payload as any).categories as CategoryItem[];
  }
  return [];
}

export default function AdminCategories() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const { data: permissions, isLoading: permissionsLoading, error: permissionsError } = trpc.rbac.me.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  const canUpload = Boolean(permissions && !permissions.readOnly);

  const loadCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const response = await fetch("/api/categories", {
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error((payload as any)?.error || "Impossible de charger les categories.");
      }

      const list = normalizeCategoriesPayload(payload).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      setCategories(list);
    } catch (error: any) {
      toast.error(error?.message || "Impossible de charger les categories.");
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    if (!permissions) return;
    if (!permissions.allowedModules.includes("categories")) return;
    loadCategories();
  }, [permissions, loadCategories]);

  const onModuleChange = (module: AdminModuleKey) => {
    setLocation(getAdminModulePath(module));
  };

  const onUploadClick = (categoryId: number) => {
    if (!canUpload) {
      toast.error("Vous etes en mode lecture seule.");
      return;
    }
    fileInputRefs.current[categoryId]?.click();
  };

  const onFileSelected = async (category: CategoryItem, file: File | undefined) => {
    if (!file) return;

    if (!allowedImageTypes.has(file.type)) {
      toast.error("Format non supporte. Utilisez JPG, PNG ou WebP.");
      return;
    }

    if (file.size > maxImageBytes) {
      toast.error("La taille maximale est de 5MB.");
      return;
    }

    setUploadingId(category.id);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/admin/categories/${category.id}/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error((payload as any)?.error || "Echec de l'upload de l'image.");
      }

      toast.success(`Image mise a jour pour ${category.name}.`);
      await loadCategories();
    } catch (error: any) {
      toast.error(error?.message || "Echec de l'upload de l'image.");
    } finally {
      setUploadingId(null);
    }
  };

  const categoriesCountLabel = useMemo(() => `${categories.length} categorie${categories.length > 1 ? "s" : ""}`, [categories.length]);

  if (loading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-crimson" />
      </div>
    );
  }

  if (!user) {
    window.location.href = getLoginUrl();
    return null;
  }

  if (permissionsError || !permissions || !permissions.allowedModules.includes("categories")) {
    return <AdminNotAllowed />;
  }

  return (
    <AdminLayout
      activeModule="categories"
      onModuleChange={onModuleChange}
      userName={user.name}
      allowedModules={permissions.allowedModules as AdminModuleKey[]}
      onQuickAction={permissions.readOnly ? undefined : ((action) => {
        if (action === "add_product" && permissions.allowedModules.includes("products")) setLocation("/admin/products");
        if (action === "create_coupon" && permissions.allowedModules.includes("coupons")) setLocation("/admin/coupons");
      })}
    >
      <div className="space-y-4">
        <PageHeader
          title="Categories"
          description="Importez des visuels pour les cartes univers de la page d'accueil."
          breadcrumbs={[{ label: "Admin" }, { label: "Categories" }]}
          actions={(
            <Button variant="outline" onClick={() => loadCategories()} disabled={loadingCategories}>
              {loadingCategories ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Rafraichir
            </Button>
          )}
        />

        <div className="rounded-xl border bg-card p-3 text-xs text-muted-foreground">
          {categoriesCountLabel} chargees. Formats acceptes: JPG, PNG, WebP (max 5MB). Les images sont optimisees automatiquement en WebP (1600x1000) pour un rendu net et uniforme.
        </div>

        {loadingCategories ? (
          <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Chargement des categories...</div>
        ) : categories.length === 0 ? (
          <EmptyState title="Aucune categorie" description="Les categories apparaitront ici apres creation." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => {
              const previewUrl = category.coverImageUrl || category.imageUrl || null;
              const isUploading = uploadingId === category.id;

              return (
                <article key={category.id} className="rounded-xl border bg-card p-4">
                  <div className="relative mb-3 aspect-[5/3] overflow-hidden rounded-lg border bg-muted/40">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={category.name}
                        className="h-full w-full object-cover object-center"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-crimson/65 via-rose-600/55 to-slate-900/70" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                    <div className="absolute inset-x-3 bottom-2 text-xs font-semibold text-white">
                      {category.name}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{category.name}</p>
                    <p className="text-xs text-muted-foreground">/{category.slug}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {category.description || "Aucune description"}
                    </p>
                  </div>

                  <input
                    ref={(element) => { fileInputRefs.current[category.id] = element; }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      void onFileSelected(category, file);
                      event.currentTarget.value = "";
                    }}
                  />

                  <div className="mt-4 flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-crimson text-white hover:bg-crimson-light"
                      disabled={!canUpload || isUploading}
                      onClick={() => onUploadClick(category.id)}
                    >
                      {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      {isUploading ? "Upload..." : "Uploader image"}
                    </Button>
                    {previewUrl ? (
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-muted-foreground underline underline-offset-4"
                      >
                        Apercu
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
