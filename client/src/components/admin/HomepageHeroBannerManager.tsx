import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Eye, Loader2, Pencil, RefreshCw, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import PageHeader, {
  adminCardClass,
  adminCardPadding,
  adminSpacingScale,
  adminTypographyScale,
} from "@/components/admin/PageHeader";
import StatusBadge from "@/components/admin/StatusBadge";
import EmptyState from "@/components/admin/EmptyState";
import SkeletonTable from "@/components/admin/SkeletonTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createCroppedDataUrl, type CropPixels } from "@/lib/imageCrop";

type HomepageHeroBanner = {
  id: number;
  placement: "homepage_hero";
  title: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
  imageUrl: string;
  imageUrlDesktop: string;
  imageUrlMobile: string;
  cropMeta: string | null;
  status: "draft" | "published";
  priority: number;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CropPreset = {
  id: string;
  label: string;
  width: number;
  height: number;
  aspect: number;
};

const desktopPresets: CropPreset[] = [
  { id: "desktop_1920x800", label: "Desktop hero 1920x800", width: 1920, height: 800, aspect: 1920 / 800 },
  { id: "desktop_21x9", label: "Desktop hero 21:9", width: 2100, height: 900, aspect: 21 / 9 },
];

const mobilePresets: CropPreset[] = [
  { id: "mobile_4x5", label: "Mobile hero 4:5 (1080x1350)", width: 1080, height: 1350, aspect: 4 / 5 },
  { id: "mobile_9x16", label: "Mobile hero 9:16 (1080x1920)", width: 1080, height: 1920, aspect: 9 / 16 },
];

type BannerFormState = {
  title: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
  status: "draft" | "published";
  priority: string;
  startAt: string;
  endAt: string;
  imageUrlDesktop: string;
  imageUrlMobile: string;
};

const initialFormState: BannerFormState = {
  title: "",
  subtitle: "",
  buttonText: "Shop now",
  buttonLink: "/boutique",
  status: "draft",
  priority: "0",
  startAt: "",
  endAt: "",
  imageUrlDesktop: "",
  imageUrlMobile: "",
};

async function requestBannerApi<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "Banner API request failed");
  }

  return payload as T;
}

function toDatetimeLocalValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function toIsoOrNull(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function parseCropMeta(meta: string | null) {
  if (!meta) return null;
  try {
    return JSON.parse(meta);
  } catch {
    return null;
  }
}

function toCropPixels(area: Area | null) {
  if (!area) return null;
  return {
    x: Math.max(0, Math.round(area.x)),
    y: Math.max(0, Math.round(area.y)),
    width: Math.max(1, Math.round(area.width)),
    height: Math.max(1, Math.round(area.height)),
  } as CropPixels;
}

export default function HomepageHeroBannerManager() {
  const [banners, setBanners] = useState<HomepageHeroBanner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishingId, setIsPublishingId] = useState<number | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<BannerFormState>(initialFormState);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const [sourceImage, setSourceImage] = useState("");
  const [previewDesktop, setPreviewDesktop] = useState("");
  const [previewMobile, setPreviewMobile] = useState("");
  const [imageDirty, setImageDirty] = useState(false);

  const [desktopPresetId, setDesktopPresetId] = useState(desktopPresets[0].id);
  const [desktopCrop, setDesktopCrop] = useState({ x: 0, y: 0 });
  const [desktopZoom, setDesktopZoom] = useState(1);
  const [desktopPixels, setDesktopPixels] = useState<Area | null>(null);

  const [mobilePresetId, setMobilePresetId] = useState(mobilePresets[0].id);
  const [mobileCrop, setMobileCrop] = useState({ x: 0, y: 0 });
  const [mobileZoom, setMobileZoom] = useState(1);
  const [mobilePixels, setMobilePixels] = useState<Area | null>(null);

  const desktopPreset = useMemo(
    () => desktopPresets.find(preset => preset.id === desktopPresetId) || desktopPresets[0],
    [desktopPresetId]
  );
  const mobilePreset = useMemo(
    () => mobilePresets.find(preset => preset.id === mobilePresetId) || mobilePresets[0],
    [mobilePresetId]
  );

  const activeCount = useMemo(
    () => banners.filter(item => item.status === "published").length,
    [banners]
  );

  const loadBanners = useCallback(async () => {
    try {
      setIsLoading(true);
      const payload = await requestBannerApi<{ banners: HomepageHeroBanner[] }>(
        "/api/admin/banners?placement=homepage_hero"
      );
      setBanners(payload.banners || []);
    } catch (error: any) {
      console.error("[Admin Hero Banner] list failed", error);
      toast.error(error?.message || "Unable to load banners");
      setBanners([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBanners();
  }, [loadBanners]);

  const resetEditor = () => {
    setSourceImage("");
    setPreviewDesktop("");
    setPreviewMobile("");
    setImageDirty(false);
    setDesktopPresetId(desktopPresets[0].id);
    setDesktopCrop({ x: 0, y: 0 });
    setDesktopZoom(1);
    setDesktopPixels(null);
    setMobilePresetId(mobilePresets[0].id);
    setMobileCrop({ x: 0, y: 0 });
    setMobileZoom(1);
    setMobilePixels(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(initialFormState);
    setInlineError(null);
    resetEditor();
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be smaller than 10MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setSourceImage(result);
      setImageDirty(true);
      setPreviewDesktop("");
      setPreviewMobile("");
    };
    reader.readAsDataURL(file);
  };

  const refreshPreviews = async () => {
    if (!sourceImage) {
      setInlineError("Upload or set a source image first.");
      return;
    }
    const desktopCropPixels = toCropPixels(desktopPixels);
    const mobileCropPixels = toCropPixels(mobilePixels);
    if (!desktopCropPixels || !mobileCropPixels) {
      setInlineError("Move each crop area once so crop coordinates are captured.");
      return;
    }

    setInlineError(null);
    setIsOptimizing(true);
    try {
      const [desktopDataUrl, mobileDataUrl] = await Promise.all([
        createCroppedDataUrl(
          sourceImage,
          desktopCropPixels,
          desktopPreset.width,
          desktopPreset.height
        ),
        createCroppedDataUrl(
          sourceImage,
          mobileCropPixels,
          mobilePreset.width,
          mobilePreset.height
        ),
      ]);

      setPreviewDesktop(desktopDataUrl);
      setPreviewMobile(mobileDataUrl);
      toast.success("Desktop and mobile previews updated.");
    } catch (error: any) {
      console.error("[Admin Hero Banner] preview generation failed", error);
      setInlineError(error?.message || "Unable to generate previews.");
      toast.error(error?.message || "Unable to generate previews.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const optimizeAndStoreImages = async () => {
    if (!sourceImage) {
      throw new Error("Source image is missing.");
    }
    const desktopCropPixels = toCropPixels(desktopPixels);
    const mobileCropPixels = toCropPixels(mobilePixels);
    if (!desktopCropPixels || !mobileCropPixels) {
      throw new Error("Crop data missing. Adjust desktop and mobile crop areas first.");
    }

    const [desktopDataUrl, mobileDataUrl] = await Promise.all([
      createCroppedDataUrl(
        sourceImage,
        desktopCropPixels,
        desktopPreset.width,
        desktopPreset.height
      ),
      createCroppedDataUrl(
        sourceImage,
        mobileCropPixels,
        mobilePreset.width,
        mobilePreset.height
      ),
    ]);

    setPreviewDesktop(desktopDataUrl);
    setPreviewMobile(mobileDataUrl);

    const optimized = await requestBannerApi<{
      imageUrlDesktop: string;
      imageUrlMobile: string;
    }>("/api/admin/banners/optimize", {
      method: "POST",
      body: JSON.stringify({
        desktopImageData: desktopDataUrl,
        mobileImageData: mobileDataUrl,
        desktop: { width: desktopPreset.width, height: desktopPreset.height },
        mobile: { width: mobilePreset.width, height: mobilePreset.height },
        quality: 80,
      }),
    });

    return {
      imageUrlDesktop: optimized.imageUrlDesktop,
      imageUrlMobile: optimized.imageUrlMobile,
      cropMeta: JSON.stringify({
        desktop: {
          presetId: desktopPreset.id,
          zoom: desktopZoom,
          x: desktopCrop.x,
          y: desktopCrop.y,
          pixels: desktopCropPixels,
        },
        mobile: {
          presetId: mobilePreset.id,
          zoom: mobileZoom,
          x: mobileCrop.x,
          y: mobileCrop.y,
          pixels: mobileCropPixels,
        },
      }),
    };
  };

  const handleEdit = (banner: HomepageHeroBanner) => {
    setEditingId(banner.id);
    setInlineError(null);
    setForm({
      title: banner.title,
      subtitle: banner.subtitle,
      buttonText: banner.buttonText,
      buttonLink: banner.buttonLink,
      status: banner.status,
      priority: String(banner.priority),
      startAt: toDatetimeLocalValue(banner.startAt),
      endAt: toDatetimeLocalValue(banner.endAt),
      imageUrlDesktop: banner.imageUrlDesktop || "",
      imageUrlMobile: banner.imageUrlMobile || "",
    });
    setSourceImage(banner.imageUrlDesktop || banner.imageUrl || "");
    setPreviewDesktop(banner.imageUrlDesktop || "");
    setPreviewMobile(banner.imageUrlMobile || "");
    setImageDirty(false);

    const meta = parseCropMeta(banner.cropMeta);
    if (meta?.desktop) {
      if (typeof meta.desktop.presetId === "string") setDesktopPresetId(meta.desktop.presetId);
      if (typeof meta.desktop.zoom === "number") setDesktopZoom(meta.desktop.zoom);
      if (typeof meta.desktop.x === "number" && typeof meta.desktop.y === "number") {
        setDesktopCrop({ x: meta.desktop.x, y: meta.desktop.y });
      }
    }
    if (meta?.mobile) {
      if (typeof meta.mobile.presetId === "string") setMobilePresetId(meta.mobile.presetId);
      if (typeof meta.mobile.zoom === "number") setMobileZoom(meta.mobile.zoom);
      if (typeof meta.mobile.x === "number" && typeof meta.mobile.y === "number") {
        setMobileCrop({ x: meta.mobile.x, y: meta.mobile.y });
      }
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setInlineError("Title is required.");
      return;
    }
    if (!form.buttonText.trim()) {
      setInlineError("Button text is required.");
      return;
    }
    if (!form.buttonLink.trim()) {
      setInlineError("Button link is required.");
      return;
    }

    const startAt = toIsoOrNull(form.startAt);
    const endAt = toIsoOrNull(form.endAt);
    if (form.startAt && !startAt) {
      setInlineError("Invalid start date.");
      return;
    }
    if (form.endAt && !endAt) {
      setInlineError("Invalid end date.");
      return;
    }

    setInlineError(null);
    setIsSaving(true);

    try {
      let imageUrlDesktop = form.imageUrlDesktop;
      let imageUrlMobile = form.imageUrlMobile;
      let cropMeta: string | null | undefined = undefined;

      if (imageDirty || !imageUrlDesktop || !imageUrlMobile) {
        const optimized = await optimizeAndStoreImages();
        imageUrlDesktop = optimized.imageUrlDesktop;
        imageUrlMobile = optimized.imageUrlMobile;
        cropMeta = optimized.cropMeta;
      }

      if (!imageUrlDesktop || !imageUrlMobile) {
        throw new Error("Desktop and mobile hero images are required.");
      }

      const payload = {
        placement: "homepage_hero" as const,
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        buttonText: form.buttonText.trim(),
        buttonLink: form.buttonLink.trim(),
        imageUrl: imageUrlDesktop,
        imageUrlDesktop,
        imageUrlMobile,
        cropMeta: cropMeta ?? undefined,
        status: form.status,
        priority: Number(form.priority) || 0,
        startAt,
        endAt,
      };

      if (editingId) {
        const response = await requestBannerApi<{ banner: HomepageHeroBanner }>(
          `/api/admin/banners/${editingId}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );
        setBanners(prev => prev.map(item => (item.id === editingId ? response.banner : item)));
        toast.success("Hero banner updated.");
      } else {
        const response = await requestBannerApi<{ banner: HomepageHeroBanner }>(
          "/api/admin/banners",
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );
        setBanners(prev => [response.banner, ...prev]);
        toast.success("Hero banner created.");
      }

      await loadBanners();
      setForm(prev => ({
        ...prev,
        imageUrlDesktop,
        imageUrlMobile,
      }));
      setImageDirty(false);
      if (!editingId) resetForm();
    } catch (error: any) {
      console.error("[Admin Hero Banner] save failed", error);
      const message = error?.message || "Failed to save hero banner.";
      setInlineError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishToggle = async (banner: HomepageHeroBanner) => {
    try {
      setIsPublishingId(banner.id);
      const nextStatus = banner.status === "published" ? "draft" : "published";
      const response = await requestBannerApi<{ banner: HomepageHeroBanner }>(
        `/api/admin/banners/${banner.id}/publish`,
        {
          method: "POST",
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      setBanners(prev => prev.map(item => (item.id === banner.id ? response.banner : item)));
      toast.success(nextStatus === "published" ? "Banner published." : "Banner unpublished.");
    } catch (error: any) {
      console.error("[Admin Hero Banner] publish failed", error);
      toast.error(error?.message || "Failed to update publish status.");
    } finally {
      setIsPublishingId(null);
    }
  };

  return (
    <div className={adminSpacingScale.section}>
      <PageHeader
        title="Homepage Hero Banner"
        description="Create premium desktop/mobile hero visuals with crop, zoom, and preview."
        breadcrumbs={[{ label: "Admin" }, { label: "Banners" }]}
        actions={(
          <>
            <Button variant="outline" onClick={() => void loadBanners()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open("/", "_blank", "noopener,noreferrer")}
            >
              <Eye className="mr-2 h-4 w-4" />
              Preview homepage
            </Button>
          </>
        )}
      />

      <div className={`${adminCardClass} ${adminCardPadding} ${adminSpacingScale.stack}`}>
        <h3 className={adminTypographyScale.sectionTitle}>
          {editingId ? `Edit Hero Banner #${editingId}` : "Create Hero Banner"}
        </h3>
        <p className={adminTypographyScale.description}>
          Placement is fixed to <code>homepage_hero</code>. Published banners: {activeCount}
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input
              value={form.title}
              onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))}
              placeholder="Big homepage headline"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(value: "draft" | "published") => setForm(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">draft</SelectItem>
                <SelectItem value="published">published</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Subtitle</Label>
          <Textarea
            rows={3}
            value={form.subtitle}
            onChange={event => setForm(prev => ({ ...prev, subtitle: event.target.value }))}
            placeholder="Supporting hero subtitle"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Button text *</Label>
            <Input
              value={form.buttonText}
              onChange={event => setForm(prev => ({ ...prev, buttonText: event.target.value }))}
              placeholder="Shop now"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Button link *</Label>
            <Input
              value={form.buttonLink}
              onChange={event => setForm(prev => ({ ...prev, buttonLink: event.target.value }))}
              placeholder="/boutique"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Input
              type="number"
              value={form.priority}
              onChange={event => setForm(prev => ({ ...prev, priority: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Start at</Label>
            <Input
              type="datetime-local"
              value={form.startAt}
              onChange={event => setForm(prev => ({ ...prev, startAt: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>End at</Label>
            <Input
              type="datetime-local"
              value={form.endAt}
              onChange={event => setForm(prev => ({ ...prev, endAt: event.target.value }))}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[2fr,1fr]">
          <div className="space-y-1.5">
            <Label>Source image URL</Label>
            <Input
              value={sourceImage}
              onChange={event => {
                setSourceImage(event.target.value);
                setImageDirty(true);
              }}
              placeholder="https://... or data:image/..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Upload image</Label>
            <div className="flex items-center gap-2">
              <Input type="file" accept="image/*" onChange={handleImageUpload} />
              <UploadCloud className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border p-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Desktop crop</Label>
              <Select
                value={desktopPresetId}
                onValueChange={value => {
                  setDesktopPresetId(value);
                  setImageDirty(true);
                }}
              >
                <SelectTrigger className="h-8 w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {desktopPresets.map(preset => (
                    <SelectItem key={preset.id} value={preset.id}>{preset.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative h-[260px] overflow-hidden rounded-lg bg-black">
              {sourceImage ? (
                <Cropper
                  image={sourceImage}
                  crop={desktopCrop}
                  zoom={desktopZoom}
                  aspect={desktopPreset.aspect}
                  onCropChange={value => {
                    setDesktopCrop(value);
                    setImageDirty(true);
                  }}
                  onZoomChange={value => {
                    setDesktopZoom(value);
                    setImageDirty(true);
                  }}
                  onCropComplete={(_, pixels) => setDesktopPixels(pixels)}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-white/70">
                  Upload an image to start desktop crop.
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Zoom ({desktopZoom.toFixed(2)}x)</Label>
              <Input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={desktopZoom}
                onChange={event => {
                  setDesktopZoom(Number(event.target.value));
                  setImageDirty(true);
                }}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border p-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Mobile crop</Label>
              <Select
                value={mobilePresetId}
                onValueChange={value => {
                  setMobilePresetId(value);
                  setImageDirty(true);
                }}
              >
                <SelectTrigger className="h-8 w-[230px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mobilePresets.map(preset => (
                    <SelectItem key={preset.id} value={preset.id}>{preset.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative h-[260px] overflow-hidden rounded-lg bg-black">
              {sourceImage ? (
                <Cropper
                  image={sourceImage}
                  crop={mobileCrop}
                  zoom={mobileZoom}
                  aspect={mobilePreset.aspect}
                  onCropChange={value => {
                    setMobileCrop(value);
                    setImageDirty(true);
                  }}
                  onZoomChange={value => {
                    setMobileZoom(value);
                    setImageDirty(true);
                  }}
                  onCropComplete={(_, pixels) => setMobilePixels(pixels)}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-white/70">
                  Upload an image to start mobile crop.
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Zoom ({mobileZoom.toFixed(2)}x)</Label>
              <Input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={mobileZoom}
                onChange={event => {
                  setMobileZoom(Number(event.target.value));
                  setImageDirty(true);
                }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-3">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold">Desktop + Mobile Preview</h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refreshPreviews()}
              disabled={isOptimizing}
            >
              {isOptimizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Refresh previews
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border p-2">
              <p className="mb-2 text-xs text-muted-foreground">Desktop preview</p>
              {previewDesktop || form.imageUrlDesktop ? (
                <img
                  src={previewDesktop || form.imageUrlDesktop}
                  alt="Desktop preview"
                  className="h-36 w-full rounded object-cover"
                />
              ) : (
                <div className="flex h-36 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                  No desktop preview yet
                </div>
              )}
            </div>
            <div className="rounded-lg border p-2">
              <p className="mb-2 text-xs text-muted-foreground">Mobile preview</p>
              {previewMobile || form.imageUrlMobile ? (
                <img
                  src={previewMobile || form.imageUrlMobile}
                  alt="Mobile preview"
                  className="h-36 w-full rounded object-cover"
                />
              ) : (
                <div className="flex h-36 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                  No mobile preview yet
                </div>
              )}
            </div>
          </div>
        </div>

        {inlineError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {inlineError}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => void handleSave()}
            className="bg-crimson text-white hover:bg-crimson-light"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : editingId ? "Update hero banner" : "Create hero banner"}
          </Button>
          {editingId && (
            <Button variant="outline" onClick={resetForm}>
              Cancel edit
            </Button>
          )}
        </div>
      </div>

      <div className={`${adminCardClass} ${adminCardPadding} ${adminSpacingScale.stack}`}>
        <h3 className={adminTypographyScale.sectionTitle}>Saved hero banners</h3>
        <p className={adminTypographyScale.description}>
          Ordered by priority then update date.
        </p>

        {isLoading ? (
          <SkeletonTable rows={5} />
        ) : banners.length === 0 ? (
          <EmptyState
            title="No homepage hero banners"
            description="Create your first hero banner to power the storefront header."
          />
        ) : (
          <div className="space-y-3">
            {banners.map(banner => (
              <div
                key={banner.id}
                className="flex flex-col gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/20 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex min-w-0 gap-3">
                  {banner.imageUrlDesktop ? (
                    <img
                      src={banner.imageUrlDesktop}
                      alt={banner.title}
                      className="h-16 w-24 rounded-md border object-cover"
                    />
                  ) : (
                    <div className="h-16 w-24 rounded-md border bg-muted" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{banner.title}</p>
                    <p className="truncate text-sm text-muted-foreground">{banner.subtitle}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <StatusBadge status={banner.status} />
                      <span className="text-xs text-muted-foreground">priority: {banner.priority}</span>
                      <span className="text-xs text-muted-foreground">
                        updated: {new Date(banner.updatedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(banner)}
                  >
                    <Pencil className="mr-1 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPublishingId === banner.id}
                    onClick={() => void handlePublishToggle(banner)}
                  >
                    {isPublishingId === banner.id ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : null}
                    {banner.status === "published" ? "Unpublish" : "Publish"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
