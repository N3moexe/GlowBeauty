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
import {
  adminCardClass,
  adminCardPadding,
} from "@/components/admin/PageHeader";
import { cn } from "@/lib/utils";

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
      toast.success("Page created");
      await utils.cms.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const cmsUpdateMutation = trpc.cms.update.useMutation({
    onSuccess: async () => {
      toast.success("Page updated");
      await Promise.all([
        utils.cms.list.invalidate(),
        utils.cms.byId.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const cmsSetStatusMutation = trpc.cms.setStatus.useMutation({
    onSuccess: async () => {
      toast.success("Page status updated");
      await Promise.all([
        utils.cms.list.invalidate(),
        utils.cms.byId.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const cmsDeleteMutation = trpc.cms.delete.useMutation({
    onSuccess: async () => {
      toast.success("Page deleted");
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
          "Unable to load CMS pages."
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
      toast.error("CMS editing is not allowed");
      return;
    }
    if (!cmsForm.title.trim()) {
      toast.error("Page title is required");
      return;
    }
    if (!cmsForm.slug.trim()) {
      toast.error("Page slug is required");
      return;
    }
    if (!cmsForm.content.trim()) {
      toast.error("Page content is required");
      return;
    }

    const normalizedSlug = slugify(cmsForm.slug);
    const duplicateSlug = cmsRows.find(
      page =>
        page.slug.toLowerCase() === normalizedSlug.toLowerCase() &&
        page.id !== cmsEditingId
    );
    if (duplicateSlug) {
      toast.error("This slug already exists. Choose a unique slug.");
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
        toast.error("CMS editing is not allowed");
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
      toast.error("Deletion is not allowed");
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
      ["Title", "Slug", "Status", "SEO Score", "Updated"],
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
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            context="order"
            label={row.original.status === "published" ? "Published" : "Draft"}
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
                {score >= 75 ? "Strong" : score >= 50 ? "Medium" : "Needs work"}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
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
              Preview
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
              Edit
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
              {row.original.status === "published" ? "Unpublish" : "Publish"}
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
              Delete
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
        title="CMS unavailable"
        description={errorMessage}
        onRetry={() => {
          void Promise.all([cmsPagesQuery.refetch(), cmsByIdQuery.refetch()]);
        }}
      />
    );
  }

  const STAT_CARDS = [
    {
      label: "Total pages",
      value: String(cmsRows.length),
      icon: <FileText className="h-4 w-4" />,
      cardClass: "border-[#ddd1c7] bg-white/90",
      iconClass:
        "rounded-2xl border border-[#e2d6cc] bg-[#faf5f0] p-2.5 text-[#8f5f68]",
    },
    {
      label: "Published",
      value: String(publishedCount),
      icon: <Globe className="h-4 w-4" />,
      cardClass: "border-[#d4e0d2] bg-white/90",
      iconClass:
        "rounded-2xl border border-[#d4e0d2] bg-[#edf5eb] p-2.5 text-[#567552]",
    },
    {
      label: "Drafts",
      value: String(draftCount),
      icon: <FileText className="h-4 w-4" />,
      cardClass: "border-[#e6d7cf] bg-white/90",
      iconClass:
        "rounded-2xl border border-[#e4d5cc] bg-[#f8f1eb] p-2.5 text-[#8a6c57]",
    },
    {
      label: "Avg SEO score",
      value: `${averageSeoScore}/100`,
      icon: <Sparkles className="h-4 w-4" />,
      cardClass: "border-[#e2d6cc] bg-white/90",
      iconClass:
        "rounded-2xl border border-[#eddccf] bg-[#fff7f0] p-2.5 text-[#b37f4f]",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STAT_CARDS.map(card => (
          <motion.article
            key={card.label}
            whileHover={shouldReduceMotion ? undefined : { y: -2 }}
            className={cn(adminCardClass, adminCardPadding, card.cardClass)}
          >
            <div className="flex items-center gap-3">
              <div className={card.iconClass}>{card.icon}</div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {card.label}
                </p>
                <p className="text-2xl font-semibold">{card.value}</p>
              </div>
            </div>
          </motion.article>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={exportCmsCsv}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
        <Button
          type="button"
          onClick={openCreateCmsEditor}
          disabled={!canManage}
          className="bg-[var(--admin-accent)] text-white hover:bg-[var(--admin-accent-hover)]"
        >
          <Plus className="mr-2 h-4 w-4" />
          New page
        </Button>
      </div>

      <DataTable
        columns={cmsColumns}
        data={cmsRows}
        isLoading={cmsPagesQuery.isLoading}
        searchValue={cmsSearch}
        onSearchValueChange={setCmsSearch}
        searchPlaceholder="Search by title, slug, content..."
        filters={
          <Select
            value={cmsStatusFilter}
            onValueChange={(value: "all" | "draft" | "published") =>
              setCmsStatusFilter(value)
            }
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        }
        emptyTitle="No CMS pages yet"
        emptyDescription="Create your first content page to start publishing."
        emptyCtaLabel={canManage ? "Create page" : undefined}
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
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {cmsEditingId ? "Edit page" : "Create page"}
            </DialogTitle>
            <DialogDescription>
              Manage content, publishing, and SEO metadata for storefront pages.
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
                  <Label>Title</Label>
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
                    placeholder="Home, About us, Shipping policy..."
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
                  <Label>Status</Label>
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
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-xl border border-[#e5d8ce] bg-[#faf5f0] p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    SEO health
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {computeSeoScore(cmsForm)}/100
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Fill SEO title, description, and rich content for stronger
                    ranking.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  rows={10}
                  value={cmsForm.content}
                  onChange={e =>
                    setCmsForm(prev => ({ ...prev, content: e.target.value }))
                  }
                  placeholder="Write your page content..."
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>SEO title</Label>
                  <Input
                    value={cmsForm.seoTitle}
                    onChange={e =>
                      setCmsForm(prev => ({
                        ...prev,
                        seoTitle: e.target.value,
                      }))
                    }
                    placeholder="Optimized SEO title"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SEO description</Label>
                  <Textarea
                    rows={3}
                    value={cmsForm.seoDescription}
                    onChange={e =>
                      setCmsForm(prev => ({
                        ...prev,
                        seoDescription: e.target.value,
                      }))
                    }
                    placeholder="Compelling 140-160 character description"
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
                    Toggle publish
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
                    Cancel
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
                    Save page
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete page</DialogTitle>
            <DialogDescription>
              This action will permanently remove {cmsPendingDelete?.title}.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCmsPendingDelete(null)}
            >
              Cancel
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
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
