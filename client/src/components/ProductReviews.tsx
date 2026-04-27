import { useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertCircle,
  Loader2,
  MessageSquarePlus,
  Sparkles,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { createProductReview, fetchProductReviews } from "@/lib/reviewsApi";

interface ProductReviewsProps {
  productId: number;
  productName: string;
}

type ReviewFormState = {
  rating: number;
  title: string;
  body: string;
  customerName: string;
  customerEmail: string;
  honeypot: string;
};

const EMPTY_FORM: ReviewFormState = {
  rating: 0,
  title: "",
  body: "",
  customerName: "",
  customerEmail: "",
  honeypot: "",
};

function ReviewStars({
  value,
  onChange,
}: {
  value: number;
  onChange?: (next: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => {
        const star = index + 1;
        return (
          <button
            key={star}
            type="button"
            className="rounded-md p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onChange?.(star)}
            disabled={!onChange}
            aria-label={`${star} sur 5`}
          >
            <Star
              className={`h-4 w-4 ${
                star <= value
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/35"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

export default function ProductReviews({
  productId,
  productName,
}: ProductReviewsProps) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState<ReviewFormState>(EMPTY_FORM);

  const reviewsQuery = useInfiniteQuery({
    queryKey: ["product-reviews", productId],
    queryFn: ({ pageParam }) =>
      fetchProductReviews(productId, {
        limit: 6,
        cursor: pageParam ?? null,
      }),
    initialPageParam: null as number | null,
    getNextPageParam: lastPage => lastPage.nextCursor || null,
    enabled: productId > 0,
  });

  const submitReviewMutation = useMutation({
    mutationFn: createProductReview,
    onSuccess: async () => {
      toast.success("Merci! Votre avis est en attente de validation.");
      setForm(EMPTY_FORM);
      setIsDialogOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["product-reviews", productId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Impossible d'envoyer votre avis.");
    },
  });

  const summary = reviewsQuery.data?.pages[0]?.summary;
  const reviewRows = useMemo(
    () => reviewsQuery.data?.pages.flatMap(page => page.reviews) ?? [],
    [reviewsQuery.data?.pages]
  );

  const canSubmit =
    form.rating >= 1 &&
    form.customerName.trim().length >= 2 &&
    form.body.trim().length >= 8 &&
    !submitReviewMutation.isPending;

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error("Veuillez renseigner une note, votre nom et votre avis.");
      return;
    }
    await submitReviewMutation.mutateAsync({
      productId,
      rating: form.rating,
      title: form.title.trim() || undefined,
      body: form.body.trim(),
      customerName: form.customerName.trim(),
      customerEmail: form.customerEmail.trim() || undefined,
      honeypot: form.honeypot,
    });
  };

  const handleLoadMore = () => {
    if (reviewsQuery.hasNextPage && !reviewsQuery.isFetchingNextPage) {
      void reviewsQuery.fetchNextPage();
    }
  };

  return (
    <section className="mt-12 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">
            Avis clients
          </h2>
          <p className="text-sm text-muted-foreground">
            Partagez votre experience sur {productName}.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="soft" className="rounded-xl">
              <MessageSquarePlus className="h-4 w-4" />
              Ecrire un avis
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Donner votre avis</DialogTitle>
              <DialogDescription>
                Votre avis sera verifie par notre equipe avant publication.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-1">
              <div className="space-y-2">
                <Label>Note</Label>
                <ReviewStars
                  value={form.rating}
                  onChange={rating =>
                    setForm(previous => ({ ...previous, rating }))
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="review-title">Titre (optionnel)</Label>
                <Input
                  id="review-title"
                  value={form.title}
                  onChange={event =>
                    setForm(previous => ({
                      ...previous,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Ex: Texture legere et efficace"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="review-body">Votre avis</Label>
                <Textarea
                  id="review-body"
                  value={form.body}
                  onChange={event =>
                    setForm(previous => ({
                      ...previous,
                      body: event.target.value,
                    }))
                  }
                  placeholder="Decrivez votre experience avec ce produit."
                  rows={5}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="review-name">Nom</Label>
                  <Input
                    id="review-name"
                    value={form.customerName}
                    onChange={event =>
                      setForm(previous => ({
                        ...previous,
                        customerName: event.target.value,
                      }))
                    }
                    placeholder="Votre nom"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="review-email">Email (optionnel)</Label>
                  <Input
                    id="review-email"
                    type="email"
                    value={form.customerEmail}
                    onChange={event =>
                      setForm(previous => ({
                        ...previous,
                        customerEmail: event.target.value,
                      }))
                    }
                    placeholder="vous@email.com"
                  />
                </div>
              </div>

              <input
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                value={form.honeypot}
                onChange={event =>
                  setForm(previous => ({
                    ...previous,
                    honeypot: event.target.value,
                  }))
                }
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {submitReviewMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  "Envoyer l'avis"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {reviewsQuery.isLoading ? (
        <Card className="space-y-3 p-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-20 w-full" />
        </Card>
      ) : reviewsQuery.isError ? (
        <Card className="space-y-3 p-4">
          <p className="text-sm text-destructive">
            Impossible de charger les avis.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void reviewsQuery.refetch()}
          >
            Reessayer
          </Button>
        </Card>
      ) : (
        <Card className="space-y-4 p-4">
          {summary?.reviewsCount ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-3xl font-semibold text-foreground">
                {summary.avgRating ? summary.avgRating.toFixed(1) : "—"}
              </p>
              <ReviewStars value={Math.round(summary.avgRating || 0)} />
              <p className="text-sm text-muted-foreground">
                {summary.reviewsCount} avis publie
                {summary.reviewsCount > 1 ? "s" : ""}
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-xl bg-brand-accent/5 p-3 text-sm text-foreground">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" />
              <span>
                Aucun avis pour le moment.{" "}
                <span className="font-medium">Soyez la première voix.</span>{" "}
                Votre retour aide toute la communauté skincare.
              </span>
            </div>
          )}

          {summary?.breakdown?.length && summary.reviewsCount > 0 ? (
            <div className="grid gap-2 sm:max-w-sm">
              {summary.breakdown.map(row => {
                const ratio =
                  summary.reviewsCount > 0
                    ? Math.round((row.count / summary.reviewsCount) * 100)
                    : 0;
                return (
                  <div
                    key={`breakdown-${row.star}`}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="w-10 text-muted-foreground">
                      {row.star} etoiles
                    </span>
                    <div className="h-2 flex-1 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-amber-400 transition-all"
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-muted-foreground">
                      {row.count}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="space-y-3">
            {reviewRows.length === 0
              ? null
              : reviewRows.map(review => (
                  <article
                    key={review.id}
                    className="rounded-xl border border-border/70 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          {review.title?.trim() || "Avis client"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {review.customerName}
                        </p>
                      </div>
                      <ReviewStars value={review.rating} />
                    </div>
                    <p className="mt-2 text-sm text-foreground/80">
                      {review.body}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      {review.isVerifiedPurchase ? (
                        <Badge variant="outline" className="text-[11px]">
                          Achat verifie
                        </Badge>
                      ) : null}
                      <span>
                        {new Date(review.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </article>
                ))}
          </div>

          {reviewsQuery.hasNextPage ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleLoadMore}
              disabled={reviewsQuery.isFetchingNextPage}
            >
              {reviewsQuery.isFetchingNextPage ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement...
                </>
              ) : (
                "Voir plus d'avis"
              )}
            </Button>
          ) : null}
        </Card>
      )}
    </section>
  );
}
