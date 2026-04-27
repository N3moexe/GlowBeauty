import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Check } from "lucide-react";
import { Link } from "wouter";

interface ComparisonProduct {
  id: number;
  name: string;
  price: number;
  comparePrice?: number;
  description?: string;
  inStock: boolean;
  imageUrl?: string;
  slug: string;
}

interface ProductComparisonProps {
  products: ComparisonProduct[];
  onRemove?: (productId: number) => void;
}

export default function ProductComparison({
  products,
  onRemove,
}: ProductComparisonProps) {
  if (products.length === 0) {
    return null;
  }

  function formatCFA(amount: number) {
    return new Intl.NumberFormat("fr-FR").format(amount) + " CFA";
  }

  return (
    <div className="bg-card border rounded-lg p-6 overflow-x-auto">
      <h3 className="text-lg font-semibold mb-4">Comparaison de produits</h3>
      
      <table className="w-full min-w-max">
        <tbody>
          {/* Product Images */}
          <tr className="border-b">
            <td className="font-medium text-sm py-3 pr-4 sticky left-0 bg-card">Images</td>
            {products.map((p) => (
              <td key={p.id} className="px-4 py-3 text-center">
                <div className="w-32 h-32 rounded-lg overflow-hidden bg-muted mx-auto mb-2">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      N/A
                    </div>
                  )}
                </div>
              </td>
            ))}
          </tr>

          {/* Product Names */}
          <tr className="border-b">
            <td className="font-medium text-sm py-3 pr-4 sticky left-0 bg-card">Produit</td>
            {products.map((p) => (
              <td key={p.id} className="px-4 py-3">
                <Link href={`/p/${p.slug}`} className="font-medium hover:text-crimson transition-colors">
                  {p.name}
                </Link>
              </td>
            ))}
          </tr>

          {/* Prices */}
          <tr className="border-b bg-muted/50">
            <td className="font-medium text-sm py-3 pr-4 sticky left-0 bg-muted/50">Prix</td>
            {products.map((p) => (
              <td key={p.id} className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  <span className="text-lg font-bold text-crimson">{formatCFA(p.price)}</span>
                  {p.comparePrice && (
                    <span className="text-sm text-muted-foreground line-through">
                      {formatCFA(p.comparePrice)}
                    </span>
                  )}
                </div>
              </td>
            ))}
          </tr>

          {/* Stock Status */}
          <tr className="border-b">
            <td className="font-medium text-sm py-3 pr-4 sticky left-0 bg-card">Stock</td>
            {products.map((p) => (
              <td key={p.id} className="px-4 py-3 text-center">
                {p.inStock ? (
                  <Badge className="bg-green-accent/10 text-green-accent border-green-accent/20">
                    <Check className="h-3 w-3 mr-1" /> En stock
                  </Badge>
                ) : (
                  <Badge variant="destructive">Rupture</Badge>
                )}
              </td>
            ))}
          </tr>

          {/* Description */}
          <tr className="border-b">
            <td className="font-medium text-sm py-3 pr-4 sticky left-0 bg-card">Description</td>
            {products.map((p) => (
              <td key={p.id} className="px-4 py-3 text-sm text-muted-foreground">
                {p.description || "N/A"}
              </td>
            ))}
          </tr>

          {/* Actions */}
          <tr>
            <td className="font-medium text-sm py-3 pr-4 sticky left-0 bg-card">Actions</td>
            {products.map((p) => (
              <td key={p.id} className="px-4 py-3 text-center">
                <div className="flex gap-2 justify-center">
                  <Link href={`/p/${p.slug}`}>
                    <Button size="sm" className="bg-crimson hover:bg-crimson-light text-white">
                      Voir
                    </Button>
                  </Link>
                  {onRemove && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() => onRemove(p.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
