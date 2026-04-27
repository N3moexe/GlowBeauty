
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tag, Check, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface CouponInputProps {
  orderAmount: number;
  onCouponApplied?: (discount: number, couponCode: string) => void;
}

export default function CouponInput({ orderAmount, onCouponApplied }: CouponInputProps) {
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);

  const [isValidating, setIsValidating] = useState(false);

  const validateCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error("Veuillez entrer un code");
      return;
    }

    setIsValidating(true);
    try {
      // Use trpc client to call query directly
      const utils = trpc.useUtils();
      const coupon = await utils.client.coupons.validate.query({
        code: couponCode,
        orderAmount,
      }) as any;
      setAppliedCoupon(coupon);
      toast.success(`Code appliqué ! Réduction : ${coupon.discountType === "percentage" ? coupon.discountValue + "%" : formatCFA(coupon.discountValue)}`);
      if (onCouponApplied) {
        const discount = coupon.discountType === "percentage"
          ? (orderAmount * coupon.discountValue) / 100
          : coupon.discountValue;
        onCouponApplied(discount, coupon.code);
      }
    } catch (error: any) {
      toast.error(error.message || "Code invalide");
      setCouponCode("");
    } finally {
      setIsValidating(false);
    }
  };

  const handleApplyCoupon = () => {
    validateCoupon();
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    if (onCouponApplied) {
      onCouponApplied(0, "");
    }
  };

  function formatCFA(amount: number) {
    return new Intl.NumberFormat("fr-FR").format(amount) + " CFA";
  }

  if (appliedCoupon) {
    return (
      <Card className="p-4 bg-green-accent/10 border-green-accent/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Check className="h-5 w-5 text-green-accent" />
            <div>
              <p className="font-semibold text-sm">Code appliqué</p>
              <p className="text-xs text-muted-foreground">{appliedCoupon.code}</p>
            </div>
          </div>
          <button
            onClick={handleRemoveCoupon}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">Code de réduction</label>
      <div className="flex gap-2">
        <Input
          placeholder="Entrez votre code..."
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
        onKeyPress={(e) => e.key === "Enter" && handleApplyCoupon()}
        disabled={isValidating}
        className="flex-1"
        />
        <Button
          onClick={handleApplyCoupon}
          disabled={isValidating || !couponCode.trim()}
          variant="outline"
          className="px-4"
        >
          <Tag className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Vous avez un code de réduction ? Entrez-le pour obtenir une réduction
      </p>
    </div>
  );
}
