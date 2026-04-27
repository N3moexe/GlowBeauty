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
import { adminCms, ADMIN_INTEGRATIONS_QUERY_KEY } from "@/lib/adminCms";
import { STOREFRONT_INTEGRATIONS_QUERY_KEY } from "@/lib/storefrontCms";
import { trpc } from "@/lib/trpc";
import type { Integrations } from "@shared/storefront-cms";
import { defaultIntegrations } from "@shared/storefront-cms";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

type Draft = Omit<Integrations, "updatedAt">;

function toDraft(integrations: Integrations | undefined | null): Draft {
  const base = integrations ?? defaultIntegrations();
  return {
    metaPixelId: base.metaPixelId,
    ga4MeasurementId: base.ga4MeasurementId,
    brevoApiKey: base.brevoApiKey,
    whatsappNumber: base.whatsappNumber,
    tiktokPixelId: base.tiktokPixelId,
  };
}

export default function AdminIntegrations() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: permissions, isLoading: permissionsLoading } =
    trpc.rbac.me.useQuery(undefined, { enabled: !!user, retry: false });
  const canAccessSettings =
    permissions?.allowedModules.includes("settings") ?? false;
  const canAccessSettingsCap = Boolean(permissions?.canAccessSettings);
  const canWrite = canAccessSettingsCap && !permissions?.readOnly;

  const integrationsQuery = useQuery({
    queryKey: ADMIN_INTEGRATIONS_QUERY_KEY,
    queryFn: adminCms.getIntegrations,
    enabled: !!user && canAccessSettings,
  });

  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    if (integrationsQuery.data && !draft)
      setDraft(toDraft(integrationsQuery.data));
  }, [integrationsQuery.data, draft]);

  const saveMutation = useMutation({
    mutationFn: async (input: Draft) => adminCms.saveIntegrations(input),
    onSuccess: result => {
      queryClient.setQueryData(ADMIN_INTEGRATIONS_QUERY_KEY, result);
      queryClient.invalidateQueries({
        queryKey: STOREFRONT_INTEGRATIONS_QUERY_KEY,
      });
      setDraft(toDraft(result));
      toast.success("Intégrations enregistrées");
    },
    onError: error => {
      toast.error("Erreur", {
        description: error instanceof Error ? error.message : "Réessayez.",
      });
    },
  });

  const dirty = useMemo(() => {
    if (!integrationsQuery.data || !draft) return false;
    return (
      JSON.stringify(toDraft(integrationsQuery.data)) !== JSON.stringify(draft)
    );
  }, [integrationsQuery.data, draft]);

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
  if (!canAccessSettings) {
    return <AdminNotAllowed />;
  }

  const state = draft ?? toDraft(integrationsQuery.data);

  return (
    <AdminLayout
      activeModule="settings"
      userName={user.name}
      onModuleChange={m => setLocation(getAdminModulePath(m))}
    >
      <PageHeader
        breadcrumbs={[{ label: "Admin" }, { label: "Intégrations" }]}
        title="Intégrations marketing et analytics"
        description="IDs de tracking et clés API. Rien n'est actif tant que la valeur est vide."
        actions={
          <Button
            onClick={() => draft && canWrite && saveMutation.mutate(draft)}
            disabled={!dirty || saveMutation.isPending || !canWrite}
            title={!canWrite ? "Lecture seule" : undefined}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Enregistrer
          </Button>
        }
      />

      <div className="space-y-4">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-base font-semibold">Analytics & pixels</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Google Analytics 4 (measurement ID)</Label>
              <Input
                value={state.ga4MeasurementId}
                placeholder="G-XXXXXXX"
                onChange={e =>
                  setDraft({ ...state, ga4MeasurementId: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Meta Pixel ID</Label>
              <Input
                value={state.metaPixelId}
                placeholder="1234567890"
                onChange={e =>
                  setDraft({ ...state, metaPixelId: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>TikTok Pixel ID</Label>
              <Input
                value={state.tiktokPixelId}
                placeholder="C4XXX..."
                onChange={e =>
                  setDraft({ ...state, tiktokPixelId: e.target.value })
                }
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-base font-semibold">Communication</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Numéro WhatsApp</Label>
              <Input
                value={state.whatsappNumber}
                placeholder="+221788911010"
                onChange={e =>
                  setDraft({ ...state, whatsappNumber: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Utilisé par les boutons "Nous contacter" et le chatbot.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Brevo API key (email marketing)</Label>
              <Input
                type="password"
                value={state.brevoApiKey}
                placeholder="xkeysib-…"
                onChange={e =>
                  setDraft({ ...state, brevoApiKey: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Secret — ne sera pas affiché en clair côté client.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
