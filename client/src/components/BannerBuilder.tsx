import { useState, useRef } from "react";
import { Upload, X, ZoomIn, ZoomOut, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface BannerBuilderProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function BannerBuilder({ onSuccess, onCancel }: BannerBuilderProps) {
  const [step, setStep] = useState<"upload" | "edit" | "details">("upload");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [zoom, setZoom] = useState(100);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [bannerData, setBannerData] = useState({
    title: "",
    description: "",
    buttonText: "",
    buttonLink: "",
    position: "top" as const,
    layout: "full-width" as const,
  });

  const utils = trpc.useUtils();
  const createMutation = trpc.banners.create.useMutation();

  const handleImageSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner une image");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image doit faire moins de 5MB");
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
      setStep("edit");
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleImageSelect(files[0]);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleImageSelect(files[0]);
    }
  };

  const handleCreateBanner = async () => {
    if (!bannerData.title.trim()) {
      toast.error("Veuillez entrer un titre");
      return;
    }

    if (!imagePreview) {
      toast.error("Veuillez sélectionner une image");
      return;
    }

    // Compress image to reduce size
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      // Resize to max 600x600px for smaller file size
      if (width > 600 || height > 600) {
        const ratio = Math.min(600 / width, 600 / height);
        width = width * ratio;
        height = height * ratio;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        // Use 50% quality for smaller file size
        const compressedImage = canvas.toDataURL('image/jpeg', 0.5);
        createMutation.mutate(
          {
            ...bannerData,
            imageUrl: compressedImage,
            backgroundColor: "#C41E3A",
            textColor: "#FFFFFF",
          },
          {
            onSuccess: async () => {
              await Promise.all([
                utils.banners.getAll.invalidate(),
                utils.banners.getForPage.invalidate(),
                utils.banners.getActive.invalidate(),
              ]);
              toast.success("Banniere creee avec succes.");
              setImagePreview("");
              setBannerData({
                title: "",
                description: "",
                buttonText: "",
                buttonLink: "",
                position: "top",
                layout: "full-width",
              });
              onSuccess?.();
            },
            onError: (error) => {
              toast.error(error.message || "Erreur lors de la creation de la banniere.");
            },
          }
        );
      }
    };
    img.src = imagePreview;
  };

  if (step === "upload") {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            isDragging ? "border-crimson bg-crimson/5" : "border-gray-300"
          }`}
        >
          <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">Téléchargez votre image</h3>
          <p className="text-sm text-gray-600 mb-4">
            Glissez-déposez votre image ici ou cliquez pour sélectionner
          </p>
          <p className="text-xs text-gray-500 mb-6">
            Formats acceptés: JPG, PNG, WebP (max 5MB)
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <Button
            onClick={handleUploadClick}
            className="bg-crimson hover:bg-crimson/90 text-white"
          >
            Choisir une image
          </Button>

          {onCancel && (
            <Button variant="outline" className="ml-2" onClick={onCancel}>
              Annuler
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (step === "edit") {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Ajustez votre image</h3>
          <div className="bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center h-96">
            <div
              style={{
                transform: `scale(${zoom / 100}) translate(${offsetX}px, ${offsetY}px)`,
                transformOrigin: "center",
                transition: "transform 0.2s",
              }}
            >
              <img src={imagePreview} alt="Preview" className="max-h-96 max-w-full" />
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <ZoomOut className="h-4 w-4" />
              <input
                type="range"
                min="50"
                max="200"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-32"
              />
              <ZoomIn className="h-4 w-4" />
              <span className="text-sm text-gray-600">{zoom}%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <Label className="text-xs">Position X</Label>
              <Input
                type="range"
                min="-100"
                max="100"
                value={offsetX}
                onChange={(e) => setOffsetX(Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs">Position Y</Label>
              <Input
                type="range"
                min="-100"
                max="100"
                value={offsetY}
                onChange={(e) => setOffsetY(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => setStep("details")}
            className="flex-1 bg-green-accent hover:bg-green-accent-light text-white"
          >
            Continuer
          </Button>
          <Button
            onClick={() => {
              setImagePreview("");
              setImageFile(null);
              setStep("upload");
            }}
            variant="outline"
            className="flex-1"
          >
            Changer l'image
          </Button>
        </div>
      </div>
    );
  }

  if (step === "details") {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Détails de la bannière</h3>

          <div className="space-y-4">
            <div>
              <Label>Titre *</Label>
              <Input
                placeholder="Ex: Soldes d'été 50% de réduction"
                value={bannerData.title}
                onChange={(e) => setBannerData({ ...bannerData, title: e.target.value })}
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="Ex: Profitez de nos meilleures offres cette semaine"
                value={bannerData.description}
                onChange={(e) => setBannerData({ ...bannerData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Texte du bouton</Label>
                <Input
                  placeholder="Ex: Voir les offres"
                  value={bannerData.buttonText}
                  onChange={(e) => setBannerData({ ...bannerData, buttonText: e.target.value })}
                />
              </div>
              <div>
                <Label>Lien du bouton</Label>
                <Input
                  placeholder="Ex: /shop"
                  value={bannerData.buttonLink}
                  onChange={(e) => setBannerData({ ...bannerData, buttonLink: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Position</Label>
                <select
                  value={bannerData.position}
                  onChange={(e) => setBannerData({ ...bannerData, position: e.target.value as any })}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="top">Haut de la page</option>
                  <option value="bottom">Bas de la page</option>
                  <option value="hero">Section héro</option>
                </select>
              </div>
              <div>
                <Label>Style</Label>
                <select
                  value={bannerData.layout}
                  onChange={(e) => setBannerData({ ...bannerData, layout: e.target.value as any })}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="full-width">Largeur complète</option>
                  <option value="centered">Centré</option>
                  <option value="side-by-side">Image + Texte</option>
                  <option value="overlay">Image de fond</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleCreateBanner}
            disabled={createMutation.isPending}
            className="flex-1 bg-green-accent hover:bg-green-accent-light text-white"
          >
            {createMutation.isPending ? "Création..." : "Créer la bannière"}
          </Button>
          <Button
            onClick={() => setStep("edit")}
            variant="outline"
            className="flex-1"
          >
            Retour
          </Button>
        </div>
      </div>
    );
  }

  return null;
}


