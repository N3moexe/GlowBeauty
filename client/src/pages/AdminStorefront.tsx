import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import AdminLayout from "@/components/admin/AdminLayout";
import { getAdminModulePath } from "@/lib/adminNavigation";
import PageHeader from "@/components/admin/PageHeader";
import AdminNotAllowed from "@/pages/AdminNotAllowed";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ImagePickerField from "@/components/admin/ImagePickerField";
import { adminCms, ADMIN_LAYOUT_QUERY_KEY } from "@/lib/adminCms";
import { STOREFRONT_LAYOUT_QUERY_KEY } from "@/lib/storefrontCms";
import { trpc } from "@/lib/trpc";
import type {
  ConcernsSection,
  HeroSection,
  HomepageLayout,
  HomepageSection,
  HomepageSectionType,
  NewsletterSection,
  ProductRailSection,
  RichTextSection,
  TrustSection,
} from "@shared/storefront-cms";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Smartphone,
  Trash2,
} from "lucide-react";

function newSection(type: HomepageSectionType): HomepageSection {
  const id = `${type}-${Math.random().toString(36).slice(2, 8)}`;
  switch (type) {
    case "hero":
      return {
        type: "hero",
        id,
        enabled: true,
        badge: "",
        title: "",
        subtitle: "",
        imageUrl: "",
        primaryCtaLabel: "Voir la boutique",
        primaryCtaHref: "/boutique",
        secondaryCtaLabel: "",
        secondaryCtaHref: "",
        overlayKicker: "",
        overlayTitle: "",
        overlayDescription: "",
        overlayCtaLabel: "",
        overlayCtaHref: "",
      };
    case "trust":
      return { type: "trust", id, enabled: true, items: [] };
    case "concerns":
      return {
        type: "concerns",
        id,
        enabled: true,
        kicker: "",
        title: "",
        subtitle: "",
        actionLabel: "Voir toute la boutique",
        actionHref: "/boutique",
        items: [],
      };
    case "product_rail":
      return {
        type: "product_rail",
        id,
        enabled: true,
        kicker: "",
        title: "",
        source: "trending",
        limit: 8,
        actionLabel: "Voir plus",
        actionHref: "/boutique",
      };
    case "newsletter":
      return {
        type: "newsletter",
        id,
        enabled: true,
        title: "",
        subtitle: "",
      };
    case "rich_text":
      return {
        type: "rich_text",
        id,
        enabled: true,
        kicker: "",
        title: "",
        body: "",
        ctaLabel: "",
        ctaHref: "",
      };
  }
}

const SECTION_TYPES: { value: HomepageSectionType; label: string }[] = [
  { value: "hero", label: "Hero" },
  { value: "trust", label: "Bandeau confiance" },
  { value: "concerns", label: "Tuiles par objectif peau" },
  { value: "product_rail", label: "Carrousel de produits" },
  { value: "newsletter", label: "Newsletter" },
  { value: "rich_text", label: "Texte éditorial" },
];

