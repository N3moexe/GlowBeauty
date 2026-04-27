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
import { adminCms, ADMIN_EMAIL_TEMPLATES_QUERY_KEY } from "@/lib/adminCms";
import { trpc } from "@/lib/trpc";
import type { EmailTemplate, EmailTemplateKey } from "@shared/storefront-cms";
import { toast } from "sonner";
import { Loader2, Save, Send } from "lucide-react";

const TEMPLATE_LABELS: Record<EmailTemplateKey, string> = {
  order_confirmation: "Confirmation de commande",
  order_status_update: "Mise à jour du statut",
  admin_notification: "Notification admin",
};

const VARIABLE_HINTS: Record<EmailTemplateKey, string[]> = {
  order_confirmation: [
    "{{orderNumber}}",
    "{{customerName}}",
    "{{customerPhone}}",
    "{{totalAmount}}",
    "{{paymentMethod}}",
    "{{trackingUrl}}",
  ],
  order_status_update: [
    "{{orderNumber}}",
    "{{customerName}}",
    "{{status}}",
    "{{statusLabel}}",
    "{{totalAmount}}",
  ],
  admin_notification: [
    "{{orderNumber}}",
    "{{customerName}}",
    "{{customerPhone}}",
    "{{totalAmount}}",
    "{{itemCount}}",
    "{{paymentMethod}}",
  ],
};

type DraftMap = Map<EmailTemplateKey, { subject: string; body: string }>;

export default function AdminEmailTemplates() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: permissions, isLoading: permissionsLoading } =
    trpc.rbac.me.useQuery(undefined, { enabled: !!user, retry: false });
  const canAccessCms = permissions?.allowedModules.includes("cms") ?? false;
  const canWriteCms = Boolean(permissions?.canWriteCms);

  const templatesQuery = useQuery({
    queryKey: ADMIN_EMAIL_TEMPLATES_QUERY_KEY,
    queryFn: adminCms.listEmailTemplates,
    enabled: !!user && canAccessCms,
  });

  const [selected, setSelected] =
    useState<EmailTemplateKey>("order_confirmation");
  const [drafts, setDrafts] = useState<DraftMap>(new Map());

  useEffect(() => {
    if (!templatesQuery.data) return;
    const next: DraftMap = new Map();
    for (const template of templatesQuery.data) {
      next.set(template.key, {
        subject: template.subject,
        body: template.body,
      });
    }
    setDrafts(next);
  }, [templatesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (input: {
      key: EmailTemplateKey;
      subject: string;
      body: string;
    }) =>
      adminCms.updateEmailTemplate(input.key, {
        subject: input.subject,
        body: input.body,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ADMIN_EMAIL_TEMPLATES_QUERY_KEY,
      });
      toast.success("Template enregistré");
    },
    onError: error => {
      toast.error("Erreur", {
        description: error instanceof Error ? error.message : "Réessayez.",
      });
    },
  });

  const [testRecipient, setTestRecipient] = useState("");
  const testSendMutation = useMutation({
    mutationFn: async (input: { key: EmailTemplateKey; recipient: string }) =>
      adminCms.testSendEmailTemplate(input.key, input.recipient),
    onSuccess: result => {
      toast.success(
        result?.mode === "dev-outbox"
          ? `Aperçu écrit dans .dev-emails (${result.recipient})`
          : `Aperçu envoyé à ${result?.recipient ?? testRecipient}`
      );
    },
    onError: error => {
      toast.error("Envoi impossible", {
        description: error instanceof Error ? error.message : "Réessayez.",
      });
    },
  });

  const currentDraft = drafts.get(selected);
  const originalTemplate = useMemo<EmailTemplate | undefined>(
    () => templatesQuery.data?.find(t => t.key === selected),
    [templatesQuery.data, selected]
  );
  const dirty =
    !!currentDraft &&
    !!originalTemplate &&
    (currentDraft.subject !== originalTemplate.subject ||
      currentDraft.body !== originalTemplate.body);

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

  const updateDraft = (patch: Partial<{ subject: string; body: string }>) => {
    const next = new Map(drafts);
    const current = next.get(selected) ?? { subject: "", body: "" };
    next.set(selected, { ...current, ...patch });
    setDrafts(next);
  };

  return (
    <AdminLayout
      activeModule="settings"
      userName={user.name}
      onModuleChange={m => setLocation(getAdminModulePath(m))}
    >
      <PageHeader
        breadcrumbs={[{ label: "Admin" }, { label: "Email templates" }]}
        title="Modèles d'emails transactionnels"
        description="Confirmation de commande, mises à jour de statut, notifications équipe."
        actions={
          <Button
            onClick={() => {
              if (!currentDraft || !canWriteCms) return;
              saveMutation.mutate({ key: selected, ...currentDraft });
            }}
            disabled={!dirty || saveMutation.isPending || !canWriteCms}
            title={!canWriteCms ? "Lecture seule" : undefined}
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

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <div className="space-y-2">
          {(Object.keys(TEMPLATE_LABELS) as EmailTemplateKey[]).map(key => {
            const active = key === selected;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                  active
                    ? "border-brand-accent bg-brand-accent/5 font-semibold text-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-brand-accent/40"
                }`}
              >
                {TEMPLATE_LABELS[key]}
              </button>
            );
          })}
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="space-y-1.5">
            <Label>Sujet</Label>
            <Input
              value={currentDraft?.subject ?? ""}
              onChange={e => updateDraft({ subject: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Corps du message</Label>
            <Textarea
              value={currentDraft?.body ?? ""}
              rows={18}
              className="font-mono text-sm"
              onChange={e => updateDraft({ body: e.target.value })}
            />
          </div>

          <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            <p className="mb-1 font-semibold text-foreground">
              Variables disponibles :
            </p>
            <div className="flex flex-wrap gap-1">
              {VARIABLE_HINTS[selected].map(v => (
                <code
                  key={v}
                  className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]"
                >
                  {v}
                </code>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-semibold text-foreground">
              Envoyer un aperçu
            </p>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Enregistrez d'abord, puis envoyez-vous le modèle actuel avec des
              valeurs de test.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="email"
                placeholder="votre@email.com"
                value={testRecipient}
                onChange={e => setTestRecipient(e.target.value)}
                className="h-9 max-w-[260px] flex-1"
              />
              <Button
                type="button"
                variant="outline"
                disabled={
                  !canWriteCms ||
                  testSendMutation.isPending ||
                  !testRecipient.trim()
                }
                onClick={() => {
                  if (!canWriteCms || !testRecipient.trim()) return;
                  testSendMutation.mutate({
                    key: selected,
                    recipient: testRecipient.trim(),
                  });
                }}
                title={!canWriteCms ? "Lecture seule" : undefined}
              >
                {testSendMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1.5 h-4 w-4" />
                )}
                Envoyer un test
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
