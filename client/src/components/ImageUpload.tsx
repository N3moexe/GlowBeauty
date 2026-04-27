import { useState, useRef } from "react";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface ImageUploadProps {
  onImageSelected?: (file: File) => void;
  onImageUploaded?: (url: string) => void;
  isLoading?: boolean;
  maxSizeMB?: number;
  acceptedFormats?: string[];
  useS3?: boolean;
}

export function ImageUpload({
  onImageSelected,
  onImageUploaded,
  isLoading = false,
  maxSizeMB = 5,
  acceptedFormats = ["image/jpeg", "image/png", "image/webp"],
  useS3 = true,
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = trpc.imageUpload.uploadProductImage.useMutation();

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      reader.onload = () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        resolve(btoa(binary));
      };
      reader.onerror = reject;
    });
  };

  const uploadToS3 = async (file: File) => {
    try {
      setUploading(true);
      const base64 = await fileToBase64(file);

      const allowedMimes = ["image/jpeg", "image/png", "image/webp"] as const;
      type AllowedMime = (typeof allowedMimes)[number];
      const contentType: AllowedMime = allowedMimes.includes(
        file.type as AllowedMime
      )
        ? (file.type as AllowedMime)
        : "image/jpeg";

      const result = await uploadMutation.mutateAsync({
        fileName: file.name,
        fileData: base64,
        contentType,
      });

      if (result.success && result.url) {
        toast.success("Image uploadée avec succès!");
        if (onImageUploaded) {
          onImageUploaded(result.url);
        }
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Erreur lors de l'upload de l'image");
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (file: File) => {
    // Check file extension as fallback for MIME type validation
    const fileName = file.name.toLowerCase();
    const validExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"];
    const hasValidExtension = validExtensions.some(ext =>
      fileName.endsWith(ext)
    );

    // Accept if MIME type matches OR file extension is valid
    if (!acceptedFormats.includes(file.type) && !hasValidExtension) {
      toast.error("Format non supporté. Utilisez JPG, PNG, WebP, GIF ou BMP.");
      return;
    }

    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      toast.error(`L'image doit faire moins de ${maxSizeMB}MB`);
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    if (onImageSelected) {
      onImageSelected(file);
    }

    if (useS3) {
      await uploadToS3(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const clearPreview = () => {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isProcessing = isLoading || uploading || uploadMutation.isPending;

  return (
    <div className="w-full">
      {preview ? (
        <div className="relative w-full">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-64 object-contain rounded-lg border-2 border-border bg-muted/30"
          />
          <button
            onClick={clearPreview}
            disabled={isProcessing}
            className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          {uploading && (
            <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            isDragging
              ? "border-crimson bg-crimson/5"
              : "border-border hover:border-crimson/50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFormats.join(",")}
            onChange={handleInputChange}
            className="hidden"
            disabled={isProcessing}
          />

          <div className="flex flex-col items-center gap-3">
            {isProcessing ? (
              <Loader2 className="h-8 w-8 text-crimson animate-spin" />
            ) : (
              <>
                <ImageIcon className="h-8 w-8 text-crimson" />
                <div>
                  <p className="font-semibold text-foreground">
                    Cliquez ou glissez une image
                  </p>
                  <p className="text-sm text-muted-foreground">
                    JPG, PNG ou WebP (max {maxSizeMB}MB)
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="mt-2 gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Sélectionner une image
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
