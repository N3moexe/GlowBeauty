import { useCallback, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Check, Eye, Loader2, RefreshCw, Trash2, X } from "lucide-react";
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
      toast.success("Statut de l'avis mis à jour");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Échec de la mise à jour de l'avis"));
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
      toast.success("Avis supprimé");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Échec de la suppression de l'avis"));
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
        toast.error("La modération des avis n'est pas autorisée");
        return;
      }
      await reviewModerateMutation.mutateAsync({ id: review.id, status });
    },
    [canManage, reviewModerateMutation]
  );

  const handleDeleteReview = useCallback(
    async (reviewId: number) => {
      if (!canDelete) {
        toast.error("Suppression non autorisée");
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
        header: "Client",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-medium">{row.original.customerName}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.customerEmail ?? "Aucun e-mail"}
            </p>
            {row.original.isVerifiedPurchase ? (
              <StatusBadge
                status="approved"
                context="generic"
                label="Vérifié"
              />
            ) : null}
          </div>
        ),
      },
      {
        id: "product",
        header: "Produit",
        cell: ({ row }) => {
          const product = productRows.find(
            p => p.id === row.original.productId
          );
          return (
            <div className="space-y-0.5">
              <p>{product?.name ?? `Produit #${row.original.productId}`}</p>
              <p className="text-xs text-muted-foreground">
                ID: {row.original.productId}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "rating",
        header: "Note",
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
        header: "Avis",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-medium">{row.original.title ?? "Avis"}</p>
            <p className="line-clamp-2 max-w-md text-xs text-muted-foreground">
              {row.original.body ?? "Aucun texte d'avis"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Statut",
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            context="generic"
            label={
              row.original.status === "approved"
                ? "Publié"
                : row.original.status === "rejected"
                  ? "Masqué"
                  : "En attente"
            }
          />
        ),
      },
      {
        id: "createdAt",
        header: "Créé le",
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
              Voir
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-[var(--admin-accent)] text-white hover:bg-[var(--admin-accent-hover)]"
              onClick={e => {
                e.stopPropagation();
                void handleReviewStatus(row.original, "approved");
              }}
              disabled={!canManage || reviewModerateMutation.isPending}
            >
              <Check className="mr-1 h-3.5 w-3.5" />
              Publier
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
              Masquer
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={e => {
                e.stopPropagation();
                void handleDeleteReview(row.original.id);
              }}
              disabled={!canDelete || reviewDeleteMutation.isPending}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Supprimer
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
    ? getErrorMessage(reviewsAdminQuery.error, "Impossible de charger les avis.")
    : null;

  return (
    <section className="space-y-6">
      {reviewsErrorMessage ? (
        <RetryPanel
          title="Avis indisponibles"
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
          searchPlaceholder="Client, e-mail, titre, id produit..."
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={reviewStatusFilter}
                onValueChange={(
                  value: "all" | "approved" | "pending" | "rejected"
                ) => setReviewStatusFilter(value)}
              >
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="approved">Publié</SelectItem>
                  <SelectItem value="rejected">Masqué</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={reviewProductFilter}
                onValueChange={value => setReviewProductFilter(value)}
              >
                <SelectTrigger className="h-9 w-[220px]">
                  <SelectValue placeholder="Filtrer par produit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les produits</SelectItem>
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
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 border-[var(--admin-border)]"
                title="Rafraîchir"
                onClick={() => void reviewsAdminQuery.refetch()}
                disabled={reviewsAdminQuery.isFetching}
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    reviewsAdminQuery.isFetching ? "animate-spin" : ""
                  }`}
                />
              </Button>
            </div>
          }
          emptyTitle="Aucun avis"
          emptyDescription="Aucun avis ne correspond à vos filtres."
          getRowId={row => String(row.id)}
        />
      )}

      <Dialog
        open={Boolean(reviewPreview)}
        onOpenChange={open => {
          if (!open) setReviewPreview(null);
        }}
      >
        <DialogContent className="sm:max-w-lg border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <DialogHeader>
            <DialogTitle className="[font-family:var(--font-admin-display)]">
              Aperçu de l'avis
            </DialogTitle>
            <DialogDescription>
              Soumis par {reviewPreview?.customerName ?? "Inconnu"}
            </DialogDescription>
          </DialogHeader>

          {reviewPreview ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Note</p>
                <p className="font-medium">
                  {"★".repeat(Math.max(1, Math.min(5, reviewPreview.rating)))}{" "}
                  <span className="text-muted-foreground">
                    ({reviewPreview.rating}/5)
                  </span>
                </p>
              </div>
              {reviewPreview.title ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Titre</p>
                  <p className="font-semibold">{reviewPreview.title}</p>
                </div>
              ) : null}
              {reviewPreview.body ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Avis</p>
                  <p className="text-sm leading-relaxed">
                    {reviewPreview.body}
                  </p>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Statut :</p>
                <StatusBadge
                  status={reviewPreview.status}
                  context="generic"
                  label={
                    reviewPreview.status === "approved"
                      ? "Publié"
                      : reviewPreview.status === "rejected"
                        ? "Masqué"
                        : "En attente"
                  }
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button
                  type="button"
                  size="sm"
                  className="bg-[var(--admin-accent)] text-white hover:bg-[var(--admin-accent-hover)]"
                  onClick={() => {
                    void handleReviewStatus(reviewPreview, "approved");
                  }}
                  disabled={!canManage || reviewModerateMutation.isPending}
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Publier
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
                  Masquer
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
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
                  Supprimer
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
