import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import AdminLayout from "@/components/admin/AdminLayout";
import { getAdminModulePath } from "@/lib/adminNavigation";
import PageHeader from "@/components/admin/PageHeader";
import AdminNotAllowed from "@/pages/AdminNotAllowed";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminCms, ADMIN_PAGES_QUERY_KEY } from "@/lib/adminCms";
import { STOREFRONT_PAGE_QUERY_KEY } from "@/lib/storefrontCms";
import { trpc } from "@/lib/trpc";
import type { StaticPage } from "@shared/storefront-cms";
import { toast } from "sonner";
import { ExternalLink, Loader2, Plus, Save, Trash2 } from "lucide-react";

type DraftState = {
  id?: number;
  slug: string;
  title: string;
  body: string;
  metaDescription: string;
  status: "draft" | "published";
};

const emptyDraft: DraftState = {
  slug: "",
  title: "",
  body: "",
  metaDescription: "",
  status: "draft",
};

export default function AdminPages() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: permissions, isLoading: permissionsLoading } =
    trpc.rbac.me.useQuery(undefined, { enabled: !!user, retry: false });
  const canAccessCms = permissions?.allowedModules.includes("cms") ?? false;
  const canWriteCms = Boolean(permissions?.canWriteCms);
  const canDelete = Boolean(permissions?.canDelete);

  const pagesQuery = useQuery({
    queryKey: ADMIN_PAGES_QUERY_KEY,
    queryFn: adminCms.listPages,
    enabled: !!user && canAccessCms,
  });

  const [selectedId, setSelectedId] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<DraftState>(emptyDraft);

  useEffect(() => {
    if (!pagesQuery.data) return;
    if (selectedId === null && pagesQuery.data[0]) {
      setSelectedId(pagesQuery.data[0].id);
    }
  }, [pagesQuery.data, selectedId]);

  useEffect(() => {
    if (selectedId === "new") {
      setDraft(emptyDraft);
      return;
    }
    if (typeof selectedId === "number" && pagesQuery.data) {
      const page = pagesQuery.data.find(p => p.id === selectedId);
      if (page) {
        setDraft({
          id: page.id,
          slug: page.slug,
          title: page.title,
          body: page.body,
          metaDescription: page.metaDescription,
          status: page.status,
        });
      }
    }
  }, [selectedId, pagesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (next: DraftState) => {
      if (next.id) {
        return adminCms.updatePage({
          id: next.id,
          slug: next.slug,
          title: next.title,
          body: next.body,
          metaDescription: next.metaDescription,
          status: next.status,
        });
      }
      return adminCms.createPage({
        slug: next.slug,
        title: next.title,
        body: next.body,
        metaDescription: next.metaDescription,
        status: next.status,
      });
    },
    onSuccess: page => {
      queryClient.invalidateQueries({ queryKey: ADMIN_PAGES_QUERY_KEY });
      queryClient.invalidateQueries({
        queryKey: STOREFRONT_PAGE_QUERY_KEY(page.slug),
      });
      setSelectedId(page.id);
      toast.success("Page enregistrée");
    },
    onError: error => {
      toast.error("Erreur", {
        description: error instanceof Error ? error.message : "Réessayez.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminCms.deletePage(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_PAGES_QUERY_KEY });
      if (selectedId === id) setSelectedId(null);
      toast.success("Page supprimée");
    },
    onError: error => {
      toast.error("Suppression impossible", {
        description: error instanceof Error ? error.message : "Réessayez.",
      });
    },
  });

  const pages = pagesQuery.data ?? [];
  const publicUrl = useMemo(() => {
    if (!draft.slug) return null;
    if (typeof window === "undefined") return null;
    return `${window.location.origin}/page/${draft.slug}`;
  }, [draft.slug]);

  if (authLoading || permissionsLoading) {
    return (
      <AdminLayout
        activeModule="cms"
        onModuleChange={m => setLocation(getAdminModulePath(m))}
        userName={null}
      >
        <div className="p-10 text-center text-sm text-muted-foreground">
          Chargement…
        </div>
      </AdminLayout>
    );
  }
  if (!user) {
    window.location.href = getLoginUrl();
    return null;
  }
  if (!canAccessCms) {
    return <AdminNotAllowed />;
  }

  const handleSave = () => {
    if (!canWriteCms) return;
    if (!draft.slug.trim() || !draft.title.trim()) {
      toast.error("Slug et titre sont obligatoires");
      return;
    }
    saveMutation.mutate(draft);
  };

  return (
    <AdminLayout
      activeModule="cms"
      userName={user.name}
      onModuleChange={m => setLocation(getAdminModulePath(m))}
    >
      <PageHeader
        breadcrumbs={[{ label: "Admin" }, { label: "Pages" }]}
        title="Pages statiques"
        description="CGV, confidentialité, à propos, contact — modifiables sans redéployer."
        actions={
          <Button onClick={() => setSelectedId("new")}>
            <Plus className="mr-1.5 h-4 w-4" /> Nouvelle page
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          {pagesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : (
            pages.map(page => (
              <PageRow
                key={page.id}
                page={page}
                active={selectedId === page.id}
                onSelect={() => setSelectedId(page.id)}
              />
            ))
          )}
          {selectedId === "new" ? (
            <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
              Nouvelle page (non enregistrée)
            </div>
          ) : null}
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Slug (URL)</Label>
              <Input
                value={draft.slug}
                placeholder="ex: a-propos"
                onChange={e =>
                  setDraft(prev => ({
                    ...prev,
                    slug: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "-"),
                  }))
                }
              />
              {publicUrl ? (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand-accent hover:underline"
                >
                  {publicUrl}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label>Statut</Label>
              <Select
                value={draft.status}
                onValueChange={v =>
                  setDraft(prev => ({
                    ...prev,
                    status: v as "draft" | "published",
                  }))
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
          </div>

          <div className="space-y-1.5">
            <Label>Titre</Label>
            <Input
              value={draft.title}
              placeholder="Conditions générales de vente"
              onChange={e =>
                setDraft(prev => ({ ...prev, title: e.target.value }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label>Meta description (SEO)</Label>
            <Input
              value={draft.metaDescription}
              placeholder="Courte description pour les moteurs de recherche"
              onChange={e =>
                setDraft(prev => ({ ...prev, metaDescription: e.target.value }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label>Contenu (markdown)</Label>
            <Textarea
              value={draft.body}
              rows={20}
              className="font-mono text-sm"
              placeholder={
                "## Titre de section\n\nUn paragraphe.\n\n- Puce 1\n- Puce 2\n\n**Gras**, *italique*, [lien](https://…)"
              }
              onChange={e =>
                setDraft(prev => ({ ...prev, body: e.target.value }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Supports : ## titres, listes à puces (-), **gras**, *italique*,
              [lien](https://…).
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            {draft.id ? (
              <Button
                variant="outline"
                onClick={() => {
                  if (!draft.id) return;
                  if (!window.confirm(`Supprimer la page "${draft.title}" ?`))
                    return;
                  deleteMutation.mutate(draft.id);
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-1.5 h-4 w-4 text-destructive" />
                Supprimer
              </Button>
            ) : (
              <div />
            )}
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Enregistrer
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function PageRow({
  page,
  active,
  onSelect,
}: {
  page: StaticPage;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${
        active
          ? "border-brand-accent bg-brand-accent/5"
          : "border-border bg-card hover:border-brand-accent/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground line-clamp-1">
          {page.title}
        </p>
        <Badge variant={page.status === "published" ? "stock" : "outline"}>
          {page.status === "published" ? "Publiée" : "Brouillon"}
        </Badge>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">/page/{page.slug}</p>
    </button>
  );
}
