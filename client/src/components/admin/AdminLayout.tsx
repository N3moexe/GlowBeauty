import SidebarNav, { type AdminModuleKey } from "@/components/admin/SidebarNav";
import TopBar, { type TopBarNotification } from "@/components/admin/TopBar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { motion, useReducedMotion } from "framer-motion";
import { Menu } from "lucide-react";
import { useState, type ReactNode } from "react";

type AdminLayoutProps = {
  children: ReactNode;
  activeModule: string;
  onModuleChange: (module: AdminModuleKey) => void;
  userName?: string | null;
  onQuickAction?: (action: "add_product" | "create_coupon") => void;
  onSearchSubmit?: (query: string) => void;
  allowedModules?: AdminModuleKey[];
  notifications?: TopBarNotification[];
  onLogout?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

export default function AdminLayout({
  children,
  activeModule,
  onModuleChange,
  userName,
  onQuickAction,
  onSearchSubmit,
  allowedModules,
  notifications,
  onLogout,
  collapsed = false,
  onToggleCollapsed,
}: AdminLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--admin-bg)]">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(circle_at_1px_1px,rgba(67,49,42,0.06)_1px,transparent_0)] [background-size:24px_24px]" />
      <div className="flex min-h-screen">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.22, ease: "easeOut" }
          }
          className="sticky top-0 hidden h-screen w-80 overflow-y-auto border-r border-[var(--admin-divider)] bg-[var(--admin-bg)] p-4 lg:block"
        >
          <div className="mb-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-tint)] px-3 py-2.5">
            <p className="text-sm font-semibold tracking-tight text-[var(--admin-ink)] [font-family:var(--font-admin-display)]">
              Tableau de bord
            </p>
            <p className="text-xs text-[var(--admin-muted)]">
              GlowBeauty admin
            </p>
          </div>
          <SidebarNav
            activeModule={activeModule}
            onModuleChange={onModuleChange}
            allowedModules={allowedModules}
            collapsed={collapsed}
            onToggleCollapsed={onToggleCollapsed}
            onLogout={onLogout}
          />
        </motion.div>

        <main className="relative z-10 flex-1 min-w-0">
          <div className="flex items-center gap-3 border-b border-[var(--admin-divider)] bg-[var(--admin-bg)] px-4 py-2 lg:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] p-3">
                <SidebarNav
                  activeModule={activeModule}
                  allowedModules={allowedModules}
                  onModuleChange={module => {
                    onModuleChange(module);
                    setMobileOpen(false);
                  }}
                />
              </SheetContent>
            </Sheet>
            <div>
              <p className="text-sm font-semibold text-[var(--admin-ink)] [font-family:var(--font-admin-display)]">
                Administration
              </p>
              <p className="text-xs text-[var(--admin-muted)]">GlowBeauty</p>
            </div>
          </div>

          <div className="sticky top-0 z-20">
            <TopBar
              userName={userName}
              onQuickAction={onQuickAction}
              onSearchSubmit={onSearchSubmit}
              notifications={notifications}
              onLogout={onLogout}
            />
          </div>

          <div className="p-4 md:p-6">
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.22, ease: "easeOut" }
              }
            >
              <Card className="border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow)] md:p-6">
                {children}
              </Card>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
