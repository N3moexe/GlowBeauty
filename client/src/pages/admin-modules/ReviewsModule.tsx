import { useCallback, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Check, Eye, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import DataTable from "@/components/admin/DataTable";
import StatusBadge from "@/components/admin/StatusBadge";
import { RetryPanel } from "@/pages/admin-modules/shared/RetryPanel";
import { getErrorMessage } from "@/pages/admin-modules/shared/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ReviewEntity = {
  id: number;
  productId: number;
  orderId?: number | null;
  customerName: string;
  customerEmail?: string | null;
  rating: number;
  title?: string | null;
  body?: string | null;
  images?: string[] | null;
  status: "pending" | "approved" | "rejected";
  isVerifiedPurchase?: boolean;
  createdAt: string | Date;
  updatedAt?: string | Date;
};

type ProductRow = { id: number; name: string };

interface ReviewsModuleProps {
  canManage: boolean;
  canDelete: boolean;
}

export function ReviewsModule({ canManage, canDelete }: ReviewsModuleProps) {
  const utils = trpc.useUtils();

  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewStatusFilter, setReviewStatusFilter] = useState<
    "all" | "approved" | "pending" | "rejected"
  >("all");
  const [reviewProductFilter, setReviewProductFilter] = useState<string>("all");
  const [reviewPreview, setReviewPreview] = useState<ReviewEntity | null>(null);

  const reviewsAdminQuery = trpc.reviews.adminList.useQuery(
    { status: reviewStatusFilter, limit: 200, offset: 0 },
    { refetchInterval: 15000 }
  );

  const productsQuery = trpc.product.list.useQuery(undefined);

  const reviewModerateMutation = trpc.reviews.moderate.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.reviews.adminList.invalidate(),
        utils.reviews.list.invalidate(),
        utils.reviews.averageRating.invalidate(),
      ]);
      toast.success("Review status updated");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to update review"));
    },
  });

  const reviewDeleteMutation = trpc.reviews.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.reviews.adminList.invalidate(),
        utils.reviews.list.invalidate(),
        utils.reviews.averageRating.invalidate(),
      ]);
      setReviewPreview(null);
      toast.success("Review deleted");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to delete review"));
    },
  });

  const reviewRows = useMemo(
    () => (reviewsAdminQuery.data?.reviews ?? []) as ReviewEntity[],
    [reviewsAdminQuery.data?.reviews]
  );

  const productRows = useMemo(
    () => (productsQuery.data?.products ?? []) as ProductRow[],
    [productsQuery.data]
  );

  const filteredReviews = useMemo(() => {
    let rows = [...reviewRows];
    if (reviewStatusFilter !== "all")
      rows = rows.filter(r => r.status === reviewStatusFilter);
    if (reviewProductFilter !== "all")
      rows = rows.filter(r => String(r.productId) === reviewProductFilter);
    if (reviewSearch.trim()) {
      const q = reviewSearch.trim().toLowerCase();
      rows = rows.filter(r =>
        [
          r.customerName,
          r.customerEmail ?? "",
          r.title ?? "",
          r.body ?? "",
          String(r.productId),
        ].some(f => f.toLowerCase().includes(q))
      );
    }
    return rows;
  }, [reviewRows, reviewSearch, reviewStatusFilter, reviewProductFilter]);

  const handleReviewStatus = useCallback(
    async (review: ReviewEntity, status: "approved" | "rejected") => {
      if (!canManage) {
        toast.error("Review moderation is not allowed");
        return;
      }
      await reviewModerateMutation.mutateAsync({ id: review.id, status });
    },
    [canManage, reviewModerateMutation]
  );

  const handleDeleteReview = useCallback(
    async (reviewId: number) => {
      if (!canDelete) {
        toast.error("Delete not allowed");
        return;
      }
      await reviewDeleteMutation.mutateAsync({ id: reviewId });
    },
    [canDelete, reviewDeleteMutation]
  );

  const reviewColumns = useMemo<ColumnDef<ReviewEntity>[]>(
    () => [
      {
        accessorKey: "customerName",
        header: "Customer",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-medium">{row.original.customerName}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.customerEmail ?? "No email"}
            </p>
            {row.original.isVerifiedPurchase ? (
              <StatusBadge
                status="approved"
                context="generic"
                label="Verified"
              />
            ) : null}
          </div>
        ),
      },
      {
        id: "product",
        header: "Product",
        cell: ({ row }) => {
          const product = productRows.find(
            p => p.id === row.original.productId
          );
          return (
            <div className="space-y-0.5">
              <p>{product?.name ?? `Product #${row.original.productId}`}</p>
              <p className="text-xs text-muted-foreground">
                ID: {row.original.productId}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "rating",
        header: "Rating",
        cell: ({ row }) => (
          <p className="font-medium">
            {"★".repeat(Math.max(1, Math.min(5, row.original.rating)))}{" "}
            <span className="text-muted-foreground">
              ({row.original.rating}/5)
            </span>
          </p>
        ),
      },
      {
        id: "review",
        header: "Review",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-medium">{row.original.title ?? "Review"}</p>
            <p className="line-clamp-2 max-w-md text-xs text-muted-foreground">
              {row.original.body ?? "No review text"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            context="generic"
            label={
              row.original.status === "approved"
                ? "Published"
                : row.original.status === "rejected"
                  ? "Hidden"
                  : "Pending"
            }
          />
        ),
      },
      {
        id: "createdAt",
        header: "Created",
        cell: ({ row }) => (
          <p className="text-xs text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleDateString("fr-FR")}
          </p>
        ),
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
                setReviewPreview(row.original);
              }}
            >
              <Eye className="mr-1 h-3.5 w-3.5" />
              View
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={e => {
                e.stopPropagation();
                void handleReviewStatus(row.original, "approved");
              }}
              disabled={!canManage || reviewModerateMutation.isPending}
            >
              <Check className="mr-1 h-3.5 w-3.5" />
              Publish
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={e => {
                e.stopPropagation();
                void handleReviewStatus(row.original, "rejected");
              }}
              disabled={!canManage || reviewModerateMutation.isPending}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Hide
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={e => {
                e.stopPropagation();
                void handleDeleteReview(row.original.id);
              }}
              disabled={!canDelete || reviewDeleteMutation.isPending}
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
      handleDeleteReview,
      handleReviewStatus,
      productRows,
      reviewModerateMutation.isPending,
      reviewDeleteMutation.isPending,
    ]
  );

  const reviewsErrorMessage = reviewsAdminQuery.error
    ? getErrorMessage(reviewsAdminQuery.error, "Unable to load reviews.")
    : null;

  return (
    <section className="space-y-6">
      {reviewsErrorMessage ? (
        <RetryPanel
          title="Reviews unavailable"
          description={reviewsErrorMessage}
          onRetry={() => {
            void reviewsAdminQuery.refetch();
          }}
        />
      ) : (
        <DataTable
          columns={reviewColumns}
          data={filteredReviews}
          isLoading={reviewsAdminQuery.isLoading}
          searchValue={reviewSearch}
          onSearchValueChange={setReviewSearch}
          searchPlaceholder="Customer, email, title, product id..."
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={reviewStatusFilter}
                onValueChange={(
                  value: "all" | "approved" | "pending" | "rejected"
                ) => setReviewStatusFilter(value)}
              >
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Published</SelectItem>
                  <SelectItem value="rejected">Hidden</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={reviewProductFilter}
                onValueChange={value => setReviewProductFilter(value)}
              >
                <SelectTrigger className="h-9 w-[220px]">
                  <SelectValue placeholder="Filter product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All products</SelectItem>
                  {productRows.map(product => (
                    <SelectItem
                      key={`review-product-${product.id}`}
                      value={String(product.id)}
                    >
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
          emptyTitle="No reviews"
          emptyDescription="No reviews match your filters."
          getRowId={row => String(row.id)}
        />
      )}

      <Dialog
        open={Boolean(reviewPreview)}
        onOpenChange={open => {
          if (!open) setReviewPreview(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review preview</DialogTitle>
            <DialogDescription>
              Submitted by {reviewPreview?.customerName ?? "Unknown"}
            </DialogDescription>
          </DialogHeader>

          {reviewPreview ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Rating</p>
                <p className="font-medium">
                  {"★".repeat(Math.max(1, Math.min(5, reviewPreview.rating)))}{" "}
                  <span className="text-muted-foreground">
                    ({reviewPreview.rating}/5)
                  </span>
                </p>
              </div>
              {reviewPreview.title ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Title</p>
                  <p className="font-semibold">{reviewPreview.title}</p>
                </div>
              ) : null}
              {reviewPreview.body ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Review</p>
                  <p className="text-sm leading-relaxed">
                    {reviewPreview.body}
                  </p>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Status:</p>
                <StatusBadge
                  status={reviewPreview.status}
                  context="generic"
                  label={
                    reviewPreview.status === "approved"
                      ? "Published"
                      : reviewPreview.status === "rejected"
                        ? "Hidden"
                        : "Pending"
                  }
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void handleReviewStatus(reviewPreview, "approved");
                  }}
                  disabled={!canManage || reviewModerateMutation.isPending}
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Publish
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void handleReviewStatus(reviewPreview, "rejected");
                  }}
                  disabled={!canManage || reviewModerateMutation.isPending}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Hide
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => {
                    void handleDeleteReview(reviewPreview.id);
                  }}
                  disabled={!canDelete || reviewDeleteMutation.isPending}
                >
                  {reviewDeleteMutation.isPending ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                  )}
                  Delete
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
