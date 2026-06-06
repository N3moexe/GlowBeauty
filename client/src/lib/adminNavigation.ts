import type { AdminModuleKey } from "@/components/admin/SidebarNav";

export const adminModulePathMap: Record<AdminModuleKey, string> = {
  analytics: "/admin",
  orders: "/admin/orders",
  customers: "/admin/customers",
  products: "/admin/products",
  categories: "/admin/categories",
  reviews: "/admin/reviews",
  inventory: "/admin/inventory",
  coupons: "/admin/coupons",
  banners: "/admin/banners",
  reports: "/admin/reports",
  cms: "/admin/cms",
  settings: "/admin/settings",
  newsletter: "/admin/newsletter",
  activity: "/admin/activity",
};

export const dashboardModuleKeys: AdminModuleKey[] = [
  "analytics",
  "orders",
  "customers",
  "products",
  "categories",
  "reviews",
  "inventory",
  "coupons",
  "banners",
  "reports",
  "cms",
  "settings",
  "newsletter",
  "activity",
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
