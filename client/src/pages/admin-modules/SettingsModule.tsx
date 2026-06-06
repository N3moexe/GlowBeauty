import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import EmptyState from "@/components/admin/EmptyState";
import { RetryPanel } from "@/pages/admin-modules/shared/RetryPanel";
import { getErrorMessage } from "@/pages/admin-modules/shared/utils";
import { Surface } from "@/components/admin/ui/Surface";
import { Heading } from "@/components/admin/ui/Heading";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type PaymentForm = {
  waveEnabled: boolean;
  orangeEnabled: boolean;
  freeMoneyEnabled: boolean;
  cardEnabled: boolean;
};

interface SettingsModuleProps {
  canAccessSettings: boolean;
}

export function SettingsModule({ canAccessSettings }: SettingsModuleProps) {
  const utils = trpc.useUtils();

  const [form, setForm] = useState<PaymentForm>({
    waveEnabled: true,
    orangeEnabled: true,
    freeMoneyEnabled: true,
    cardEnabled: false,
  });
  const [saving, setSaving] = useState(false);

  const paymentSettingsQuery = trpc.settings.list.useQuery(
    { prefix: "payments." },
    { enabled: canAccessSettings, retry: 1, refetchOnWindowFocus: true }
  );

  const storefrontQuery = trpc.settings.storefront.useQuery(undefined, {
    enabled: canAccessSettings,
    retry: 1,
  });

  const settingsSetMutation = trpc.settings.set.useMutation({
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    const map = new Map<string, string>();
    (
      (paymentSettingsQuery.data ?? []) as Array<{ key: string; value: string }>
    ).forEach(entry => map.set(entry.key, entry.value ?? ""));
    setForm({
      waveEnabled:
        (map.get("payments.waveEnabled") || "true").toLowerCase() === "true",
      orangeEnabled:
        (map.get("payments.orangeEnabled") || "true").toLowerCase() === "true",
      freeMoneyEnabled:
        (map.get("payments.freeMoneyEnabled") || "true").toLowerCase() ===
        "true",
      cardEnabled:
        (map.get("payments.cardEnabled") || "false").toLowerCase() === "true",
    });
  }, [paymentSettingsQuery.data]);

  const errorMessage =
    paymentSettingsQuery.error || storefrontQuery.error
      ? getErrorMessage(
          paymentSettingsQuery.error || storefrontQuery.error,
          "Impossible de charger les paramètres de paiement."
        )
      : null;

  const saveSettings = useCallback(async () => {
    if (!canAccessSettings) {
      toast.error("Accès aux paramètres non autorisé");
      return;
    }
    setSaving(true);
    try {
      await Promise.all(
        [
          { key: "payments.waveEnabled", value: String(form.waveEnabled) },
          { key: "payments.orangeEnabled", value: String(form.orangeEnabled) },
          {
            key: "payments.freeMoneyEnabled",
            value: String(form.freeMoneyEnabled),
          },
          { key: "payments.cardEnabled", value: String(form.cardEnabled) },
        ].map(entry => settingsSetMutation.mutateAsync(entry))
      );
      await Promise.all([
        utils.settings.storefront.invalidate(),
        utils.settings.list.invalidate(),
      ]);
      toast.success("Moyens de paiement mis à jour");
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Échec de l'enregistrement des paramètres")
      );
    } finally {
      setSaving(false);
    }
  }, [
    canAccessSettings,
    form,
    settingsSetMutation,
    utils.settings.list,
    utils.settings.storefront,
  ]);

  if (!canAccessSettings) {
    return (
      <EmptyState
        title="Accès refusé"
        description="Seuls les administrateurs peuvent modifier les paramètres de paiement."
      />
    );
  }

  if (errorMessage) {
    return (
      <RetryPanel
        title="Paramètres indisponibles"
        description={errorMessage}
        onRetry={() => {
          void Promise.all([
            paymentSettingsQuery.refetch(),
            storefrontQuery.refetch(),
          ]);
        }}
      />
    );
  }

  const PAYMENT_METHODS: Array<{
    key: keyof PaymentForm;
    label: string;
    description: string;
  }> = [
    {
      key: "waveEnabled",
      label: "Wave",
      description: "Paiement mobile via Wave.",
    },
    {
      key: "orangeEnabled",
      label: "Orange Money",
      description: "Paiement mobile via Orange.",
    },
    {
      key: "freeMoneyEnabled",
      label: "Free Money",
      description: "Paiement mobile via Free Money.",
    },
    {
      key: "cardEnabled",
      label: "Paiement par carte",
      description: "Paiement par Visa et Mastercard.",
    },
  ];

  const activeMethodLabels = [
    form.waveEnabled ? "Wave" : null,
    form.orangeEnabled ? "Orange Money" : null,
    form.freeMoneyEnabled ? "Free Money" : null,
    form.cardEnabled ? "Carte" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-4">
      <Surface className="p-4 md:p-5">
        <div className="mb-4 flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-[var(--admin-muted)]" />
          <Heading level={3}>Moyens de paiement</Heading>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="ml-auto h-9 w-9 border-[var(--admin-border)]"
            title="Rafraîchir"
            onClick={() => {
              void Promise.all([
                paymentSettingsQuery.refetch(),
                storefrontQuery.refetch(),
              ]);
            }}
            disabled={paymentSettingsQuery.isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 ${paymentSettingsQuery.isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {PAYMENT_METHODS.map(method => (
            <div
              key={method.key}
              className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-tint)] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--admin-ink)]">
                    {method.label}
                  </p>
                  <p className="text-xs text-[var(--admin-muted)]">
                    {method.description}
                  </p>
                </div>
                <Switch
                  checked={form[method.key]}
                  onCheckedChange={checked =>
                    setForm(prev => ({
                      ...prev,
                      [method.key]: Boolean(checked),
                    }))
                  }
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-tint)] p-3 text-xs text-[var(--admin-muted)]">
          <p className="font-medium text-[var(--admin-ink)]">
            Aperçu du paiement
          </p>
          <p className="mt-1">Moyens actifs : {activeMethodLabels || "Aucun"}</p>
          <p className="mt-1">
            Texte boutique : {storefrontQuery.data?.paymentMethodsText || "—"}
          </p>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            onClick={() => void saveSettings()}
            disabled={!canAccessSettings || saving}
            className="bg-[var(--admin-accent)] text-white hover:bg-[var(--admin-accent-hover)]"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Enregistrer
          </Button>
        </div>
      </Surface>
    </div>
  );
}
