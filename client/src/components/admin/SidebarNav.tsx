import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import type { ComponentType } from "react";
import { useLocation } from "wouter";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  FileText,
  Grid2x2,
  Image as ImageIcon,
  LayoutGrid,
  LogOut,
  Mail,
  Megaphone,
  MessageCircle,
  Palette,
  ScrollText,
  Settings,
  ShoppingCart,
  Tag,
  Users,
  Warehouse,
  Wrench,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export type AdminModuleKey =
  | "analytics"
  | "orders"
  | "customers"
  | "products"
  | "categories"
  | "reviews"
  | "inventory"
  | "coupons"
  | "banners"
  | "reports"
  | "cms"
  | "settings"
  | "newsletter"
  | "activity";

type SidebarNavProps = {
  activeModule: string;
  onModuleChange: (module: AdminModuleKey) => void;
  className?: string;
  allowedModules?: AdminModuleKey[];
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onLogout?: () => void;
};

type SidebarItem = {
  key?: AdminModuleKey;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string;
  href?: string;
  priority?: "primary" | "secondary";
};

const primaryItems: SidebarItem[] = [
  {
    key: "analytics",
    label: "Dashboard",
    icon: LayoutGrid,
    priority: "primary",
  },
  { key: "products", label: "Produits", icon: Boxes, priority: "primary" },
  {
    key: "orders",
    label: "Commandes",
    icon: ShoppingCart,
    priority: "primary",
  },
  { key: "customers", label: "Clients", icon: Users, priority: "primary" },
  { key: "reports", label: "Analytique", icon: BarChart3, priority: "primary" },
  { key: "coupons", label: "Promotions", icon: Megaphone, priority: "primary" },
  { key: "settings", label: "Paramètres", icon: Settings, priority: "primary" },
];

const secondaryItems: SidebarItem[] = [
  {
    key: "categories",
    label: "Catégories",
    icon: Grid2x2,
    priority: "secondary",
  },
  { key: "reviews", label: "Avis", icon: ClipboardList, priority: "secondary" },
  { key: "inventory", label: "Stock", icon: Warehouse, priority: "secondary" },
  {
    key: "banners",
    label: "Bannières",
    icon: ImageIcon,
    priority: "secondary",
  },
  { key: "cms", label: "Contenu", icon: FileText, priority: "secondary" },
  { key: "newsletter", label: "Newsletter", icon: Mail, priority: "secondary" },
  {
    key: "activity",
    label: "Journal d'audit",
    icon: ScrollText,
    priority: "secondary",
  },
  {
    label: "Storefront",
    icon: LayoutGrid,
    href: "/admin/storefront",
    priority: "secondary",
  },
  {
    label: "Pages",
    icon: FileText,
    href: "/admin/pages",
    priority: "secondary",
  },
  {
    label: "Navigation",
    icon: Wrench,
    href: "/admin/navigation",
    priority: "secondary",
  },
  {
    label: "Thème",
    icon: Palette,
    href: "/admin/theme",
    priority: "secondary",
  },
  {
    label: "E-mails",
    icon: Tag,
    href: "/admin/email-templates",
    priority: "secondary",
  },
  {
    label: "Médias",
    icon: ImageIcon,
    href: "/admin/media",
    priority: "secondary",
  },
  {
    label: "Intégrations",
    icon: Wrench,
    href: "/admin/integrations",
    priority: "secondary",
  },
  {
    label: "Chatbot",
    icon: MessageCircle,
    href: "/admin/chatbot",
    priority: "secondary",
  },
];

