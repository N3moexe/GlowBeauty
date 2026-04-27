import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import AdminLayout from "@/components/admin/AdminLayout";
import { getAdminModulePath } from "@/lib/adminNavigation";
import PageHeader from "@/components/admin/PageHeader";
import AdminNotAllowed from "@/pages/AdminNotAllowed";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminCms, ADMIN_NAVIGATION_QUERY_KEY } from "@/lib/adminCms";
import { STOREFRONT_NAV_QUERY_KEY } from "@/lib/storefrontCms";
import type { NavGroup, NavItem, Navigation } from "@shared/storefront-cms";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react";

function newId() {
  return `nav-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AdminNavigation() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: permissions, isLoading: permissionsLoading } =
    trpc.rbac.me.useQuery(undefined, { enabled: !!user, retry: false });
  const canAccessCms = permissions?.allowedModules.includes("cms") ?? false;
  const canWriteCms = Boolean(permissions?.canWriteCms);

  const navQuery = useQuery({
    queryKey: ADMIN_NAVIGATION_QUERY_KEY,
    queryFn: adminCms.getNavigation,
    enabled: !!user && canAccessCms,
  });

  const [draft, setDraft] = useState<{
    header: NavItem[];
    footer: NavGroup[];
  } | null>(null);

  useEffect(() => {
    if (navQuery.data && !draft) {
      setDraft({ header: navQuery.data.header, footer: navQuery.data.footer });
    }
  }, [navQuery.data, draft]);

  const saveMutation = useMutation({
    mutationFn: async (input: { header: NavItem[]; footer: NavGroup[] }) =>
      adminCms.saveNavigation(input as Omit<Navigation, "updatedAt">),
    onSuccess: result => {
      queryClient.setQueryData(ADMIN_NAVIGATION_QUERY_KEY, result);
      queryClient.invalidateQueries({ queryKey: STOREFRONT_NAV_QUERY_KEY });
      setDraft({ header: result.header, footer: result.footer });
      toast.success("Navigation enregistrée");
    },
    onError: error => {
      toast.error("Erreur", {
        description: error instanceof Error ? error.message : "Réessayez.",
      });
    },
  });

  const dirty = useMemo(() => {
    if (!navQuery.data || !draft) return false;
    return (
      JSON.stringify({
        header: navQuery.data.header,
        footer: navQuery.data.footer,
      }) !== JSON.stringify(draft)
    );
  }, [navQuery.data, draft]);

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

  const state = draft ?? { header: [], footer: [] };

  const updateHeaderItem = (index: number, patch: Partial<NavItem>) => {
    const header = [...state.header];
    header[index] = { ...header[index], ...patch };
    setDraft({ ...state, header });
  };
  const moveHeaderItem = (index: number, delta: number) => {
    const header = [...state.header];
    const target = index + delta;
    if (target < 0 || target >= header.length) return;
    const [moved] = header.splice(index, 1);
    header.splice(target, 0, moved);
    setDraft({ ...state, header });
  };
  const addHeaderItem = () =>
    setDraft({
      ...state,
      header: [
        ...state.header,
        { id: newId(), label: "Nouvelle entrée", href: "/" },
      ],
    });
  const removeHeaderItem = (index: number) => {
    const header = [...state.header];
    header.splice(index, 1);
    setDraft({ ...state, header });
  };

  const updateGroup = (groupIndex: number, patch: Partial<NavGroup>) => {
    const footer = [...state.footer];
    footer[groupIndex] = { ...footer[groupIndex], ...patch };
    setDraft({ ...state, footer });
  };
  const moveGroup = (index: number, delta: number) => {
    const footer = [...state.footer];
    const target = index + delta;
    if (target < 0 || target >= footer.length) return;
    const [moved] = footer.splice(index, 1);
    footer.splice(target, 0, moved);
    setDraft({ ...state, footer });
  };
  const addGroup = () =>
    setDraft({
      ...state,
      footer: [
        ...state.footer,
        { id: newId(), title: "Nouveau groupe", items: [] },
      ],
    });
  const removeGroup = (index: number) => {
    const footer = [...state.footer];
    footer.splice(index, 1);
    setDraft({ ...state, footer });
  };
  const updateGroupItem = (
    groupIndex: number,
    itemIndex: number,
    patch: Partial<NavItem>
  ) => {
    const footer = [...state.footer];
    const items = [...footer[groupIndex].items];
    items[itemIndex] = { ...items[itemIndex], ...patch };
    footer[groupIndex] = { ...footer[groupIndex], items };
    setDraft({ ...state, footer });
  };
  const moveGroupItem = (
    groupIndex: number,
    itemIndex: number,
    delta: number
  ) => {
    const footer = [...state.footer];
    const items = [...footer[groupIndex].items];
    const target = itemIndex + delta;
    if (target < 0 || target >= items.length) return;
    const [moved] = items.splice(itemIndex, 1);
    items.splice(target, 0, moved);
    footer[groupIndex] = { ...footer[groupIndex], items };
    setDraft({ ...state, footer });
  };
  const addGroupItem = (groupIndex: number) => {
    const footer = [...state.footer];
    const group = footer[groupIndex];
    footer[groupIndex] = {
      ...group,
      items: [
        ...group.items,
        { id: newId(), label: "Nouvelle entrée", href: "/" },
      ],
    };
    setDraft({ ...state, footer });
  };
  const removeGroupItem = (groupIndex: number, itemIndex: number) => {
    const footer = [...state.footer];
    const items = [...footer[groupIndex].items];
    items.splice(itemIndex, 1);
    footer[groupIndex] = { ...footer[groupIndex], items };
    setDraft({ ...state, footer });
  };

  return (
    <AdminLayout
      activeModule="cms"
      userName={user.name}
      onModuleChange={m => setLocation(getAdminModulePath(m))}
    >
      <PageHeader
        breadcrumbs={[{ label: "Admin" }, { label: "Navigation" }]}
        title="Menus"
        description="Entrées du menu principal et des colonnes du pied de page."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() =>
                navQuery.data &&
                setDraft({
                  header: navQuery.data.header,
                  footer: navQuery.data.footer,
                })
              }
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

      <div className="space-y-8">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-base font-semibold text-foreground">
            Menu principal (header)
          </h2>
          <div className="space-y-2">
            {state.header.map((item, index) => (
              <div
                key={item.id}
                className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-[1fr_2fr_auto_auto_auto]"
              >
                <Input
                  value={item.label}
                  placeholder="Libellé"
                  onChange={e =>
                    updateHeaderItem(index, { label: e.target.value })
                  }
                />
                <Input
                  value={item.href}
                  placeholder="/boutique"
                  onChange={e =>
                    updateHeaderItem(index, { href: e.target.value })
                  }
                />
                <Button
                  variant="outline"
                  size="icon"
                  disabled={index === 0}
                  onClick={() => moveHeaderItem(index, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={index === state.header.length - 1}
                  onClick={() => moveHeaderItem(index, +1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => removeHeaderItem(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addHeaderItem}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Ajouter une entrée
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-base font-semibold text-foreground">
            Pied de page
          </h2>
          <div className="space-y-4">
            {state.footer.map((group, groupIndex) => (
              <div
                key={group.id}
                className="rounded-lg border border-border p-4"
              >
                <div className="mb-3 grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Titre du groupe
                    </Label>
                    <Input
                      value={group.title}
                      placeholder="Ex: Informations"
                      onChange={e =>
                        updateGroup(groupIndex, { title: e.target.value })
                      }
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={groupIndex === 0}
                    onClick={() => moveGroup(groupIndex, -1)}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={groupIndex === state.footer.length - 1}
                    onClick={() => moveGroup(groupIndex, +1)}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => removeGroup(groupIndex)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {group.items.map((item, itemIndex) => (
                    <div
                      key={item.id}
                      className="grid gap-2 rounded-lg border border-dashed border-border p-2 md:grid-cols-[1fr_2fr_auto_auto_auto]"
                    >
                      <Input
                        value={item.label}
                        placeholder="Libellé"
                        onChange={e =>
                          updateGroupItem(groupIndex, itemIndex, {
                            label: e.target.value,
                          })
                        }
                      />
                      <Input
                        value={item.href}
                        placeholder="/page/cgv"
                        onChange={e =>
                          updateGroupItem(groupIndex, itemIndex, {
                            href: e.target.value,
                          })
                        }
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={itemIndex === 0}
                        onClick={() => moveGroupItem(groupIndex, itemIndex, -1)}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={itemIndex === group.items.length - 1}
                        onClick={() => moveGroupItem(groupIndex, itemIndex, +1)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => removeGroupItem(groupIndex, itemIndex)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addGroupItem(groupIndex)}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Ajouter un lien
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addGroup}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Ajouter un groupe
            </Button>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
