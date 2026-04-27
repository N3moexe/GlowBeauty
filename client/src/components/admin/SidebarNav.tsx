import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import type { ComponentType } from "react";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  FileText,
  Grid2x2,
  Image as ImageIcon,
  LayoutGrid,
  LogOut,
  Megaphone,
  MessageCircle,
  Package,
  Palette,
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
  | "search"
  | "products"
  | "categories"
  | "reviews"
  | "inventory"
  | "coupons"
  | "banners"
  | "reports"
  | "cms"
  | "settings";

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
  priority?: "primary" | "secondary";
  onClick?: () => void;
};

const primaryItems: SidebarItem[] = [
  { key: "analytics", label: "Dashboard", icon: LayoutGrid, priority: "primary" },
  { key: "products", label: "Products", icon: Boxes, priority: "primary" },
  { key: "orders", label: "Orders", icon: ShoppingCart, priority: "primary" },
  // Maps to search module: customer-centric order lookup
  { key: "search", label: "Customers", icon: Users, priority: "primary" },
  // Maps to reports module for deeper analytics views
  { key: "reports", label: "Analytics", icon: BarChart3, priority: "primary" },
  { key: "coupons", label: "Promotions", icon: Megaphone, priority: "primary" },
  { key: "settings", label: "Settings", icon: Settings, priority: "primary" },
];

