import type { AdminModuleKey } from "@/components/admin/SidebarNav";

export const adminModulePathMap: Record<AdminModuleKey, string> = {
  analytics: "/admin",
  orders: "/admin/orders",
  // "search" is the historical module key for the Customers directory.
  // It routes to the standalone /admin/customers page (v1 of task 1.5).
  search: "/admin/customers",
  products: "/admin/products",
  categories: "/admin/categories",
  reviews: "/admin/reviews",
  inventory: "/admin/inventory",
  coupons: "/admin/coupons",
  banners: "/admin/banners",
  reports: "/admin/reports",
  cms: "/admin/cms",
  settings: "/admin/settings",
};

export const dashboardModuleKeys: AdminModuleKey[] = [
  "analytics",
  "orders",
  "search",
  "products",
  "reviews",
  "inventory",
  "coupons",
  "banners",
  "reports",
];

export function getAdminModulePath(module: AdminModuleKey): string {
  return adminModulePathMap[module];
}

export function parseDashboardModuleFromPath(
  moduleParam: string | undefined | null
): AdminModuleKey {
  if (!moduleParam) return "analytics";
  if (dashboardModuleKeys.includes(moduleParam as AdminModuleKey)) {
    return moduleParam as AdminModuleKey;
  }
  return "analytics";
}
