import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MapPin, Zap, Lock } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface OneClickCheckoutProps {
  cartTotal: number;
  onCheckoutComplete?: () => void;
}

export default function OneClickCheckout({
  cartTotal,
  onCheckoutComplete,
}: OneClickCheckoutProps) {
  const [customerEmail, setCustomerEmail] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: savedAddresses } = trpc.addresses.list.useQuery(
    { customerEmail },
    { enabled: !!customerEmail }
  );

  const handleQuickCheckout = async () => {
    if (!customerEmail || !selectedAddressId) {
      toast.error("Veuillez selectionner une adresse");
      return;
    }

    setIsProcessing(true);
    try {
      // Simulate checkout process
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success("Commande creee avec succes !");
      onCheckoutComplete?.();
    } catch (error) {
      toast.error("Erreur lors de la commande");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-green-accent/5 to-green-accent/10 border-green-accent/20">
      <div className="flex items-start gap-4 mb-4">
        <div className="h-10 w-10 rounded-full bg-green-accent/20 flex items-center justify-center shrink-0">
          <Zap className="h-6 w-6 text-green-accent" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-1">Commande rapide</h3>
          <p className="text-sm text-muted-foreground">
            Finalisez votre achat en quelques secondes avec vos adresses sauvegardees
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Email Input */}
        <div>
          <label className="block text-sm font-medium mb-2">Votre email</label>
          <Input
            type="email"
            placeholder="votre@email.com"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            disabled={isProcessing}
          />
        </div>

        {/* Saved Addresses */}
        {customerEmail && savedAddresses && savedAddresses.length > 0 ? (
          <div>
            <label className="block text-sm font-medium mb-2">Adresse de livraison</label>
            <div className="space-y-2">
              {savedAddresses.map((addr) => (
                <div
                  key={addr.id}
                  onClick={() => setSelectedAddressId(addr.id)}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedAddressId === addr.id
                      ? "border-green-accent bg-green-accent/5"
                      : "border-muted hover:border-green-accent/50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{addr.fullName}</p>
                        {addr.isDefault && (
                          <Badge variant="outline" className="text-xs">
                            Par defaut
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{addr.phone}</p>
                      <p className="text-xs text-muted-foreground">{addr.address}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : customerEmail ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              Aucune adresse sauvegardee. Creez une adresse dans votre profil pour utiliser cette fonction.
            </p>
          </div>
        ) : null}

        {/* Order Summary */}
        <div className="bg-background rounded-lg p-3 border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-bold text-crimson">
              {new Intl.NumberFormat("fr-FR").format(cartTotal)} CFA
            </span>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" /> Paiement securise
          </p>
        </div>

        {/* Action Button */}
        <Button
          onClick={handleQuickCheckout}
          disabled={isProcessing || !customerEmail || !selectedAddressId}
          className="w-full bg-green-accent hover:bg-green-accent-light text-white h-11 font-semibold"
        >
          {isProcessing ? "Traitement..." : "Commander maintenant"}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Vous serez redirige vers le paiement apres confirmation
        </p>
      </div>
    </Card>
  );
}
