import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface WishlistButtonProps {
  productId: number;
  customerEmail?: string;
  variant?: "icon" | "button";
  size?: "sm" | "md" | "lg";
}

export default function WishlistButton({
  productId,
  customerEmail,
  variant = "icon",
  size = "md",
}: WishlistButtonProps) {
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [email, setEmail] = useState(customerEmail || "");



  const { data: wishlist } = trpc.wishlist.list.useQuery(
    { customerEmail: email },
    { enabled: !!email }
  );

  useEffect(() => {
    if (wishlist) {
      setIsWishlisted(wishlist.some((item: any) => item.productId === productId));
    }
  }, [wishlist, productId]);

  const addToWishlistMutation = trpc.wishlist.add.useMutation({
    onSuccess: () => {
      setIsWishlisted(true);
      toast.success("Ajouté à la liste de souhaits !");
    },
    onError: (error) => {
      toast.error(error.message || "Erreur");
    },
  });

  const removeFromWishlistMutation = trpc.wishlist.remove.useMutation({
    onSuccess: () => {
      setIsWishlisted(false);
      toast.success("Retiré de la liste de souhaits");
    },
    onError: (error) => {
      toast.error(error.message || "Erreur");
    },
  });

  const handleToggleWishlist = async () => {
    if (!email) {
      toast.error("Veuillez entrer votre email");
      return;
    }

    if (isWishlisted) {
      await removeFromWishlistMutation.mutateAsync({
        customerEmail: email,
        productId,
      });
    } else {
      await addToWishlistMutation.mutateAsync({
        customerEmail: email,
        productId,
      });
    }
  };

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  if (variant === "icon") {
    return (
      <button
        onClick={handleToggleWishlist}
        disabled={addToWishlistMutation.isPending || removeFromWishlistMutation.isPending}
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center transition-colors ${
          isWishlisted
            ? "bg-crimson/10 text-crimson hover:bg-crimson/20"
            : "bg-muted hover:bg-muted/80 text-muted-foreground"
        }`}
      >
        <Heart
          className={`h-5 w-5 ${isWishlisted ? "fill-current" : ""}`}
        />
      </button>
    );
  }

  return (
    <Button
      onClick={handleToggleWishlist}
      disabled={addToWishlistMutation.isPending || removeFromWishlistMutation.isPending}
      variant={isWishlisted ? "default" : "outline"}
      className={isWishlisted ? "bg-crimson hover:bg-crimson-light text-white" : ""}
    >
      <Heart className={`h-4 w-4 mr-2 ${isWishlisted ? "fill-current" : ""}`} />
      {isWishlisted ? "Retiré de la liste" : "Ajouter à la liste"}
    </Button>
  );
}
