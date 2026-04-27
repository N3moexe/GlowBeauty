import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, ArrowLeft, UploadCloud, Save } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/admin/AdminLayout";
import EditorialHero from "@/components/home/EditorialHero";
import HomeHero from "@/components/home/HomeHero";
import EditorialResultsSection from "@/components/home/EditorialResultsSection";
import PageHeader from "@/components/admin/PageHeader";
import DataTable from "@/components/admin/DataTable";
import StatusBadge from "@/components/admin/StatusBadge";
import EmptyState from "@/components/admin/EmptyState";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import AdminNotAllowed from "@/pages/AdminNotAllowed";
import { getAdminModulePath } from "@/lib/adminNavigation";
import type { AdminModuleKey } from "@/components/admin/SidebarNav";
import {
  CMS_HOME_HERO_ADMIN_QUERY_KEY,
  CMS_HOME_HERO_PUBLIC_QUERY_KEY,
  fetchAdminHomeHero,
  makeHomeHeroFallback,
  notifyHomeHeroUpdated,
  updateAdminHomeHero,
  uploadAdminHomeHeroImage,
} from "@/lib/cmsHomeHero";
import {
  CMS_RESULTS_SECTION_ADMIN_QUERY_KEY,
  CMS_RESULTS_SECTION_PUBLIC_QUERY_KEY,
  fetchAdminResultsSection,
  makeResultsSectionFallback,
  notifyResultsSectionUpdated,
  updateAdminResultsSection,
  uploadAdminResultsSectionImage,
  type CmsResultsSection,
} from "@/lib/cmsResultsSection";
import {
  CMS_EDITORIAL_HERO_ADMIN_QUERY_KEY,
  CMS_EDITORIAL_HERO_PUBLIC_QUERY_KEY,
  fetchAdminEditorialHero,
  makeEditorialHeroFallback,
  notifyEditorialHeroUpdated,
  updateAdminEditorialHero,
  uploadAdminEditorialHeroImage,
  type CmsEditorialHeroBlock,
  type CmsEditorialHeroCardPosition,
} from "@/lib/cmsEditorialHero";

const cmsEditorSchema = z.object({
  title: z.string().trim().min(1, "Le titre est obligatoire."),
  slug: z.string().trim().min(1, "Le slug est obligatoire."),
  status: z.enum(["draft", "published"]),
  content: z.string().trim().min(1, "Le contenu est obligatoire."),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
});

type CmsEditorValues = z.infer<typeof cmsEditorSchema>;

const defaultCmsValues: CmsEditorValues = {
  title: "",
  slug: "",
  status: "draft",
  content: "",
  seoTitle: "",
  seoDescription: "",
};

type HomeHeroFormValues = {
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaText: string;
  ctaLink: string;
  secondaryCtaText: string;
  secondaryCtaLink: string;
  badgeText: string;
  isActive: boolean;
};

const defaultHomeHeroForm: HomeHeroFormValues = {
  title: "",
  subtitle: "",
  imageUrl: "",
  ctaText: "Voir la boutique",
  ctaLink: "/boutique",
  secondaryCtaText: "Trouver mon type de peau",
  secondaryCtaLink: "/boutique?q=routine",
  badgeText: "Editorial skincare",
  isActive: true,
};

type EditorialHeroFormValues = {
  isActive: boolean;
  badgeText: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  backgroundImageUrl: string;
  overlayOpacity: number;
  cardPosition: CmsEditorialHeroCardPosition;
};

const defaultEditorialHeroForm: EditorialHeroFormValues = {
  isActive: true,
  badgeText: "RITUEL SIGNATURE",
  title: "Un rituel skincare elegant, pense pour votre peau.",
  subtitle:
    "Des actifs premium, une routine simple et des resultats visibles, jour apres jour.",
  ctaText: "Decouvrir la routine",
  ctaLink: "/boutique",
  backgroundImageUrl: "",
  overlayOpacity: 55,
  cardPosition: "left",
};

type ResultsSectionFormValues = {
  enabled: boolean;
  title: string;
  subtitle: string;
  beforeLabel: string;
  afterLabel: string;
  beforeImageUrl: string;
  afterImageUrl: string;
  stat1Value: string;
  stat1Title: string;
  stat1Desc: string;
  stat2Value: string;
  stat2Title: string;
  stat2Desc: string;
  stat3Value: string;
  stat3Title: string;
  stat3Desc: string;
  footerNote: string;
};

