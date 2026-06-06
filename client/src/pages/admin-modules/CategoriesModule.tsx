import { useCallback, useMemo, useState } from "react";
import {
  FolderTree,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Surface } from "@/components/admin/ui/Surface";
import { Heading } from "@/components/admin/ui/Heading";
import { ShimmerBlock } from "@/pages/admin-modules/shared/ShimmerBlock";
import { RetryPanel } from "@/pages/admin-modules/shared/RetryPanel";
import { getErrorMessage, slugify } from "@/pages/admin-modules/shared/utils";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const SKINCARE_CATEGORY_PRESET = [
  {
    name: "Nettoyants",
    slug: "nettoyants",
    description: "Gels et huiles nettoyantes pour un nettoyage doux quotidien.",
  },
  {
    name: "Serums",
    slug: "serums",
    description:
      "Actifs cibles: hydratation, eclat, imperfections et anti-age.",
  },
  {
    name: "Hydratants",
    slug: "hydratants",
    description: "Cremes et lotions pour renforcer la barriere cutanee.",
  },
  {
    name: "Masques",
    slug: "masques",
    description: "Masques hebdomadaires pour detox, glow et nutrition intense.",
  },
  {
    name: "SPF",
    slug: "spf",
    description: "Protections solaires quotidiennes large spectre.",
  },
  {
    name: "Kits Routine",
    slug: "kits-routine",
    description: "Routines pre-composees matin/soir par objectif peau.",
  },
] as const;

type CategoryEntity = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
};

type ProductEntity = {
  id: number;
  categoryId: number;
};

const PRESET_SLUGS = new Set<string>(
  SKINCARE_CATEGORY_PRESET.map(category => category.slug)
);

