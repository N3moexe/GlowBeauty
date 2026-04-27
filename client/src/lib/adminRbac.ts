import type { AdminModuleKey } from "@/components/admin/SidebarNav";

export type AdminRole = "ADMIN" | "MANAGER" | "STAFF";

export type AdminPermissions = {
  role: AdminRole;
  allowedModules: string[];
  canWriteOrders: boolean;
  canWriteProducts: boolean;
  canWriteCms: boolean;
  canDelete: boolean;
  canAccessSettings: boolean;
  readOnly: boolean;
};

export function isModuleAllowed(permissions: AdminPermissions | null | undefined, module: AdminModuleKey): boolean {
  if (!permissions) return false;
  return permissions.allowedModules.includes(module);
}