export default function AdminStorefront() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: permissions, isLoading: permissionsLoading } =
    trpc.rbac.me.useQuery(undefined, { enabled: !!user, retry: false });
  const canAccessCms = permissions?.allowedModules.includes("cms") ?? false;
  const canWriteCms = Boolean(permissions?.canWriteCms);

  const layoutQuery = useQuery({
    queryKey: ADMIN_LAYOUT_QUERY_KEY,
    queryFn: adminCms.getLayout,
    enabled: !!user && canAccessCms,
  });

  const [draft, setDraft] = useState<HomepageSection[] | null>(null);

  useEffect(() => {
    if (layoutQuery.data && !draft) {
      setDraft(layoutQuery.data.sections);
    }
  }, [layoutQuery.data, draft]);

  const saveMutation = useMutation({
    mutationFn: async (sections: HomepageSection[]) => {
      return adminCms.saveLayout({ sections } as Omit<
        HomepageLayout,
        "updatedAt"
      >);
    },
    onSuccess: result => {
      queryClient.setQueryData(ADMIN_LAYOUT_QUERY_KEY, result);
      queryClient.invalidateQueries({ queryKey: STOREFRONT_LAYOUT_QUERY_KEY });
      setDraft(result.sections);
      toast.success("Page d'accueil enregistrée");
    },
    onError: error => {
      toast.error("Erreur d'enregistrement", {
        description: error instanceof Error ? error.message : "Réessayez.",
      });
    },
  });

  const dirty = useMemo(() => {
    if (!layoutQuery.data || !draft) return false;
    return JSON.stringify(layoutQuery.data.sections) !== JSON.stringify(draft);
  }, [layoutQuery.data, draft]);

  // Preview panel state — must be declared at the top level (hooks rule) so
  // the hook count stays stable across auth-loading / unauth / admin renders.
  const [previewOpen, setPreviewOpen] = useState(true);
  const [previewMobile, setPreviewMobile] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  // Refresh iframe whenever a save lands.
  useEffect(() => {
    if (saveMutation.isSuccess) setPreviewKey(k => k + 1);
  }, [saveMutation.isSuccess]);

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

  const sections = draft ?? [];

  const moveSection = (index: number, delta: number) => {
    const next = [...sections];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setDraft(next);
  };

  const updateSection = (index: number, patch: Partial<HomepageSection>) => {
    const next = [...sections];
    next[index] = { ...next[index], ...patch } as HomepageSection;
    setDraft(next);
  };

  const addSection = (type: HomepageSectionType) => {
    setDraft([...sections, newSection(type)]);
  };

  const removeSection = (index: number) => {
    const next = [...sections];
    next.splice(index, 1);
    setDraft(next);
  };

  return (
    <AdminLayout
      activeModule="cms"
      userName={user.name}
      onModuleChange={m => setLocation(getAdminModulePath(m))}
    >
      <PageHeader
        breadcrumbs={[{ label: "Admin" }, { label: "Storefront builder" }]}
        title="Page d'accueil"
        description="Ajoutez, réorganisez ou masquez les sections visibles sur la home."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setDraft(layoutQuery.data?.sections ?? [])}
              disabled={!dirty || saveMutation.isPending}
            >
              Annuler
            </Button>
            <Button
              onClick={() => draft && canWriteCms && saveMutation.mutate(draft)}
              disabled={!dirty || saveMutation.isPending || !canWriteCms}
              title={!canWriteCms ? "Lecture seule" : undefined}
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Publier
            </Button>
          </div>
        }
      />

      <div
        className={
          previewOpen
            ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(380px,520px)]"
            : "space-y-4"
        }
      >
        <div className="space-y-4 min-w-0">
          {sections.map((section, index) => (
            <SectionCard
              key={section.id}
              section={section}
              index={index}
              total={sections.length}
              onUp={() => moveSection(index, -1)}
              onDown={() => moveSection(index, +1)}
              onChange={patch => updateSection(index, patch)}
              onRemove={() => removeSection(index)}
            />
          ))}

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border p-4">
            <p className="mr-2 text-sm font-semibold text-foreground">
              Ajouter une section :
            </p>
            {SECTION_TYPES.map(type => (
              <Button
                key={type.value}
                variant="outline"
                size="sm"
                onClick={() => addSection(type.value)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {type.label}
              </Button>
            ))}
          </div>
        </div>

        {previewOpen ? (
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Aperçu en direct
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewMobile(v => !v)}
                    title={previewMobile ? "Vue desktop" : "Vue mobile"}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewKey(k => k + 1)}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  <a
                    href="/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs hover:bg-muted"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ouvrir
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewOpen(false)}
                    title="Masquer l'aperçu"
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div
                className={`overflow-hidden rounded-lg border border-border ${
                  previewMobile ? "mx-auto max-w-[380px]" : ""
                }`}
              >
                <iframe
                  key={previewKey}
                  src="/"
                  title="Aperçu"
                  className="block h-[70vh] w-full border-0 bg-background"
                />
              </div>
              {dirty ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Modifications non publiées — cliquez sur Publier pour les voir
                  apparaître.
                </p>
              ) : null}
            </div>
          </aside>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreviewOpen(true)}
            className="mt-2"
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Afficher l'aperçu
          </Button>
        )}
      </div>
    </AdminLayout>
  );
}

type SectionCardProps = {
  section: HomepageSection;
  index: number;
  total: number;
  onUp: () => void;
  onDown: () => void;
  onChange: (patch: Partial<HomepageSection>) => void;
  onRemove: () => void;
};

function SectionCard({
  section,
  index,
  total,
  onUp,
  onDown,
  onChange,
  onRemove,
}: SectionCardProps) {
  const typeLabel =
    SECTION_TYPES.find(t => t.value === section.type)?.label ?? section.type;
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-accent/10 text-xs font-semibold text-brand-accent">
            {index + 1}
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{typeLabel}</p>
            <p className="text-xs text-muted-foreground">ID : {section.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border px-2 py-1">
            <Switch
              checked={section.enabled !== false}
              onCheckedChange={checked => onChange({ enabled: checked } as any)}
            />
            <span className="text-xs font-medium text-muted-foreground">
              {section.enabled !== false ? "Visible" : "Masquée"}
            </span>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={onUp}
            disabled={index === 0}
            aria-label="Monter"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onDown}
            disabled={index === total - 1}
            aria-label="Descendre"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onRemove}
            aria-label="Supprimer"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {section.type === "hero" ? (
        <HeroForm section={section} onChange={onChange} />
      ) : null}
      {section.type === "trust" ? (
        <TrustForm section={section} onChange={onChange} />
      ) : null}
      {section.type === "concerns" ? (
        <ConcernsForm section={section} onChange={onChange} />
      ) : null}
      {section.type === "product_rail" ? (
        <ProductRailForm section={section} onChange={onChange} />
      ) : null}
      {section.type === "newsletter" ? (
        <NewsletterForm section={section} onChange={onChange} />
      ) : null}
      {section.type === "rich_text" ? (
        <RichTextForm section={section} onChange={onChange} />
      ) : null}
    </div>
  );
}

