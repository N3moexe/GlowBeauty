import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Images, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { adminCms, ADMIN_MEDIA_QUERY_KEY } from "@/lib/adminCms";

type ImagePickerFieldProps = {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  maxSizeMB?: number;
  /** Aspect ratio for the preview — CSS-ish string, e.g. "4/5", "1/1", "16/9". */
  previewRatio?: string;
  /** Visual layout. 'compact' is best for dense admin forms. */
  layout?: "compact" | "stacked";
  allowUrlPaste?: boolean;
  /**
   * On mobile, setting this forwards the file input's `capture` attribute so the
   * OS shows camera + library. Leave undefined to let the OS show its usual picker.
   */
  capture?: "environment" | "user";
};

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedMime = (typeof ALLOWED_MIMES)[number];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      resolve(btoa(binary));
    };
    reader.onerror = () => reject(new Error("Read failed"));
  });
}

export default function ImagePickerField({
  value,
  onChange,
  placeholder = "https://… ou cliquez sur Téléverser",
  maxSizeMB = 5,
  previewRatio = "4/5",
  layout = "compact",
  allowUrlPaste = true,
  capture,
}: ImagePickerFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const uploadMutation = trpc.imageUpload.uploadProductImage.useMutation();
  const queryClient = useQueryClient();

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      toast.error(`L'image doit faire moins de ${maxSizeMB} MB (taille : ${sizeMB.toFixed(1)} MB).`);
      return;
    }
    const contentType: AllowedMime = ALLOWED_MIMES.includes(file.type as AllowedMime)
      ? (file.type as AllowedMime)
      : "image/jpeg";

    try {
      setUploading(true);
      const base64 = await fileToBase64(file);
      const result = await uploadMutation.mutateAsync({
        fileName: file.name,
        fileData: base64,
        contentType,
      });
      if (result?.url) {
        onChange(result.url);
        toast.success("Image téléversée");
        // Best-effort register in the media library so future pickers can
        // reuse this asset. Failures here don't affect the caller's field.
        try {
          await adminCms.createMediaAsset({
            url: result.url,
            name: file.name,
            size: file.size,
            mimeType: file.type,
          });
          queryClient.invalidateQueries({ queryKey: ADMIN_MEDIA_QUERY_KEY });
        } catch {
          // Silent — admin may not have library access in some deploys.
        }
      } else {
        throw new Error("Réponse invalide du serveur");
      }
    } catch (error) {
      toast.error("Échec du téléversement", {
        description: error instanceof Error ? error.message : "Réessayez.",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleClear = () => onChange("");

  const previewStyle = { aspectRatio: previewRatio } as React.CSSProperties;
  const hasImage = value.trim().length > 0;

  return (
    <div className={layout === "stacked" ? "space-y-2" : "space-y-2"}>
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 overflow-hidden rounded-lg border border-border bg-muted/30"
          style={{ ...previewStyle, width: layout === "compact" ? 96 : 128 }}
        >
          {hasImage ? (
            <img
              src={value}
              alt="Aperçu"
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.opacity = "0.35";
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              Aperçu
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          {allowUrlPaste ? (
            <Input
              value={value}
              placeholder={placeholder}
              onChange={(e) => onChange(e.target.value)}
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture={capture}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
              className="sr-only"
              aria-hidden
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePick}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-3.5 w-3.5" />
              )}
              {uploading ? "Téléversement…" : "Téléverser depuis l'appareil"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLibraryOpen(true)}
            >
              <Images className="mr-1.5 h-3.5 w-3.5" />
              Bibliothèque
            </Button>
            {hasImage ? (
              <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
                <X className="mr-1.5 h-3.5 w-3.5" />
                Retirer
              </Button>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Votre téléphone ouvrira automatiquement la galerie ou l'appareil photo.
            JPG / PNG / WebP, {maxSizeMB} MB max.
          </p>
        </div>
      </div>

      <LibraryPickerDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        onPick={(url) => {
          onChange(url);
          setLibraryOpen(false);
        }}
      />
    </div>
  );
}

function LibraryPickerDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (url: string) => void;
}) {
  const query = useQuery({
    queryKey: ADMIN_MEDIA_QUERY_KEY,
    queryFn: adminCms.listMedia,
    enabled: open,
  });

  const assets = query.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bibliothèque média</DialogTitle>
          <DialogDescription>
            Sélectionnez une image déjà téléversée, ou téléversez-en une nouvelle depuis le champ.
          </DialogDescription>
        </DialogHeader>
        {query.isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : assets.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Aucune image pour l'instant. Téléversez depuis votre appareil pour alimenter la bibliothèque.
          </div>
        ) : (
          <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
            {assets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => onPick(asset.url)}
                className="group aspect-square overflow-hidden rounded-lg border border-border bg-muted/30 transition-all hover:border-brand-accent hover:shadow-md"
                title={asset.name}
              >
                <img
                  src={asset.url}
                  alt={asset.name}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