function mapResultsSectionToForm(
  section: CmsResultsSection
): ResultsSectionFormValues {
  return {
    enabled: Boolean(section.enabled),
    title: section.title || "",
    subtitle: section.subtitle || "",
    beforeLabel: section.beforeLabel || "AVANT",
    afterLabel: section.afterLabel || "APRES",
    beforeImageUrl: section.beforeImageUrl || "",
    afterImageUrl: section.afterImageUrl || "",
    stat1Value: section.stat1Value || "",
    stat1Title: section.stat1Title || "",
    stat1Desc: section.stat1Desc || "",
    stat2Value: section.stat2Value || "",
    stat2Title: section.stat2Title || "",
    stat2Desc: section.stat2Desc || "",
    stat3Value: section.stat3Value || "",
    stat3Title: section.stat3Title || "",
    stat3Desc: section.stat3Desc || "",
    footerNote: section.footerNote || "",
  };
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminCms() {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();
  const params = useParams<{ id?: string }>();
  const isCreate = location === "/admin/cms/new";
  const cmsId = params.id ? Number(params.id) : null;
  const isEditing = Number.isFinite(cmsId) && cmsId !== null;
  const isEditor = isCreate || isEditing;

  const {
    data: permissions,
    isLoading: permissionsLoading,
    error: permissionsError,
  } = trpc.rbac.me.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  const canWrite = Boolean(permissions?.canWriteCms);

  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "draft" | "published"
  >("all");
  const [editorialHeroForm, setEditorialHeroForm] =
    useState<EditorialHeroFormValues>(defaultEditorialHeroForm);
  const [editorialHeroImagePreview, setEditorialHeroImagePreview] =
    useState("");
  const [editorialHeroImageName, setEditorialHeroImageName] = useState("");
  const [heroForm, setHeroForm] =
    useState<HomeHeroFormValues>(defaultHomeHeroForm);
  const [heroImagePreview, setHeroImagePreview] = useState("");
  const [heroImageName, setHeroImageName] = useState("");
  const [resultsForm, setResultsForm] = useState<ResultsSectionFormValues>(() =>
    mapResultsSectionToForm(makeResultsSectionFallback())
  );
  const [beforeImagePreview, setBeforeImagePreview] = useState("");
  const [beforeImageName, setBeforeImageName] = useState("");
  const [afterImagePreview, setAfterImagePreview] = useState("");
  const [afterImageName, setAfterImageName] = useState("");

  const cmsListQuery = trpc.cms.list.useQuery(
    {
      search: search || undefined,
      status: statusFilter,
      limit: 200,
    },
    { enabled: !isEditor && !!permissions }
  );
  const cmsDetailQuery = trpc.cms.byId.useQuery(
    { id: cmsId! },
    { enabled: isEditing && !!cmsId && !!permissions }
  );
  const homeHeroAdminQuery = useQuery({
    queryKey: CMS_HOME_HERO_ADMIN_QUERY_KEY,
    queryFn: fetchAdminHomeHero,
    enabled: !isEditor && !!permissions,
    staleTime: 5_000,
  });
  const editorialHeroAdminQuery = useQuery({
    queryKey: CMS_EDITORIAL_HERO_ADMIN_QUERY_KEY,
    queryFn: fetchAdminEditorialHero,
    enabled: !isEditor && !!permissions,
    staleTime: 5_000,
  });
  const resultsSectionAdminQuery = useQuery({
    queryKey: CMS_RESULTS_SECTION_ADMIN_QUERY_KEY,
    queryFn: fetchAdminResultsSection,
    enabled: !isEditor && !!permissions,
    staleTime: 5_000,
  });

  const saveHomeHero = useMutation({
    mutationFn: () => updateAdminHomeHero(heroForm),
    onSuccess: async updatedHero => {
      if (updatedHero) {
        setHeroForm({
          title: updatedHero.title || "",
          subtitle: updatedHero.subtitle || "",
          imageUrl: updatedHero.imageUrl || "",
          ctaText: updatedHero.ctaText || "Voir la boutique",
          ctaLink: updatedHero.ctaLink || "/boutique",
          secondaryCtaText:
            updatedHero.secondaryCtaText || "Trouver mon type de peau",
          secondaryCtaLink:
            updatedHero.secondaryCtaLink || "/boutique?q=routine",
          badgeText: updatedHero.badgeText || "Editorial skincare",
          isActive: Boolean(updatedHero.isActive),
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: CMS_HOME_HERO_ADMIN_QUERY_KEY,
        }),
        queryClient.invalidateQueries({
          queryKey: CMS_HOME_HERO_PUBLIC_QUERY_KEY,
        }),
        utils.banners.getForPage.invalidate({
          page: "homepage",
          position: "hero",
        }),
      ]);
      notifyHomeHeroUpdated();
      toast.success("Hero homepage mis a jour.");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Impossible de sauvegarder le hero.");
    },
  });

  const saveEditorialHero = useMutation({
    mutationFn: () => updateAdminEditorialHero(editorialHeroForm),
    onSuccess: async updatedHero => {
      if (updatedHero) {
        setEditorialHeroForm({
          isActive: Boolean(updatedHero.isActive),
          badgeText: updatedHero.badgeText || "",
          title: updatedHero.title || "",
          subtitle: updatedHero.subtitle || "",
          ctaText: updatedHero.ctaText || "",
          ctaLink: updatedHero.ctaLink || "",
          backgroundImageUrl: updatedHero.backgroundImageUrl || "",
          overlayOpacity: Number(updatedHero.overlayOpacity || 55),
          cardPosition: (updatedHero.cardPosition ||
            "left") as CmsEditorialHeroCardPosition,
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: CMS_EDITORIAL_HERO_ADMIN_QUERY_KEY,
        }),
        queryClient.invalidateQueries({
          queryKey: CMS_EDITORIAL_HERO_PUBLIC_QUERY_KEY,
        }),
      ]);
      notifyEditorialHeroUpdated();
      toast.success("Editorial hero mis a jour.");
    },
    onError: (error: any) => {
      toast.error(
        error?.message || "Impossible de sauvegarder l'editorial hero."
      );
    },
  });

  const uploadEditorialHeroImage = useMutation({
    mutationFn: (file: File) => uploadAdminEditorialHeroImage(file),
    onSuccess: url => {
      setEditorialHeroForm(previous => ({
        ...previous,
        backgroundImageUrl: url,
      }));
      setEditorialHeroImagePreview(url);
      toast.success("Image editorial hero uploadee.");
    },
    onError: (error: any) => {
      toast.error(
        error?.message || "Echec de l'upload de l'image editorial hero."
      );
    },
  });

  const uploadHomeHeroImage = useMutation({
    mutationFn: (file: File) => uploadAdminHomeHeroImage(file),
    onSuccess: url => {
      setHeroForm(previous => ({ ...previous, imageUrl: url }));
      setHeroImagePreview(url);
      toast.success("Image hero uploadee.");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Echec de l'upload de l'image hero.");
    },
  });

  const saveResultsSection = useMutation({
    mutationFn: () =>
      updateAdminResultsSection({
        enabled: resultsForm.enabled,
        title: resultsForm.title,
        subtitle: resultsForm.subtitle,
        beforeLabel: resultsForm.beforeLabel,
        afterLabel: resultsForm.afterLabel,
        beforeImageUrl: resultsForm.beforeImageUrl || null,
        afterImageUrl: resultsForm.afterImageUrl || null,
        stat1Value: resultsForm.stat1Value,
        stat1Title: resultsForm.stat1Title,
        stat1Desc: resultsForm.stat1Desc,
        stat2Value: resultsForm.stat2Value,
        stat2Title: resultsForm.stat2Title,
        stat2Desc: resultsForm.stat2Desc,
        stat3Value: resultsForm.stat3Value,
        stat3Title: resultsForm.stat3Title,
        stat3Desc: resultsForm.stat3Desc,
        footerNote: resultsForm.footerNote,
      }),
    onSuccess: async updatedSection => {
      if (updatedSection) {
        setResultsForm(mapResultsSectionToForm(updatedSection));
        setBeforeImagePreview(updatedSection.beforeImageUrl || "");
        setAfterImagePreview(updatedSection.afterImageUrl || "");
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: CMS_RESULTS_SECTION_ADMIN_QUERY_KEY,
        }),
        queryClient.invalidateQueries({
          queryKey: CMS_RESULTS_SECTION_PUBLIC_QUERY_KEY,
        }),
      ]);
      notifyResultsSectionUpdated();
      toast.success("Section editorial results mise a jour.");
    },
    onError: (error: any) => {
      toast.error(
        error?.message ||
          "Impossible de sauvegarder la section editorial results."
      );
    },
  });

  const uploadResultsImage = useMutation({
    mutationFn: async ({
      file,
      target,
    }: {
      file: File;
      target: "before" | "after";
    }) => {
      const url = await uploadAdminResultsSectionImage(file);
      return { target, url, fileName: file.name };
    },
    onSuccess: ({ target, url, fileName }) => {
      if (target === "before") {
        setResultsForm(previous => ({ ...previous, beforeImageUrl: url }));
        setBeforeImagePreview(url);
        setBeforeImageName(fileName);
      } else {
        setResultsForm(previous => ({ ...previous, afterImageUrl: url }));
        setAfterImagePreview(url);
        setAfterImageName(fileName);
      }
      toast.success("Image editorial results uploadee.");
    },
    onError: (error: any) => {
      toast.error(
        error?.message || "Echec de l'upload de l'image editorial results."
      );
    },
  });

  const createCms = trpc.cms.create.useMutation({
    onSuccess: result => {
      toast.success("Page CMS creee");
      utils.cms.list.invalidate();
      setLocation(`/admin/cms/${result.id}`);
    },
    onError: error => toast.error(error.message),
  });

  const updateCms = trpc.cms.update.useMutation({
    onSuccess: () => {
      toast.success("Page CMS mise a jour");
      utils.cms.list.invalidate();
      if (cmsId) utils.cms.byId.invalidate({ id: cmsId });
    },
    onError: error => toast.error(error.message),
  });

  const setCmsStatus = trpc.cms.setStatus.useMutation({
    onSuccess: () => {
      toast.success("Statut mis a jour");
      utils.cms.list.invalidate();
      if (cmsId) utils.cms.byId.invalidate({ id: cmsId });
    },
    onError: error => toast.error(error.message),
  });

  const deleteCms = trpc.cms.delete.useMutation({
    onSuccess: () => {
      toast.success("Page supprimee");
      utils.cms.list.invalidate();
      setLocation("/admin/cms");
    },
    onError: error => toast.error(error.message),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CmsEditorValues>({
    resolver: zodResolver(cmsEditorSchema),
    defaultValues: defaultCmsValues,
  });

  useEffect(() => {
    if (!isEditor) return;
    if (isCreate) {
      reset(defaultCmsValues);
      return;
    }
    if (!cmsDetailQuery.data) return;

    reset({
      title: cmsDetailQuery.data.title || "",
      slug: cmsDetailQuery.data.slug || "",
      status: cmsDetailQuery.data.status || "draft",
      content: cmsDetailQuery.data.content || "",
      seoTitle: cmsDetailQuery.data.seoTitle || "",
      seoDescription: cmsDetailQuery.data.seoDescription || "",
    });
  }, [cmsDetailQuery.data, isCreate, isEditor, reset]);

  useEffect(() => {
    if (!editorialHeroAdminQuery.data) return;
    const hero = editorialHeroAdminQuery.data;
    setEditorialHeroForm({
      isActive: Boolean(hero.isActive),
      badgeText: hero.badgeText || "",
      title: hero.title || "",
      subtitle: hero.subtitle || "",
      ctaText: hero.ctaText || "",
      ctaLink: hero.ctaLink || "",
      backgroundImageUrl: hero.backgroundImageUrl || "",
      overlayOpacity: Number(hero.overlayOpacity || 55),
      cardPosition: (hero.cardPosition ||
        "left") as CmsEditorialHeroCardPosition,
    });
    setEditorialHeroImagePreview(hero.backgroundImageUrl || "");
  }, [editorialHeroAdminQuery.data]);

  useEffect(() => {
    if (!homeHeroAdminQuery.data) return;
    const hero = homeHeroAdminQuery.data;
    setHeroForm({
      title: hero.title || "",
      subtitle: hero.subtitle || "",
      imageUrl: hero.imageUrl || "",
      ctaText: hero.ctaText || "Voir la boutique",
      ctaLink: hero.ctaLink || "/boutique",
      secondaryCtaText: hero.secondaryCtaText || "Trouver mon type de peau",
      secondaryCtaLink: hero.secondaryCtaLink || "/boutique?q=routine",
      badgeText: hero.badgeText || "Editorial skincare",
      isActive: Boolean(hero.isActive),
    });
    setHeroImagePreview(hero.imageUrl || "");
  }, [homeHeroAdminQuery.data]);

  useEffect(() => {
    if (!resultsSectionAdminQuery.data) return;
    const section = resultsSectionAdminQuery.data;
    setResultsForm(mapResultsSectionToForm(section));
    setBeforeImagePreview(section.beforeImageUrl || "");
    setAfterImagePreview(section.afterImageUrl || "");
  }, [resultsSectionAdminQuery.data]);

  useEffect(() => {
    return () => {
      if (editorialHeroImagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(editorialHeroImagePreview);
      }
    };
  }, [editorialHeroImagePreview]);

  useEffect(() => {
    return () => {
      if (heroImagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(heroImagePreview);
      }
    };
  }, [heroImagePreview]);

  useEffect(() => {
    return () => {
      if (beforeImagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(beforeImagePreview);
      }
    };
  }, [beforeImagePreview]);

  useEffect(() => {
    return () => {
      if (afterImagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(afterImagePreview);
      }
    };
  }, [afterImagePreview]);

  const editorialHeroPreview = useMemo<CmsEditorialHeroBlock>(() => {
    const fallback = makeEditorialHeroFallback();
    const normalizedOverlay = Math.max(
      0,
      Math.min(90, Math.round(Number(editorialHeroForm.overlayOpacity) || 0))
    );
    return {
      ...fallback,
      isActive: editorialHeroForm.isActive,
      badgeText: editorialHeroForm.badgeText || fallback.badgeText,
      title: editorialHeroForm.title || fallback.title,
      subtitle: editorialHeroForm.subtitle || fallback.subtitle,
      ctaText: editorialHeroForm.ctaText || fallback.ctaText,
      ctaLink: editorialHeroForm.ctaLink || fallback.ctaLink,
      backgroundImageUrl:
        editorialHeroImagePreview ||
        editorialHeroForm.backgroundImageUrl ||
        fallback.backgroundImageUrl,
      overlayOpacity: normalizedOverlay,
      cardPosition: editorialHeroForm.cardPosition || fallback.cardPosition,
      updatedAt: new Date().toISOString(),
      id: 1,
    };
  }, [editorialHeroForm, editorialHeroImagePreview]);

  const homeHeroPreview = useMemo(() => {
    const fallback = makeHomeHeroFallback(heroForm.imageUrl || "");
    return {
      ...fallback,
      title: heroForm.title || fallback.title,
      subtitle: heroForm.subtitle || fallback.subtitle,
      imageUrl: heroForm.imageUrl || fallback.imageUrl,
      ctaText: heroForm.ctaText || fallback.ctaText,
      ctaLink: heroForm.ctaLink || fallback.ctaLink,
      secondaryCtaText: heroForm.secondaryCtaText || fallback.secondaryCtaText,
      secondaryCtaLink: heroForm.secondaryCtaLink || fallback.secondaryCtaLink,
      badgeText: heroForm.badgeText || fallback.badgeText,
      isActive: heroForm.isActive,
      updatedAt: new Date().toISOString(),
    };
  }, [heroForm]);

  const resultsSectionPreview = useMemo<CmsResultsSection>(() => {
    const fallback = makeResultsSectionFallback();
    return {
      ...fallback,
      enabled: resultsForm.enabled,
      title: resultsForm.title || fallback.title,
      subtitle: resultsForm.subtitle || fallback.subtitle,
      beforeLabel: resultsForm.beforeLabel || fallback.beforeLabel,
      afterLabel: resultsForm.afterLabel || fallback.afterLabel,
      beforeImageUrl: beforeImagePreview || resultsForm.beforeImageUrl || null,
      afterImageUrl: afterImagePreview || resultsForm.afterImageUrl || null,
      stat1Value: resultsForm.stat1Value || fallback.stat1Value,
      stat1Title: resultsForm.stat1Title || fallback.stat1Title,
      stat1Desc: resultsForm.stat1Desc || fallback.stat1Desc,
      stat2Value: resultsForm.stat2Value || fallback.stat2Value,
      stat2Title: resultsForm.stat2Title || fallback.stat2Title,
      stat2Desc: resultsForm.stat2Desc || fallback.stat2Desc,
      stat3Value: resultsForm.stat3Value || fallback.stat3Value,
      stat3Title: resultsForm.stat3Title || fallback.stat3Title,
      stat3Desc: resultsForm.stat3Desc || fallback.stat3Desc,
      footerNote: resultsForm.footerNote || fallback.footerNote,
      updatedAt: new Date().toISOString(),
    };
  }, [afterImagePreview, beforeImagePreview, resultsForm]);

  const onEditorialHeroImageSelected = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|webp)$/i)) {
      toast.error("Formats autorises: jpg, png, webp");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop lourde (max 5MB).");
      return;
    }
    const localPreviewUrl = URL.createObjectURL(file);
    setEditorialHeroImagePreview(localPreviewUrl);
    setEditorialHeroImageName(file.name);
    uploadEditorialHeroImage.mutate(file);
  };

  const onHeroImageSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|webp)$/i)) {
      toast.error("Formats autorises: jpg, png, webp");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop lourde (max 5MB).");
      return;
    }
    const localPreviewUrl = URL.createObjectURL(file);
    setHeroImagePreview(localPreviewUrl);
    setHeroImageName(file.name);
    uploadHomeHeroImage.mutate(file);
  };

  const onResultsImageSelected = (
    event: ChangeEvent<HTMLInputElement>,
    target: "before" | "after"
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|webp)$/i)) {
      toast.error("Formats autorises: jpg, png, webp");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop lourde (max 5MB).");
      return;
    }

    const localPreviewUrl = URL.createObjectURL(file);
    if (target === "before") {
      setBeforeImagePreview(localPreviewUrl);
      setBeforeImageName(file.name);
    } else {
      setAfterImagePreview(localPreviewUrl);
      setAfterImageName(file.name);
    }

    uploadResultsImage.mutate({ file, target });
  };

  const cmsColumns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-medium">{row.original.title}</p>
            <p className="text-xs text-muted-foreground">
              /{row.original.slug}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            label={row.original.status === "published" ? "Published" : "Draft"}
          />
        ),
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) =>
          new Date(row.original.updatedAt).toLocaleString("fr-FR"),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Link href={`/admin/cms/${row.original.id}`}>
              <Button size="sm" variant="outline">
                Open
              </Button>
            </Link>
            {canWrite && (
              <Button
                size="sm"
                variant="outline"
                onClick={event => {
                  event.stopPropagation();
                  setCmsStatus.mutate({
                    id: row.original.id,
                    status:
                      row.original.status === "published"
                        ? "draft"
                        : "published",
                  });
                }}
              >
                {row.original.status === "published" ? "Unpublish" : "Publish"}
              </Button>
            )}
          </div>
        ),
      },
    ],
    [canWrite, setCmsStatus]
  );

  if (loading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-crimson" />
      </div>
    );
  }

  if (!user) {
    window.location.href = getLoginUrl();
    return null;
  }

  if (
    permissionsError ||
    !permissions ||
    !permissions.allowedModules.includes("cms")
  ) {
    return <AdminNotAllowed />;
  }

  const onModuleChange = (module: AdminModuleKey) => {
    setLocation(getAdminModulePath(module));
  };

  const saving =
    createCms.isPending || updateCms.isPending || setCmsStatus.isPending;

  return (
    <AdminLayout
      activeModule="cms"
      onModuleChange={onModuleChange}
      userName={user.name}
      allowedModules={permissions.allowedModules as AdminModuleKey[]}
      onQuickAction={
        permissions.readOnly
          ? undefined
          : action => {
              if (
                action === "add_product" &&
                permissions.allowedModules.includes("products")
              )
                setLocation("/admin/products");
              if (
                action === "create_coupon" &&
                permissions.allowedModules.includes("coupons")
              )
                setLocation("/admin/coupons");
            }
      }
    >
      {!isEditor ? (
        <div className="space-y-4">
          <PageHeader
            title="CMS"
            description="Gerez les pages statiques et leur SEO."
            breadcrumbs={[{ label: "Admin" }, { label: "CMS" }]}
            actions={
              canWrite ? (
                <Link href="/admin/cms/new">
                  <Button className="bg-crimson text-white hover:bg-crimson-light">
                    <Plus className="h-4 w-4 mr-2" />
                    Nouvelle page
                  </Button>
                </Link>
              ) : undefined
            }
          />

          <section
            id="editorial-hero"
            className="scroll-mt-28 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
          >
            <div className="rounded-xl border bg-card p-4 space-y-4">
              <div>
                <p className="text-sm font-semibold">Editorial Hero</p>
                <p className="text-xs text-muted-foreground">
                  Grande section editoriale avec image plein cadre et carte
                  glass.
                </p>
              </div>

              {editorialHeroAdminQuery.isLoading ? (
                <div className="rounded-lg border p-4 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement de l'editorial hero...
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={editorialHeroForm.isActive}
                        onChange={event =>
                          setEditorialHeroForm(previous => ({
                            ...previous,
                            isActive: event.target.checked,
                          }))
                        }
                        disabled={!canWrite}
                        className="h-4 w-4 rounded border-border"
                      />
                      Section active
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {editorialHeroForm.isActive
                        ? "Visible sur la homepage"
                        : "Masquee sur la homepage"}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Badge text</Label>
                    <Input
                      value={editorialHeroForm.badgeText}
                      onChange={event =>
                        setEditorialHeroForm(previous => ({
                          ...previous,
                          badgeText: event.target.value,
                        }))
                      }
                      disabled={!canWrite}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Textarea
                      rows={3}
                      value={editorialHeroForm.title}
                      onChange={event =>
                        setEditorialHeroForm(previous => ({
                          ...previous,
                          title: event.target.value,
                        }))
                      }
                      disabled={!canWrite}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Subtitle</Label>
                    <Textarea
                      rows={3}
                      value={editorialHeroForm.subtitle}
                      onChange={event =>
                        setEditorialHeroForm(previous => ({
                          ...previous,
                          subtitle: event.target.value,
                        }))
                      }
                      disabled={!canWrite}
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>CTA text</Label>
                      <Input
                        value={editorialHeroForm.ctaText}
                        onChange={event =>
                          setEditorialHeroForm(previous => ({
                            ...previous,
                            ctaText: event.target.value,
                          }))
                        }
                        disabled={!canWrite}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>CTA link</Label>
                      <Input
                        value={editorialHeroForm.ctaLink}
                        onChange={event =>
                          setEditorialHeroForm(previous => ({
                            ...previous,
                            ctaLink: event.target.value,
                          }))
                        }
                        disabled={!canWrite}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                    <div className="space-y-1.5">
                      <Label>Background image URL</Label>
                      <Input
                        value={editorialHeroForm.backgroundImageUrl}
                        onChange={event =>
                          setEditorialHeroForm(previous => ({
                            ...previous,
                            backgroundImageUrl: event.target.value,
                          }))
                        }
                        disabled={!canWrite}
                        placeholder="/uploads/hero/..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Upload background image</Label>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        {uploadEditorialHeroImage.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UploadCloud className="h-4 w-4" />
                        )}
                        {uploadEditorialHeroImage.isPending
                          ? "Upload..."
                          : "Choisir"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          onChange={onEditorialHeroImageSelected}
                          disabled={
                            !canWrite || uploadEditorialHeroImage.isPending
                          }
                        />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <Label>Overlay opacity</Label>
                      <span className="text-xs text-muted-foreground">
                        {editorialHeroForm.overlayOpacity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={90}
                      step={1}
                      value={editorialHeroForm.overlayOpacity}
                      onChange={event =>
                        setEditorialHeroForm(previous => ({
                          ...previous,
                          overlayOpacity: Number(event.target.value),
                        }))
                      }
                      disabled={!canWrite}
                      className="w-full accent-crimson"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Card position</Label>
                    <Select
                      value={editorialHeroForm.cardPosition}
                      onValueChange={(value: CmsEditorialHeroCardPosition) =>
                        setEditorialHeroForm(previous => ({
                          ...previous,
                          cardPosition: value,
                        }))
                      }
                      disabled={!canWrite}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    {editorialHeroImageName ? (
                      <p className="text-xs text-muted-foreground">
                        File: {editorialHeroImageName}
                      </p>
                    ) : (
                      <span />
                    )}
                    <Button
                      type="button"
                      className="bg-crimson text-white hover:bg-crimson-light"
                      onClick={() => saveEditorialHero.mutate()}
                      disabled={!canWrite || saveEditorialHero.isPending}
                    >
                      {saveEditorialHero.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Editorial Hero
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold">Editorial hero preview</p>
                <p className="text-xs text-muted-foreground">
                  Meme composant que la homepage, avec mise a jour instantanee.
                </p>
              </div>
              {editorialHeroPreview.isActive ? (
                <div className="overflow-hidden rounded-xl border bg-background">
                  <EditorialHero hero={editorialHeroPreview} />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  Section desactivee. Elle ne sera pas affichee sur la homepage.
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-xl border bg-card p-4 space-y-4">
              <div>
                <p className="text-sm font-semibold">Homepage Hero</p>
                <p className="text-xs text-muted-foreground">
                  Editez le hero de la page d'accueil et publiez en direct.
                </p>
              </div>

              {homeHeroAdminQuery.isLoading ? (
                <div className="rounded-lg border p-4 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement du hero...
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input
                      value={heroForm.title}
                      onChange={event =>
                        setHeroForm(previous => ({
                          ...previous,
                          title: event.target.value,
                        }))
                      }
                      disabled={!canWrite}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Subtitle</Label>
                    <Textarea
                      rows={3}
                      value={heroForm.subtitle}
                      onChange={event =>
                        setHeroForm(previous => ({
                          ...previous,
                          subtitle: event.target.value,
                        }))
                      }
                      disabled={!canWrite}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Badge text</Label>
                    <Input
                      value={heroForm.badgeText}
                      onChange={event =>
                        setHeroForm(previous => ({
                          ...previous,
                          badgeText: event.target.value,
                        }))
                      }
                      disabled={!canWrite}
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Primary CTA text</Label>
                      <Input
                        value={heroForm.ctaText}
                        onChange={event =>
                          setHeroForm(previous => ({
                            ...previous,
                            ctaText: event.target.value,
                          }))
                        }
                        disabled={!canWrite}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Primary CTA link</Label>
                      <Input
                        value={heroForm.ctaLink}
                        onChange={event =>
                          setHeroForm(previous => ({
                            ...previous,
                            ctaLink: event.target.value,
                          }))
                        }
                        disabled={!canWrite}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Secondary CTA text</Label>
                      <Input
                        value={heroForm.secondaryCtaText}
                        onChange={event =>
                          setHeroForm(previous => ({
                            ...previous,
                            secondaryCtaText: event.target.value,
                          }))
                        }
                        disabled={!canWrite}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Secondary CTA link</Label>
                      <Input
                        value={heroForm.secondaryCtaLink}
                        onChange={event =>
                          setHeroForm(previous => ({
                            ...previous,
                            secondaryCtaLink: event.target.value,
                          }))
                        }
                        disabled={!canWrite}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                    <div className="space-y-1.5">
                      <Label>Image URL</Label>
                      <Input
                        value={heroForm.imageUrl}
                        onChange={event =>
                          setHeroForm(previous => ({
                            ...previous,
                            imageUrl: event.target.value,
                          }))
                        }
                        disabled={!canWrite}
                        placeholder="/uploads/hero/..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Upload image</Label>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        {uploadHomeHeroImage.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UploadCloud className="h-4 w-4" />
                        )}
                        {uploadHomeHeroImage.isPending
                          ? "Upload..."
                          : "Choisir"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          onChange={onHeroImageSelected}
                          disabled={!canWrite || uploadHomeHeroImage.isPending}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={heroForm.isActive}
                        onChange={event =>
                          setHeroForm(previous => ({
                            ...previous,
                            isActive: event.target.checked,
                          }))
                        }
                        disabled={!canWrite}
                        className="h-4 w-4 rounded border-border"
                      />
                      Hero actif
                    </label>
                    {heroImageName ? (
                      <span className="text-xs text-muted-foreground">
                        {heroImageName}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      className="bg-crimson text-white hover:bg-crimson-light"
                      onClick={() => saveHomeHero.mutate()}
                      disabled={!canWrite || saveHomeHero.isPending}
                    >
                      {saveHomeHero.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Hero
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold">Live preview</p>
                <p className="text-xs text-muted-foreground">
                  Meme composant que la homepage, mise a jour instantanee.
                </p>
              </div>
              <div className="overflow-hidden rounded-xl border bg-background">
                <HomeHero
                  hero={homeHeroPreview}
                  fallbackImageUrl={heroImagePreview || heroForm.imageUrl || ""}
                />
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-xl border bg-card p-4 space-y-4">
              <div>
                <p className="text-sm font-semibold">
                  Homepage Editorial Results
                </p>
                <p className="text-xs text-muted-foreground">
                  Editez AVANT/APRES, metriques et note de confiance.
                </p>
              </div>

              {resultsSectionAdminQuery.isLoading ? (
                <div className="rounded-lg border p-4 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement de la section...
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={resultsForm.enabled}
                        onChange={event =>
                          setResultsForm(previous => ({
                            ...previous,
                            enabled: event.target.checked,
                          }))
                        }
                        disabled={!canWrite}
                        className="h-4 w-4 rounded border-border"
                      />
                      Section active
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {resultsForm.enabled
                        ? "Visible sur la homepage"
                        : "Masquee sur la homepage"}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input
                      value={resultsForm.title}
                      onChange={event =>
                        setResultsForm(previous => ({
                          ...previous,
                          title: event.target.value,
                        }))
                      }
                      disabled={!canWrite}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Subtitle</Label>
                    <Textarea
                      rows={3}
                      value={resultsForm.subtitle}
                      onChange={event =>
                        setResultsForm(previous => ({
                          ...previous,
                          subtitle: event.target.value,
                        }))
                      }
                      disabled={!canWrite}
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Before label</Label>
                      <Input
                        value={resultsForm.beforeLabel}
                        onChange={event =>
                          setResultsForm(previous => ({
                            ...previous,
                            beforeLabel: event.target.value,
                          }))
                        }
                        disabled={!canWrite}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>After label</Label>
                      <Input
                        value={resultsForm.afterLabel}
                        onChange={event =>
                          setResultsForm(previous => ({
                            ...previous,
                            afterLabel: event.target.value,
                          }))
                        }
                        disabled={!canWrite}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border p-3 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Images avant / apres
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Before image URL</Label>
                        <Input
                          value={resultsForm.beforeImageUrl}
                          onChange={event =>
                            setResultsForm(previous => ({
                              ...previous,
                              beforeImageUrl: event.target.value,
                            }))
                          }
                          disabled={!canWrite}
                          placeholder="/uploads/hero/..."
                        />
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
                          {uploadResultsImage.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UploadCloud className="h-4 w-4" />
                          )}
                          {uploadResultsImage.isPending
                            ? "Upload..."
                            : "Choisir"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="sr-only"
                            onChange={event =>
                              onResultsImageSelected(event, "before")
                            }
                            disabled={!canWrite || uploadResultsImage.isPending}
                          />
                        </label>
                        {beforeImageName ? (
                          <p className="text-xs text-muted-foreground">
                            File: {beforeImageName}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label>After image URL</Label>
                        <Input
                          value={resultsForm.afterImageUrl}
                          onChange={event =>
                            setResultsForm(previous => ({
                              ...previous,
                              afterImageUrl: event.target.value,
                            }))
                          }
                          disabled={!canWrite}
                          placeholder="/uploads/hero/..."
                        />
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
                          {uploadResultsImage.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UploadCloud className="h-4 w-4" />
                          )}
                          {uploadResultsImage.isPending
                            ? "Upload..."
                            : "Choisir"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="sr-only"
                            onChange={event =>
                              onResultsImageSelected(event, "after")
                            }
                            disabled={!canWrite || uploadResultsImage.isPending}
                          />
                        </label>
                        {afterImageName ? (
                          <p className="text-xs text-muted-foreground">
                            File: {afterImageName}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-3 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Stat card 1
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        value={resultsForm.stat1Value}
                        onChange={event =>
                          setResultsForm(previous => ({
                            ...previous,
                            stat1Value: event.target.value,
                          }))
                        }
                        disabled={!canWrite}
                        placeholder="Value"
                      />
                      <Input
                        value={resultsForm.stat1Title}
                        onChange={event =>
                          setResultsForm(previous => ({
                            ...previous,
                            stat1Title: event.target.value,
                          }))
                        }
                        disabled={!canWrite}
                        placeholder="Title"
                      />
                    </div>
                    <Textarea
                      rows={2}
                      value={resultsForm.stat1Desc}
                      onChange={event =>
                        setResultsForm(previous => ({
                          ...previous,
                          stat1Desc: event.target.value,
                        }))
                      }
                      disabled={!canWrite}
                      placeholder="Description"
                    />
                  </div>

                  <div className="rounded-lg border p-3 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Stat card 2
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        value={resultsForm.stat2Value}
                        onChange={event =>
                          setResultsForm(previous => ({
                            ...previous,
                            stat2Value: event.target.value,
                          }))
                        }
                        disabled={!canWrite}
                        placeholder="Value"
                      />
                      <Input
                        value={resultsForm.stat2Title}
                        onChange={event =>
                          setResultsForm(previous => ({
                            ...previous,
                            stat2Title: event.target.value,
                          }))
                        }
                        disabled={!canWrite}
                        placeholder="Title"
                      />
                    </div>
                    <Textarea
                      rows={2}
                      value={resultsForm.stat2Desc}
                      onChange={event =>
                        setResultsForm(previous => ({
                          ...previous,
                          stat2Desc: event.target.value,
                        }))
                      }
                      disabled={!canWrite}
                      placeholder="Description"
                    />
                  </div>

                  <div className="rounded-lg border p-3 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Stat card 3
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        value={resultsForm.stat3Value}
                        onChange={event =>
                          setResultsForm(previous => ({
                            ...previous,
                            stat3Value: event.target.value,
                          }))
                        }
                        disabled={!canWrite}
                        placeholder="Value"
                      />
                      <Input
                        value={resultsForm.stat3Title}
                        onChange={event =>
                          setResultsForm(previous => ({
                            ...previous,
                            stat3Title: event.target.value,
                          }))
                        }
                        disabled={!canWrite}
                        placeholder="Title"
                      />
                    </div>
                    <Textarea
                      rows={2}
                      value={resultsForm.stat3Desc}
                      onChange={event =>
                        setResultsForm(previous => ({
                          ...previous,
                          stat3Desc: event.target.value,
                        }))
                      }
                      disabled={!canWrite}
                      placeholder="Description"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Footer note</Label>
                    <Textarea
                      rows={3}
                      value={resultsForm.footerNote}
                      onChange={event =>
                        setResultsForm(previous => ({
                          ...previous,
                          footerNote: event.target.value,
                        }))
                      }
                      disabled={!canWrite}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      className="bg-crimson text-white hover:bg-crimson-light"
                      onClick={() => saveResultsSection.mutate()}
                      disabled={!canWrite || saveResultsSection.isPending}
                    >
                      {saveResultsSection.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Editorial Results
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold">
                  Editorial results preview
                </p>
                <p className="text-xs text-muted-foreground">
                  Meme composant que la homepage, avec placeholders si images
                  manquantes.
                </p>
              </div>
              {resultsSectionPreview.enabled ? (
                <div className="overflow-hidden rounded-xl border bg-background p-3">
                  <EditorialResultsSection section={resultsSectionPreview} />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  Section desactivee. Elle ne sera pas affichee sur la homepage.
                </div>
              )}
            </div>
          </section>

          <DataTable
            columns={cmsColumns}
            data={cmsListQuery.data?.pages || []}
            isLoading={cmsListQuery.isLoading}
            searchValue={search}
            onSearchValueChange={setSearch}
            searchPlaceholder="Search title, slug, content..."
            filters={
              <Select
                value={statusFilter}
                onValueChange={(value: "all" | "draft" | "published") =>
                  setStatusFilter(value)
                }
              >
                <SelectTrigger className="h-9 w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            }
            emptyTitle="No CMS pages"
            emptyDescription="Create your first page to start publishing content."
            emptyCtaLabel={canWrite ? "Create page" : undefined}
            onEmptyCtaClick={
              canWrite ? () => setLocation("/admin/cms/new") : undefined
            }
            getRowId={row => String((row as any).id)}
            onRowClick={(row: any) => setLocation(`/admin/cms/${row.id}`)}
            tableClassName="min-w-[900px]"
          />
        </div>
      ) : (
        <div className="space-y-4">
          <PageHeader
            title={isCreate ? "New CMS page" : "Edit CMS page"}
            description="Configure title, content and SEO metadata."
            breadcrumbs={[
              { label: "Admin" },
              { label: "CMS", href: "/admin/cms" },
              { label: isCreate ? "New" : "Edit" },
            ]}
            actions={
              <Button
                variant="outline"
                onClick={() => setLocation("/admin/cms")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            }
          />

          {!isCreate && cmsDetailQuery.isLoading ? (
            <div className="rounded-xl border p-6 text-sm text-muted-foreground">
              Loading page...
            </div>
          ) : !isCreate && !cmsDetailQuery.data ? (
            <EmptyState
              title="Page not found"
              description="This CMS page does not exist."
            />
          ) : (
            <form
              className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]"
              onSubmit={handleSubmit(values => {
                if (!canWrite) {
                  toast.error("Not allowed");
                  return;
                }
                const payload = {
                  ...values,
                  slug: values.slug || toSlug(values.title),
                };
                if (isCreate) {
                  createCms.mutate(payload);
                } else if (cmsId) {
                  updateCms.mutate({ id: cmsId, ...payload });
                }
              })}
            >
              <div className="space-y-4 rounded-xl border bg-card p-4">
                <div className="space-y-1.5">
                  <Label>Title *</Label>
                  <Input
                    {...register("title")}
                    onBlur={event => {
                      if (!watch("slug")) {
                        setValue("slug", toSlug(event.target.value), {
                          shouldDirty: true,
                        });
                      }
                    }}
                    disabled={!canWrite}
                  />
                  {errors.title && (
                    <p className="text-xs text-destructive">
                      {errors.title.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Slug *</Label>
                  <Input {...register("slug")} disabled={!canWrite} />
                  {errors.slug && (
                    <p className="text-xs text-destructive">
                      {errors.slug.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={watch("status")}
                    onValueChange={(value: "draft" | "published") =>
                      setValue("status", value, { shouldDirty: true })
                    }
                    disabled={!canWrite}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Content *</Label>
                  <Textarea
                    {...register("content")}
                    rows={14}
                    disabled={!canWrite}
                  />
                  {errors.content && (
                    <p className="text-xs text-destructive">
                      {errors.content.message}
                    </p>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>SEO title</Label>
                    <Input {...register("seoTitle")} disabled={!canWrite} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>SEO description</Label>
                    <Textarea
                      {...register("seoDescription")}
                      rows={3}
                      disabled={!canWrite}
                    />
                  </div>
                </div>
              </div>

              <aside className="space-y-3">
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-sm font-semibold mb-3">Actions</p>
                  <div className="space-y-2">
                    <Button
                      type="submit"
                      className="w-full bg-crimson text-white hover:bg-crimson-light"
                      disabled={!canWrite || saving}
                    >
                      {saving && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Save
                    </Button>
                    {!isCreate && cmsId && canWrite && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() =>
                          setCmsStatus.mutate({
                            id: cmsId,
                            status:
                              watch("status") === "published"
                                ? "draft"
                                : "published",
                          })
                        }
                      >
                        {watch("status") === "published"
                          ? "Unpublish"
                          : "Publish"}
                      </Button>
                    )}
                    {!isCreate &&
                      cmsId &&
                      canWrite &&
                      permissions.canDelete && (
                        <ConfirmDialog
                          title="Supprimer cette page ?"
                          description="Cette action est irreversible."
                          confirmLabel="Supprimer"
                          destructive
                          onConfirm={() => deleteCms.mutate({ id: cmsId })}
                          trigger={
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full text-destructive"
                            >
                              Delete
                            </Button>
                          }
                        />
                      )}
                  </div>
                </div>
              </aside>
            </form>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
