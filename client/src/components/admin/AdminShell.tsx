import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminNotAllowed from "@/pages/AdminNotAllowed";
import { AdminUIProvider, useAdminUI } from "@/stores/adminUI";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { isModuleAllowed } from "@/lib/adminRbac";
import { getAdminModulePath } from "@/lib/adminNavigation";
import { ALL_MODULES } from "@/pages/admin-modules/shared/utils";
import type { AdminModuleKey } from "@/components/admin/SidebarNav";
import type { TopBarNotification } from "@/components/admin/TopBar";
import { Loader2 } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { useLocation } from "wouter";

type AdminShellProps = {
  module: AdminModuleKey;
  children: ReactNode;
  onQuickAction?: (action: "add_product" | "create_coupon") => void;
  onSearchSubmit?: (query: string) => void;
  notifications?: TopBarNotification[];
};

function AdminShellInner({
  module,
  children,
  onQuickAction,
  onSearchSubmit,
  notifications,
}: AdminShellProps) {
  const { user, loading, logout } = useAuth();
  const { permissions, isLoading: permissionsLoading } =
    useAdminPermissions(!!user);
  const { sidebarCollapsed, toggleSidebar } = useAdminUI();
  const [, setLocation] = useLocation();

  const allowedModules = useMemo(
    () =>
      ALL_MODULES.filter(m => Boolean(permissions?.allowedModules.includes(m))),
    [permissions?.allowedModules]
  );

  if (loading || permissionsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--admin-bg)]">
        <Loader2 className="h-7 w-7 animate-spin text-[var(--admin-accent)]" />
      </div>
    );
  }

  if (!user) {
    setLocation(getLoginUrl());
    return null;
  }

  if (!permissions || !isModuleAllowed(permissions, module)) {
    return <AdminNotAllowed />;
  }

  return (
    <AdminLayout
      activeModule={module}
      onModuleChange={next => setLocation(getAdminModulePath(next))}
      userName={user.name}
      allowedModules={allowedModules}
      collapsed={sidebarCollapsed}
      onToggleCollapsed={toggleSidebar}
      onQuickAction={permissions.readOnly ? undefined : onQuickAction}
      onSearchSubmit={onSearchSubmit}
      notifications={notifications}
      onLogout={() => {
        void logout();
      }}
    >
      {children}
    </AdminLayout>
  );
}

export function AdminShell(props: AdminShellProps) {
  return (
    <AdminUIProvider>
      <AdminShellInner {...props} />
    </AdminUIProvider>
  );
}