const secondaryItems: SidebarItem[] = [
  { key: "categories", label: "Categories", icon: Grid2x2, priority: "secondary" },
  { key: "reviews", label: "Reviews", icon: ClipboardList, priority: "secondary" },
  { key: "inventory", label: "Inventory", icon: Warehouse, priority: "secondary" },
  { key: "banners", label: "Banners", icon: ImageIcon, priority: "secondary" },
  { key: "cms", label: "Content", icon: FileText, priority: "secondary" },
  {
    label: "Storefront builder",
    icon: LayoutGrid,
    priority: "secondary",
    onClick: () => {
      if (typeof window !== "undefined") {
        window.location.href = "/admin/storefront";
      }
    },
  },
  {
    label: "Pages",
    icon: FileText,
    priority: "secondary",
    onClick: () => {
      if (typeof window !== "undefined") {
        window.location.href = "/admin/pages";
      }
    },
  },
  {
    label: "Navigation",
    icon: Wrench,
    priority: "secondary",
    onClick: () => {
      if (typeof window !== "undefined") {
        window.location.href = "/admin/navigation";
      }
    },
  },
  {
    label: "Theme",
    icon: Palette,
    priority: "secondary",
    onClick: () => {
      if (typeof window !== "undefined") {
        window.location.href = "/admin/theme";
      }
    },
  },
  {
    label: "Email templates",
    icon: Tag,
    priority: "secondary",
    onClick: () => {
      if (typeof window !== "undefined") {
        window.location.href = "/admin/email-templates";
      }
    },
  },
  {
    label: "Media library",
    icon: ImageIcon,
    priority: "secondary",
    onClick: () => {
      if (typeof window !== "undefined") {
        window.location.href = "/admin/media";
      }
    },
  },
  {
    label: "Integrations",
    icon: Wrench,
    priority: "secondary",
    onClick: () => {
      if (typeof window !== "undefined") {
        window.location.href = "/admin/integrations";
      }
    },
  },
  {
    label: "Chatbot",
    icon: MessageCircle,
    priority: "secondary",
    onClick: () => {
      if (typeof window !== "undefined") {
        window.location.href = "/admin/chatbot";
      }
    },
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

  const filterVisible = (item: SidebarItem) => {
    if (!item.key) return true;
    if (!allowedModules) return true;
    return allowedModules.includes(item.key);
  };

  const visiblePrimaryItems = primaryItems.filter(filterVisible);
  const visibleSecondaryItems = secondaryItems.filter(filterVisible);

  return (
    <aside className={cn("w-full", className)}>
      <div className="relative overflow-hidden rounded-3xl border border-[#ded3ca] bg-[linear-gradient(180deg,#fffdfb_0%,#f7f2ec_100%)] p-3 shadow-[0_22px_44px_-34px_rgba(67,49,42,0.52)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(182,124,134,0.18),transparent_34%),radial-gradient(circle_at_0%_100%,rgba(141,162,132,0.18),transparent_34%)]" />

        <div className="relative flex items-center justify-between gap-2 px-1 pb-2">
          {!collapsed ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f5f68]">Control center</p>
              <p className="text-xs text-[#756a64]">Skincare operations</p>
            </div>
          ) : (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f5f68]">Admin</p>
          )}

          {onToggleCollapsed ? (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={onToggleCollapsed}
              className="h-8 w-8 rounded-xl border border-[#dfd4cb] bg-white/70 text-[#7b6f68] hover:bg-white"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          ) : null}
        </div>

        <div className="relative space-y-2.5 pt-1">
          {visiblePrimaryItems.map((item, index) => {
            const active = item.key === activeModule;
            return (
              <motion.div
                key={item.label}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, delay: index * 0.02 }}
                whileHover={shouldReduceMotion ? undefined : { y: -1 }}
              >
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (item.onClick) {
                      item.onClick();
                      return;
                    }
                    if (item.key) onModuleChange(item.key);
                  }}
                  className={cn(
                    "group relative h-11 w-full justify-start gap-2 rounded-2xl border text-left transition-all",
                    collapsed ? "px-2.5" : "px-3",
                    active
                      ? "border-[#c7959d] bg-[linear-gradient(135deg,#b67c86_0%,#d19ca5_100%)] text-white shadow-[0_12px_28px_-18px_rgba(143,95,104,0.8)]"
                      : "border-[#e1d6cc] bg-white/70 text-[#423a35] hover:border-[#ccb9ac] hover:bg-white"
                  )}
                >
                  {active ? (
                    <span className="absolute left-1.5 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-white/75" />
                  ) : null}
                  <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-[#8f5f68]")} />
                  {!collapsed ? <span className="truncate text-sm font-medium">{item.label}</span> : null}
                  {!collapsed && item.badge ? (
                    <Badge variant="outline" className="ml-auto border-white/35 bg-white/15 text-[10px] text-white">
                      {item.badge}
                    </Badge>
                  ) : null}
                </Button>
              </motion.div>
            );
          })}
        </div>

        {visibleSecondaryItems.length > 0 ? (
          <div className="relative mt-4 border-t border-[#e0d5cb] pt-3">
            {!collapsed ? (
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8f7f77]">
                More tools
              </p>
            ) : null}
            <div className="space-y-1.5">
              {visibleSecondaryItems.map((item, index) => {
                const active = item.key === activeModule;
                return (
                  <motion.div
                    key={item.label}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.14, delay: index * 0.015 }}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        if (item.onClick) {
                          item.onClick();
                          return;
                        }
                        if (item.key) onModuleChange(item.key);
                      }}
                      className={cn(
                        "h-9 w-full justify-start gap-2 rounded-xl border text-left",
                        collapsed ? "px-2.5" : "px-3",
                        active
                          ? "border-[#c7959d] bg-[#f5e5e8] text-[#7b4d56]"
                          : "border-[#e7ddd4] bg-white/50 text-[#5d534d] hover:bg-white"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed ? <span className="truncate text-sm">{item.label}</span> : null}
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ) : null}

        {onLogout ? (
          <div className="relative mt-4 border-t border-[#e0d5cb] pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onLogout}
              className={cn(
                "h-10 w-full justify-start gap-2 rounded-xl border border-[#e4d8cf] bg-white/65 text-[#7d5b62] hover:bg-white",
                collapsed ? "px-2.5" : "px-3"
              )}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="text-sm font-medium">Logout</span> : null}
            </Button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
