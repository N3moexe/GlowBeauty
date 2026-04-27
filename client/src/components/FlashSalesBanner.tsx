import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function FlashSalesBanner() {
  const { data: flashSales, isLoading } = trpc.flashSales.active.useQuery();
  const [timeLeft, setTimeLeft] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    if (!flashSales || flashSales.length === 0) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const newTimeLeft: { [key: number]: string } = {};

      flashSales.forEach((sale) => {
        const endTime = new Date(sale.endTime).getTime();
        const diff = endTime - now;

        if (diff > 0) {
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          newTimeLeft[sale.id] = `${hours}h ${minutes}m ${seconds}s`;
        }
      });

      setTimeLeft(newTimeLeft);
    }, 1000);

    return () => clearInterval(interval);
  }, [flashSales]);

  if (isLoading || !flashSales || flashSales.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {flashSales.map((sale) => (
          <Card key={sale.id} className="p-4 bg-gradient-to-br from-crimson/10 to-crimson/5 border-crimson/20">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-crimson" />
                <h3 className="font-semibold text-sm text-foreground">Vente Flash</h3>
              </div>
              <Badge className="bg-crimson text-white text-xs">
                -{sale.discountPercentage}%
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground mb-3">Reduction speciale en cours</p>

            <div className="flex items-center gap-2 text-xs text-crimson font-semibold">
              <Clock className="h-3 w-3" />
              <span>{timeLeft[sale.id] || "Chargement..."}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
