import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import EmptyState from "@/components/admin/EmptyState";
import { RetryPanel } from "@/pages/admin-modules/shared/RetryPanel";
import { getErrorMessage } from "@/pages/admin-modules/shared/utils";
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
          "Unable to load payment settings."
        )
      : null;

  const saveSettings = useCallback(async () => {
    if (!canAccessSettings) {
      toast.error("Settings access is not allowed");
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
      toast.success("Payment methods updated");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save payment settings"));
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
        title="Access denied"
        description="Only admin users can update payment settings."
      />
    );
  }

  if (errorMessage) {
    return (
      <RetryPanel
        title="Settings unavailable"
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
      description: "Mobile checkout with Wave.",
    },
    {
      key: "orangeEnabled",
      label: "Orange Money",
      description: "Mobile checkout with Orange.",
    },
    {
      key: "freeMoneyEnabled",
      label: "Free Money",
      description: "Mobile checkout with Free Money.",
    },
    {
      key: "cardEnabled",
      label: "Card payment",
      description: "Visa and Mastercard checkout option.",
    },
  ];

  const activeMethodLabels = [
    form.waveEnabled ? "Wave" : null,
    form.orangeEnabled ? "Orange Money" : null,
    form.freeMoneyEnabled ? "Free Money" : null,
    form.cardEnabled ? "Card" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-white/92 p-4 shadow-sm md:p-5">
        <div className="mb-4 flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Payment methods</h3>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {PAYMENT_METHODS.map(method => (
            <div
              key={method.key}
              className="rounded-xl border border-border/70 bg-white/80 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{method.label}</p>
                  <p className="text-xs text-muted-foreground">
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

        <div className="mt-4 rounded-xl border border-border/70 bg-white/80 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Checkout preview</p>
          <p className="mt-1">Active methods: {activeMethodLabels || "None"}</p>
          <p className="mt-1">
            Storefront text: {storefrontQuery.data?.paymentMethodsText || "-"}
          </p>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            onClick={() => void saveSettings()}
            disabled={!canAccessSettings || saving}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save settings
          </Button>
        </div>
      </div>
    </div>
  );
}
