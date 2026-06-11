import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  AdminChatbotSettingsUpdate,
  AdminUser,
  AdminUserCreate,
  AdminUserRole,
  AuditLogItem,
  SettingsPayments,
  SettingsStore,
  ShippingRate,
  ShippingZone,
} from "@shared/admin-settings";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  createAdminUser,
  createShippingRate,
  createShippingZone,
  fetchAdminChatbotSettings,
  deleteShippingRate,
  deleteShippingZone,
  fetchAdminPaymentSettings,
  fetchAdminStoreSettings,
  fetchAdminUsers,
  fetchAuditLogs,
  fetchShippingZones,
  resetAdminUserPassword,
  type ShippingZoneWithRates,
  updateAdminPaymentSettings,
  updateAdminChatbotSettings,
  updateAdminStoreSettings,
  updateAdminUser,
  updateShippingRate,
  updateShippingZone,
  updateStorefrontTexts,
} from "@/lib/adminSettings";
import { ImageUpload } from "@/components/ImageUpload";
import AdminLayout from "@/components/admin/AdminLayout";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import AdminNotAllowed from "@/pages/AdminNotAllowed";
import type { AdminModuleKey } from "@/components/admin/SidebarNav";
import { getAdminModulePath } from "@/lib/adminNavigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const sections = [
  "overview",
  "store",
  "payments",
  "chatbot",
  "shipping",
  "users",
  "audit-logs",
] as const;

type SettingsSection = (typeof sections)[number];

const sectionLabels: Record<SettingsSection, string> = {
  overview: "Aperçu",
  store: "Boutique",
  payments: "Paiements",
  chatbot: "Chatbot",
  shipping: "Livraison",
  users: "Utilisateurs",
  "audit-logs": "Journaux d'audit",
};

function parseSection(section: string | undefined): SettingsSection {
  if (section && sections.includes(section as SettingsSection))
    return section as SettingsSection;
  return "overview";
}

const defaultStoreForm: SettingsStore = {
  name: "",
  logoUrl: "",
  phone: "",
  email: "",
  address: "",
  currency: "CFA",
  socials: {},
};

const defaultPaymentsForm: SettingsPayments = {
  waveEnabled: true,
  omEnabled: true,
  cardEnabled: false,
  waveKey: "",
  omKey: "",
  cardPublicKey: "",
  cardSecretKey: "",
};

const defaultChatbotForm: AdminChatbotSettingsUpdate = {
  greeting:
    "Bienvenue chez GlowBeauty. Je suis votre concierge skincare premium.",
  tone: "Luxury skincare",
  whatsappNumber: "+221788911010",
  policies: {
    return: "Retours acceptes selon etat du produit sous validation support.",
    delivery: "Livraison a Dakar et regions selon zone et delai.",
    payment:
      "Paiement Wave, Orange Money, Free Money, carte selon disponibilite.",
  },
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("fr-FR");
}

function roleBadge(role: AdminUserRole) {
  if (role === "admin") return "bg-rose-500 text-white";
  if (role === "manager") return "bg-emerald-600 text-white";
  return "bg-slate-200 text-slate-800";
}

const roleLabels: Record<AdminUserRole, string> = {
  admin: "Administrateur",
  manager: "Gestionnaire",
  editor: "Éditeur",
};

function SectionLoading() {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-3/4" />
    </div>
  );
}

function SectionError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <p className="text-sm text-red-500">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Réessayer
      </Button>
    </div>
  );
}

