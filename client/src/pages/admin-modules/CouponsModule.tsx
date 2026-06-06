import { useCallback, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import DataTable from "@/components/admin/DataTable";
import StatusBadge from "@/components/admin/StatusBadge";
import { RetryPanel } from "@/pages/admin-modules/shared/RetryPanel";
import {
  formatCFA,
  toDateLabel,
  toDateInputValue,
} from "@/pages/admin-modules/shared/formatters";
import { getErrorMessage } from "@/pages/admin-modules/shared/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type CouponEntity = {
  id: number;
  code: string;
  description: string | null;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmount: number;
  maxUses: number | null;
  currentUses: number;
  isActive: boolean;
  startDate: string | Date | null;
  endDate: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type CouponFormState = {
  code: string;
  description: string;
  discountType: "percentage" | "fixed";
  discountValue: string;
  minOrderAmount: string;
  maxUses: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
};

const EMPTY_COUPON_FORM: CouponFormState = {
  code: "",
  description: "",
  discountType: "percentage",
  discountValue: "",
  minOrderAmount: "0",
  maxUses: "",
  isActive: true,
  startDate: "",
  endDate: "",
};

interface CouponsModuleProps {
  canManage: boolean;
  canDelete: boolean;
}

export function CouponsModule({ canManage, canDelete }: CouponsModuleProps) {
  const utils = trpc.useUtils();

  const [couponSearch, setCouponSearch] = useState("");
  const [couponStatusFilter, setCouponStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState<number | null>(null);
  const [couponPendingDelete, setCouponPendingDelete] =
    useState<CouponEntity | null>(null);
  const [couponForm, setCouponForm] =
    useState<CouponFormState>(EMPTY_COUPON_FORM);

  const couponsQuery = trpc.coupons.list.useQuery(undefined, {
    refetchInterval: 15000,
  });

  const couponCreateMutation = trpc.coupons.create.useMutation({
    onSuccess: async () => {
      await utils.coupons.list.invalidate();
      setCouponModalOpen(false);
      resetCouponEditor();
      toast.success("Promotion created");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to create promotion"));
    },
  });

  const couponUpdateMutation = trpc.coupons.update.useMutation({
    onSuccess: async () => {
      await utils.coupons.list.invalidate();
      setCouponModalOpen(false);
      resetCouponEditor();
      toast.success("Promotion updated");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to update promotion"));
    },
  });

  const couponToggleMutation = trpc.coupons.toggleActive.useMutation({
    onSuccess: async () => {
      await utils.coupons.list.invalidate();
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to toggle promotion"));
    },
  });

  const couponDeleteMutation = trpc.coupons.delete.useMutation({
    onSuccess: async () => {
      await utils.coupons.list.invalidate();
      setCouponPendingDelete(null);
      toast.success("Promotion deleted");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to delete promotion"));
    },
  });

  const couponRows = useMemo(
    () => (couponsQuery.data ?? []) as CouponEntity[],
    [couponsQuery.data]
  );

  const filteredCoupons = useMemo(() => {
    let rows = [...couponRows];
    if (couponStatusFilter === "active") rows = rows.filter(c => c.isActive);
    if (couponStatusFilter === "inactive") rows = rows.filter(c => !c.isActive);
    if (couponSearch.trim()) {
      const q = couponSearch.trim().toLowerCase();
      rows = rows.filter(c =>
        [c.code, c.description ?? "", c.discountType].some(f =>
          f.toLowerCase().includes(q)
        )
      );
    }
    return rows;
  }, [couponRows, couponSearch, couponStatusFilter]);

  const resetCouponEditor = useCallback(() => {
    setEditingCouponId(null);
    setCouponForm(EMPTY_COUPON_FORM);
  }, []);

  const openCreateCouponDialog = useCallback(() => {
    resetCouponEditor();
    setCouponModalOpen(true);
  }, [resetCouponEditor]);

  const openEditCouponDialog = useCallback((coupon: CouponEntity) => {
    setEditingCouponId(coupon.id);
    setCouponForm({
      code: coupon.code ?? "",
      description: coupon.description ?? "",
      discountType: coupon.discountType,
      discountValue: String(coupon.discountValue ?? 0),
      minOrderAmount: String(coupon.minOrderAmount ?? 0),
      maxUses: coupon.maxUses ? String(coupon.maxUses) : "",
      isActive: Boolean(coupon.isActive),
      startDate: toDateInputValue(coupon.startDate),
      endDate: toDateInputValue(coupon.endDate),
    });
    setCouponModalOpen(true);
  }, []);

  const handleToggleCouponStatus = useCallback(
    async (coupon: CouponEntity, checked: boolean) => {
      if (!canManage) return;
      await couponToggleMutation.mutateAsync({
        id: coupon.id,
        isActive: checked,
      });
    },
    [canManage, couponToggleMutation]
  );

  const submitCouponForm = useCallback(async () => {
    if (!canManage) return;
    const code = couponForm.code.trim().toUpperCase();
    if (!code) {
      toast.error("Code is required");
      return;
    }
    const payload = {
      code,
      description: couponForm.description.trim() || undefined,
      discountType: couponForm.discountType,
      discountValue: parseFloat(couponForm.discountValue) || 0,
      minOrderAmount: parseFloat(couponForm.minOrderAmount) || 0,
      maxUses: couponForm.maxUses ? parseInt(couponForm.maxUses, 10) : null,
      isActive: couponForm.isActive,
      startDate: couponForm.startDate || null,
      endDate: couponForm.endDate || null,
    };
    if (editingCouponId) {
      await couponUpdateMutation.mutateAsync({
        id: editingCouponId,
        ...payload,
      });
    } else {
      await couponCreateMutation.mutateAsync(payload);
    }
  }, [
    canManage,
    couponForm,
    editingCouponId,
    couponCreateMutation,
    couponUpdateMutation,
  ]);

  const handleDeleteCoupon = useCallback(async () => {
    if (!couponPendingDelete || !canDelete) return;
    await couponDeleteMutation.mutateAsync({ id: couponPendingDelete.id });
  }, [canDelete, couponDeleteMutation, couponPendingDelete]);

  const couponColumns = useMemo<ColumnDef<CouponEntity>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Code",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-medium">{row.original.code}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.description ?? "No description"}
            </p>
          </div>
        ),
      },
      {
        id: "discount",
        header: "Discount",
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="space-y-0.5">
              <p className="font-medium">
                {c.discountType === "percentage"
                  ? `${c.discountValue}%`
                  : formatCFA(c.discountValue)}
              </p>
              <p className="text-xs text-muted-foreground">
                Min order: {formatCFA(c.minOrderAmount ?? 0)}
              </p>
            </div>
          );
        },
      },
      {
        id: "usage",
        header: "Usage",
        cell: ({ row }) => (
          <p className="text-sm">
            {row.original.currentUses}/{row.original.maxUses ?? "∞"}
          </p>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <StatusBadge
              status={row.original.isActive ? "active" : "inactive"}
              context="generic"
              label={row.original.isActive ? "Active" : "Inactive"}
            />
            <Switch
              checked={row.original.isActive}
              onClick={e => e.stopPropagation()}
              onCheckedChange={checked => {
                void handleToggleCouponStatus(row.original, Boolean(checked));
              }}
              disabled={!canManage || couponToggleMutation.isPending}
            />
          </div>
        ),
      },
      {
        accessorKey: "endDate",
        header: "Expires",
        cell: ({ row }) =>
          row.original.endDate
            ? toDateLabel(row.original.endDate)
            : "No expiry",
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={e => {
                e.stopPropagation();
                openEditCouponDialog(row.original);
              }}
              disabled={!canManage}
            >
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={e => {
                e.stopPropagation();
                setCouponPendingDelete(row.original);
              }}
              disabled={!canDelete}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [
      canDelete,
      canManage,
      couponToggleMutation.isPending,
      handleToggleCouponStatus,
      openEditCouponDialog,
    ]
  );

  const couponsErrorMessage = couponsQuery.error
    ? getErrorMessage(couponsQuery.error, "Unable to load promotions.")
    : null;

  return (
    <section className="space-y-6">
      {couponsErrorMessage ? (
        <RetryPanel
          title="Promotions unavailable"
          description={couponsErrorMessage}
          onRetry={() => {
            void couponsQuery.refetch();
          }}
        />
      ) : (
        <DataTable
          columns={couponColumns}
          data={filteredCoupons}
          isLoading={couponsQuery.isLoading}
          searchValue={couponSearch}
          onSearchValueChange={setCouponSearch}
          searchPlaceholder="Search code or description..."
          filters={
            <Select
              value={couponStatusFilter}
              onValueChange={(value: "all" | "active" | "inactive") =>
                setCouponStatusFilter(value)
              }
            >
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          }
          emptyTitle="No promotions"
          emptyDescription="Create your first promotion code."
          emptyCtaLabel={canManage ? "New promotion" : undefined}
          onEmptyCtaClick={canManage ? openCreateCouponDialog : undefined}
          onRowClick={openEditCouponDialog}
          getRowId={row => String(row.id)}
        />
      )}

      <Dialog
        open={couponModalOpen}
        onOpenChange={open => {
          setCouponModalOpen(open);
          if (!open) resetCouponEditor();
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingCouponId ? "Edit promotion" : "Create promotion"}
            </DialogTitle>
            <DialogDescription>
              Configure discount value, usage limits, and active period.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={e => {
              e.preventDefault();
              void submitCouponForm();
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Promo code</Label>
                <Input
                  value={couponForm.code}
                  onChange={e =>
                    setCouponForm(prev => ({
                      ...prev,
                      code: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="GLOW20"
                />
              </div>
              <div className="space-y-2">
                <Label>Discount type</Label>
                <Select
                  value={couponForm.discountType}
                  onValueChange={(value: "percentage" | "fixed") =>
                    setCouponForm(prev => ({ ...prev, discountType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={couponForm.description}
                onChange={e =>
                  setCouponForm(prev => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Premium skincare promo for first orders."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Discount value</Label>
                <Input
                  value={couponForm.discountValue}
                  onChange={e =>
                    setCouponForm(prev => ({
                      ...prev,
                      discountValue: e.target.value,
                    }))
                  }
                  placeholder={
                    couponForm.discountType === "percentage" ? "20" : "5000"
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Min order (CFA)</Label>
                <Input
                  value={couponForm.minOrderAmount}
                  onChange={e =>
                    setCouponForm(prev => ({
                      ...prev,
                      minOrderAmount: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Max uses</Label>
                <Input
                  value={couponForm.maxUses}
                  onChange={e =>
                    setCouponForm(prev => ({
                      ...prev,
                      maxUses: e.target.value,
                    }))
                  }
                  placeholder="Unlimited if empty"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={couponForm.startDate}
                  onChange={e =>
                    setCouponForm(prev => ({
                      ...prev,
                      startDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>End date</Label>
                <Input
                  type="date"
                  value={couponForm.endDate}
                  onChange={e =>
                    setCouponForm(prev => ({
                      ...prev,
                      endDate: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={couponForm.isActive}
                onCheckedChange={checked =>
                  setCouponForm(prev => ({
                    ...prev,
                    isActive: Boolean(checked),
                  }))
                }
              />
              Promotion active
            </label>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCouponModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  couponCreateMutation.isPending ||
                  couponUpdateMutation.isPending
                }
              >
                {couponCreateMutation.isPending ||
                couponUpdateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save promotion
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(couponPendingDelete)}
        onOpenChange={open => {
          if (!open) setCouponPendingDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete promotion</DialogTitle>
            <DialogDescription>
              This will remove code {couponPendingDelete?.code}.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCouponPendingDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                void handleDeleteCoupon();
              }}
              disabled={couponDeleteMutation.isPending}
            >
              {couponDeleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
