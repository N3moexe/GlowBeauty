import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { getAdminModulePath } from "@/lib/adminNavigation";
import AdminLayout from "@/components/admin/AdminLayout";
import PageHeader from "@/components/admin/PageHeader";
import AdminNotAllowed from "@/pages/AdminNotAllowed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createAdminCoupon,
  deactivateAdminCoupon,
  listAdminCoupons,
  previewSessionCoupon,
  updateAdminCoupon,
  type CouponApiError,
} from "@/lib/couponsApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CouponAppliesTo, CouponRecord, CouponType, CreateCouponInput } from "@shared/coupons";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type CouponFormState = {
  code: string;
  type: CouponType;
  value: string;
  minSubtotal: string;
  maxDiscount: string;
  startAt: string;
  endAt: string;
  usageLimit: string;
  perSessionLimit: string;
  appliesTo: CouponAppliesTo;
  categoryId: string;
  productId: string;
  active: boolean;
  note: string;
};

const EMPTY_FORM: CouponFormState = {
  code: "",
  type: "PERCENT",
  value: "",
  minSubtotal: "0",
  maxDiscount: "",
  startAt: "",
  endAt: "",
  usageLimit: "",
  perSessionLimit: "",
  appliesTo: "ALL",
  categoryId: "",
  productId: "",
  active: true,
  note: "",
};

const COUPON_APPLIES_TO_LABELS: Record<CouponAppliesTo, string> = {
  ALL: "Tout",
  CATEGORY: "Catégorie",
  PRODUCT: "Produit",
};