type FormProps<T> = {
  section: T;
  onChange: (patch: Partial<T>) => void;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function HeroForm({ section, onChange }: FormProps<HeroSection>) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Badge">
        <Input
          value={section.badge}
          onChange={e => onChange({ badge: e.target.value })}
        />
      </Field>
      <Field label="Image">
        <ImagePickerField
          value={section.imageUrl}
          onChange={url => onChange({ imageUrl: url })}
          placeholder="https://… (vide = image du produit best seller)"
          previewRatio="4/5"
        />
      </Field>
      <Field label="Titre">
        <Textarea
          value={section.title}
          rows={2}
          onChange={e => onChange({ title: e.target.value })}
        />
      </Field>
      <Field label="Sous-titre">
        <Textarea
          value={section.subtitle}
          rows={3}
          onChange={e => onChange({ subtitle: e.target.value })}
        />
      </Field>
      <Field label="Bouton principal — libellé">
        <Input
          value={section.primaryCtaLabel}
          onChange={e => onChange({ primaryCtaLabel: e.target.value })}
        />
      </Field>
      <Field label="Bouton principal — lien">
        <Input
          value={section.primaryCtaHref}
          onChange={e => onChange({ primaryCtaHref: e.target.value })}
        />
      </Field>
      <Field label="Bouton secondaire — libellé">
        <Input
          value={section.secondaryCtaLabel}
          onChange={e => onChange({ secondaryCtaLabel: e.target.value })}
        />
      </Field>
      <Field label="Bouton secondaire — lien">
        <Input
          value={section.secondaryCtaHref}
          onChange={e => onChange({ secondaryCtaHref: e.target.value })}
        />
      </Field>
      <div className="md:col-span-2 rounded-lg border border-dashed border-border p-3">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Bandeau superposé à l'image
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Kicker">
            <Input
              value={section.overlayKicker}
              onChange={e => onChange({ overlayKicker: e.target.value })}
            />
          </Field>
          <Field label="Titre">
            <Input
              value={section.overlayTitle}
              onChange={e => onChange({ overlayTitle: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <Input
              value={section.overlayDescription}
              onChange={e => onChange({ overlayDescription: e.target.value })}
            />
          </Field>
          <Field label="Lien CTA">
            <Input
              value={section.overlayCtaHref}
              onChange={e => onChange({ overlayCtaHref: e.target.value })}
            />
          </Field>
          <Field label="Libellé CTA">
            <Input
              value={section.overlayCtaLabel}
              onChange={e => onChange({ overlayCtaLabel: e.target.value })}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

function TrustForm({ section, onChange }: FormProps<TrustSection>) {
  const addItem = () =>
    onChange({
      items: [
        ...section.items,
        {
          id: `trust-${Math.random().toString(36).slice(2, 6)}`,
          icon: "sparkles",
          title: "",
          subtitle: "",
        },
      ],
    });
  const updateItem = (
    index: number,
    patch: Partial<TrustSection["items"][number]>
  ) => {
    const items = [...section.items];
    items[index] = { ...items[index], ...patch };
    onChange({ items });
  };
  const removeItem = (index: number) => {
    const items = [...section.items];
    items.splice(index, 1);
    onChange({ items });
  };

  return (
    <div className="space-y-3">
      {section.items.map((item, index) => (
        <div
          key={item.id}
          className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-[120px_1fr_2fr_auto]"
        >
          <Select
            value={item.icon}
            onValueChange={v => updateItem(index, { icon: v as any })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="truck">Livraison</SelectItem>
              <SelectItem value="shield">Paiement</SelectItem>
              <SelectItem value="sparkles">Support</SelectItem>
              <SelectItem value="heart">Coeur</SelectItem>
              <SelectItem value="phone">Téléphone</SelectItem>
              <SelectItem value="chat">Chat</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={item.title}
            placeholder="Titre"
            onChange={e => updateItem(index, { title: e.target.value })}
          />
          <Input
            value={item.subtitle}
            placeholder="Sous-titre"
            onChange={e => updateItem(index, { subtitle: e.target.value })}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => removeItem(index)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addItem}>
        <Plus className="mr-1.5 h-3.5 w-3.5" /> Ajouter un élément
      </Button>
    </div>
  );
}

function ConcernsForm({ section, onChange }: FormProps<ConcernsSection>) {
  const addItem = () =>
    onChange({
      items: [
        ...section.items,
        {
          id: `concern-${Math.random().toString(36).slice(2, 6)}`,
          title: "",
          subtitle: "",
          href: "/boutique",
          gradient: "",
        },
      ],
    });
  const updateItem = (
    index: number,
    patch: Partial<ConcernsSection["items"][number]>
  ) => {
    const items = [...section.items];
    items[index] = { ...items[index], ...patch };
    onChange({ items });
  };
  const removeItem = (index: number) => {
    const items = [...section.items];
    items.splice(index, 1);
    onChange({ items });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Kicker">
          <Input
            value={section.kicker}
            onChange={e => onChange({ kicker: e.target.value })}
          />
        </Field>
        <Field label="Lien 'Voir tout'">
          <Input
            value={section.actionHref}
            onChange={e => onChange({ actionHref: e.target.value })}
          />
        </Field>
        <Field label="Titre">
          <Input
            value={section.title}
            onChange={e => onChange({ title: e.target.value })}
          />
        </Field>
        <Field label="Libellé 'Voir tout'">
          <Input
            value={section.actionLabel}
            onChange={e => onChange({ actionLabel: e.target.value })}
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Sous-titre">
            <Textarea
              value={section.subtitle}
              onChange={e => onChange({ subtitle: e.target.value })}
              rows={2}
            />
          </Field>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Tuiles d'objectifs peau (laisser vide pour utiliser les défauts)
        </p>
        {section.items.map((item, index) => (
          <div
            key={item.id}
            className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-[1fr_1.5fr_1fr_auto]"
          >
            <Input
              value={item.title}
              placeholder="Titre"
              onChange={e => updateItem(index, { title: e.target.value })}
            />
            <Input
              value={item.subtitle}
              placeholder="Sous-titre"
              onChange={e => updateItem(index, { subtitle: e.target.value })}
            />
            <Input
              value={item.href}
              placeholder="Lien"
              onChange={e => updateItem(index, { href: e.target.value })}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => removeItem(index)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addItem}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Ajouter une tuile
        </Button>
      </div>
    </div>
  );
}

function ProductRailForm({ section, onChange }: FormProps<ProductRailSection>) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Kicker">
        <Input
          value={section.kicker}
          onChange={e => onChange({ kicker: e.target.value })}
        />
      </Field>
      <Field label="Titre">
        <Input
          value={section.title}
          onChange={e => onChange({ title: e.target.value })}
        />
      </Field>
      <Field label="Source des produits">
        <Select
          value={section.source}
          onValueChange={v => onChange({ source: v as any })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="trending">Tendance</SelectItem>
            <SelectItem value="featured">Mis en avant</SelectItem>
            <SelectItem value="new">Nouveautés</SelectItem>
            <SelectItem value="best_sellers">Best sellers</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Limite">
        <Input
          type="number"
          min={2}
          max={24}
          value={section.limit}
          onChange={e =>
            onChange({
              limit: Math.max(2, Math.min(24, Number(e.target.value) || 8)),
            })
          }
        />
      </Field>
      <Field label="Lien 'Voir plus'">
        <Input
          value={section.actionHref}
          onChange={e => onChange({ actionHref: e.target.value })}
        />
      </Field>
      <Field label="Libellé 'Voir plus'">
        <Input
          value={section.actionLabel}
          onChange={e => onChange({ actionLabel: e.target.value })}
        />
      </Field>
    </div>
  );
}

function NewsletterForm({ section, onChange }: FormProps<NewsletterSection>) {
  return (
    <div className="grid gap-3">
      <Field label="Titre">
        <Input
          value={section.title}
          onChange={e => onChange({ title: e.target.value })}
        />
      </Field>
      <Field label="Sous-titre">
        <Textarea
          value={section.subtitle}
          onChange={e => onChange({ subtitle: e.target.value })}
          rows={2}
        />
      </Field>
    </div>
  );
}

function RichTextForm({ section, onChange }: FormProps<RichTextSection>) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Kicker">
        <Input
          value={section.kicker}
          onChange={e => onChange({ kicker: e.target.value })}
        />
      </Field>
      <Field label="Titre">
        <Input
          value={section.title}
          onChange={e => onChange({ title: e.target.value })}
        />
      </Field>
      <div className="md:col-span-2">
        <Field label="Corps">
          <Textarea
            value={section.body}
            rows={4}
            onChange={e => onChange({ body: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Lien CTA">
        <Input
          value={section.ctaHref}
          onChange={e => onChange({ ctaHref: e.target.value })}
        />
      </Field>
      <Field label="Libellé CTA">
        <Input
          value={section.ctaLabel}
          onChange={e => onChange({ ctaLabel: e.target.value })}
        />
      </Field>
    </div>
  );
}
