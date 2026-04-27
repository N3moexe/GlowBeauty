import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { getAdminModulePath } from "@/lib/adminNavigation";
import AdminLayout from "@/components/admin/AdminLayout";
import PageHeader from "@/components/admin/PageHeader";
import AdminNotAllowed from "@/pages/AdminNotAllowed";
import { Button } from "@/components/ui/button";
import { adminCms, ADMIN_MEDIA_QUERY_KEY } from "@/lib/adminCms";
import { trpc } from "@/lib/trpc";
import type { MediaAsset } from "@shared/storefront-cms";
import { toast } from "sonner";
import { Copy, Loader2, Trash2, Upload } from "lucide-react";

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedMime = (typeof ALLOWED_MIMES)[number];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = () => {
      const bytes = new Uint8Array(reader.result as ArrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++)
        binary += String.fromCharCode(bytes[i]);
      resolve(btoa(binary));
    };
    reader.onerror = () => reject(new Error("Read failed"));
  });
}

export default function AdminMedia() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: permissions, isLoading: permissionsLoading } =
    trpc.rbac.me.useQuery(undefined, { enabled: !!user, retry: false });
  const canAccessCms = permissions?.allowedModules.includes("cms") ?? false;
  const canWriteCms = Boolean(permissions?.canWriteCms);

  const mediaQuery = useQuery({
    queryKey: ADMIN_MEDIA_QUERY_KEY,
    queryFn: adminCms.listMedia,
    enabled: !!user && canAccessCms,
  });

  const uploadMutation = trpc.imageUpload.uploadProductImage.useMutation();

  const registerMutation = useMutation({
    mutationFn: (input: {
      url: string;
      name: string;
      size?: number;
      mimeType?: string;
    }) => adminCms.createMediaAsset(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ADMIN_MEDIA_QUERY_KEY }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminCms.deleteMediaAsset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_MEDIA_QUERY_KEY });
      toast.success("Média supprimé");
    },
    onError: error =>
      toast.error("Suppression impossible", {
        description: error instanceof Error ? error.message : "Réessayez.",
      }),
  });

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setUploading(true);
    try {
      for (const file of arr) {
        const contentType: AllowedMime = ALLOWED_MIMES.includes(
          file.type as AllowedMime
        )
          ? (file.type as AllowedMime)
          : "image/jpeg";
        const base64 = await fileToBase64(file);
        const result = await uploadMutation.mutateAsync({
          fileName: file.name,
          fileData: base64,
          contentType,
        });
        if (result.url) {
          await registerMutation.mutateAsync({
            url: result.url,
            name: file.name,
            size: file.size,
            mimeType: file.type,
          });
        }
      }
      toast.success(`${arr.length} image(s) téléversée(s)`);
    } catch (error) {
      toast.error("Téléversement en échec", {
        description: error instanceof Error ? error.message : "Réessayez.",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (authLoading || permissionsLoading) {
    return (
      <AdminLayout
        activeModule="cms"
        onModuleChange={m => setLocation(getAdminModulePath(m))}
        userName={null}
      >
        <div className="p-10 text-center text-sm text-muted-foreground">
          Chargement…
        </div>
      </AdminLayout>
    );
  }
  if (!user) {
    window.location.href = getLoginUrl();
    return null;
  }
  if (!canAccessCms) {
    return <AdminNotAllowed />;
  }

  const assets = mediaQuery.data ?? [];

  return (
    <AdminLayout
      activeModule="cms"
      userName={user.name}
      onModuleChange={m => setLocation(getAdminModulePath(m))}
    >
      <PageHeader
        breadcrumbs={[{ label: "Admin" }, { label: "Bibliothèque média" }]}
        title="Bibliothèque média"
        description="Téléversez et réutilisez les images de votre boutique (hero, tuiles, logos)."
        actions={
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={e => {
                if (e.target.files) void handleFiles(e.target.files);
              }}
            />
            <Button
              onClick={() => canWriteCms && fileInputRef.current?.click()}
              disabled={uploading || !canWriteCms}
              title={!canWriteCms ? "Lecture seule" : undefined}
            >
              {uploading ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-4 w-4" />
              )}
              Téléverser
            </Button>
          </div>
        }
      />

      {assets.length === 0 && !mediaQuery.isLoading ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Aucune image pour le moment. Téléversez depuis votre téléphone ou
          votre ordinateur pour commencer.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {assets.map(asset => (
            <MediaTile
              key={asset.id}
              asset={asset}
              canDelete={canWriteCms}
              onDelete={() => {
                if (!canWriteCms) return;
                if (!window.confirm(`Supprimer ${asset.name} ?`)) return;
                deleteMutation.mutate(asset.id);
              }}
            />
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

function MediaTile({
  asset,
  onDelete,
  canDelete,
}: {
  asset: MediaAsset;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(asset.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Copie impossible");
    }
  };
  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-card">
      <div className="aspect-square bg-muted/30">
        <img
          src={asset.url}
          alt={asset.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="p-2">
        <p className="truncate text-xs font-medium" title={asset.name}>
          {asset.name}
        </p>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex translate-y-full items-center gap-1 bg-white/95 p-1.5 opacity-0 backdrop-blur transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
        <Button
          size="sm"
          variant="outline"
          className="h-7 flex-1 text-xs"
          onClick={handleCopy}
        >
          <Copy className="mr-1 h-3 w-3" />
          {copied ? "Copié" : "Copier l'URL"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-7"
          onClick={onDelete}
          disabled={!canDelete}
          aria-label="Supprimer"
          title={!canDelete ? "Lecture seule" : undefined}
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
