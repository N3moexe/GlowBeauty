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
    throw new Error("Coupon value must be a valid number.");
  }
  if (minSubtotal === null || minSubtotal < 0) {
    throw new Error("Minimum subtotal must be a valid number.");
  }
  if (form.type === "PERCENT" && (value < 1 || value > 100)) {
    throw new Error("Percent coupons must be between 1 and 100.");
  }
  if (form.type === "FIXED" && value < 1) {
    throw new Error("Fixed coupon value must be greater than 0.");
  }
  if (form.type === "FREE_SHIPPING" && value !== 0) {
    throw new Error("Free shipping coupon value must be 0.");
  }
  if (form.appliesTo === "CATEGORY" && !form.categoryId.trim()) {
    throw new Error("Select a category for CATEGORY coupons.");
  }
  if (form.appliesTo === "PRODUCT" && !form.productId.trim()) {
    throw new Error("Select a product for PRODUCT coupons.");
  }
  const startAt = fromDateTimeInput(form.startAt);
  const endAt = fromDateTimeInput(form.endAt);
  if (startAt && endAt && new Date(startAt) > new Date(endAt)) {
    throw new Error("End date must be after start date.");
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
      toast.success("Coupon created");
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
      toast.success("Coupon updated");
      await refreshCoupons();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateAdminCoupon(id),
    onSuccess: async () => {
      toast.success("Coupon deactivated");
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
        toast.error("Coupon code is required.");
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
      toast.error(error?.message || "Unable to save coupon.");
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
          description="Manage discount logic applied at checkout and payment."
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
                Refresh
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
                New coupon
              </Button>
            </div>
          }
        />

        <section className="rounded-xl border bg-card p-4">
          <h3 className="text-base font-semibold">Test Coupon</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Preview coupon validation for a session cart without persisting.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Session ID</Label>
              <Input
                value={testSessionId}
                onChange={(event) => setTestSessionId(event.target.value)}
                placeholder="session-abc123..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Coupon code</Label>
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
                      `OK: discount=${formatCFA(result.discountAmount)}, total=${formatCFA(result.total)}`
                    );
                  } catch (error: any) {
                    const couponError = error as CouponApiError;
                    setTestOutput(
                      `ERROR${couponError.code ? ` (${couponError.code})` : ""}: ${couponError.message}`
                    );
                  }
                }}
              >
                Test
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
                placeholder="Search code, type, scope..."
                className="h-9 w-[260px]"
              />
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger className="h-9 w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
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
                  <th className="px-2 py-2 font-medium">Value</th>
                  <th className="px-2 py-2 font-medium">Min subtotal</th>
                  <th className="px-2 py-2 font-medium">Scope</th>
                  <th className="px-2 py-2 font-medium">Usage</th>
                  <th className="px-2 py-2 font-medium">Active</th>
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
                      No coupons found.
                    </td>
                  </tr>
                ) : (
                  filteredCoupons.map((coupon) => (
                    <tr key={coupon.id} className="border-b align-top">
                      <td className="px-2 py-3">
                        <p className="font-medium">{coupon.code}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {coupon.startAt ? `Start: ${new Date(coupon.startAt).toLocaleString()}` : "No start"}
                          {" · "}
                          {coupon.endAt ? `End: ${new Date(coupon.endAt).toLocaleString()}` : "No end"}
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
                            <SelectItem value="PERCENT">PERCENT</SelectItem>
                            <SelectItem value="FIXED">FIXED</SelectItem>
                            <SelectItem value="FREE_SHIPPING">FREE_SHIPPING</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-3">
                        {coupon.type === "PERCENT" ? `${coupon.value}%` : formatCFA(coupon.value)}
                        {coupon.maxDiscount != null ? (
                          <p className="text-xs text-muted-foreground">
                            Cap: {formatCFA(coupon.maxDiscount)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-2 py-3">{formatCFA(coupon.minSubtotal)}</td>
                      <td className="px-2 py-3">
                        <p>{coupon.appliesTo}</p>
                        {coupon.appliesTo === "CATEGORY" && coupon.categoryId ? (
                          <p className="text-xs text-muted-foreground">Category #{coupon.categoryId}</p>
                        ) : null}
                        {coupon.appliesTo === "PRODUCT" && coupon.productId ? (
                          <p className="text-xs text-muted-foreground">Product #{coupon.productId}</p>
                        ) : null}
                      </td>
                      <td className="px-2 py-3">
                        <p>{coupon.usageCount}</p>
                        <p className="text-xs text-muted-foreground">
                          limit {coupon.usageLimit ?? "∞"} / session {coupon.perSessionLimit ?? "∞"}
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
                          <span className="text-xs">{coupon.active ? "Active" : "Inactive"}</span>
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
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setTestCode(coupon.code);
                            }}
                          >
                            Test code
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              void deactivateMutation.mutateAsync(coupon.id);
                            }}
                          >
                            Deactivate
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
            <DialogTitle>{editingCoupon ? "Edit coupon" : "Create coupon"}</DialogTitle>
            <DialogDescription>
              Configure discount value, scope rules, limits and schedule.
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
                    <SelectItem value="PERCENT">PERCENT</SelectItem>
                    <SelectItem value="FIXED">FIXED</SelectItem>
                    <SelectItem value="FREE_SHIPPING">FREE_SHIPPING</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Active</Label>
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
                <Label>Value</Label>
                <Input
                  value={couponForm.value}
                  onChange={(event) => setCouponForm((prev) => ({ ...prev, value: event.target.value }))}
                  placeholder={couponForm.type === "PERCENT" ? "10" : "2000"}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Min subtotal (CFA)</Label>
                <Input
                  value={couponForm.minSubtotal}
                  onChange={(event) =>
                    setCouponForm((prev) => ({ ...prev, minSubtotal: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Max discount (CFA)</Label>
                <Input
                  value={couponForm.maxDiscount}
                  onChange={(event) =>
                    setCouponForm((prev) => ({ ...prev, maxDiscount: event.target.value }))
                  }
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Usage limit</Label>
                <Input
                  value={couponForm.usageLimit}
                  onChange={(event) =>
                    setCouponForm((prev) => ({ ...prev, usageLimit: event.target.value }))
                  }
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Per-session limit</Label>
                <Input
                  value={couponForm.perSessionLimit}
                  onChange={(event) =>
                    setCouponForm((prev) => ({ ...prev, perSessionLimit: event.target.value }))
                  }
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Start at</Label>
                <Input
                  type="datetime-local"
                  value={couponForm.startAt}
                  onChange={(event) =>
                    setCouponForm((prev) => ({ ...prev, startAt: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>End at</Label>
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
                <Label>Applies to</Label>
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
                    <SelectItem value="ALL">ALL</SelectItem>
                    <SelectItem value="CATEGORY">CATEGORY</SelectItem>
                    <SelectItem value="PRODUCT">PRODUCT</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Category</Label>
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
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {(categoriesQuery.data || []).map((category) => (
                      <SelectItem key={category.id} value={String(category.id)}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Product</Label>
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
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
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
              <Label>Internal note (optional)</Label>
              <Textarea
                value={couponForm.note}
                onChange={(event) =>
                  setCouponForm((prev) => ({ ...prev, note: event.target.value }))
                }
                rows={2}
                placeholder="Optional context for your team."
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
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save coupon
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
