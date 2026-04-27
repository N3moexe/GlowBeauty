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
}: AdminLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(194,24,91,0.08),_transparent_36%),radial-gradient(circle_at_bottom_left,_rgba(194,24,91,0.05),_transparent_32%)]">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.07)_1px,transparent_0)] [background-size:24px_24px]" />
      <div className="flex min-h-screen">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
          className="sticky top-0 hidden h-screen w-80 overflow-y-auto border-r border-border/60 bg-background/75 p-4 backdrop-blur lg:block"
        >
          <div className="mb-4 rounded-xl border border-border/70 bg-white/70 px-3 py-2.5 shadow-sm">
            <p className="text-sm font-semibold tracking-tight">Admin</p>
            <p className="text-xs text-muted-foreground">Control center</p>
          </div>
          <SidebarNav
            activeModule={activeModule}
            onModuleChange={onModuleChange}
            allowedModules={allowedModules}
          />
        </motion.div>

        <main className="relative z-10 flex-1 min-w-0">
          <div className="flex items-center gap-3 border-b border-border/70 bg-background/85 px-4 py-2 backdrop-blur lg:hidden">
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
              <p className="text-sm font-semibold">Admin dashboard</p>
              <p className="text-xs text-muted-foreground">Gestion complete</p>
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
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
            >
              <Card className="border-border/70 bg-white/92 p-4 shadow-[0_18px_44px_rgba(0,0,0,0.08)] backdrop-blur md:p-6">
                {children}
              </Card>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