export default function AdminSettings() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ section?: string }>();
  const activeSection = parseSection(params.section);
  const queryClient = useQueryClient();
  const trpcUtils = trpc.useUtils();

  const {
    data: permissions,
    isLoading: permissionsLoading,
    error: permissionsError,
  } = trpc.rbac.me.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  const canAccessSettings = Boolean(permissions?.canAccessSettings);
  const readOnly = Boolean(permissions?.readOnly);

  const storeQuery = useQuery({
    queryKey: ["admin-settings", "store"],
    queryFn: fetchAdminStoreSettings,
    enabled: canAccessSettings && activeSection === "store",
  });

  const paymentsQuery = useQuery({
    queryKey: ["admin-settings", "payments"],
    queryFn: fetchAdminPaymentSettings,
    enabled: canAccessSettings && activeSection === "payments",
  });

  const shippingQuery = useQuery({
    queryKey: ["admin-settings", "shipping", "zones"],
    queryFn: fetchShippingZones,
    enabled: canAccessSettings && activeSection === "shipping",
  });

  const chatbotQuery = useQuery({
    queryKey: ["admin-settings", "chatbot"],
    queryFn: fetchAdminChatbotSettings,
    enabled: canAccessSettings && activeSection === "chatbot",
  });

  const usersQuery = useQuery({
    queryKey: ["admin-settings", "users"],
    queryFn: fetchAdminUsers,
    enabled: canAccessSettings && activeSection === "users",
  });

  const [auditCursor, setAuditCursor] = useState<number | undefined>(undefined);
  const [auditCursorHistory, setAuditCursorHistory] = useState<number[]>([]);
  const [auditActionFilter, setAuditActionFilter] = useState("");
  const [auditEntityFilter, setAuditEntityFilter] = useState("");
  const auditQuery = useQuery({
    queryKey: [
      "admin-settings",
      "audit",
      auditCursor,
      auditActionFilter,
      auditEntityFilter,
    ],
    queryFn: () =>
      fetchAuditLogs({
        limit: 50,
        cursor: auditCursor,
        action: auditActionFilter || undefined,
        entityType: auditEntityFilter || undefined,
      }),
    enabled: canAccessSettings && activeSection === "audit-logs",
  });

  const [storeForm, setStoreForm] = useState<SettingsStore>(defaultStoreForm);
  const [textsForm, setTextsForm] = useState({
    storeTagline: "",
    deliveryText: "",
    paymentMethodsText: "",
  });
  const storefrontTextsQuery = trpc.settings.storefront.useQuery(undefined, {
    enabled: canAccessSettings && activeSection === "store",
  });
  const [paymentsForm, setPaymentsForm] =
    useState<SettingsPayments>(defaultPaymentsForm);
  const [chatbotForm, setChatbotForm] =
    useState<AdminChatbotSettingsUpdate>(defaultChatbotForm);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [editingZone, setEditingZone] = useState<ShippingZone | null>(null);
  const [editingRate, setEditingRate] = useState<ShippingRate | null>(null);
  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [auditDetails, setAuditDetails] = useState<AuditLogItem | null>(null);
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);

  const [zoneForm, setZoneForm] = useState({
    name: "",
    slug: "",
    description: "",
    deliveryFee: 0,
    deliveryDays: 2,
    isActive: true,
    displayOrder: 0,
  });
  const [rateForm, setRateForm] = useState({
    zoneId: 0,
    label: "",
    minAmountCfa: 0,
    maxAmountCfa: "",
    feeCfa: 0,
    etaMinHours: 24,
    etaMaxHours: 72,
    isActive: true,
  });
  const [createUserForm, setCreateUserForm] = useState<AdminUserCreate>({
    name: "",
    email: "",
    phone: "",
    username: "",
    password: "",
    inviteOnly: false,
    role: "editor",
    isActive: true,
  });

  useEffect(() => {
    if (storeQuery.data) setStoreForm(storeQuery.data);
  }, [storeQuery.data]);

  useEffect(() => {
    if (!storefrontTextsQuery.data) return;
    setTextsForm({
      storeTagline: storefrontTextsQuery.data.storeTagline || "",
      deliveryText: storefrontTextsQuery.data.deliveryText || "",
      paymentMethodsText: storefrontTextsQuery.data.paymentMethodsText || "",
    });
  }, [storefrontTextsQuery.data]);

  useEffect(() => {
    if (paymentsQuery.data) setPaymentsForm(paymentsQuery.data);
  }, [paymentsQuery.data]);

  useEffect(() => {
    if (!chatbotQuery.data) return;
    setChatbotForm({
      greeting: chatbotQuery.data.greeting,
      tone: chatbotQuery.data.tone,
      whatsappNumber: chatbotQuery.data.whatsappNumber,
      policies: chatbotQuery.data.policies,
    });
  }, [chatbotQuery.data]);

  useEffect(() => {
    if (!shippingQuery.data?.length) {
      setSelectedZoneId(null);
      return;
    }
    if (
      !selectedZoneId ||
      !shippingQuery.data.some(zone => zone.id === selectedZoneId)
    ) {
      setSelectedZoneId(shippingQuery.data[0].id);
    }
  }, [shippingQuery.data, selectedZoneId]);

  const selectedZone = useMemo(() => {
    if (!shippingQuery.data || !selectedZoneId) return null;
    return shippingQuery.data.find(zone => zone.id === selectedZoneId) || null;
  }, [shippingQuery.data, selectedZoneId]);

  const saveStoreMutation = useMutation({
    mutationFn: async () => {
      await updateAdminStoreSettings(storeForm);
      // Storefront display texts live in the key/value settings store and are
      // saved through the legacy mapped endpoint. Empty strings are skipped so
      // we never wipe a value with a blank (the API requires min length).
      const texts: Record<string, string> = {};
      if (textsForm.storeTagline.trim())
        texts.storeTagline = textsForm.storeTagline.trim();
      if (textsForm.deliveryText.trim())
        texts.deliveryText = textsForm.deliveryText.trim();
      if (textsForm.paymentMethodsText.trim())
        texts.paymentMethodsText = textsForm.paymentMethodsText.trim();
      if (Object.keys(texts).length > 0) {
        await updateStorefrontTexts(texts);
      }
    },
    onSuccess: async () => {
      toast.success("Paramètres de la boutique enregistrés");
      await queryClient.invalidateQueries({
        queryKey: ["admin-settings", "store"],
      });
      await trpcUtils.settings.list.invalidate();
      await trpcUtils.settings.storefront.invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const savePaymentsMutation = useMutation({
    mutationFn: () => updateAdminPaymentSettings(paymentsForm),
    onSuccess: async () => {
      toast.success("Paramètres de paiement enregistrés");
      await queryClient.invalidateQueries({
        queryKey: ["admin-settings", "payments"],
      });
      await trpcUtils.settings.list.invalidate();
      await trpcUtils.settings.storefront.invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveChatbotMutation = useMutation({
    mutationFn: () => updateAdminChatbotSettings(chatbotForm),
    onSuccess: async () => {
      toast.success("Paramètres du chatbot enregistrés");
      await queryClient.invalidateQueries({
        queryKey: ["admin-settings", "chatbot"],
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createZoneMutation = useMutation({
    mutationFn: createShippingZone,
    onSuccess: async () => {
      toast.success("Zone de livraison créée");
      setZoneDialogOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["admin-settings", "shipping"],
      });
      await trpcUtils.deliveryZone.list.invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateZoneMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Parameters<typeof updateShippingZone>[1];
    }) => updateShippingZone(id, payload),
    onSuccess: async () => {
      toast.success("Zone de livraison mise à jour");
      setZoneDialogOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["admin-settings", "shipping"],
      });
      await trpcUtils.deliveryZone.list.invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteZoneMutation = useMutation({
    mutationFn: deleteShippingZone,
    onSuccess: async () => {
      toast.success("Zone de livraison supprimée");
      await queryClient.invalidateQueries({
        queryKey: ["admin-settings", "shipping"],
      });
      await trpcUtils.deliveryZone.list.invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createRateMutation = useMutation({
    mutationFn: createShippingRate,
    onSuccess: async () => {
      toast.success("Tarif de livraison créé");
      setRateDialogOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["admin-settings", "shipping"],
      });
      await trpcUtils.deliveryZone.list.invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateRateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Parameters<typeof updateShippingRate>[1];
    }) => updateShippingRate(id, payload),
    onSuccess: async () => {
      toast.success("Tarif de livraison mis à jour");
      setRateDialogOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["admin-settings", "shipping"],
      });
      await trpcUtils.deliveryZone.list.invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteRateMutation = useMutation({
    mutationFn: deleteShippingRate,
    onSuccess: async () => {
      toast.success("Tarif de livraison supprimé");
      await queryClient.invalidateQueries({
        queryKey: ["admin-settings", "shipping"],
      });
      await trpcUtils.deliveryZone.list.invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createUserMutation = useMutation({
    mutationFn: createAdminUser,
    onSuccess: async result => {
      if (result.inviteCreated && result.tempPassword) {
        toast.success("Invitation créée", {
          description: `Mot de passe temporaire : ${result.tempPassword}`,
        });
      } else {
        toast.success("Utilisateur créé");
      }
      setCreateUserDialogOpen(false);
      setCreateUserForm({
        name: "",
        email: "",
        phone: "",
        username: "",
        password: "",
        inviteOnly: false,
        role: "editor",
        isActive: true,
      });
      await queryClient.invalidateQueries({
        queryKey: ["admin-settings", "users"],
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Parameters<typeof updateAdminUser>[1];
    }) => updateAdminUser(id, payload),
    onSuccess: async () => {
      toast.success("Utilisateur mis à jour");
      await queryClient.invalidateQueries({
        queryKey: ["admin-settings", "users"],
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id }: { id: number }) => resetAdminUserPassword(id),
    onSuccess: async result => {
      toast.success("Mot de passe réinitialisé", {
        description: `Mot de passe temporaire : ${result.tempPassword}`,
      });
      await queryClient.invalidateQueries({
        queryKey: ["admin-settings", "users"],
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const applyAuditFilters = () => {
    setAuditCursor(undefined);
    setAuditCursorHistory([]);
    void auditQuery.refetch();
  };

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

  if (permissionsError || !permissions || !permissions.canAccessSettings) {
    return <AdminNotAllowed />;
  }

  const onModuleChange = (module: AdminModuleKey) => {
    setLocation(getAdminModulePath(module));
  };

  const openCreateZoneDialog = () => {
    setEditingZone(null);
    setZoneForm({
      name: "",
      slug: "",
      description: "",
      deliveryFee: 0,
      deliveryDays: 2,
      isActive: true,
      displayOrder: shippingQuery.data?.length || 0,
    });
    setZoneDialogOpen(true);
  };

  const openEditZoneDialog = (zone: ShippingZone) => {
    setEditingZone(zone);
    setZoneForm({
      name: zone.name,
      slug: zone.slug,
      description: zone.description || "",
      deliveryFee: zone.deliveryFee,
      deliveryDays: zone.deliveryDays,
      isActive: zone.isActive,
      displayOrder: zone.displayOrder,
    });
    setZoneDialogOpen(true);
  };

  const submitZone = () => {
    if (!zoneForm.name.trim()) {
      toast.error("Le nom de la zone est requis");
      return;
    }
    if (editingZone) {
      updateZoneMutation.mutate({
        id: editingZone.id,
        payload: {
          name: zoneForm.name,
          slug: zoneForm.slug || undefined,
          description: zoneForm.description || undefined,
          deliveryFee: Number(zoneForm.deliveryFee || 0),
          deliveryDays: Number(zoneForm.deliveryDays || 0),
          isActive: zoneForm.isActive,
          displayOrder: Number(zoneForm.displayOrder || 0),
        },
      });
      return;
    }
    createZoneMutation.mutate({
      name: zoneForm.name,
      slug: zoneForm.slug || undefined,
      description: zoneForm.description || undefined,
      deliveryFee: Number(zoneForm.deliveryFee || 0),
      deliveryDays: Number(zoneForm.deliveryDays || 0),
      isActive: zoneForm.isActive,
      displayOrder: Number(zoneForm.displayOrder || 0),
    });
  };

  const openCreateRateDialog = () => {
    if (!selectedZone) {
      toast.error("Sélectionnez d'abord une zone");
      return;
    }
    setEditingRate(null);
    setRateForm({
      zoneId: selectedZone.id,
      label: "",
      minAmountCfa: 0,
      maxAmountCfa: "",
      feeCfa: selectedZone.deliveryFee,
      etaMinHours: Math.max(12, selectedZone.deliveryDays * 24),
      etaMaxHours: Math.max(24, selectedZone.deliveryDays * 24 + 24),
      isActive: true,
    });
    setRateDialogOpen(true);
  };

  const openEditRateDialog = (rate: ShippingRate) => {
    setEditingRate(rate);
    setRateForm({
      zoneId: rate.zoneId,
      label: rate.label,
      minAmountCfa: rate.minAmountCfa,
      maxAmountCfa: rate.maxAmountCfa == null ? "" : String(rate.maxAmountCfa),
      feeCfa: rate.feeCfa,
      etaMinHours: rate.etaMinHours,
      etaMaxHours: rate.etaMaxHours,
      isActive: rate.isActive,
    });
    setRateDialogOpen(true);
  };

  const submitRate = () => {
    if (!rateForm.label.trim()) {
      toast.error("Le libellé du tarif est requis");
      return;
    }
    const maxAmount =
      rateForm.maxAmountCfa === "" ? null : Number(rateForm.maxAmountCfa);
    if (maxAmount != null && maxAmount < Number(rateForm.minAmountCfa)) {
      toast.error(
        "Le montant maximum doit être supérieur ou égal au montant minimum"
      );
      return;
    }
    if (editingRate) {
      updateRateMutation.mutate({
        id: editingRate.id,
        payload: {
          label: rateForm.label,
          minAmountCfa: Number(rateForm.minAmountCfa),
          maxAmountCfa: maxAmount,
          feeCfa: Number(rateForm.feeCfa),
          etaMinHours: Number(rateForm.etaMinHours),
          etaMaxHours: Number(rateForm.etaMaxHours),
          isActive: rateForm.isActive,
        },
      });
      return;
    }
    createRateMutation.mutate({
      zoneId: Number(rateForm.zoneId),
      label: rateForm.label,
      minAmountCfa: Number(rateForm.minAmountCfa),
      maxAmountCfa: maxAmount,
      feeCfa: Number(rateForm.feeCfa),
      etaMinHours: Number(rateForm.etaMinHours),
      etaMaxHours: Number(rateForm.etaMaxHours),
      isActive: rateForm.isActive,
    });
  };

  const sectionNav = (
    <div className="flex flex-wrap gap-2">
      {sections.map(section => (
        <Button
          key={section}
          type="button"
          size="sm"
          variant={section === activeSection ? "default" : "outline"}
          onClick={() =>
            setLocation(
              section === "overview"
                ? "/admin/settings"
                : `/admin/settings/${section}`
            )
          }
          className={
            section === activeSection
              ? "bg-crimson text-white hover:bg-crimson-light"
              : ""
          }
        >
          {sectionLabels[section]}
        </Button>
      ))}
    </div>
  );

  return (
    <AdminLayout
      activeModule="settings"
      onModuleChange={onModuleChange}
      userName={user.name}
      allowedModules={permissions.allowedModules as AdminModuleKey[]}
      onQuickAction={
        permissions.readOnly
          ? undefined
          : action => {
              if (
                action === "add_product" &&
                permissions.allowedModules.includes("products")
              )
                setLocation("/admin/products");
              if (
                action === "create_coupon" &&
                permissions.allowedModules.includes("coupons")
              )
                setLocation("/admin/coupons");
            }
      }
    >
      <div className="space-y-4">
        <PageHeader
          title="Paramètres"
          description="Boutique, paiements, zones/tarifs de livraison, utilisateurs et journaux d'audit."
          breadcrumbs={[{ label: "Admin" }, { label: "Paramètres" }]}
          actions={
            activeSection !== "overview" ? (
              <Link href="/admin/settings">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Aperçu
                </Button>
              </Link>
            ) : undefined
          }
        />

        {sectionNav}

        {activeSection === "overview" && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[
              {
                title: "Boutique",
                desc: "Nom de la marque, contacts, devise",
                href: "/admin/settings/store",
              },
              {
                title: "Paiements",
                desc: "Wave, Orange Money, Carte",
                href: "/admin/settings/payments",
              },
              {
                title: "Chatbot",
                desc: "Message d'accueil du concierge, ton, WhatsApp, politiques",
                href: "/admin/settings/chatbot",
              },
              {
                title: "Livraison",
                desc: "Zones et tarifs dynamiques",
                href: "/admin/settings/shipping",
              },
              {
                title: "Utilisateurs",
                desc: "Rôles, statut actif, réinitialisation du mot de passe",
                href: "/admin/settings/users",
              },
              {
                title: "Journaux d'audit",
                desc: "Historique d'activité de l'administration",
                href: "/admin/settings/audit-logs",
              },
            ].map(item => (
              <button
                key={item.title}
                type="button"
                className="rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/20"
                onClick={() => setLocation(item.href)}
              >
                <p className="font-semibold">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.desc}
                </p>
              </button>
            ))}
          </div>
        )}

        {activeSection === "store" && (
          <div className="rounded-xl border bg-card p-4 space-y-4">
            {storeQuery.isLoading ? (
              <SectionLoading />
            ) : storeQuery.error ? (
              <SectionError
                message={(storeQuery.error as Error).message}
                onRetry={() => void storeQuery.refetch()}
              />
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Nom de la boutique</Label>
                    <Input
                      value={storeForm.name}
                      onChange={event =>
                        setStoreForm(prev => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Logo</Label>
                    {storeForm.logoUrl ? (
                      <div className="flex items-center gap-3 rounded-md border border-border/70 bg-muted/30 p-2">
                        <img
                          src={storeForm.logoUrl}
                          alt="Logo actuel"
                          className="h-12 w-12 rounded object-contain bg-white"
                        />
                        <span className="flex-1 truncate text-xs text-muted-foreground">
                          {storeForm.logoUrl}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setStoreForm(prev => ({ ...prev, logoUrl: "" }))
                          }
                          disabled={readOnly}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null}
                    <ImageUpload
                      onImageUploaded={url =>
                        setStoreForm(prev => ({ ...prev, logoUrl: url }))
                      }
                      maxSizeMB={2}
                    />
                    <Input
                      value={storeForm.logoUrl}
                      onChange={event =>
                        setStoreForm(prev => ({
                          ...prev,
                          logoUrl: event.target.value,
                        }))
                      }
                      placeholder="… ou collez une URL d'image"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Téléphone</Label>
                    <Input
                      value={storeForm.phone}
                      onChange={event =>
                        setStoreForm(prev => ({
                          ...prev,
                          phone: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>E-mail</Label>
                    <Input
                      value={storeForm.email}
                      onChange={event =>
                        setStoreForm(prev => ({
                          ...prev,
                          email: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Adresse</Label>
                    <Input
                      value={storeForm.address}
                      onChange={event =>
                        setStoreForm(prev => ({
                          ...prev,
                          address: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Devise</Label>
                    <Input
                      value={storeForm.currency}
                      onChange={event =>
                        setStoreForm(prev => ({
                          ...prev,
                          currency: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Slogan (sous le nom, en-tête du site)</Label>
                    <Input
                      value={textsForm.storeTagline}
                      onChange={event =>
                        setTextsForm(prev => ({
                          ...prev,
                          storeTagline: event.target.value,
                        }))
                      }
                      placeholder="Premium deals et essentials"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Texte livraison (bandeau haut + pied de page)</Label>
                    <Input
                      value={textsForm.deliveryText}
                      onChange={event =>
                        setTextsForm(prev => ({
                          ...prev,
                          deliveryText: event.target.value,
                        }))
                      }
                      placeholder="Expedition a Dakar et regions en 24h/72h."
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Moyens de paiement affichés (pied de page)</Label>
                  <Input
                    value={textsForm.paymentMethodsText}
                    onChange={event =>
                      setTextsForm(prev => ({
                        ...prev,
                        paymentMethodsText: event.target.value,
                      }))
                    }
                    placeholder="Wave, Orange Money, Free Money, Visa, Mastercard"
                  />
                </div>
                <Button
                  className="bg-crimson text-white hover:bg-crimson-light"
                  disabled={readOnly || saveStoreMutation.isPending}
                  onClick={() => saveStoreMutation.mutate()}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Enregistrer les paramètres de la boutique
                </Button>
              </>
            )}
          </div>
        )}

        {activeSection === "payments" && (
          <div className="rounded-xl border bg-card p-4 space-y-4">
            {paymentsQuery.isLoading ? (
              <SectionLoading />
            ) : paymentsQuery.error ? (
              <SectionError
                message={(paymentsQuery.error as Error).message}
                onRetry={() => void paymentsQuery.refetch()}
              />
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="rounded-lg border p-3 flex items-center justify-between">
                    <span className="text-sm">Wave</span>
                    <Switch
                      checked={paymentsForm.waveEnabled}
                      onCheckedChange={value =>
                        setPaymentsForm(prev => ({
                          ...prev,
                          waveEnabled: value,
                        }))
                      }
                    />
                  </label>
                  <label className="rounded-lg border p-3 flex items-center justify-between">
                    <span className="text-sm">Orange Money</span>
                    <Switch
                      checked={paymentsForm.omEnabled}
                      onCheckedChange={value =>
                        setPaymentsForm(prev => ({ ...prev, omEnabled: value }))
                      }
                    />
                  </label>
                  <label className="rounded-lg border p-3 flex items-center justify-between">
                    <span className="text-sm">Carte</span>
                    <Switch
                      checked={paymentsForm.cardEnabled}
                      onCheckedChange={value =>
                        setPaymentsForm(prev => ({
                          ...prev,
                          cardEnabled: value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Clé Wave</Label>
                    <Input
                      value={paymentsForm.waveKey}
                      onChange={event =>
                        setPaymentsForm(prev => ({
                          ...prev,
                          waveKey: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Clé Orange Money</Label>
                    <Input
                      value={paymentsForm.omKey}
                      onChange={event =>
                        setPaymentsForm(prev => ({
                          ...prev,
                          omKey: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Clé publique de carte</Label>
                    <Input
                      value={paymentsForm.cardPublicKey}
                      onChange={event =>
                        setPaymentsForm(prev => ({
                          ...prev,
                          cardPublicKey: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Clé secrète de carte</Label>
                    <Input
                      value={paymentsForm.cardSecretKey}
                      onChange={event =>
                        setPaymentsForm(prev => ({
                          ...prev,
                          cardSecretKey: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <Button
                  className="bg-crimson text-white hover:bg-crimson-light"
                  disabled={readOnly || savePaymentsMutation.isPending}
                  onClick={() => savePaymentsMutation.mutate()}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Enregistrer les paramètres de paiement
                </Button>
              </>
            )}
          </div>
        )}

        {activeSection === "chatbot" && (
          <div className="rounded-xl border bg-card p-4 space-y-4">
            {chatbotQuery.isLoading ? (
              <SectionLoading />
            ) : chatbotQuery.error ? (
              <SectionError
                message={(chatbotQuery.error as Error).message}
                onRetry={() => void chatbotQuery.refetch()}
              />
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Message d'accueil</Label>
                  <Textarea
                    rows={3}
                    value={chatbotForm.greeting || ""}
                    onChange={event =>
                      setChatbotForm(prev => ({
                        ...prev,
                        greeting: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Ton</Label>
                    <Select
                      value={chatbotForm.tone || "Luxury skincare"}
                      onValueChange={(
                        value: "Luxury skincare" | "Friendly" | "Professional"
                      ) =>
                        setChatbotForm(prev => ({
                          ...prev,
                          tone: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Luxury skincare">
                          Skincare de luxe
                        </SelectItem>
                        <SelectItem value="Friendly">Convivial</SelectItem>
                        <SelectItem value="Professional">
                          Professionnel
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Numéro WhatsApp</Label>
                    <Input
                      value={chatbotForm.whatsappNumber || ""}
                      onChange={event =>
                        setChatbotForm(prev => ({
                          ...prev,
                          whatsappNumber: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Politique de retour</Label>
                    <Textarea
                      rows={4}
                      value={chatbotForm.policies?.return || ""}
                      onChange={event =>
                        setChatbotForm(prev => ({
                          ...prev,
                          policies: {
                            return: event.target.value,
                            delivery: prev.policies?.delivery || "",
                            payment: prev.policies?.payment || "",
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Politique de livraison</Label>
                    <Textarea
                      rows={4}
                      value={chatbotForm.policies?.delivery || ""}
                      onChange={event =>
                        setChatbotForm(prev => ({
                          ...prev,
                          policies: {
                            return: prev.policies?.return || "",
                            delivery: event.target.value,
                            payment: prev.policies?.payment || "",
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Politique de paiement</Label>
                    <Textarea
                      rows={4}
                      value={chatbotForm.policies?.payment || ""}
                      onChange={event =>
                        setChatbotForm(prev => ({
                          ...prev,
                          policies: {
                            return: prev.policies?.return || "",
                            delivery: prev.policies?.delivery || "",
                            payment: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                </div>

                <Button
                  className="bg-crimson text-white hover:bg-crimson-light"
                  disabled={readOnly || saveChatbotMutation.isPending}
                  onClick={() => saveChatbotMutation.mutate()}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Enregistrer les paramètres du chatbot
                </Button>
              </>
            )}
          </div>
        )}

        {activeSection === "shipping" && (
          <div className="space-y-4">
            {shippingQuery.isLoading ? (
              <SectionLoading />
            ) : shippingQuery.error ? (
              <SectionError
                message={(shippingQuery.error as Error).message}
                onRetry={() => void shippingQuery.refetch()}
              />
            ) : (
              <>
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">Zones de livraison</p>
                    <Button
                      size="sm"
                      onClick={openCreateZoneDialog}
                      disabled={readOnly}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter une zone
                    </Button>
                  </div>
                  {!shippingQuery.data?.length ? (
                    <EmptyState
                      title="Aucune zone pour le moment"
                      description="Créez votre première zone de livraison."
                    />
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left">Zone</th>
                            <th className="px-3 py-2 text-left">Slug</th>
                            <th className="px-3 py-2 text-right">
                              Frais de base
                            </th>
                            <th className="px-3 py-2 text-right">Jours</th>
                            <th className="px-3 py-2 text-left">Statut</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shippingQuery.data.map(zone => (
                            <tr
                              key={zone.id}
                              className={`border-t ${selectedZoneId === zone.id ? "bg-muted/20" : ""}`}
                            >
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  className="font-medium hover:underline"
                                  onClick={() => setSelectedZoneId(zone.id)}
                                >
                                  {zone.name}
                                </button>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {zone.slug}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {zone.deliveryFee} CFA
                              </td>
                              <td className="px-3 py-2 text-right">
                                {zone.deliveryDays}
                              </td>
                              <td className="px-3 py-2">
                                <Badge
                                  className={
                                    zone.isActive
                                      ? "bg-emerald-600 text-white"
                                      : "bg-slate-300 text-slate-800"
                                  }
                                >
                                  {zone.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <div className="inline-flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEditZoneDialog(zone)}
                                    disabled={readOnly}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-500 hover:text-red-600"
                                    disabled={
                                      readOnly || deleteZoneMutation.isPending
                                    }
                                    onClick={() => {
                                      if (
                                        !window.confirm(
                                          `Supprimer la zone « ${zone.name} » ?`
                                        )
                                      )
                                        return;
                                      deleteZoneMutation.mutate(zone.id);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">
                      Tarifs {selectedZone ? `- ${selectedZone.name}` : ""}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={openCreateRateDialog}
                      disabled={readOnly || !selectedZone}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter un tarif
                    </Button>
                  </div>
                  {!selectedZone ? (
                    <EmptyState
                      title="Aucune zone sélectionnée"
                      description="Choisissez une zone pour gérer les tarifs."
                    />
                  ) : !selectedZone.rates.length ? (
                    <EmptyState
                      title="Aucun tarif pour le moment"
                      description="Créez au moins un tarif pour cette zone."
                    />
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left">Libellé</th>
                            <th className="px-3 py-2 text-right">
                              Plage (CFA)
                            </th>
                            <th className="px-3 py-2 text-right">Frais</th>
                            <th className="px-3 py-2 text-right">Délai (h)</th>
                            <th className="px-3 py-2 text-left">Statut</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedZone.rates.map(rate => (
                            <tr key={rate.id} className="border-t">
                              <td className="px-3 py-2 font-medium">
                                {rate.label}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {rate.minAmountCfa} -{" "}
                                {rate.maxAmountCfa == null
                                  ? "∞"
                                  : rate.maxAmountCfa}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {rate.feeCfa} CFA
                              </td>
                              <td className="px-3 py-2 text-right">
                                {rate.etaMinHours} - {rate.etaMaxHours}
                              </td>
                              <td className="px-3 py-2">
                                <Badge
                                  className={
                                    rate.isActive
                                      ? "bg-emerald-600 text-white"
                                      : "bg-slate-300 text-slate-800"
                                  }
                                >
                                  {rate.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <div className="inline-flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEditRateDialog(rate)}
                                    disabled={readOnly}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-500 hover:text-red-600"
                                    disabled={
                                      readOnly || deleteRateMutation.isPending
                                    }
                                    onClick={() => {
                                      if (
                                        !window.confirm(
                                          `Supprimer le tarif « ${rate.label} » ?`
                                        )
                                      )
                                        return;
                                      deleteRateMutation.mutate(rate.id);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeSection === "users" && (
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Utilisateurs et rôles</p>
              <Button
                size="sm"
                onClick={() => setCreateUserDialogOpen(true)}
                disabled={readOnly}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un utilisateur
              </Button>
            </div>
            {usersQuery.isLoading ? (
              <SectionLoading />
            ) : usersQuery.error ? (
              <SectionError
                message={(usersQuery.error as Error).message}
                onRetry={() => void usersQuery.refetch()}
              />
            ) : !usersQuery.data?.length ? (
              <EmptyState
                title="Aucun utilisateur trouvé"
                description="Créez votre premier utilisateur administrateur."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Utilisateur</th>
                      <th className="px-3 py-2 text-left">E-mail</th>
                      <th className="px-3 py-2 text-left">Rôle</th>
                      <th className="px-3 py-2 text-left">Actif</th>
                      <th className="px-3 py-2 text-left">
                        Dernière connexion
                      </th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersQuery.data.map(item => (
                      <UserRoleRow
                        key={item.id}
                        item={item}
                        saving={
                          updateUserMutation.isPending ||
                          resetPasswordMutation.isPending
                        }
                        readOnly={readOnly}
                        onSave={payload =>
                          updateUserMutation.mutate({ id: item.id, payload })
                        }
                        onResetPassword={() => {
                          if (
                            !window.confirm(
                              `Réinitialiser le mot de passe de ${item.name} ?`
                            )
                          )
                            return;
                          resetPasswordMutation.mutate({ id: item.id });
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeSection === "audit-logs" && (
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1.5">
                <Label>Action</Label>
                <Input
                  value={auditActionFilter}
                  onChange={event => setAuditActionFilter(event.target.value)}
                  placeholder="settings.store.update"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Entité</Label>
                <Input
                  value={auditEntityFilter}
                  onChange={event => setAuditEntityFilter(event.target.value)}
                  placeholder="shipping_zone"
                />
              </div>
              <Button variant="outline" onClick={applyAuditFilters}>
                Appliquer les filtres
              </Button>
            </div>
            {auditQuery.isLoading ? (
              <SectionLoading />
            ) : auditQuery.error ? (
              <SectionError
                message={(auditQuery.error as Error).message}
                onRetry={() => void auditQuery.refetch()}
              />
            ) : !auditQuery.data?.items.length ? (
              <EmptyState
                title="Aucun journal d'audit pour le moment"
                description="Les actions d'administration apparaîtront ici."
              />
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Auteur</th>
                        <th className="px-3 py-2 text-left">Action</th>
                        <th className="px-3 py-2 text-left">Entité</th>
                        <th className="px-3 py-2 text-right">Détails</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditQuery.data.items.map(log => (
                        <tr key={log.id} className="border-t">
                          <td className="px-3 py-2">
                            {formatDate(log.createdAt)}
                          </td>
                          <td className="px-3 py-2">
                            {log.actorName ||
                              `Utilisateur #${log.actorUserId || "-"}`}
                          </td>
                          <td className="px-3 py-2 font-medium">
                            {log.action}
                          </td>
                          <td className="px-3 py-2">
                            {log.entityType}
                            {log.entityId ? ` #${log.entityId}` : ""}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setAuditDetails(log)}
                            >
                              Ouvrir
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    disabled={!auditCursorHistory.length}
                    onClick={() => {
                      setAuditCursorHistory(prev => {
                        if (!prev.length) return prev;
                        const copy = [...prev];
                        const nextCursor = copy.pop();
                        setAuditCursor(nextCursor || undefined);
                        return copy;
                      });
                    }}
                  >
                    Précédent
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!auditQuery.data.nextCursor}
                    onClick={() => {
                      if (!auditQuery.data?.nextCursor) return;
                      setAuditCursorHistory(prev => [
                        ...prev,
                        auditCursor || 0,
                      ]);
                      setAuditCursor(auditQuery.data.nextCursor || undefined);
                    }}
                  >
                    Suivant
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        <Dialog open={zoneDialogOpen} onOpenChange={setZoneDialogOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingZone
                  ? "Modifier la zone de livraison"
                  : "Créer une zone de livraison"}
              </DialogTitle>
              <DialogDescription>
                Gérez les détails de la zone de livraison et la tarification de
                base par défaut.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nom</Label>
                  <Input
                    value={zoneForm.name}
                    onChange={event =>
                      setZoneForm(prev => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Slug</Label>
                  <Input
                    value={zoneForm.slug}
                    onChange={event =>
                      setZoneForm(prev => ({
                        ...prev,
                        slug: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  value={zoneForm.description}
                  onChange={event =>
                    setZoneForm(prev => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Frais de base (CFA)</Label>
                  <Input
                    type="number"
                    value={zoneForm.deliveryFee}
                    onChange={event =>
                      setZoneForm(prev => ({
                        ...prev,
                        deliveryFee: Number(event.target.value || 0),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Jours de livraison</Label>
                  <Input
                    type="number"
                    value={zoneForm.deliveryDays}
                    onChange={event =>
                      setZoneForm(prev => ({
                        ...prev,
                        deliveryDays: Number(event.target.value || 0),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ordre d'affichage</Label>
                  <Input
                    type="number"
                    value={zoneForm.displayOrder}
                    onChange={event =>
                      setZoneForm(prev => ({
                        ...prev,
                        displayOrder: Number(event.target.value || 0),
                      }))
                    }
                  />
                </div>
              </div>
              <label className="rounded-lg border p-3 flex items-center justify-between">
                <span className="text-sm">Actif</span>
                <Switch
                  checked={zoneForm.isActive}
                  onCheckedChange={value =>
                    setZoneForm(prev => ({ ...prev, isActive: value }))
                  }
                />
              </label>
              <Button
                className="bg-crimson text-white hover:bg-crimson-light"
                disabled={
                  readOnly ||
                  createZoneMutation.isPending ||
                  updateZoneMutation.isPending
                }
                onClick={submitZone}
              >
                <Save className="h-4 w-4 mr-2" />
                Enregistrer la zone
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingRate
                  ? "Modifier le tarif de livraison"
                  : "Créer un tarif de livraison"}
              </DialogTitle>
              <DialogDescription>
                Définissez les plages de valeur du panier, les frais de
                livraison et les fenêtres de délai.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Zone</Label>
                  <Select
                    value={String(rateForm.zoneId)}
                    onValueChange={value =>
                      setRateForm(prev => ({ ...prev, zoneId: Number(value) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(shippingQuery.data || []).map(
                        (zone: ShippingZoneWithRates) => (
                          <SelectItem key={zone.id} value={String(zone.id)}>
                            {zone.name}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Libellé</Label>
                  <Input
                    value={rateForm.label}
                    onChange={event =>
                      setRateForm(prev => ({
                        ...prev,
                        label: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Montant minimum (CFA)</Label>
                  <Input
                    type="number"
                    value={rateForm.minAmountCfa}
                    onChange={event =>
                      setRateForm(prev => ({
                        ...prev,
                        minAmountCfa: Number(event.target.value || 0),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Montant maximum (CFA)</Label>
                  <Input
                    value={rateForm.maxAmountCfa}
                    onChange={event =>
                      setRateForm(prev => ({
                        ...prev,
                        maxAmountCfa: event.target.value,
                      }))
                    }
                    placeholder="Laissez vide pour aucun maximum"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Frais (CFA)</Label>
                  <Input
                    type="number"
                    value={rateForm.feeCfa}
                    onChange={event =>
                      setRateForm(prev => ({
                        ...prev,
                        feeCfa: Number(event.target.value || 0),
                      }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Délai min (heures)</Label>
                  <Input
                    type="number"
                    value={rateForm.etaMinHours}
                    onChange={event =>
                      setRateForm(prev => ({
                        ...prev,
                        etaMinHours: Number(event.target.value || 0),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Délai max (heures)</Label>
                  <Input
                    type="number"
                    value={rateForm.etaMaxHours}
                    onChange={event =>
                      setRateForm(prev => ({
                        ...prev,
                        etaMaxHours: Number(event.target.value || 0),
                      }))
                    }
                  />
                </div>
              </div>
              <label className="rounded-lg border p-3 flex items-center justify-between">
                <span className="text-sm">Actif</span>
                <Switch
                  checked={rateForm.isActive}
                  onCheckedChange={value =>
                    setRateForm(prev => ({ ...prev, isActive: value }))
                  }
                />
              </label>
              <Button
                className="bg-crimson text-white hover:bg-crimson-light"
                disabled={
                  readOnly ||
                  createRateMutation.isPending ||
                  updateRateMutation.isPending
                }
                onClick={submitRate}
              >
                <Save className="h-4 w-4 mr-2" />
                Enregistrer le tarif
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={createUserDialogOpen}
          onOpenChange={setCreateUserDialogOpen}
        >
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Créer un utilisateur administrateur</DialogTitle>
              <DialogDescription>
                Attribuez des identifiants et un rôle pour accéder au tableau de
                bord.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nom</Label>
                  <Input
                    value={createUserForm.name}
                    onChange={event =>
                      setCreateUserForm(prev => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input
                    value={createUserForm.email}
                    onChange={event =>
                      setCreateUserForm(prev => ({
                        ...prev,
                        email: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Téléphone</Label>
                  <Input
                    value={createUserForm.phone || ""}
                    onChange={event =>
                      setCreateUserForm(prev => ({
                        ...prev,
                        phone: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Rôle</Label>
                  <Select
                    value={createUserForm.role}
                    onValueChange={(value: AdminUserRole) =>
                      setCreateUserForm(prev => ({ ...prev, role: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrateur</SelectItem>
                      <SelectItem value="manager">Gestionnaire</SelectItem>
                      <SelectItem value="editor">Éditeur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nom d'utilisateur</Label>
                  <Input
                    value={createUserForm.username}
                    onChange={event =>
                      setCreateUserForm(prev => ({
                        ...prev,
                        username: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    Mot de passe{" "}
                    {createUserForm.inviteOnly ? "(facultatif)" : ""}
                  </Label>
                  <Input
                    type="password"
                    value={createUserForm.password || ""}
                    onChange={event =>
                      setCreateUserForm(prev => ({
                        ...prev,
                        password: event.target.value,
                      }))
                    }
                    placeholder={
                      createUserForm.inviteOnly
                        ? "Laissez vide pour générer automatiquement"
                        : ""
                    }
                  />
                </div>
              </div>
              <label className="rounded-lg border p-3 flex items-center justify-between">
                <span className="text-sm">
                  Mode invitation (générer automatiquement un mot de passe
                  temporaire)
                </span>
                <Switch
                  checked={Boolean(createUserForm.inviteOnly)}
                  onCheckedChange={value =>
                    setCreateUserForm(prev => ({ ...prev, inviteOnly: value }))
                  }
                />
              </label>
              <label className="rounded-lg border p-3 flex items-center justify-between">
                <span className="text-sm">Actif</span>
                <Switch
                  checked={createUserForm.isActive}
                  onCheckedChange={value =>
                    setCreateUserForm(prev => ({ ...prev, isActive: value }))
                  }
                />
              </label>
              <Button
                className="bg-crimson text-white hover:bg-crimson-light"
                disabled={readOnly || createUserMutation.isPending}
                onClick={() => {
                  if (
                    !createUserForm.inviteOnly &&
                    !(createUserForm.password || "").trim()
                  ) {
                    toast.error(
                      "Le mot de passe est requis sauf si le mode invitation est activé"
                    );
                    return;
                  }
                  createUserMutation.mutate(createUserForm);
                }}
              >
                <Save className="h-4 w-4 mr-2" />
                Créer l'utilisateur
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(auditDetails)}
          onOpenChange={open => {
            if (!open) setAuditDetails(null);
          }}
        >
          <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Détails de l'audit</DialogTitle>
              <DialogDescription>
                {auditDetails
                  ? `${auditDetails.action} - ${auditDetails.entityType}`
                  : ""}
              </DialogDescription>
            </DialogHeader>
            {auditDetails && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Avant</p>
                  <pre className="rounded-lg border bg-muted/30 p-3 text-xs overflow-auto max-h-[320px]">
                    {JSON.stringify(auditDetails.beforeJson, null, 2) || "null"}
                  </pre>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Après</p>
                  <pre className="rounded-lg border bg-muted/30 p-3 text-xs overflow-auto max-h-[320px]">
                    {JSON.stringify(auditDetails.afterJson, null, 2) || "null"}
                  </pre>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

function UserRoleRow({
  item,
  onSave,
  onResetPassword,
  saving,
  readOnly,
}: {
  item: AdminUser;
  onSave: (payload: { role?: AdminUserRole; isActive?: boolean }) => void;
  onResetPassword: () => void;
  saving: boolean;
  readOnly: boolean;
}) {
  const [role, setRole] = useState<AdminUserRole>(item.role);
  const [isActive, setIsActive] = useState<boolean>(Boolean(item.isActive));

  useEffect(() => {
    setRole(item.role);
    setIsActive(Boolean(item.isActive));
  }, [item.role, item.isActive]);

  return (
    <tr className="border-t">
      <td className="px-3 py-2">
        <div className="font-medium">{item.name}</div>
        <div className="text-xs text-muted-foreground">
          @{item.username || "n/d"}
        </div>
      </td>
      <td className="px-3 py-2 text-muted-foreground">{item.email || "-"}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Badge className={roleBadge(role)}>{roleLabels[role]}</Badge>
          <Select
            value={role}
            onValueChange={(value: AdminUserRole) => setRole(value)}
            disabled={readOnly}
          >
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Administrateur</SelectItem>
              <SelectItem value="manager">Gestionnaire</SelectItem>
              <SelectItem value="editor">Éditeur</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </td>
      <td className="px-3 py-2">
        <Switch
          checked={isActive}
          onCheckedChange={setIsActive}
          disabled={readOnly}
        />
      </td>
      <td className="px-3 py-2">{formatDate(item.lastLoginAt)}</td>
      <td className="px-3 py-2 text-right">
        <div className="inline-flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={saving || readOnly}
            onClick={() => onSave({ role, isActive })}
          >
            Enregistrer
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={saving || readOnly}
            onClick={onResetPassword}
          >
            <KeyRound className="h-4 w-4 mr-1" />
            Réinitialiser
          </Button>
        </div>
      </td>
    </tr>
  );
}
