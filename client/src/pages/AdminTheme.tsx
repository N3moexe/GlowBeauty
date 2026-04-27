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
import { Switch } from "@/components/ui/switch";
import ImagePickerField from "@/components/admin/ImagePickerField";
import { adminCms, ADMIN_THEME_QUERY_KEY } from "@/lib/adminCms";
import { STOREFRONT_THEME_QUERY_KEY } from "@/lib/storefrontCms";
import { trpc } from "@/lib/trpc";
import type { ThemeConfig } from "@shared/storefront-cms";
import { defaultTheme } from "@shared/storefront-cms";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

type Draft = Omit<ThemeConfig, "updatedAt">;

function themeToDraft(theme: ThemeConfig | undefined | null): Draft {
  const base = theme ?? defaultTheme();
  return {
    brandAccent: base.brandAccent,
    brandAccentHover: base.brandAccentHover,
    brandInk: base.brandInk,
    brandBg: base.brandBg,
    logoUrl: base.logoUrl,
    faviconUrl: base.faviconUrl,
    announcementEnabled: base.announcementEnabled,
    announcementText: base.announcementText,
    announcementHref: base.announcementHref,
  };
}

export default function AdminTheme() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: permissions, isLoading: permissionsLoading } =
    trpc.rbac.me.useQuery(undefined, { enabled: !!user, retry: false });
  const canAccessCms = permissions?.allowedModules.includes("cms") ?? false;
  const canWriteCms = Boolean(permissions?.canWriteCms);

  const themeQuery = useQuery({
    queryKey: ADMIN_THEME_QUERY_KEY,
    queryFn: adminCms.getTheme,
    enabled: !!user && canAccessCms,
  });

  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    if (themeQuery.data && !draft) setDraft(themeToDraft(themeQuery.data));
  }, [themeQuery.data, draft]);

  const saveMutation = useMutation({
    mutationFn: async (next: Draft) => adminCms.saveTheme(next),
    onSuccess: result => {
      queryClient.setQueryData(ADMIN_THEME_QUERY_KEY, result);
      queryClient.invalidateQueries({ queryKey: STOREFRONT_THEME_QUERY_KEY });
      setDraft(themeToDraft(result));
      toast.success("Thème enregistré");
    },
    onError: error => {
      toast.error("Erreur", {
        description: error instanceof Error ? error.message : "Réessayez.",
      });
    },
  });

  const dirty = useMemo(() => {
    if (!themeQuery.data || !draft) return false;
    return (
      JSON.stringify(themeToDraft(themeQuery.data)) !== JSON.stringify(draft)
    );
  }, [themeQuery.data, draft]);

  if (authLoading || permissionsLoading) {
    return (
      <AdminLayout
        activeModule="settings"
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

  const state = draft ?? themeToDraft(themeQuery.data);

  return (
    <AdminLayout
      activeModule="settings"
      userName={user.name}
      onModuleChange={m => setLocation(getAdminModulePath(m))}
    >
      <PageHeader
        breadcrumbs={[{ label: "Admin" }, { label: "Theme" }]}
        title="Thème de la boutique"
        description="Couleurs, logo, favicon et bandeau d'annonce."
        actions={
          <Button
            onClick={() => draft && canWriteCms && saveMutation.mutate(draft)}
            disabled={!dirty || saveMutation.isPending || !canWriteCms}
            title={!canWriteCms ? "Lecture seule" : undefined}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Publier
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-base font-semibold">Couleurs</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <ColorField
                label="Accent principal (CTA)"
                value={state.brandAccent}
                onChange={v => setDraft({ ...state, brandAccent: v })}
              />
              <ColorField
                label="Accent — hover"
                value={state.brandAccentHover}
                onChange={v => setDraft({ ...state, brandAccentHover: v })}
              />
              <ColorField
                label="Texte principal"
                value={state.brandInk}
                onChange={v => setDraft({ ...state, brandInk: v })}
              />
              <ColorField
                label="Fond de page"
                value={state.brandBg}
                onChange={v => setDraft({ ...state, brandBg: v })}
              />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-base font-semibold">Identité visuelle</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Logo</Label>
                <ImagePickerField
                  value={state.logoUrl}
                  onChange={url => setDraft({ ...state, logoUrl: url })}
                  placeholder="https://…"
                  previewRatio="1/1"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Favicon</Label>
                <ImagePickerField
                  value={state.faviconUrl}
                  onChange={url => setDraft({ ...state, faviconUrl: url })}
                  placeholder="https://…/favicon.png"
                  previewRatio="1/1"
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Bandeau d'annonce</h2>
                <p className="text-xs text-muted-foreground">
                  Apparaît tout en haut du site.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={state.announcementEnabled}
                  onCheckedChange={checked =>
                    setDraft({ ...state, announcementEnabled: checked })
                  }
                />
                <span className="text-xs font-medium">
                  {state.announcementEnabled ? "Actif" : "Masqué"}
                </span>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Message</Label>
                <Input
                  value={state.announcementText}
                  placeholder="Livraison offerte dès 50 000 CFA"
                  onChange={e =>
                    setDraft({ ...state, announcementText: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Lien (optionnel)</Label>
                <Input
                  value={state.announcementHref}
                  placeholder="/boutique"
                  onChange={e =>
                    setDraft({ ...state, announcementHref: e.target.value })
                  }
                />
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Aperçu
            </p>
            <div
              className="mt-2 h-24 rounded-lg"
              style={{ backgroundColor: state.brandBg }}
            />
          </div>
          <div className="space-y-2">
            <button
              className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: state.brandAccent }}
            >
              Bouton principal
            </button>
            <p
              style={{ color: state.brandInk }}
              className="text-base font-semibold"
            >
              Texte principal — cohérence du thème
            </p>
          </div>
        </aside>
      </div>
    </AdminLayout>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value.startsWith("#") ? value : "#e3744e"}
          onChange={e => onChange(e.target.value)}
          className="h-10 w-12 rounded border border-border"
          aria-label={`${label} (sélecteur)`}
        />
        <Input value={value} onChange={e => onChange(e.target.value)} />
      </div>
    </div>
  );
}
