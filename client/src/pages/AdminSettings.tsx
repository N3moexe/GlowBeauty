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
    "Bienvenue chez SenBonsPlans. Je suis votre concierge skincare premium.",
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
        Retry
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
    mutationFn: () => updateAdminStoreSettings(storeForm),
    onSuccess: async () => {
      toast.success("Store settings saved");
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
      toast.success("Payment settings saved");
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
      toast.success("Chatbot settings saved");
      await queryClient.invalidateQueries({
        queryKey: ["admin-settings", "chatbot"],
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createZoneMutation = useMutation({
    mutationFn: createShippingZone,
    onSuccess: async () => {
      toast.success("Shipping zone created");
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
      toast.success("Shipping zone updated");
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
      toast.success("Shipping zone deleted");
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
      toast.success("Shipping rate created");
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
      toast.success("Shipping rate updated");
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
      toast.success("Shipping rate deleted");
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
        toast.success("Invite created", {
          description: `Temporary password: ${result.tempPassword}`,
        });
      } else {
        toast.success("User created");
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
      toast.success("User updated");
      await queryClient.invalidateQueries({
        queryKey: ["admin-settings", "users"],
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id }: { id: number }) => resetAdminUserPassword(id),
    onSuccess: async result => {
      toast.success("Password reset", {
        description: `Temporary password: ${result.tempPassword}`,
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
      toast.error("Zone name is required");
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
      toast.error("Select a zone first");
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
      toast.error("Rate label is required");
      return;
    }
    const maxAmount =
      rateForm.maxAmountCfa === "" ? null : Number(rateForm.maxAmountCfa);
    if (maxAmount != null && maxAmount < Number(rateForm.minAmountCfa)) {
      toast.error("Max amount must be greater than or equal to min amount");
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
          {section === "overview" ? "Overview" : section}
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
          title="Settings"
          description="Store, payments, shipping zones/rates, users and audit logs."
          breadcrumbs={[{ label: "Admin" }, { label: "Settings" }]}
          actions={
            activeSection !== "overview" ? (
              <Link href="/admin/settings">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Overview
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
                title: "Store",
                desc: "Brand name, contacts, currency",
                href: "/admin/settings/store",
              },
              {
                title: "Payments",
                desc: "Wave, Orange Money, Card",
                href: "/admin/settings/payments",
              },
              {
                title: "Chatbot",
                desc: "Concierge greeting, tone, WhatsApp, policies",
                href: "/admin/settings/chatbot",
              },
              {
                title: "Shipping",
                desc: "Zones and dynamic rates",
                href: "/admin/settings/shipping",
              },
              {
                title: "Users",
                desc: "Roles, active status, reset password",
                href: "/admin/settings/users",
              },
              {
                title: "Audit logs",
                desc: "Admin activity timeline",
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
                    <Label>Store name</Label>
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
                    <Label>Phone</Label>
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
                    <Label>Email</Label>
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
                    <Label>Address</Label>
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
                    <Label>Currency</Label>
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
                <Button
                  className="bg-crimson text-white hover:bg-crimson-light"
                  disabled={readOnly || saveStoreMutation.isPending}
                  onClick={() => saveStoreMutation.mutate()}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save store settings
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
                    <span className="text-sm">Card</span>
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
                    <Label>Wave key</Label>
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
                    <Label>Orange Money key</Label>
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
                    <Label>Card public key</Label>
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
                    <Label>Card secret key</Label>
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
                  Save payment settings
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
                  <Label>Greeting</Label>
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
                    <Label>Tone</Label>
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
                          Luxury skincare
                        </SelectItem>
                        <SelectItem value="Friendly">Friendly</SelectItem>
                        <SelectItem value="Professional">
                          Professional
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>WhatsApp number</Label>
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
                    <Label>Return policy</Label>
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
                    <Label>Delivery policy</Label>
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
                    <Label>Payment policy</Label>
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
                  Save chatbot settings
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
                    <p className="font-semibold">Shipping zones</p>
                    <Button
                      size="sm"
                      onClick={openCreateZoneDialog}
                      disabled={readOnly}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add zone
                    </Button>
                  </div>
                  {!shippingQuery.data?.length ? (
                    <EmptyState
                      title="No zones yet"
                      description="Create your first delivery zone."
                    />
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left">Zone</th>
                            <th className="px-3 py-2 text-left">Slug</th>
                            <th className="px-3 py-2 text-right">Base fee</th>
                            <th className="px-3 py-2 text-right">Days</th>
                            <th className="px-3 py-2 text-left">Status</th>
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
                                          `Delete zone "${zone.name}"?`
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
                      Rates {selectedZone ? `- ${selectedZone.name}` : ""}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={openCreateRateDialog}
                      disabled={readOnly || !selectedZone}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add rate
                    </Button>
                  </div>
                  {!selectedZone ? (
                    <EmptyState
                      title="No zone selected"
                      description="Choose a zone to manage rates."
                    />
                  ) : !selectedZone.rates.length ? (
                    <EmptyState
                      title="No rates yet"
                      description="Create at least one rate for this zone."
                    />
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left">Label</th>
                            <th className="px-3 py-2 text-right">
                              Range (CFA)
                            </th>
                            <th className="px-3 py-2 text-right">Fee</th>
                            <th className="px-3 py-2 text-right">ETA (h)</th>
                            <th className="px-3 py-2 text-left">Status</th>
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
                                  ? "INF"
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
                                          `Delete rate "${rate.label}"?`
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
              <p className="font-semibold">Users and roles</p>
              <Button
                size="sm"
                onClick={() => setCreateUserDialogOpen(true)}
                disabled={readOnly}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add user
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
                title="No users found"
                description="Create your first admin user."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">User</th>
                      <th className="px-3 py-2 text-left">Email</th>
                      <th className="px-3 py-2 text-left">Role</th>
                      <th className="px-3 py-2 text-left">Active</th>
                      <th className="px-3 py-2 text-left">Last login</th>
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
                            !window.confirm(`Reset password for ${item.name}?`)
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
                <Label>Entity</Label>
                <Input
                  value={auditEntityFilter}
                  onChange={event => setAuditEntityFilter(event.target.value)}
                  placeholder="shipping_zone"
                />
              </div>
              <Button variant="outline" onClick={applyAuditFilters}>
                Apply filters
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
                title="No audit logs yet"
                description="Admin actions will appear here."
              />
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">When</th>
                        <th className="px-3 py-2 text-left">Actor</th>
                        <th className="px-3 py-2 text-left">Action</th>
                        <th className="px-3 py-2 text-left">Entity</th>
                        <th className="px-3 py-2 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditQuery.data.items.map(log => (
                        <tr key={log.id} className="border-t">
                          <td className="px-3 py-2">
                            {formatDate(log.createdAt)}
                          </td>
                          <td className="px-3 py-2">
                            {log.actorName || `User #${log.actorUserId || "-"}`}
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
                              Open
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
                    Previous
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
                    Next
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
                {editingZone ? "Edit shipping zone" : "Create shipping zone"}
              </DialogTitle>
              <DialogDescription>
                Manage delivery zone details and default base pricing.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Name</Label>
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
                  <Label>Base fee (CFA)</Label>
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
                  <Label>Delivery days</Label>
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
                  <Label>Display order</Label>
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
                <span className="text-sm">Active</span>
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
                Save zone
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingRate ? "Edit shipping rate" : "Create shipping rate"}
              </DialogTitle>
              <DialogDescription>
                Define cart value ranges, delivery fees and ETA windows.
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
                  <Label>Label</Label>
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
                  <Label>Min amount (CFA)</Label>
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
                  <Label>Max amount (CFA)</Label>
                  <Input
                    value={rateForm.maxAmountCfa}
                    onChange={event =>
                      setRateForm(prev => ({
                        ...prev,
                        maxAmountCfa: event.target.value,
                      }))
                    }
                    placeholder="Leave empty for no max"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fee (CFA)</Label>
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
                  <Label>ETA min (hours)</Label>
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
                  <Label>ETA max (hours)</Label>
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
                <span className="text-sm">Active</span>
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
                Save rate
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
              <DialogTitle>Create admin user</DialogTitle>
              <DialogDescription>
                Assign credentials and role for dashboard access.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Name</Label>
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
                  <Label>Email</Label>
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
                  <Label>Phone</Label>
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
                  <Label>Role</Label>
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
                      <SelectItem value="admin">admin</SelectItem>
                      <SelectItem value="manager">manager</SelectItem>
                      <SelectItem value="editor">editor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Username</Label>
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
                    Password {createUserForm.inviteOnly ? "(optional)" : ""}
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
                        ? "Leave blank to auto-generate"
                        : ""
                    }
                  />
                </div>
              </div>
              <label className="rounded-lg border p-3 flex items-center justify-between">
                <span className="text-sm">
                  Invite mode (auto-generate temporary password)
                </span>
                <Switch
                  checked={Boolean(createUserForm.inviteOnly)}
                  onCheckedChange={value =>
                    setCreateUserForm(prev => ({ ...prev, inviteOnly: value }))
                  }
                />
              </label>
              <label className="rounded-lg border p-3 flex items-center justify-between">
                <span className="text-sm">Active</span>
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
                      "Password is required unless invite mode is enabled"
                    );
                    return;
                  }
                  createUserMutation.mutate(createUserForm);
                }}
              >
                <Save className="h-4 w-4 mr-2" />
                Create user
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
              <DialogTitle>Audit details</DialogTitle>
              <DialogDescription>
                {auditDetails
                  ? `${auditDetails.action} - ${auditDetails.entityType}`
                  : ""}
              </DialogDescription>
            </DialogHeader>
            {auditDetails && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Before</p>
                  <pre className="rounded-lg border bg-muted/30 p-3 text-xs overflow-auto max-h-[320px]">
                    {JSON.stringify(auditDetails.beforeJson, null, 2) || "null"}
                  </pre>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">After</p>
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
          @{item.username || "n/a"}
        </div>
      </td>
      <td className="px-3 py-2 text-muted-foreground">{item.email || "-"}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Badge className={roleBadge(role)}>{role}</Badge>
          <Select
            value={role}
            onValueChange={(value: AdminUserRole) => setRole(value)}
            disabled={readOnly}
          >
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">admin</SelectItem>
              <SelectItem value="manager">manager</SelectItem>
              <SelectItem value="editor">editor</SelectItem>
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
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={saving || readOnly}
            onClick={onResetPassword}
          >
            <KeyRound className="h-4 w-4 mr-1" />
            Reset
          </Button>
        </div>
      </td>
    </tr>
  );
}