export default function SidebarNav({
  activeModule,
  onModuleChange,
  className,
  allowedModules,
  collapsed = false,
  onToggleCollapsed,
  onLogout,
}: SidebarNavProps) {
  const shouldReduceMotion = useReducedMotion();
  const [, navigate] = useLocation();

  const filterVisible = (item: SidebarItem) => {
    if (!item.key) return true;
    if (!allowedModules) return true;
    return allowedModules.includes(item.key);
  };

  const visiblePrimaryItems = primaryItems.filter(filterVisible);
  const visibleSecondaryItems = secondaryItems.filter(filterVisible);

  function handleItemClick(item: SidebarItem) {
    if (item.href) {
      navigate(item.href);
      return;
    }
    if (item.key) onModuleChange(item.key);
  }

  return (
    <aside className={cn("w-full", className)}>
      <div className="relative overflow-hidden rounded-3xl border border-[var(--admin-border)] bg-[var(--admin-surface-tint)] p-3 shadow-[var(--admin-shadow-strong)]">
        <div className="relative flex items-center justify-between gap-2 px-1 pb-2">
          {!collapsed ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-accent)]">
                Administration
              </p>
              <p className="text-xs text-[var(--admin-muted)]">GlowBeauty</p>
            </div>
          ) : (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-accent)]">
              GB
            </p>
          )}

          {onToggleCollapsed ? (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={onToggleCollapsed}
              className="h-8 w-8 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-muted)] hover:bg-[var(--admin-accent-soft)] hover:text-[var(--admin-accent)]"
              aria-label={collapsed ? "Développer le menu" : "Réduire le menu"}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          ) : null}
        </div>

        <div className="relative space-y-1.5 pt-1">
          {visiblePrimaryItems.map((item, index) => {
            const active = item.key === activeModule;
            return (
              <motion.div
                key={item.label}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { duration: 0.16, delay: index * 0.02 }
                }
                whileHover={shouldReduceMotion ? undefined : { y: -1 }}
              >
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleItemClick(item)}
                  className={cn(
                    "group relative h-11 w-full justify-start gap-2.5 rounded-2xl border text-left transition-all",
                    collapsed ? "px-2.5" : "px-3",
                    active
                      ? "border-[var(--admin-accent)] bg-[var(--admin-accent)] text-white shadow-[0_8px_20px_-12px_var(--admin-accent)]"
                      : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-ink)] hover:border-[var(--admin-accent-soft)] hover:bg-[var(--admin-accent-soft)]"
                  )}
                >
                  {active ? (
                    <span className="absolute left-1.5 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-white/60" />
                  ) : null}
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-white" : "text-[var(--admin-accent)]"
                    )}
                  />
                  {!collapsed ? (
                    <span className="truncate text-sm font-medium">
                      {item.label}
                    </span>
                  ) : null}
                  {!collapsed && item.badge ? (
                    <Badge
                      variant="outline"
                      className="ml-auto border-white/35 bg-white/15 text-[10px] text-white"
                    >
                      {item.badge}
                    </Badge>
                  ) : null}
                </Button>
              </motion.div>
            );
          })}
        </div>

        {visibleSecondaryItems.length > 0 ? (
          <div className="relative mt-3 border-t border-[var(--admin-divider)] pt-3">
            {!collapsed ? (
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                Outils
              </p>
            ) : null}
            <div className="space-y-1">
              {visibleSecondaryItems.map((item, index) => {
                const active = item.key === activeModule;
                return (
                  <motion.div
                    key={item.label}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { duration: 0.14, delay: index * 0.015 }
                    }
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleItemClick(item)}
                      className={cn(
                        "h-9 w-full justify-start gap-2 rounded-xl border text-left",
                        collapsed ? "px-2.5" : "px-3",
                        active
                          ? "border-[var(--admin-accent-soft)] bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]"
                          : "border-transparent bg-transparent text-[var(--admin-ink)] hover:border-[var(--admin-border)] hover:bg-[var(--admin-surface)]"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          active
                            ? "text-[var(--admin-accent)]"
                            : "text-[var(--admin-muted)]"
                        )}
                      />
                      {!collapsed ? (
                        <span className="truncate text-sm">{item.label}</span>
                      ) : null}
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ) : null}

        {onLogout ? (
          <div className="relative mt-3 border-t border-[var(--admin-divider)] pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onLogout}
              className={cn(
                "h-10 w-full justify-start gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-muted)] hover:border-red-200 hover:bg-red-50 hover:text-red-600",
                collapsed ? "px-2.5" : "px-3"
              )}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed ? (
                <span className="text-sm font-medium">Déconnexion</span>
              ) : null}
            </Button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