function formatCFA(amount: number) {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(amount || 0))} CFA`;
}

function toDateTimeInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeInput(value: string) {
  if (!value.trim()) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function mapCouponToForm(coupon: CouponRecord): CouponFormState {
  return {
    code: coupon.code || "",
    type: coupon.type,
    value: String(coupon.value ?? 0),
    minSubtotal: String(coupon.minSubtotal ?? 0),
    maxDiscount: coupon.maxDiscount == null ? "" : String(coupon.maxDiscount),
    startAt: toDateTimeInput(coupon.startAt),
    endAt: toDateTimeInput(coupon.endAt),
    usageLimit: coupon.usageLimit == null ? "" : String(coupon.usageLimit),
    perSessionLimit:
      coupon.perSessionLimit == null ? "" : String(coupon.perSessionLimit),
    appliesTo: coupon.appliesTo,
    categoryId: coupon.categoryId || "",
    productId: coupon.productId || "",
    active: Boolean(coupon.active),
    note: "",
  };
}

function parseNumberInput(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

function mapFormToCreateInput(form: CouponFormState): CreateCouponInput {
  const value = parseNumberInput(form.value);
  const minSubtotal = parseNumberInput(form.minSubtotal);
  const maxDiscount = parseNumberInput(form.maxDiscount);
  const usageLimit = parseNumberInput(form.usageLimit);
  const perSessionLimit = parseNumberInput(form.perSessionLimit);
  if (value === null || value < 0) {
    throw new Error("La valeur du coupon doit être un nombre valide.");
  }
  if (minSubtotal === null || minSubtotal < 0) {
    throw new Error("Le sous-total minimum doit être un nombre valide.");
  }
  if (form.type === "PERCENT" && (value < 1 || value > 100)) {
    throw new Error("Les coupons en pourcentage doivent être compris entre 1 et 100.");
  }
  if (form.type === "FIXED" && value < 1) {
    throw new Error("La valeur d'un coupon à montant fixe doit être supérieure à 0.");
  }
  if (form.type === "FREE_SHIPPING" && value !== 0) {
    throw new Error("La valeur d'un coupon de livraison gratuite doit être 0.");
  }
  if (form.appliesTo === "CATEGORY" && !form.categoryId.trim()) {
    throw new Error("Sélectionnez une catégorie pour les coupons de type CATEGORY.");
  }
  if (form.appliesTo === "PRODUCT" && !form.productId.trim()) {
    throw new Error("Sélectionnez un produit pour les coupons de type PRODUCT.");
  }
  const startAt = fromDateTimeInput(form.startAt);
  const endAt = fromDateTimeInput(form.endAt);
  if (startAt && endAt && new Date(startAt) > new Date(endAt)) {
    throw new Error("La date de fin doit être postérieure à la date de début.");
  }

  return {
    code: form.code.trim().toUpperCase(),
    type: form.type,
    value,
    minSubtotal,
    maxDiscount: maxDiscount === null ? null : maxDiscount,
    startAt: startAt ?? null,
    endAt: endAt ?? null,
    usageLimit: usageLimit === null ? null : usageLimit,
    perSessionLimit: perSessionLimit === null ? null : perSessionLimit,
    active: form.active,
    appliesTo: form.appliesTo,
    categoryId: form.appliesTo === "CATEGORY" ? form.categoryId.trim() : null,
    productId: form.appliesTo === "PRODUCT" ? form.productId.trim() : null,
  };
}

export default function AdminCoupons() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponRecord | null>(null);
  const [couponForm, setCouponForm] = useState<CouponFormState>(EMPTY_FORM);
  const [testSessionId, setTestSessionId] = useState("");
  const [testCode, setTestCode] = useState("");
  const [testOutput, setTestOutput] = useState<string>("");

  const { data: permissions, isLoading: permissionsLoading } = trpc.rbac.me.useQuery(
    undefined,
    {
      enabled: Boolean(user),
      retry: false,
    }
  );

  const couponsQuery = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: () => listAdminCoupons(500),
    enabled: Boolean(user) && Boolean(permissions),
    refetchInterval: 15000,
  });

  const categoriesQuery = trpc.category.list.useQuery(undefined, {
    enabled: Boolean(user) && dialogOpen,
    retry: 1,
  });

  const productsQuery = trpc.product.list.useQuery(
    { limit: 300, offset: 0 },
    {
      enabled: Boolean(user) && dialogOpen,
      retry: 1,
    }
  );

  const refreshCoupons = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
  };

  const createMutation = useMutation({
    mutationFn: createAdminCoupon,
    onSuccess: async () => {
      toast.success("Coupon créé");
      await refreshCoupons();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateCouponInput> }) =>
      updateAdminCoupon(id, payload),
    onSuccess: async () => {
      toast.success("Coupon mis à jour");
      await refreshCoupons();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateAdminCoupon(id),
    onSuccess: async () => {
      toast.success("Coupon désactivé");
      await refreshCoupons();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (typeof window !== "undefined" && !loading && !user) {
      window.location.href = getLoginUrl();
    }
  }, [loading, user]);

  const canManageCoupons = Boolean(
    permissions && permissions.allowedModules.includes("coupons")
  );

  const filteredCoupons = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return (couponsQuery.data || []).filter((coupon) => {
      if (statusFilter === "active" && !coupon.active) return false;
      if (statusFilter === "inactive" && coupon.active) return false;
      if (!query) return true;
      return [
        coupon.code,
        coupon.type,
        coupon.appliesTo,
        coupon.categoryId || "",
        coupon.productId || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [couponsQuery.data, searchValue, statusFilter]);

  const submitCouponForm = async () => {
    try {
      const payload = mapFormToCreateInput(couponForm);
      if (!payload.code.trim()) {
        toast.error("Le code du coupon est requis.");
        return;
      }

      if (editingCoupon) {
        await updateMutation.mutateAsync({
          id: editingCoupon.id,
          payload,
        });
      } else {
        await createMutation.mutateAsync(payload);
      }
      setDialogOpen(false);
      setEditingCoupon(null);
      setCouponForm(EMPTY_FORM);
    } catch (error: any) {
      toast.error(error?.message || "Impossible d'enregistrer le coupon.");
    }
  };

  if (loading || permissionsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!permissions || !canManageCoupons) {
    return <AdminNotAllowed />;
  }

  return (
    <AdminLayout
      activeModule="coupons"
      userName={user.name}
      allowedModules={permissions.allowedModules as any}
      onModuleChange={(module) => {
        setLocation(getAdminModulePath(module));
      }}
      onQuickAction={(action) => {
        if (action === "create_coupon") {
          setEditingCoupon(null);
          setCouponForm(EMPTY_FORM);
          setDialogOpen(true);
        }
      }}
      onSearchSubmit={(query) => setSearchValue(query)}
    >
      <div className="space-y-4">
        <PageHeader
          title="Coupons"
          description="Gérez la logique des réductions appliquées au paiement et à la commande."
          actions={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void couponsQuery.refetch();
                }}
                disabled={couponsQuery.isFetching}
              >
                {couponsQuery.isFetching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Actualiser
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setEditingCoupon(null);
                  setCouponForm(EMPTY_FORM);
                  setDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nouveau coupon
              </Button>
            </div>
          }
        />

        <section className="rounded-xl border bg-card p-4">
          <h3 className="text-base font-semibold">Tester un coupon</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Prévisualisez la validation d'un coupon pour un panier de session sans l'enregistrer.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>ID de session</Label>
              <Input
                value={testSessionId}
                onChange={(event) => setTestSessionId(event.target.value)}
                placeholder="session-abc123..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Code du coupon</Label>
              <Input
                value={testCode}
                onChange={(event) => setTestCode(event.target.value.toUpperCase())}
                placeholder="SEN10"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                className="w-full"
                disabled={testSessionId.trim().length < 8 || testCode.trim().length < 2}
                onClick={async () => {
                  try {
                    const result = await previewSessionCoupon({
                      sessionId: testSessionId.trim(),
                      code: testCode.trim().toUpperCase(),
                    });
                    setTestOutput(
                      `OK : remise=${formatCFA(result.discountAmount)}, total=${formatCFA(result.total)}`
                    );
                  } catch (error: any) {
                    const couponError = error as CouponApiError;
                    setTestOutput(
                      `ERREUR${couponError.code ? ` (${couponError.code})` : ""} : ${couponError.message}`
                    );
                  }
                }}
              >
                Tester
              </Button>
            </div>
          </div>
          {testOutput ? (
            <p className="mt-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">{testOutput}</p>
          ) : null}
        </section>

        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Rechercher par code, type, portée..."
                className="h-9 w-[260px]"
              />
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger className="h-9 w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="inactive">Inactif</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Badge variant="outline">{filteredCoupons.length} coupons</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-2 py-2 font-medium">Code</th>
                  <th className="px-2 py-2 font-medium">Type</th>
                  <th className="px-2 py-2 font-medium">Valeur</th>
                  <th className="px-2 py-2 font-medium">Sous-total min.</th>
                  <th className="px-2 py-2 font-medium">Portée</th>
                  <th className="px-2 py-2 font-medium">Utilisation</th>
                  <th className="px-2 py-2 font-medium">Actif</th>
                  <th className="px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {couponsQuery.isLoading ? (
                  <tr>
                    <td className="px-2 py-6 text-center text-muted-foreground" colSpan={8}>
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </td>
                  </tr>
                ) : filteredCoupons.length === 0 ? (
                  <tr>
                    <td className="px-2 py-6 text-center text-muted-foreground" colSpan={8}>
                      Aucun coupon trouvé.
                    </td>
                  </tr>
                ) : (
                  filteredCoupons.map((coupon) => (
                    <tr key={coupon.id} className="border-b align-top">
                      <td className="px-2 py-3">
                        <p className="font-medium">{coupon.code}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {coupon.startAt ? `Début : ${new Date(coupon.startAt).toLocaleString()}` : "Aucun début"}
                          {" · "}
                          {coupon.endAt ? `Fin : ${new Date(coupon.endAt).toLocaleString()}` : "Aucune fin"}
                        </p>
                      </td>
                      <td className="px-2 py-3">
                        <Select
                          value={coupon.type}
                          onValueChange={(nextType: CouponType) => {
                            void updateMutation.mutateAsync({
                              id: coupon.id,
                              payload: {
                                type: nextType,
                                value: nextType === "FREE_SHIPPING" ? 0 : coupon.value,
                              },
                            });
                          }}
                        >
                          <SelectTrigger className="h-8 w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PERCENT">Pourcentage</SelectItem>
                            <SelectItem value="FIXED">Montant fixe</SelectItem>
                            <SelectItem value="FREE_SHIPPING">Livraison gratuite</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-3">
                        {coupon.type === "PERCENT" ? `${coupon.value}%` : formatCFA(coupon.value)}
                        {coupon.maxDiscount != null ? (
                          <p className="text-xs text-muted-foreground">
                            Plafond : {formatCFA(coupon.maxDiscount)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-2 py-3">{formatCFA(coupon.minSubtotal)}</td>
                      <td className="px-2 py-3">
                        <p>{COUPON_APPLIES_TO_LABELS[coupon.appliesTo] ?? coupon.appliesTo}</p>
                        {coupon.appliesTo === "CATEGORY" && coupon.categoryId ? (
                          <p className="text-xs text-muted-foreground">Catégorie n°{coupon.categoryId}</p>
                        ) : null}
                        {coupon.appliesTo === "PRODUCT" && coupon.productId ? (
                          <p className="text-xs text-muted-foreground">Produit n°{coupon.productId}</p>
                        ) : null}
                      </td>
                      <td className="px-2 py-3">
                        <p>{coupon.usageCount}</p>
                        <p className="text-xs text-muted-foreground">
                          limite {coupon.usageLimit ?? "∞"} / session {coupon.perSessionLimit ?? "∞"}
                        </p>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={coupon.active}
                            onCheckedChange={(checked) => {
                              void updateMutation.mutateAsync({
                                id: coupon.id,
                                payload: { active: Boolean(checked) },
                              });
                            }}
                          />
                          <span className="text-xs">{coupon.active ? "Actif" : "Inactif"}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingCoupon(coupon);
                              setCouponForm(mapCouponToForm(coupon));
                              setDialogOpen(true);
                            }}
                          >
                            Modifier
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setTestCode(coupon.code);
                            }}
                          >
                            Tester le code
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              void deactivateMutation.mutateAsync(coupon.id);
                            }}
                          >
                            Désactiver
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingCoupon(null);
            setCouponForm(EMPTY_FORM);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingCoupon ? "Modifier le coupon" : "Créer un coupon"}</DialogTitle>
            <DialogDescription>
              Configurez la valeur de la réduction, les règles de portée, les limites et la planification.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submitCouponForm();
            }}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Code</Label>
                <Input
                  value={couponForm.code}
                  onChange={(event) =>
                    setCouponForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))
                  }
                  placeholder="SEN10"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={couponForm.type}
                  onValueChange={(value: CouponType) =>
                    setCouponForm((prev) => ({
                      ...prev,
                      type: value,
                      value: value === "FREE_SHIPPING" ? "0" : prev.value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENT">Pourcentage</SelectItem>
                    <SelectItem value="FIXED">Montant fixe</SelectItem>
                    <SelectItem value="FREE_SHIPPING">Livraison gratuite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Actif</Label>
                <div className="flex h-10 items-center rounded-md border px-3">
                  <Switch
                    checked={couponForm.active}
                    onCheckedChange={(checked) =>
                      setCouponForm((prev) => ({ ...prev, active: Boolean(checked) }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Valeur</Label>
                <Input
                  value={couponForm.value}
                  onChange={(event) => setCouponForm((prev) => ({ ...prev, value: event.target.value }))}
                  placeholder={couponForm.type === "PERCENT" ? "10" : "2000"}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sous-total min. (CFA)</Label>
                <Input
                  value={couponForm.minSubtotal}
                  onChange={(event) =>
                    setCouponForm((prev) => ({ ...prev, minSubtotal: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Réduction max. (CFA)</Label>
                <Input
                  value={couponForm.maxDiscount}
                  onChange={(event) =>
                    setCouponForm((prev) => ({ ...prev, maxDiscount: event.target.value }))
                  }
                  placeholder="Facultatif"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Limite d'utilisation</Label>
                <Input
                  value={couponForm.usageLimit}
                  onChange={(event) =>
                    setCouponForm((prev) => ({ ...prev, usageLimit: event.target.value }))
                  }
                  placeholder="Facultatif"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Limite par session</Label>
                <Input
                  value={couponForm.perSessionLimit}
                  onChange={(event) =>
                    setCouponForm((prev) => ({ ...prev, perSessionLimit: event.target.value }))
                  }
                  placeholder="Facultatif"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Date de début</Label>
                <Input
                  type="datetime-local"
                  value={couponForm.startAt}
                  onChange={(event) =>
                    setCouponForm((prev) => ({ ...prev, startAt: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Date de fin</Label>
                <Input
                  type="datetime-local"
                  value={couponForm.endAt}
                  onChange={(event) =>
                    setCouponForm((prev) => ({ ...prev, endAt: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>S'applique à</Label>
                <Select
                  value={couponForm.appliesTo}
                  onValueChange={(value: CouponAppliesTo) =>
                    setCouponForm((prev) => ({
                      ...prev,
                      appliesTo: value,
                      categoryId: value === "CATEGORY" ? prev.categoryId : "",
                      productId: value === "PRODUCT" ? prev.productId : "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tout</SelectItem>
                    <SelectItem value="CATEGORY">Catégorie</SelectItem>
                    <SelectItem value="PRODUCT">Produit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Catégorie</Label>
                <Select
                  value={couponForm.categoryId || "__none__"}
                  onValueChange={(value) =>
                    setCouponForm((prev) => ({
                      ...prev,
                      categoryId: value === "__none__" ? "" : value,
                    }))
                  }
                  disabled={couponForm.appliesTo !== "CATEGORY"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucune</SelectItem>
                    {(categoriesQuery.data || []).map((category) => (
                      <SelectItem key={category.id} value={String(category.id)}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Produit</Label>
                <Select
                  value={couponForm.productId || "__none__"}
                  onValueChange={(value) =>
                    setCouponForm((prev) => ({
                      ...prev,
                      productId: value === "__none__" ? "" : value,
                    }))
                  }
                  disabled={couponForm.appliesTo !== "PRODUCT"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un produit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucun</SelectItem>
                    {(productsQuery.data?.products || []).map((product) => (
                      <SelectItem key={product.id} value={String(product.id)}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Note interne (facultatif)</Label>
              <Textarea
                value={couponForm.note}
                onChange={(event) =>
                  setCouponForm((prev) => ({ ...prev, note: event.target.value }))
                }
                rows={2}
                placeholder="Contexte facultatif pour votre équipe."
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                }}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Enregistrer le coupon
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
