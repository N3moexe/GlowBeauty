import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface SavedAddressesProps {
  customerEmail: string;
  onAddressSelected?: (address: any) => void;
}

export default function SavedAddresses({
  customerEmail,
  onAddressSelected,
}: SavedAddressesProps) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    label: "",
    fullName: "",
    phone: "",
    address: "",
  });

  const { data: addresses, refetch } = trpc.addresses.list.useQuery({
    customerEmail,
  });

  const saveAddressMutation = trpc.addresses.save.useMutation({
    onSuccess: () => {
      toast.success("Adresse sauvegardée !");
      setFormData({ label: "", fullName: "", phone: "", address: "" });
      setShowForm(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erreur");
    },
  });

  const handleSaveAddress = async () => {
    if (!formData.fullName || !formData.phone || !formData.address) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    await saveAddressMutation.mutateAsync({
      customerEmail,
      ...formData,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Adresses sauvegardées</h3>
        <Button
          onClick={() => setShowForm(!showForm)}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 bg-muted/50">
          <div className="space-y-3">
            <Input
              placeholder="Libellé (Domicile, Bureau, etc.)"
              value={formData.label}
              onChange={(e) =>
                setFormData({ ...formData, label: e.target.value })
              }
            />
            <Input
              placeholder="Nom complet"
              value={formData.fullName}
              onChange={(e) =>
                setFormData({ ...formData, fullName: e.target.value })
              }
            />
            <Input
              placeholder="Téléphone"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
            />
            <Input
              placeholder="Adresse complète"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
            />
            <div className="flex gap-2">
              <Button
                onClick={handleSaveAddress}
                disabled={saveAddressMutation.isPending}
                className="flex-1 bg-green-accent hover:bg-green-accent-light text-white"
              >
                Enregistrer
              </Button>
              <Button
                onClick={() => setShowForm(false)}
                variant="outline"
                className="flex-1"
              >
                Annuler
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {addresses && addresses.length > 0 ? (
          addresses.map((addr) => (
            <Card
              key={addr.id}
              className="p-4 cursor-pointer hover:border-crimson/50 transition-colors"
              onClick={() => onAddressSelected?.(addr)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {addr.label && (
                      <Badge variant="outline" className="text-xs">
                        {addr.label}
                      </Badge>
                    )}
                    {addr.isDefault && (
                      <Badge className="bg-green-accent text-white text-xs">
                        Par défaut
                      </Badge>
                    )}
                  </div>
                  <p className="font-semibold text-sm">{addr.fullName}</p>
                  <p className="text-sm text-muted-foreground">{addr.phone}</p>
                  <p className="text-sm text-muted-foreground">{addr.address}</p>
                </div>
                <button className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucune adresse sauvegardée
          </p>
        )}
      </div>
    </div>
  );
}
