import { useCallback, useEffect, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Download,
  Eye,
  FileText,
  Globe,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import DataTable from "@/components/admin/DataTable";
import StatusBadge from "@/components/admin/StatusBadge";
import { RetryPanel } from "@/pages/admin-modules/shared/RetryPanel";
import {
  computeSeoScore,
  getErrorMessage,
  slugify,
} from "@/pages/admin-modules/shared/utils";
import { toDateLabel } from "@/pages/admin-modules/shared/formatters";
import { downloadCsv } from "@/pages/admin-modules/shared/csv";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Surface } from "@/components/admin/ui/Surface";

type CmsPageEntity = {
  id: number;
  title: string;
  slug: string;
  status: "draft" | "published";
  content: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type CmsForm = {
  title: string;
  slug: string;
  status: "draft" | "published";
  content: string;
  seoTitle: string;
  seoDescription: string;
};

const EMPTY_CMS_FORM: CmsForm = {
  title: "",
  slug: "",
  status: "draft",
  content: "",
  seoTitle: "",
  seoDescription: "",
};

interface CmsModuleProps {
  canManage: boolean;
  canDelete: boolean;
}

export function CmsModule({ canManage, canDelete }: CmsModuleProps) {
  const utils = trpc.useUtils();
  const shouldReduceMotion = useReducedMotion();

  const [cmsSearch, setCmsSearch] = useState("");
  const [cmsStatusFilter, setCmsStatusFilter] = useState<
    "all" | "draft" | "published"
  >("all");
  const [cmsEditorOpen, setCmsEditorOpen] = useState(false);
  const [cmsEditingId, setCmsEditingId] = useState<number | null>(null);
  const [cmsPendingDelete, setCmsPendingDelete] =
    useState<CmsPageEntity | null>(null);
  const [cmsForm, setCmsForm] = useState<CmsForm>(EMPTY_CMS_FORM);
  const [cmsSlugTouched, setCmsSlugTouched] = useState(false);

  const cmsPagesQuery = trpc.cms.list.useQuery(
    {
      search: cmsSearch.trim() || undefined,
      status: cmsStatusFilter,
      limit: 200,
      offset: 0,
    },
    { refetchInterval: 20000, refetchOnWindowFocus: true, retry: 1 }
  );

  const cmsByIdQuery = trpc.cms.byId.useQuery(
    { id: cmsEditingId ?? 0 },
    { enabled: cmsEditorOpen && cmsEditingId !== null, retry: 1 }
  );

  const cmsCreateMutation = trpc.cms.create.useMutation({
    onSuccess: async () => {
      toast.success("Page créée");
      await utils.cms.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const cmsUpdateMutation = trpc.cms.update.useMutation({
    onSuccess: async () => {
      toast.success("Page mise à jour");
      await Promise.all([
        utils.cms.list.invalidate(),
        utils.cms.byId.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const cmsSetStatusMutation = trpc.cms.setStatus.useMutation({
    onSuccess: async () => {
      toast.success("Statut de la page mis à jour");
      await Promise.all([
        utils.cms.list.invalidate(),
        utils.cms.byId.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const cmsDeleteMutation = trpc.cms.delete.useMutation({
    onSuccess: async () => {
      toast.success("Page supprimée");
      await Promise.all([
        utils.cms.list.invalidate(),
        utils.cms.byId.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const cmsRows = useMemo(
    () =>
      ((cmsPagesQuery.data?.pages ?? []) as CmsPageEntity[])
        .slice()
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        ),
    [cmsPagesQuery.data?.pages]
  );

  const publishedCount = cmsRows.filter(p => p.status === "published").length;
  const draftCount = cmsRows.filter(p => p.status === "draft").length;
  const averageSeoScore =
    cmsRows.length > 0
      ? Math.round(
          cmsRows.reduce((sum, page) => sum + computeSeoScore(page), 0) /
            cmsRows.length
        )
      : 0;

  const errorMessage =
    cmsPagesQuery.error || cmsByIdQuery.error
      ? getErrorMessage(
          cmsPagesQuery.error || cmsByIdQuery.error,
          "Impossible de charger les pages CMS."
        )
      : null;

  useEffect(() => {
    if (!cmsEditorOpen || cmsEditingId === null) return;
    if (!cmsByIdQuery.data) return;
    setCmsForm({
      title: cmsByIdQuery.data.title || "",
      slug: cmsByIdQuery.data.slug || "",
      status: cmsByIdQuery.data.status || "draft",
      content: cmsByIdQuery.data.content || "",
      seoTitle: cmsByIdQuery.data.seoTitle || "",
      seoDescription: cmsByIdQuery.data.seoDescription || "",
    });
    setCmsSlugTouched(true);
  }, [cmsByIdQuery.data, cmsEditorOpen, cmsEditingId]);

  const resetCmsEditor = useCallback(() => {
    setCmsEditingId(null);
    setCmsSlugTouched(false);
    setCmsForm(EMPTY_CMS_FORM);
  }, []);

  const openCreateCmsEditor = useCallback(() => {
    resetCmsEditor();
    setCmsEditorOpen(true);
  }, [resetCmsEditor]);

  const openEditCmsEditor = useCallback((page: CmsPageEntity) => {
    setCmsEditingId(page.id);
    setCmsSlugTouched(true);
    setCmsForm({
      title: page.title,
      slug: page.slug,
      status: page.status,
      content: page.content || "",
      seoTitle: page.seoTitle || "",
      seoDescription: page.seoDescription || "",
    });
    setCmsEditorOpen(true);
  }, []);

  const submitCmsForm = useCallback(async () => {
    if (!canManage) {
      toast.error("La modification du CMS n'est pas autorisée");
      return;
    }
    if (!cmsForm.title.trim()) {
      toast.error("Le titre de la page est obligatoire");
      return;
    }
    if (!cmsForm.slug.trim()) {
      toast.error("Le slug de la page est obligatoire");
      return;
    }
    if (!cmsForm.content.trim()) {
      toast.error("Le contenu de la page est obligatoire");
      return;
    }

    const normalizedSlug = slugify(cmsForm.slug);
    const duplicateSlug = cmsRows.find(
      page =>
        page.slug.toLowerCase() === normalizedSlug.toLowerCase() &&
        page.id !== cmsEditingId
    );
    if (duplicateSlug) {
      toast.error("Ce slug existe déjà. Choisissez un slug unique.");
      return;
    }

    const payload = {
      title: cmsForm.title.trim(),
      slug: normalizedSlug,
      status: cmsForm.status,
      content: cmsForm.content.trim(),
      seoTitle: cmsForm.seoTitle.trim() || undefined,
      seoDescription: cmsForm.seoDescription.trim() || undefined,
    };

    try {
      if (cmsEditingId !== null) {
        await cmsUpdateMutation.mutateAsync({ id: cmsEditingId, ...payload });
      } else {
        await cmsCreateMutation.mutateAsync(payload);
      }
      setCmsEditorOpen(false);
      resetCmsEditor();
    } catch {
      // Errors displayed in mutation callbacks.
    }
  }, [
    canManage,
    cmsCreateMutation,
    cmsEditingId,
    cmsForm,
    cmsRows,
    cmsUpdateMutation,
    resetCmsEditor,
  ]);

  const toggleCmsStatus = useCallback(
    async (page: CmsPageEntity) => {
      if (!canManage) {
        toast.error("La modification du CMS n'est pas autorisée");
        return;
      }
      try {
        await cmsSetStatusMutation.mutateAsync({
          id: page.id,
          status: page.status === "published" ? "draft" : "published",
        });
      } catch {
        // Errors displayed in mutation callbacks.
      }
    },
    [canManage, cmsSetStatusMutation]
  );

  const handleDeleteCmsPage = useCallback(async () => {
    if (!cmsPendingDelete) return;
    if (!canDelete) {
      toast.error("La suppression n'est pas autorisée");
      return;
    }
    try {
      await cmsDeleteMutation.mutateAsync({ id: cmsPendingDelete.id });
      setCmsPendingDelete(null);
      if (cmsEditingId === cmsPendingDelete.id) {
        setCmsEditorOpen(false);
        resetCmsEditor();
      }
    } catch {
      // Errors displayed in mutation callbacks.
    }
  }, [
    canDelete,
    cmsDeleteMutation,
    cmsEditingId,
    cmsPendingDelete,
    resetCmsEditor,
  ]);

  const exportCmsCsv = useCallback(() => {
    downloadCsv(
      `cms-pages-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Titre", "Slug", "Statut", "Score SEO", "Mise à jour"],
      cmsRows.map(page => [
        page.title,
        page.slug,
        page.status,
        computeSeoScore(page),
        toDateLabel(page.updatedAt),
      ])
    );
  }, [cmsRows]);

  const cmsColumns = useMemo<ColumnDef<CmsPageEntity>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Page",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-medium">{row.original.title}</p>
            <p className="text-xs text-muted-foreground">
              /{row.original.slug}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Statut",
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            context="order"
            label={
              row.original.status === "published" ? "Publiée" : "Brouillon"
            }
          />
        ),
      },
      {
        id: "seo",
        header: "SEO",
        cell: ({ row }) => {
          const score = computeSeoScore(row.original);
          return (
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{score}/100</p>
              <p className="text-xs text-muted-foreground">
                {score >= 75 ? "Solide" : score >= 50 ? "Moyen" : "À améliorer"}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "updatedAt",
        header: "Mise à jour",
        cell: ({ row }) => toDateLabel(row.original.updatedAt),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={e => {
                e.stopPropagation();
                if (typeof window !== "undefined") {
                  window.open(
                    `/${row.original.slug}`,
                    "_blank",
                    "noopener,noreferrer"
                  );
                }
              }}
            >
              <Eye className="mr-1 h-3.5 w-3.5" />
              Aperçu
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={e => {
                e.stopPropagation();
                openEditCmsEditor(row.original);
              }}
              disabled={!canManage}
            >
              Modifier
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={e => {
                e.stopPropagation();
                void toggleCmsStatus(row.original);
              }}
              disabled={!canManage || cmsSetStatusMutation.isPending}
            >
              {row.original.status === "published" ? "Dépublier" : "Publier"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={e => {
                e.stopPropagation();
                setCmsPendingDelete(row.original);
              }}
              disabled={!canDelete}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Supprimer
            </Button>
          </div>
        ),
      },
    ],
    [
      canDelete,
      canManage,
      cmsSetStatusMutation.isPending,
      openEditCmsEditor,
      toggleCmsStatus,
    ]
  );

  if (errorMessage) {
    return (
      <RetryPanel
        title="CMS indisponible"
        description={errorMessage}
        onRetry={() => {
          void Promise.all([cmsPagesQuery.refetch(), cmsByIdQuery.refetch()]);
        }}
      />
    );
  }

  const STAT_CARDS = [
    {
      label: "Total des pages",
      value: String(cmsRows.length),
      icon: <FileText className="h-4 w-4" />,
      iconClass:
        "rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface-tint)] p-2.5 text-[var(--admin-accent)]",
    },
    {
      label: "Publiées",
      value: String(publishedCount),
      icon: <Globe className="h-4 w-4" />,
      iconClass:
        "rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface-tint)] p-2.5 text-[var(--admin-accent)]",
    },
    {
      label: "Brouillons",
      value: String(draftCount),
      icon: <FileText className="h-4 w-4" />,
      iconClass:
        "rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface-tint)] p-2.5 text-[var(--admin-accent)]",
    },
    {
      label: "Score SEO moyen",
      value: `${averageSeoScore}/100`,
      icon: <Sparkles className="h-4 w-4" />,
      iconClass:
        "rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface-tint)] p-2.5 text-[var(--admin-accent)]",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STAT_CARDS.map(card => (
          <motion.div
            key={card.label}
            whileHover={shouldReduceMotion ? undefined : { y: -2 }}
          >
            <Surface className="p-4 md:p-5">
              <div className="flex items-center gap-3">
                <div className={card.iconClass}>{card.icon}</div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {card.label}
                  </p>
                  <p className="text-2xl font-semibold text-[var(--admin-ink)]">
                    {card.value}
                  </p>
                </div>
              </div>
            </Surface>
          </motion.div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={exportCmsCsv}>
          <Download className="mr-2 h-4 w-4" />
          Exporter CSV
        </Button>
        <Button
          type="button"
          onClick={openCreateCmsEditor}
          disabled={!canManage}
          className="bg-[var(--admin-accent)] text-white hover:bg-[var(--admin-accent-hover)]"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle page
        </Button>
      </div>

      <DataTable
        columns={cmsColumns}
        data={cmsRows}
        isLoading={cmsPagesQuery.isLoading}
        searchValue={cmsSearch}
        onSearchValueChange={setCmsSearch}
        searchPlaceholder="Rechercher par titre, slug, contenu..."
        filters={
          <Select
            value={cmsStatusFilter}
            onValueChange={(value: "all" | "draft" | "published") =>
              setCmsStatusFilter(value)
            }
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="Filtrer par statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="published">Publiées</SelectItem>
              <SelectItem value="draft">Brouillons</SelectItem>
            </SelectContent>
          </Select>
        }
        emptyTitle="Aucune page CMS pour le moment"
        emptyDescription="Créez votre première page de contenu pour commencer à publier."
        emptyCtaLabel={canManage ? "Créer une page" : undefined}
        onEmptyCtaClick={canManage ? openCreateCmsEditor : undefined}
        onRowClick={openEditCmsEditor}
        getRowId={row => String(row.id)}
      />

      {/* CMS Editor Dialog */}
      <Dialog
        open={cmsEditorOpen}
        onOpenChange={open => {
          setCmsEditorOpen(open);
          if (!open) resetCmsEditor();
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto border-[var(--admin-border)] bg-[var(--admin-surface)] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="[font-family:var(--font-admin-display)]">
              {cmsEditingId ? "Modifier la page" : "Créer une page"}
            </DialogTitle>
            <DialogDescription>
              Gérez le contenu, la publication et les métadonnées SEO des pages
              de la boutique.
            </DialogDescription>
          </DialogHeader>

          {cmsEditingId !== null && cmsByIdQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={e => {
                e.preventDefault();
                void submitCmsForm();
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Titre</Label>
                  <Input
                    value={cmsForm.title}
                    onChange={e => {
                      const title = e.target.value;
                      setCmsForm(prev => ({
                        ...prev,
                        title,
                        slug: cmsSlugTouched ? prev.slug : slugify(title),
                      }));
                    }}
                    placeholder="Accueil, À propos, Politique de livraison..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={cmsForm.slug}
                      onChange={e => {
                        setCmsSlugTouched(true);
                        setCmsForm(prev => ({
                          ...prev,
                          slug: slugify(e.target.value),
                        }));
                      }}
                      placeholder="accueil"
                    />
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      onClick={() =>
                        setCmsForm(prev => ({
                          ...prev,
                          slug: slugify(prev.title),
                        }))
                      }
                    >
                      <Wand2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select
                    value={cmsForm.status}
                    onValueChange={(value: "draft" | "published") =>
                      setCmsForm(prev => ({ ...prev, status: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Brouillon</SelectItem>
                      <SelectItem value="published">Publiée</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-tint)] p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Santé SEO
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[var(--admin-ink)]">
                    {computeSeoScore(cmsForm)}/100
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Renseignez le titre SEO, la description et un contenu riche
                    pour un meilleur référencement.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Contenu</Label>
                <Textarea
                  rows={10}
                  value={cmsForm.content}
                  onChange={e =>
                    setCmsForm(prev => ({ ...prev, content: e.target.value }))
                  }
                  placeholder="Rédigez le contenu de votre page..."
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Titre SEO</Label>
                  <Input
                    value={cmsForm.seoTitle}
                    onChange={e =>
                      setCmsForm(prev => ({
                        ...prev,
                        seoTitle: e.target.value,
                      }))
                    }
                    placeholder="Titre SEO optimisé"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description SEO</Label>
                  <Textarea
                    rows={3}
                    value={cmsForm.seoDescription}
                    onChange={e =>
                      setCmsForm(prev => ({
                        ...prev,
                        seoDescription: e.target.value,
                      }))
                    }
                    placeholder="Description percutante de 140 à 160 caractères"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                {cmsEditingId !== null ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const edited = cmsRows.find(p => p.id === cmsEditingId);
                      if (!edited) return;
                      void toggleCmsStatus(edited);
                    }}
                    disabled={!canManage || cmsSetStatusMutation.isPending}
                  >
                    {cmsSetStatusMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Basculer la publication
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCmsEditorOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      cmsCreateMutation.isPending || cmsUpdateMutation.isPending
                    }
                    className="bg-[var(--admin-accent)] text-white hover:bg-[var(--admin-accent-hover)]"
                  >
                    {cmsCreateMutation.isPending ||
                    cmsUpdateMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Enregistrer la page
                  </Button>
                </div>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(cmsPendingDelete)}
        onOpenChange={open => {
          if (!open) setCmsPendingDelete(null);
        }}
      >
        <DialogContent className="border-[var(--admin-border)] bg-[var(--admin-surface)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="[font-family:var(--font-admin-display)]">
              Supprimer la page
            </DialogTitle>
            <DialogDescription>
              Cette action supprimera définitivement {cmsPendingDelete?.title}.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCmsPendingDelete(null)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteCmsPage()}
              disabled={cmsDeleteMutation.isPending}
            >
              {cmsDeleteMutation.isPending ? (
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