export function CategoriesModule({
  canManage,
  canDelete,
}: {
  canManage: boolean;
  canDelete: boolean;
}) {
  const utils = trpc.useUtils();

  const categoriesQuery = trpc.category.list.useQuery(undefined, {
    refetchOnWindowFocus: true,
  });

  const productsQuery = trpc.product.list.useQuery({ limit: 1000 });

  const invalidateAfterMutation = useCallback(async () => {
    await Promise.all([
      utils.category.list.invalidate(),
      utils.product.list.invalidate(),
      utils.product.count.invalidate(),
    ]);
  }, [utils]);

  const categoryCreateMutation = trpc.category.create.useMutation({
    onSuccess: async () => {
      await invalidateAfterMutation();
    },
    onError: error => toast.error(error.message),
  });

  const categoryDeleteMutation = trpc.category.delete.useMutation({
    onSuccess: async () => {
      await invalidateAfterMutation();
    },
    onError: error => toast.error(error.message),
  });

  const categories = (categoriesQuery.data ?? []) as CategoryEntity[];
  const products = (productsQuery.data?.products ?? []) as ProductEntity[];

  const productsByCategoryId = useMemo(() => {
    const map = new Map<number, number>();
    products.forEach(product => {
      map.set(product.categoryId, (map.get(product.categoryId) ?? 0) + 1);
    });
    return map;
  }, [products]);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);

  const [applying, setApplying] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createSlugTouched, setCreateSlugTouched] = useState(false);
  const [createDescription, setCreateDescription] = useState("");

  const handleCreateNameChange = useCallback(
    (value: string) => {
      setCreateName(value);
      if (!createSlugTouched) {
        setCreateSlug(slugify(value));
      }
    },
    [createSlugTouched]
  );

  const applyPreset = useCallback(async () => {
    if (!canManage) {
      toast.error("La gestion des catégories n'est pas autorisée");
      return;
    }
    setApplying(true);
    try {
      for (const preset of SKINCARE_CATEGORY_PRESET) {
        const existing = categories.find(
          category => category.slug === preset.slug
        );
        if (!existing) {
          await categoryCreateMutation.mutateAsync({
            name: preset.name,
            slug: preset.slug,
            description: preset.description,
          });
        }
      }

      const stale = categories.filter(
        category => !PRESET_SLUGS.has(category.slug)
      );
      for (const category of stale) {
        const productCount = productsByCategoryId.get(category.id) ?? 0;
        if (productCount > 0) {
          continue;
        }
        try {
          await categoryDeleteMutation.mutateAsync({ id: category.id });
        } catch (deleteError) {
          toast.error(
            getErrorMessage(
              deleteError,
              `Impossible de supprimer la catégorie "${category.name}".`
            )
          );
        }
      }

      await invalidateAfterMutation();
      toast.success("Preset skincare appliqué");
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Échec de l'application du preset skincare")
      );
    } finally {
      setApplying(false);
    }
  }, [
    canManage,
    categories,
    categoryCreateMutation,
    categoryDeleteMutation,
    invalidateAfterMutation,
    productsByCategoryId,
  ]);

  const handleDelete = useCallback(
    async (category: CategoryEntity) => {
      if (!canDelete) {
        toast.error("Suppression non autorisée");
        return;
      }
      const productCount = productsByCategoryId.get(category.id) ?? 0;
      if (productCount > 0) {
        toast.error(
          "Réassignez les produits avant de supprimer cette catégorie"
        );
        return;
      }
      setDeletingId(category.id);
      try {
        await categoryDeleteMutation.mutateAsync({ id: category.id });
        toast.success(`Catégorie "${category.name}" supprimée`);
      } catch {
        // Errors handled via mutation onError toasts.
      } finally {
        setDeletingId(null);
      }
    },
    [canDelete, categoryDeleteMutation, productsByCategoryId]
  );

  const handleCreate = useCallback(async () => {
    if (!canManage) {
      toast.error("La création de catégories n'est pas autorisée");
      return;
    }
    const name = createName.trim();
    const slug = createSlug.trim();
    if (!name) {
      toast.error("Le nom est requis");
      return;
    }
    if (!slug) {
      toast.error("Le slug est requis");
      return;
    }
    const duplicate = categories.find(
      category => category.slug.toLowerCase() === slug.toLowerCase()
    );
    if (duplicate) {
      toast.error("Ce slug existe déjà");
      return;
    }
    try {
      await categoryCreateMutation.mutateAsync({
        name,
        slug,
        description: createDescription.trim() || undefined,
      });
      toast.success("Catégorie créée");
      setCreateName("");
      setCreateSlug("");
      setCreateDescription("");
      setCreateSlugTouched(false);
    } catch {
      // Errors handled via mutation onError toasts.
    }
  }, [
    canManage,
    categories,
    categoryCreateMutation,
    createDescription,
    createName,
    createSlug,
  ]);

  if (categoriesQuery.error && !categoriesQuery.data) {
    return (
      <RetryPanel
        title="Catégories indisponibles"
        description={getErrorMessage(
          categoriesQuery.error,
          "Impossible de charger les catégories."
        )}
        onRetry={() => void categoriesQuery.refetch()}
      />
    );
  }

  const isLoading = categoriesQuery.isLoading;
  const isFetching = categoriesQuery.isFetching;
  const isCreating = categoryCreateMutation.isPending && !applying;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Heading level={2} className="text-xl">
            Catégories
          </Heading>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            Organisez la taxonomie boutique : presets ou catégories sur mesure.
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-9 w-9 border-[var(--admin-border)]"
          onClick={() => void categoriesQuery.refetch()}
          disabled={isFetching}
          aria-label="Rafraîchir"
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </Button>
      </div>

      <Surface accent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--admin-ink)] [font-family:var(--font-admin-display)]">
                Appliquer le preset skincare
              </p>
              <p className="mt-1 max-w-2xl text-sm text-[var(--admin-muted)]">
                Crée les {SKINCARE_CATEGORY_PRESET.length} catégories
                recommandées (Nettoyants, Sérums, Hydratants, Masques, SPF, Kits
                Routine) et supprime les catégories vides hors preset.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {SKINCARE_CATEGORY_PRESET.map(preset => (
                  <span
                    key={preset.slug}
                    className="inline-flex items-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-tint)] px-2 py-0.5 text-xs text-[var(--admin-ink)]"
                  >
                    {preset.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => void applyPreset()}
            disabled={!canManage || applying}
            className="bg-[var(--admin-accent)] text-white hover:bg-[var(--admin-accent-hover)]"
          >
            {applying ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Appliquer le preset
          </Button>
        </div>
      </Surface>

      <Surface className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[var(--admin-divider)] bg-[var(--admin-surface-tint)] px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-ink)]">
            <FolderTree className="h-4 w-4 text-[var(--admin-accent)]" />
            Catégories ({categories.length})
          </div>
        </div>
        {isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <ShimmerBlock key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : sortedCategories.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--admin-muted)]">
            <Layers className="h-10 w-10 opacity-30" />
            <p className="text-sm">
              Aucune catégorie. Appliquez le preset ou créez-en une.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-divider)] bg-[var(--admin-surface)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    Nom
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    Slug
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    Produits
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    Origine
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-divider)]">
                {sortedCategories.map(category => {
                  const isPreset = PRESET_SLUGS.has(category.slug);
                  const productCount =
                    productsByCategoryId.get(category.id) ?? 0;
                  const isDeletingRow = deletingId === category.id;
                  const canDeleteRow =
                    canDelete && productCount === 0 && !isDeletingRow;
                  return (
                    <tr
                      key={category.id}
                      className="transition-colors hover:bg-[var(--admin-surface-tint)]"
                    >
                      <td className="px-4 py-3 font-medium text-[var(--admin-ink)]">
                        {category.name}
                      </td>
                      <td className="px-4 py-3 text-[var(--admin-muted)]">
                        <code className="rounded bg-[var(--admin-surface-tint)] px-1.5 py-0.5 text-xs">
                          {category.slug}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-[var(--admin-muted)]">
                        <p className="line-clamp-2 max-w-md">
                          {category.description || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[var(--admin-ink)]">
                        {productCount}
                      </td>
                      <td className="px-4 py-3">
                        {isPreset ? (
                          <span className="inline-flex items-center rounded-full border border-[var(--admin-accent-soft)] bg-[var(--admin-accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--admin-accent)]">
                            Preset
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-tint)] px-2 py-0.5 text-xs text-[var(--admin-muted)]">
                            Legacy
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className={cn(
                            "h-8 w-8 border-[var(--admin-border)]",
                            canDeleteRow
                              ? "text-rose-600 hover:bg-rose-50"
                              : "text-[var(--admin-muted)]"
                          )}
                          onClick={() => void handleDelete(category)}
                          disabled={!canDeleteRow}
                          aria-label="Supprimer la catégorie"
                          title={
                            productCount > 0
                              ? "Réassignez les produits avant de supprimer"
                              : "Supprimer"
                          }
                        >
                          {isDeletingRow ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Surface>

      <Surface className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4 text-[var(--admin-accent)]" />
          <p className="text-sm font-semibold text-[var(--admin-ink)] [font-family:var(--font-admin-display)]">
            Créer une catégorie
          </p>
        </div>
        <form
          className="space-y-4"
          onSubmit={event => {
            event.preventDefault();
            void handleCreate();
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[var(--admin-ink)]">Nom</Label>
              <Input
                value={createName}
                onChange={e => handleCreateNameChange(e.target.value)}
                placeholder="Ex. Soins ciblés"
                className="border-[var(--admin-border)] bg-[var(--admin-bg)]"
                disabled={!canManage}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[var(--admin-ink)]">Slug</Label>
              <Input
                value={createSlug}
                onChange={e => {
                  setCreateSlugTouched(true);
                  setCreateSlug(slugify(e.target.value));
                }}
                placeholder="soins-cibles"
                className="border-[var(--admin-border)] bg-[var(--admin-bg)]"
                disabled={!canManage}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[var(--admin-ink)]">
              Description (optionnel)
            </Label>
            <Textarea
              rows={3}
              value={createDescription}
              onChange={e => setCreateDescription(e.target.value)}
              placeholder="Brève description de la collection."
              className="border-[var(--admin-border)] bg-[var(--admin-bg)]"
              disabled={!canManage}
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!canManage || isCreating}
              className="bg-[var(--admin-accent)] text-white hover:bg-[var(--admin-accent-hover)]"
            >
              {isCreating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Créer la catégorie
            </Button>
          </div>
        </form>
      </Surface>
    </div>
  );
}
