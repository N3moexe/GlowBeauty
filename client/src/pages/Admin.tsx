import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import DataTable from "@/components/admin/DataTable";
import EmptyState from "@/components/admin/EmptyState";
import PageHeader, {
  adminCardClass,
  adminCardPadding,
  adminSpacingScale,
} from "@/components/admin/PageHeader";
import SidebarNav, { type AdminModuleKey } from "@/components/admin/SidebarNav";
import StatusBadge from "@/components/admin/StatusBadge";
import TopBar, { type TopBarNotification } from "@/components/admin/TopBar";
import AdminNotAllowed from "@/pages/AdminNotAllowed";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ImageUpload";
import {
  fetchAdminAnalyticsOverview,
  type AdminAnalyticsOverviewResponse,
} from "@/lib/adminAnalytics";
import { trpc } from "@/lib/trpc";
import { getAdminModulePath } from "@/lib/adminNavigation";
import { isModuleAllowed } from "@/lib/adminRbac";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { AnalyticsModule } from "@/pages/admin-modules/AnalyticsModule";
import { OrdersModule } from "@/pages/admin-modules/OrdersModule";
import { ProductsModule } from "@/pages/admin-modules/ProductsModule";
import { InventoryModule } from "@/pages/admin-modules/InventoryModule";
import { CategoriesModule } from "@/pages/admin-modules/CategoriesModule";
import { CouponsModule } from "@/pages/admin-modules/CouponsModule";
import { ReviewsModule } from "@/pages/admin-modules/ReviewsModule";
import { CustomersModule } from "@/pages/admin-modules/CustomersModule";
import { ReportsModule } from "@/pages/admin-modules/ReportsModule";
import { ActivityModule } from "@/pages/admin-modules/ActivityModule";
import { NewsletterModule } from "@/pages/admin-modules/NewsletterModule";
import { CmsModule } from "@/pages/admin-modules/CmsModule";
import { BannersModule } from "@/pages/admin-modules/BannersModule";
import { SettingsModule } from "@/pages/admin-modules/SettingsModule";
import { AdminCommandPalette } from "@/components/admin/AdminCommandPalette";

const ORDERS_PAGE_SIZE = 50;
const ORDERS_EXPORT_LIMIT = 10000;
import type {
  ProductRoutine,
  ProductRoutineStep,
} from "@shared/product-content";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { motion, useReducedMotion } from "framer-motion";
import {
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Download,
  Eye,
  FileText,
  Globe,
  Loader2,
  Menu,
  PackagePlus,
  Percent,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  ShoppingCart,
  Store,
  Tag,
  Trash2,
  Trophy,
  Warehouse,
  Wand2,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import {
  formatCFA,
  formatPercent,
  toDateLabel,
  toDateInputValue,
} from "@/pages/admin-modules/shared/formatters";
import { escapeCsvCell, downloadCsv } from "@/pages/admin-modules/shared/csv";
import {
  ALL_MODULES,
  parseAdminModule,
  moveArrayItem,
  getErrorMessage,
  slugify,
  normalizePaymentStatus,
} from "@/pages/admin-modules/shared/utils";
import {
  PRODUCT_MAX_BULLETS,
  PRODUCT_DEFAULT_ROUTINE_STEPS,
  PRODUCT_MAX_ROUTINE_STEPS,
  ROUTINE_TITLE_PRESETS,
  ROUTINE_CUSTOM_VALUE,
  sanitizeBulletArray,
  sanitizeRoutineSteps,
  createDefaultRoutineSteps,
  createDefaultRoutine,
  sanitizeRoutine,
  resolveRoutinePresetValue,
  createEmptyRoutineStep,
} from "@/pages/admin-modules/shared/productHelpers";
import { ShimmerBlock } from "@/pages/admin-modules/shared/ShimmerBlock";
import { RetryPanel } from "@/pages/admin-modules/shared/RetryPanel";

type ProductEntity = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  benefits?: string[] | null;
  descriptionBullets?: string[] | null;
  routine?: ProductRoutine | null;
  price: number;
  comparePrice: number | null;
  categoryId: number;
  imageUrl: string | null;
  inStock: boolean | null;
  stockQuantity: number | null;
  isFeatured: boolean | null;
  isNew: boolean | null;
  isTrending: boolean | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type CategoryEntity = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  sortOrder: number;
};

type OrderEntity = {
  id: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  createdAt: string | Date;
};

type OrderDetailEntity = OrderEntity & {
  customerAddress?: string | null;
  customerCity?: string | null;
  notes?: string | null;
  items?: Array<{
    id: number;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
};

type DashboardWidgetId =
  | "revenue"
  | "ordersToday"
  | "lowStock"
  | "topProducts"
  | "recentOrders"
  | "quickActions";

type ProductFormState = {
  name: string;
  slug: string;
  description: string;
  benefits: string[];
  descriptionBullets: string[];
  routine: ProductRoutine;
  price: string;
  comparePrice: string;
  categoryId: string;
  imageUrl: string;
  stockQuantity: string;
  inStock: boolean;
  isFeatured: boolean;
  isNew: boolean;
  isTrending: boolean;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  ogImage: string;
};

type CouponEntity = {
  id: number;
  code: string;
  description: string | null;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmount: number;
  maxUses: number | null;
  currentUses: number;
  isActive: boolean;
  startDate: string | Date | null;
  endDate: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type CouponFormState = {
  code: string;
  description: string;
  discountType: "percentage" | "fixed";
  discountValue: string;
  minOrderAmount: string;
  maxUses: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
};

type ReviewEntity = {
  id: number;
  productId: number;
  orderId?: number | null;
  customerName: string;
  customerEmail?: string | null;
  rating: number;
  title?: string | null;
  body?: string | null;
  images?: string[] | null;
  status: "pending" | "approved" | "rejected";
  isVerifiedPurchase?: boolean;
  createdAt: string | Date;
  updatedAt?: string | Date;
};

const DEFAULT_WIDGET_ORDER: DashboardWidgetId[] = [
  "revenue",
  "ordersToday",
  "lowStock",
  "topProducts",
  "recentOrders",
  "quickActions",
];

const WIDGET_TITLE: Record<DashboardWidgetId, string> = {
  revenue: "Revenue",
  ordersToday: "Orders today",
  lowStock: "Low stock",
  topProducts: "Top products",
  recentOrders: "Recent orders",
  quickActions: "Quick actions",
};

const ORDER_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const ORDER_PAYMENT_STATUS_OPTIONS: Array<{
  value: "pending" | "processing" | "completed" | "failed";
  label: string;
}> = [
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Paid" },
  { value: "failed", label: "Failed" },
];

const ANALYTICS_STATUS_COLORS = [
  "#8f5f68",
  "#9aa791",
  "#d09ea7",
  "#c5b89a",
  "#6f6b68",
];

const EMPTY_PRODUCT_FORM: ProductFormState = {
  name: "",
  slug: "",
  description: "",
  benefits: [],
  descriptionBullets: [],
  routine: createDefaultRoutine(),
  price: "",
  comparePrice: "",
  categoryId: "",
  imageUrl: "",
  stockQuantity: "0",
  inStock: true,
  isFeatured: false,
  isNew: false,
  isTrending: false,
  metaTitle: "",
  metaDescription: "",
  metaKeywords: "",
  ogImage: "",
};

const EMPTY_COUPON_FORM: CouponFormState = {
  code: "",
  description: "",
  discountType: "percentage",
  discountValue: "",
  minOrderAmount: "0",
  maxUses: "",
  isActive: true,
  startDate: "",
  endDate: "",
};

const SKINCARE_CATEGORY_PRESET = [
  {
    name: "Nettoyants",
    slug: "nettoyants",
    description: "Gels et huiles nettoyantes pour un nettoyage doux quotidien.",
  },
  {
    name: "Serums",
    slug: "serums",
    description:
      "Actifs cibles: hydratation, eclat, imperfections et anti-age.",
  },
  {
    name: "Hydratants",
    slug: "hydratants",
    description: "Cremes et lotions pour renforcer la barriere cutanee.",
  },
  {
    name: "Masques",
    slug: "masques",
    description: "Masques hebdomadaires pour detox, glow et nutrition intense.",
  },
  {
    name: "SPF",
    slug: "spf",
    description: "Protections solaires quotidiennes large spectre.",
  },
  {
    name: "Kits Routine",
    slug: "kits-routine",
    description: "Routines pre-composees matin/soir par objectif peau.",
  },
] as const;

function readWidgetOrder(): DashboardWidgetId[] {
  if (typeof window === "undefined") return DEFAULT_WIDGET_ORDER;
  try {
    const raw = window.localStorage.getItem("sbp_admin_widget_order");
    if (!raw) return DEFAULT_WIDGET_ORDER;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_WIDGET_ORDER;
    const valid = parsed.filter((item): item is DashboardWidgetId =>
      DEFAULT_WIDGET_ORDER.includes(item as DashboardWidgetId)
    );
    const missing = DEFAULT_WIDGET_ORDER.filter(id => !valid.includes(id));
    return [...valid, ...missing];
  } catch {
    return DEFAULT_WIDGET_ORDER;
  }
}

export default function Admin() {
  /**
   * Simulation checklist (DebugMaster):
   * 1) Create product -> appears in admin table immediately and storefront queries refresh after invalidation.
   * 2) Edit product price/stock -> row updates and dependent analytics/reports counters refresh.
   * 3) Delete product -> row removed, low-stock + best-seller panels re-evaluate with fresh data.
   * 4) Update order status -> list and detail modal stay consistent after mutation + refetch.
   * 5) Create/edit/publish CMS page -> table + modal remain in sync via cms.list/cms.byId invalidation.
   * 6) Save homepage editor -> settings/banner/category queries invalidate so storefront can pick up latest content.
   */
  const { user, loading, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const params = useParams<{ module?: string }>();
  const requestedModule = parseAdminModule(params.module);
  const shouldReduceMotion = useReducedMotion();
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();

  const [activeModule, setActiveModule] =
    useState<AdminModuleKey>(requestedModule);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("sbp_admin_sidebar_collapsed") === "1";
  });

  const [kpiPeriod, setKpiPeriod] = useState<1 | 7 | 30>(30);
  const [analyticsRangeDays, setAnalyticsRangeDays] = useState<7 | 30 | 90>(30);
  const [widgetOrder, setWidgetOrder] = useState<DashboardWidgetId[]>(() =>
    readWidgetOrder()
  );

  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [productStockFilter, setProductStockFilter] = useState<
    "all" | "instock" | "low" | "out"
  >("all");
  const [productSort, setProductSort] = useState<
    "newest" | "oldest" | "name" | "price_asc" | "price_desc" | "stock"
  >("newest");
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [productPendingDelete, setProductPendingDelete] =
    useState<ProductEntity | null>(null);
  const [productForm, setProductForm] =
    useState<ProductFormState>(EMPTY_PRODUCT_FORM);
  const [productRoutineTab, setProductRoutineTab] = useState<"am" | "pm">("am");
  const [productSlugTouched, setProductSlugTouched] = useState(false);

  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderPage, setOrderPage] = useState(0); // 0-indexed page of ORDERS_PAGE_SIZE
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const debouncedOrderSearch = useDebouncedValue(orderSearch.trim(), 300);

  // Reset to page 0 whenever the search or status filter changes so we
  // don't land on an empty page of a now-smaller result set.
  useEffect(() => {
    setOrderPage(0);
  }, [debouncedOrderSearch, orderStatusFilter]);

  const [couponSearch, setCouponSearch] = useState("");
  const [couponStatusFilter, setCouponStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState<number | null>(null);
  const [couponPendingDelete, setCouponPendingDelete] =
    useState<CouponEntity | null>(null);
  const [couponForm, setCouponForm] =
    useState<CouponFormState>(EMPTY_COUPON_FORM);

  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewStatusFilter, setReviewStatusFilter] = useState<
    "all" | "approved" | "pending" | "rejected"
  >("all");
  const [reviewProductFilter, setReviewProductFilter] = useState<string>("all");
  const [reviewPreview, setReviewPreview] = useState<ReviewEntity | null>(null);

  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryDraftStock, setInventoryDraftStock] = useState<
    Record<number, string>
  >({});

  const [categoryPresetApplying, setCategoryPresetApplying] = useState(false);

  const {
    data: permissions,
    isLoading: permissionsLoading,
    error: permissionsError,
  } = trpc.rbac.me.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  useEffect(() => {
    setActiveModule(requestedModule);
  }, [requestedModule]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "sbp_admin_sidebar_collapsed",
      sidebarCollapsed ? "1" : "0"
    );
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "sbp_admin_widget_order",
      JSON.stringify(widgetOrder)
    );
  }, [widgetOrder]);

  const allowedModules = useMemo(
    () =>
      ALL_MODULES.filter(module =>
        Boolean(permissions?.allowedModules.includes(module))
      ),
    [permissions?.allowedModules]
  );

  useEffect(() => {
    if (!permissions || params.module) return;
    if (isModuleAllowed(permissions, activeModule)) return;
    const fallback = allowedModules[0];
    if (!fallback) return;
    const nextPath = getAdminModulePath(fallback);
    setActiveModule(fallback);
    if (nextPath !== location) {
      setLocation(nextPath);
    }
  }, [
    activeModule,
    allowedModules,
    location,
    params.module,
    permissions,
    setLocation,
  ]);

  const navigateToModule = useCallback(
    (module: AdminModuleKey) => {
      setActiveModule(module);
      const target = getAdminModulePath(module);
      if (target !== location) {
        setLocation(target);
      }
    },
    [location, setLocation]
  );

  const canSeeOverview = Boolean(
    permissions && isModuleAllowed(permissions, "analytics")
  );
  const canManageOrders = Boolean(permissions?.canWriteOrders);
  const canManageProducts = Boolean(permissions?.canWriteProducts);
  const canManageCms = Boolean(permissions?.canWriteCms);
  const canDeleteEntities = Boolean(permissions?.canDelete);
  const canEditHomepage = Boolean(
    permissions &&
    permissions.role === "ADMIN" &&
    (isModuleAllowed(permissions, "banners") ||
      isModuleAllowed(permissions, "settings"))
  );

  const invalidateProductSurface = useCallback(async () => {
    await Promise.all([
      utils.product.list.invalidate(),
      utils.product.byId.invalidate(),
      utils.product.bySlug.invalidate(),
      utils.product.count.invalidate(),
      utils.reports.lowStock.invalidate(),
      utils.reports.bestSellers.invalidate(),
      utils.analytics.dashboard.invalidate(),
      queryClient.invalidateQueries({ queryKey: ["admin-analytics-overview"] }),
    ]);
  }, [queryClient, utils]);

  const invalidateOrderSurface = useCallback(async () => {
    await Promise.all([
      utils.order.list.invalidate(),
      utils.order.byId.invalidate(),
      utils.analytics.dashboard.invalidate(),
      queryClient.invalidateQueries({ queryKey: ["admin-analytics-overview"] }),
    ]);
  }, [queryClient, utils]);

  const productsQuery = trpc.product.list.useQuery(
    { limit: 1000 },
    {
      enabled:
        Boolean(permissions) &&
        [
          "products",
          "inventory",
          "categories",
          "analytics",
          "reports",
        ].includes(activeModule),
      refetchInterval:
        activeModule === "products" || activeModule === "inventory"
          ? 20000
          : false,
      refetchOnWindowFocus: true,
      retry: 1,
    }
  );

  const categoriesQuery = trpc.category.list.useQuery(undefined, {
    enabled:
      Boolean(permissions) &&
      [
        "products",
        "banners",
        "analytics",
        "reports",
        "inventory",
        "categories",
      ].includes(activeModule),
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const ordersQuery = trpc.order.list.useQuery(
    {
      query: debouncedOrderSearch || undefined,
      status: orderStatusFilter !== "all" ? orderStatusFilter : undefined,
      limit: ORDERS_PAGE_SIZE,
      offset: orderPage * ORDERS_PAGE_SIZE,
    },
    {
      enabled:
        Boolean(permissions) && ["orders", "analytics"].includes(activeModule),
      refetchInterval:
        activeModule === "orders" || activeModule === "analytics"
          ? 15000
          : false,
      refetchOnWindowFocus: true,
      retry: 1,
      placeholderData: previous => previous,
    }
  );

  const orderTotal = ordersQuery.data?.total ?? 0;
  const orderPageCount = Math.max(1, Math.ceil(orderTotal / ORDERS_PAGE_SIZE));

  const orderDetailQuery = trpc.order.byId.useQuery(
    { id: selectedOrderId ?? 0 },
    { enabled: selectedOrderId !== null, retry: 1 }
  );

  const analyticsPeriodQuery = trpc.analytics.dashboard.useQuery(
    { days: kpiPeriod },
    {
      enabled: Boolean(permissions) && canSeeOverview,
      refetchInterval: activeModule === "analytics" ? 15000 : false,
      refetchOnWindowFocus: true,
      retry: 1,
    }
  );

  const analyticsTodayQuery = trpc.analytics.dashboard.useQuery(
    { days: 1 },
    {
      enabled: Boolean(permissions) && canSeeOverview,
      refetchInterval: activeModule === "analytics" ? 15000 : false,
      refetchOnWindowFocus: true,
      retry: 1,
    }
  );

  const lowStockQuery = trpc.reports.lowStock.useQuery(
    { threshold: 8 },
    {
      enabled:
        Boolean(permissions) && ["analytics", "reports"].includes(activeModule),
      refetchInterval: activeModule === "analytics" ? 30000 : false,
      refetchOnWindowFocus: true,
      retry: 1,
    }
  );

  const bestSellersQuery = trpc.reports.bestSellers.useQuery(
    { limit: 6 },
    {
      enabled:
        Boolean(permissions) && ["analytics", "reports"].includes(activeModule),
      refetchInterval: activeModule === "analytics" ? 30000 : false,
      refetchOnWindowFocus: true,
      retry: 1,
    }
  );

  const salesByCategoryQuery = trpc.reports.salesByCategory.useQuery(
    undefined,
    {
      enabled:
        Boolean(permissions) && ["analytics", "reports"].includes(activeModule),
      refetchInterval: activeModule === "analytics" ? 30000 : false,
      refetchOnWindowFocus: true,
      retry: 1,
    }
  );

  const analyticsOverviewQuery = useQuery({
    queryKey: ["admin-analytics-overview", analyticsRangeDays],
    queryFn: () => fetchAdminAnalyticsOverview(analyticsRangeDays),
    enabled:
      Boolean(permissions) && ["analytics", "reports"].includes(activeModule),
    refetchInterval:
      activeModule === "analytics" || activeModule === "reports"
        ? 15000
        : false,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const productSeoSettingsQuery = trpc.settings.list.useQuery(
    { prefix: "productSeo." },
    {
      enabled:
        Boolean(permissions) &&
        permissions?.role === "ADMIN" &&
        activeModule === "products",
      retry: 1,
      refetchOnWindowFocus: true,
    }
  );

  const couponsQuery = trpc.coupons.list.useQuery(
    { limit: 250 },
    {
      enabled: Boolean(permissions) && activeModule === "coupons",
      refetchInterval: activeModule === "coupons" ? 15000 : false,
      refetchOnWindowFocus: true,
      retry: 1,
    }
  );

  const productCreateMutation = trpc.product.create.useMutation({
    onSuccess: async () => {
      toast.success("Product created");
      await invalidateProductSurface();
    },
    onError: error => toast.error(error.message),
  });

  const productUpdateMutation = trpc.product.update.useMutation({
    onSuccess: async () => {
      toast.success("Product updated");
      await invalidateProductSurface();
    },
    onError: error => toast.error(error.message),
  });

  const productDeleteMutation = trpc.product.delete.useMutation({
    onSuccess: async () => {
      toast.success("Product deleted");
      await invalidateProductSurface();
    },
    onError: error => toast.error(error.message),
  });

  const orderUpdateStatusMutation = trpc.order.updateStatus.useMutation({
    onSuccess: async () => {
      await invalidateOrderSurface();
      toast.success("Order status updated");
    },
    onError: error => toast.error(error.message),
  });

  const orderUpdatePaymentMutation = trpc.order.updatePayment.useMutation({
    onSuccess: async () => {
      await invalidateOrderSurface();
      toast.success("Payment status updated");
    },
    onError: error => toast.error(error.message),
  });

  const settingsSetMutation = trpc.settings.set.useMutation({
    onError: error => toast.error(error.message),
  });

  const categoryUpdateMutation = trpc.category.update.useMutation({
    onError: error => toast.error(error.message),
  });

  const categoryCreateMutation = trpc.category.create.useMutation({
    onError: error => toast.error(error.message),
  });

  const categoryDeleteMutation = trpc.category.delete.useMutation({
    onError: error => toast.error(error.message),
  });

  const reviewModerateMutation = trpc.reviews.moderate.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.reviews.adminList.invalidate(),
        utils.reviews.list.invalidate(),
        utils.reviews.averageRating.invalidate(),
      ]);
      toast.success("Review status updated");
    },
    onError: error => toast.error(error.message),
  });

  const reviewDeleteMutation = trpc.reviews.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.reviews.adminList.invalidate(),
        utils.reviews.list.invalidate(),
        utils.reviews.averageRating.invalidate(),
      ]);
      toast.success("Review deleted");
    },
    onError: error => toast.error(error.message),
  });

  const couponCreateMutation = trpc.coupons.create.useMutation({
    onSuccess: async () => {
      await utils.coupons.list.invalidate();
      toast.success("Promotion created");
    },
    onError: error => toast.error(error.message),
  });

  const couponUpdateMutation = trpc.coupons.update.useMutation({
    onSuccess: async () => {
      await utils.coupons.list.invalidate();
      toast.success("Promotion updated");
    },
    onError: error => toast.error(error.message),
  });

  const couponToggleMutation = trpc.coupons.toggleActive.useMutation({
    onSuccess: async () => {
      await utils.coupons.list.invalidate();
      toast.success("Promotion status updated");
    },
    onError: error => toast.error(error.message),
  });

  const couponDeleteMutation = trpc.coupons.delete.useMutation({
    onSuccess: async () => {
      await utils.coupons.list.invalidate();
      toast.success("Promotion deleted");
    },
    onError: error => toast.error(error.message),
  });
  const productRows = useMemo(
    () => (productsQuery.data?.products ?? []) as ProductEntity[],
    [productsQuery.data?.products]
  );

  const orderRows = useMemo(
    () => (ordersQuery.data?.orders ?? []) as OrderEntity[],
    [ordersQuery.data?.orders]
  );

  const categoryRows = useMemo(
    () => (categoriesQuery.data ?? []) as CategoryEntity[],
    [categoriesQuery.data]
  );

  const couponRows = useMemo(
    () => (couponsQuery.data ?? []) as CouponEntity[],
    [couponsQuery.data]
  );

  const productSeoById = useMemo(() => {
    const map = new Map<
      number,
      Pick<
        ProductFormState,
        "metaTitle" | "metaDescription" | "metaKeywords" | "ogImage"
      >
    >();
    (
      (productSeoSettingsQuery.data ?? []) as Array<{
        key: string;
        value: string;
      }>
    ).forEach(entry => {
      const match = entry.key.match(
        /^productSeo\.(\d+)\.(metaTitle|metaDescription|metaKeywords|ogImage)$/
      );
      if (!match) return;
      const productId = Number(match[1]);
      const field = match[2] as
        | "metaTitle"
        | "metaDescription"
        | "metaKeywords"
        | "ogImage";
      const previous = map.get(productId) || {
        metaTitle: "",
        metaDescription: "",
        metaKeywords: "",
        ogImage: "",
      };
      map.set(productId, {
        ...previous,
        [field]: entry.value || "",
      });
    });
    return map;
  }, [productSeoSettingsQuery.data]);

  const categoryNameById = useMemo(() => {
    const map = new Map<number, string>();
    categoryRows.forEach(category => map.set(category.id, category.name));
    return map;
  }, [categoryRows]);

  const filteredProducts = useMemo(() => {
    let rows = [...productRows];

    if (productSearch.trim()) {
      const query = productSearch.trim().toLowerCase();
      rows = rows.filter(product =>
        [product.name, product.slug, product.description || ""].some(part =>
          part.toLowerCase().includes(query)
        )
      );
    }

    if (productCategoryFilter !== "all") {
      rows = rows.filter(
        product => String(product.categoryId) === productCategoryFilter
      );
    }

    if (productStockFilter === "instock") {
      rows = rows.filter(product => (product.stockQuantity ?? 0) > 10);
    }

    if (productStockFilter === "low") {
      rows = rows.filter(
        product =>
          (product.stockQuantity ?? 0) > 0 && (product.stockQuantity ?? 0) <= 10
      );
    }

    if (productStockFilter === "out") {
      rows = rows.filter(
        product =>
          (product.stockQuantity ?? 0) <= 0 || product.inStock === false
      );
    }

    rows.sort((left, right) => {
      if (productSort === "name") return left.name.localeCompare(right.name);
      if (productSort === "price_asc") return left.price - right.price;
      if (productSort === "price_desc") return right.price - left.price;
      if (productSort === "stock") {
        return (left.stockQuantity ?? 0) - (right.stockQuantity ?? 0);
      }
      if (productSort === "oldest") {
        return (
          new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime()
        );
      }
      return (
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      );
    });

    return rows;
  }, [
    productCategoryFilter,
    productRows,
    productSearch,
    productSort,
    productStockFilter,
  ]);

  const filteredInventoryRows = useMemo(() => {
    const source = [...productRows];
    if (!inventorySearch.trim()) return source;
    const query = inventorySearch.trim().toLowerCase();
    return source.filter(product =>
      [product.name, product.slug, product.description || ""].some(value =>
        value.toLowerCase().includes(query)
      )
    );
  }, [inventorySearch, productRows]);

  const ordersToday = analyticsTodayQuery.data?.totalOrders ?? 0;
  const totalRevenue = analyticsPeriodQuery.data?.totalRevenue ?? 0;
  const lowStockRows = (lowStockQuery.data ?? []) as Array<{
    id: number;
    name: string;
    stockQuantity?: number | null;
    categoryId?: number;
  }>;
  const lowStockCount = lowStockRows.length;
  const pendingOrderCount = orderRows.filter(
    order => order.status === "pending"
  ).length;
  const liveConnected =
    activeModule === "analytics" && !analyticsPeriodQuery.isError;

  const bestSellerRows = (
    (bestSellersQuery.data ?? []) as Array<{
      product?: { id: number; name: string };
      totalSold?: number;
      totalRevenue?: number;
    }>
  ).map(entry => ({
    productId: entry.product?.id,
    name: entry.product?.name || "Product",
    totalSold: entry.totalSold || 0,
    revenue: entry.totalRevenue || 0,
  }));

  const categorySalesRows = (
    (salesByCategoryQuery.data ?? []) as Array<{
      category?: { id: number; name: string };
      totalSales?: number | null;
      totalOrders?: number | null;
    }>
  )
    .map(entry => ({
      id: entry.category?.id ?? Math.random(),
      name: entry.category?.name || "Category",
      totalSales: Number(entry.totalSales || 0),
      totalOrders: Number(entry.totalOrders || 0),
    }))
    .filter(entry => entry.totalSales > 0)
    .sort((left, right) => right.totalSales - left.totalSales);

  const analyticsOverview = analyticsOverviewQuery.data;
  const analyticsRevenue = Number(analyticsOverview?.revenue || 0);
  const analyticsOrders = Number(analyticsOverview?.orders || 0);
  const analyticsCustomers = Number(analyticsOverview?.customers || 0);
  const analyticsAov = Number(analyticsOverview?.aov || 0);
  const analyticsConversionRate = analyticsOverview?.conversionRate ?? null;
  const analyticsLineData = analyticsOverview?.revenueSeries ?? [];
  const analyticsStatusData = analyticsOverview?.ordersByStatus ?? [];
  const analyticsBestSellerRows = analyticsOverview?.bestSellers ?? [];
  const analyticsLowStockRows = analyticsOverview?.lowStock ?? [];
  const analyticsFailedPaymentsRows = analyticsOverview?.failedPayments ?? [];
  const analyticsRecentOrders = analyticsOverview?.recentOrders ?? [];
  const analyticsTopCustomers = analyticsOverview?.topCustomers ?? [];

  const revenueTrend = useMemo(() => {
    const totalDays = kpiPeriod;
    const byDay = new Map<string, number>();
    for (let offset = totalDays - 1; offset >= 0; offset -= 1) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - offset);
      byDay.set(day.toISOString().slice(0, 10), 0);
    }
    orderRows.forEach(order => {
      const date = new Date(order.createdAt);
      const key = date.toISOString().slice(0, 10);
      if (!byDay.has(key)) return;
      if (order.paymentStatus === "failed") return;
      byDay.set(key, (byDay.get(key) || 0) + Number(order.totalAmount || 0));
    });

    const points = Array.from(byDay.entries()).map(([date, amount]) => ({
      date,
      amount,
      label: new Date(date).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
      }),
    }));
    const maxAmount = points.reduce(
      (max, point) => Math.max(max, point.amount),
      0
    );
    return { points, maxAmount };
  }, [kpiPeriod, orderRows]);

  const productsErrorMessage = productsQuery.error
    ? getErrorMessage(productsQuery.error, "Unable to load products.")
    : null;
  const ordersErrorMessage = ordersQuery.error
    ? getErrorMessage(ordersQuery.error, "Unable to load orders.")
    : null;
  const analyticsErrorMessage =
    analyticsPeriodQuery.error ||
    analyticsTodayQuery.error ||
    lowStockQuery.error ||
    bestSellersQuery.error ||
    salesByCategoryQuery.error
      ? getErrorMessage(
          analyticsPeriodQuery.error ||
            analyticsTodayQuery.error ||
            lowStockQuery.error ||
            bestSellersQuery.error ||
            salesByCategoryQuery.error,
          "Unable to load analytics."
        )
      : null;
  const analyticsOverviewErrorMessage = analyticsOverviewQuery.error
    ? getErrorMessage(
        analyticsOverviewQuery.error,
        "Unable to load analytics overview."
      )
    : null;
  const productModuleErrorMessage =
    productsErrorMessage ||
    (categoriesQuery.error
      ? getErrorMessage(categoriesQuery.error, "Unable to load categories.")
      : null);
  const categoriesErrorMessage = categoriesQuery.error
    ? getErrorMessage(categoriesQuery.error, "Unable to load categories.")
    : null;
  const inventoryErrorMessage = productsQuery.error
    ? getErrorMessage(productsQuery.error, "Unable to load inventory.")
    : null;
  const dashboardNotifications = useMemo<TopBarNotification[]>(() => {
    const notifications: TopBarNotification[] = [];

    if (pendingOrderCount > 0) {
      notifications.push({
        id: "pending-orders",
        title: `${pendingOrderCount} pending orders`,
        description: "Handle pending orders quickly.",
        count: pendingOrderCount,
        onSelect: () => {
          setOrderStatusFilter("pending");
          navigateToModule("orders");
        },
      });
    }

    if (lowStockCount > 0) {
      notifications.push({
        id: "low-stock",
        title: `${lowStockCount} low stock products`,
        description: "Restock before stockout.",
        count: lowStockCount,
        onSelect: () => navigateToModule("reports"),
      });
    }

    return notifications;
  }, [lowStockCount, navigateToModule, pendingOrderCount]);

  const openCreateProductDialog = useCallback(() => {
    setEditingProductId(null);
    setProductRoutineTab("am");
    setProductSlugTouched(false);
    setProductForm(EMPTY_PRODUCT_FORM);
    setProductModalOpen(true);
  }, []);

  const openEditProductDialog = useCallback(
    (product: ProductEntity) => {
      const seo = productSeoById.get(product.id);
      setEditingProductId(product.id);
      setProductRoutineTab("am");
      setProductSlugTouched(true);
      setProductForm({
        name: product.name,
        slug: product.slug,
        description: product.description || "",
        benefits: sanitizeBulletArray(product.benefits, PRODUCT_MAX_BULLETS),
        descriptionBullets: sanitizeBulletArray(
          product.descriptionBullets,
          PRODUCT_MAX_BULLETS
        ),
        routine: sanitizeRoutine(product.routine),
        price: String(product.price),
        comparePrice: product.comparePrice ? String(product.comparePrice) : "",
        categoryId: String(product.categoryId),
        imageUrl: product.imageUrl || "",
        stockQuantity: String(product.stockQuantity ?? 0),
        inStock: product.inStock !== false,
        isFeatured: Boolean(product.isFeatured),
        isNew: Boolean(product.isNew),
        isTrending: Boolean(product.isTrending),
        metaTitle: seo?.metaTitle || "",
        metaDescription: seo?.metaDescription || "",
        metaKeywords: seo?.metaKeywords || "",
        ogImage: seo?.ogImage || product.imageUrl || "",
      });
      setProductModalOpen(true);
    },
    [productSeoById]
  );

  const submitProductForm = useCallback(async () => {
    if (!canManageProducts) {
      toast.error("Product editing is not allowed");
      return;
    }

    if (!productForm.name.trim()) {
      toast.error("Product name is required");
      return;
    }

    if (!productForm.slug.trim()) {
      toast.error("Product slug is required");
      return;
    }

    if (!productForm.categoryId) {
      toast.error("Choose a category");
      return;
    }

    const normalizedSlug = productForm.slug.trim();
    const duplicateSlug = productRows.find(
      product =>
        product.slug.toLowerCase() === normalizedSlug.toLowerCase() &&
        product.id !== editingProductId
    );
    if (duplicateSlug) {
      toast.error("This slug already exists. Choose a unique slug.");
      return;
    }

    const parsedPrice = Number(productForm.price);
    const parsedStock = Number(productForm.stockQuantity || "0");
    const compareRaw = productForm.comparePrice.trim();
    const parsedComparePrice = compareRaw ? Number(compareRaw) : null;
    const sanitizedBenefits = sanitizeBulletArray(
      productForm.benefits,
      PRODUCT_MAX_BULLETS
    );
    const sanitizedDescriptionBullets = sanitizeBulletArray(
      productForm.descriptionBullets,
      PRODUCT_MAX_BULLETS
    );
    const sanitizedRoutine: ProductRoutine = {
      am: sanitizeRoutineSteps(productForm.routine.am, []),
      pm: sanitizeRoutineSteps(productForm.routine.pm, []),
    };

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      toast.error("Price must be valid");
      return;
    }

    if (!Number.isFinite(parsedStock) || parsedStock < 0) {
      toast.error("Stock must be valid");
      return;
    }

    if (
      parsedComparePrice !== null &&
      (!Number.isFinite(parsedComparePrice) || parsedComparePrice < 0)
    ) {
      toast.error("Compare price must be valid");
      return;
    }

    if (parsedComparePrice !== null && parsedComparePrice <= parsedPrice) {
      toast.error("Compare price must be greater than current price");
      return;
    }

    if (!sanitizedDescriptionBullets.length) {
      toast.error("Add at least one description bullet");
      return;
    }

    const payloadBase = {
      name: productForm.name.trim(),
      slug: normalizedSlug,
      description: productForm.description.trim() || undefined,
      benefits: sanitizedBenefits,
      descriptionBullets: sanitizedDescriptionBullets,
      routine: sanitizedRoutine,
      price: parsedPrice,
      categoryId: Number(productForm.categoryId),
      imageUrl: productForm.imageUrl.trim() || undefined,
      inStock: productForm.inStock,
      stockQuantity: parsedStock,
      isFeatured: productForm.isFeatured,
      isNew: productForm.isNew,
      isTrending: productForm.isTrending,
    };

    try {
      let savedProductId = editingProductId;

      if (editingProductId) {
        await productUpdateMutation.mutateAsync({
          id: editingProductId,
          ...payloadBase,
          comparePrice: parsedComparePrice,
        });
      } else {
        const created = await productCreateMutation.mutateAsync({
          ...payloadBase,
          ...(parsedComparePrice !== null
            ? { comparePrice: parsedComparePrice }
            : {}),
        });
        const createdId = Number(
          (created as { id?: number } | undefined)?.id ?? 0
        );
        savedProductId =
          Number.isFinite(createdId) && createdId > 0 ? createdId : null;
      }

      if (savedProductId && permissions?.role === "ADMIN") {
        const seoPayload = [
          {
            key: `productSeo.${savedProductId}.metaTitle`,
            value: productForm.metaTitle.trim(),
          },
          {
            key: `productSeo.${savedProductId}.metaDescription`,
            value: productForm.metaDescription.trim(),
          },
          {
            key: `productSeo.${savedProductId}.metaKeywords`,
            value: productForm.metaKeywords.trim(),
          },
          {
            key: `productSeo.${savedProductId}.ogImage`,
            value: productForm.ogImage.trim(),
          },
        ];
        try {
          await Promise.all(
            seoPayload.map(entry => settingsSetMutation.mutateAsync(entry))
          );
          await utils.settings.list.invalidate();
        } catch (seoError) {
          toast.error(
            getErrorMessage(
              seoError,
              "Product saved, but SEO fields could not be persisted."
            )
          );
        }
      }

      setProductModalOpen(false);
      setEditingProductId(null);
      setProductForm(EMPTY_PRODUCT_FORM);
    } catch {
      // Errors are handled via mutation onError; keep dialog open for quick correction.
    }
  }, [
    canManageProducts,
    editingProductId,
    permissions?.role,
    productCreateMutation,
    productForm,
    productRows,
    productUpdateMutation,
    settingsSetMutation,
    utils.settings.list,
  ]);

  const handleDeleteProduct = useCallback(
    async (productId: number) => {
      if (!canDeleteEntities) {
        toast.error("Deletion is not allowed");
        return;
      }
      try {
        await productDeleteMutation.mutateAsync({ id: productId });
        setProductPendingDelete(null);
      } catch {
        // Errors are handled by mutation callbacks.
      }
    },
    [canDeleteEntities, productDeleteMutation]
  );

  const handleOrderStatusChange = useCallback(
    async (orderId: number, status: string) => {
      if (!canManageOrders) {
        toast.error("Order update is not allowed");
        return;
      }
      try {
        await orderUpdateStatusMutation.mutateAsync({ id: orderId, status });
      } catch {
        // Errors are handled by mutation callbacks.
      }
    },
    [canManageOrders, orderUpdateStatusMutation]
  );

  const handleOrderPaymentStatusChange = useCallback(
    async (
      orderId: number,
      paymentStatus: "pending" | "processing" | "completed" | "failed"
    ) => {
      if (!canManageOrders) {
        toast.error("Order update is not allowed");
        return;
      }
      try {
        await orderUpdatePaymentMutation.mutateAsync({
          id: orderId,
          paymentStatus,
        });
      } catch {
        // Errors are handled by mutation callbacks.
      }
    },
    [canManageOrders, orderUpdatePaymentMutation]
  );

  const resetCouponEditor = useCallback(() => {
    setEditingCouponId(null);
    setCouponForm(EMPTY_COUPON_FORM);
  }, []);

  const openCreateCouponDialog = useCallback(() => {
    resetCouponEditor();
    setCouponModalOpen(true);
  }, [resetCouponEditor]);

  const openEditCouponDialog = useCallback((coupon: CouponEntity) => {
    setEditingCouponId(coupon.id);
    setCouponForm({
      code: coupon.code || "",
      description: coupon.description || "",
      discountType: coupon.discountType,
      discountValue: String(coupon.discountValue ?? 0),
      minOrderAmount: String(coupon.minOrderAmount ?? 0),
      maxUses: coupon.maxUses ? String(coupon.maxUses) : "",
      isActive: Boolean(coupon.isActive),
      startDate: toDateInputValue(coupon.startDate),
      endDate: toDateInputValue(coupon.endDate),
    });
    setCouponModalOpen(true);
  }, []);

  const submitCouponForm = useCallback(async () => {
    if (!canManageProducts) {
      toast.error("Promotion editing is not allowed");
      return;
    }

    const code = couponForm.code.trim().toUpperCase();
    if (code.length < 2) {
      toast.error("Promotion code must contain at least 2 characters");
      return;
    }

    const parsedDiscount = Number(couponForm.discountValue);
    const parsedMinOrder = Number(couponForm.minOrderAmount || "0");
    const parsedMaxUses = couponForm.maxUses.trim()
      ? Number(couponForm.maxUses)
      : null;
    if (!Number.isFinite(parsedDiscount) || parsedDiscount <= 0) {
      toast.error("Discount value must be valid");
      return;
    }
    if (couponForm.discountType === "percentage" && parsedDiscount > 100) {
      toast.error("Percentage discount cannot exceed 100");
      return;
    }
    if (!Number.isFinite(parsedMinOrder) || parsedMinOrder < 0) {
      toast.error("Minimum order must be valid");
      return;
    }
    if (
      parsedMaxUses !== null &&
      (!Number.isFinite(parsedMaxUses) || parsedMaxUses < 1)
    ) {
      toast.error("Maximum uses must be valid");
      return;
    }

    const startDateIso = couponForm.startDate
      ? new Date(couponForm.startDate).toISOString()
      : null;
    const endDateIso = couponForm.endDate
      ? new Date(couponForm.endDate).toISOString()
      : null;
    if (
      startDateIso &&
      endDateIso &&
      new Date(startDateIso) > new Date(endDateIso)
    ) {
      toast.error("End date must be after start date");
      return;
    }

    const duplicateCode = couponRows.find(
      coupon =>
        coupon.code.toLowerCase() === code.toLowerCase() &&
        coupon.id !== editingCouponId
    );
    if (duplicateCode) {
      toast.error("This promo code already exists");
      return;
    }

    try {
      if (editingCouponId !== null) {
        await couponUpdateMutation.mutateAsync({
          id: editingCouponId,
          code,
          description: couponForm.description.trim() || null,
          discountType: couponForm.discountType,
          discountValue: parsedDiscount,
          minOrderAmount: parsedMinOrder,
          maxUses: parsedMaxUses,
          isActive: couponForm.isActive,
          startDate: startDateIso,
          endDate: endDateIso,
        });
      } else {
        await couponCreateMutation.mutateAsync({
          code,
          description: couponForm.description.trim() || undefined,
          discountType: couponForm.discountType,
          discountValue: parsedDiscount,
          minOrderAmount: parsedMinOrder,
          maxUses: parsedMaxUses,
          isActive: couponForm.isActive,
          startDate: startDateIso,
          endDate: endDateIso,
        });
      }
      setCouponModalOpen(false);
      resetCouponEditor();
    } catch {
      // Errors are handled by mutation callbacks.
    }
  }, [
    canManageProducts,
    couponCreateMutation,
    couponForm,
    couponRows,
    couponUpdateMutation,
    editingCouponId,
    resetCouponEditor,
  ]);

  const handleDeleteCoupon = useCallback(async () => {
    if (!couponPendingDelete) return;
    if (!canDeleteEntities) {
      toast.error("Deletion is not allowed");
      return;
    }
    try {
      await couponDeleteMutation.mutateAsync({ id: couponPendingDelete.id });
      setCouponPendingDelete(null);
    } catch {
      // Errors are handled by mutation callbacks.
    }
  }, [canDeleteEntities, couponDeleteMutation, couponPendingDelete]);

  const handleToggleCouponStatus = useCallback(
    async (coupon: CouponEntity, nextStatus: boolean) => {
      if (!canManageProducts) {
        toast.error("Promotion editing is not allowed");
        return;
      }
      try {
        await couponToggleMutation.mutateAsync({
          id: coupon.id,
          isActive: nextStatus,
        });
      } catch {
        // Errors are handled by mutation callbacks.
      }
    },
    [canManageProducts, couponToggleMutation]
  );

  const handleReviewStatus = useCallback(
    async (
      review: ReviewEntity,
      status: "pending" | "approved" | "rejected"
    ) => {
      if (!canManageProducts) {
        toast.error("Review moderation is not allowed");
        return;
      }
      try {
        await reviewModerateMutation.mutateAsync({ id: review.id, status });
      } catch {
        // Errors are handled by mutation callbacks.
      }
    },
    [canManageProducts, reviewModerateMutation]
  );

  const handleDeleteReview = useCallback(
    async (reviewId: number) => {
      if (!canDeleteEntities) {
        toast.error("Deletion is not allowed");
        return;
      }
      try {
        await reviewDeleteMutation.mutateAsync({ id: reviewId });
      } catch {
        // Errors are handled by mutation callbacks.
      }
    },
    [canDeleteEntities, reviewDeleteMutation]
  );

  const saveInventoryStock = useCallback(
    async (product: ProductEntity) => {
      if (!canManageProducts) {
        toast.error("Inventory updates are not allowed");
        return;
      }
      const raw =
        inventoryDraftStock[product.id] ?? String(product.stockQuantity ?? 0);
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        toast.error("Stock quantity must be a positive number");
        return;
      }

      try {
        await productUpdateMutation.mutateAsync({
          id: product.id,
          stockQuantity: parsed,
          inStock: parsed > 0,
        });
        setInventoryDraftStock(previous => ({
          ...previous,
          [product.id]: String(parsed),
        }));
      } catch {
        // Errors are handled by mutation callbacks.
      }
    },
    [canManageProducts, inventoryDraftStock, productUpdateMutation]
  );

  const applySkincareCategoryPreset = useCallback(async () => {
    if (!canManageProducts) {
      toast.error("Category management is not allowed");
      return;
    }
    setCategoryPresetApplying(true);
    try {
      const ensuredCategories: Array<{ id: number; slug: string }> = [];
      for (let index = 0; index < SKINCARE_CATEGORY_PRESET.length; index += 1) {
        const preset = SKINCARE_CATEGORY_PRESET[index];
        const existing = categoryRows.find(
          category => category.slug === preset.slug
        );
        if (existing) {
          await categoryUpdateMutation.mutateAsync({
            id: existing.id,
            name: preset.name,
            slug: preset.slug,
            description: preset.description,
            sortOrder: index + 1,
          });
          ensuredCategories.push({ id: existing.id, slug: preset.slug });
        } else {
          const created = await categoryCreateMutation.mutateAsync({
            name: preset.name,
            slug: preset.slug,
            description: preset.description,
            sortOrder: index + 1,
          });
          const createdId = Number(
            (created as { id?: number } | undefined)?.id ?? 0
          );
          if (!createdId) {
            throw new Error(`Could not create category "${preset.name}"`);
          }
          ensuredCategories.push({ id: createdId, slug: preset.slug });
        }
      }

      const presetSlugs = new Set<string>(
        SKINCARE_CATEGORY_PRESET.map(category => category.slug)
      );
      const staleCategories = categoryRows.filter(
        category => !presetSlugs.has(category.slug)
      );
      const fallbackCategoryId = ensuredCategories[0]?.id;

      if (fallbackCategoryId && staleCategories.length > 0) {
        const staleIds = new Set(staleCategories.map(category => category.id));
        const productsToReassign = productRows.filter(product =>
          staleIds.has(product.categoryId)
        );
        for (const product of productsToReassign) {
          await productUpdateMutation.mutateAsync({
            id: product.id,
            categoryId: fallbackCategoryId,
          });
        }

        for (const category of staleCategories) {
          try {
            await categoryDeleteMutation.mutateAsync({ id: category.id });
          } catch {
            toast.error(
              `Category "${category.name}" could not be removed. Remove it manually if needed.`
            );
          }
        }
      }

      await Promise.all([
        utils.category.list.invalidate(),
        utils.product.list.invalidate(),
        utils.reports.salesByCategory.invalidate(),
      ]);
      toast.success("Skincare category preset applied");
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Failed to apply skincare category preset")
      );
    } finally {
      setCategoryPresetApplying(false);
    }
  }, [
    canManageProducts,
    categoryCreateMutation,
    categoryDeleteMutation,
    categoryRows,
    categoryUpdateMutation,
    productRows,
    productUpdateMutation,
    utils.category.list,
    utils.product.list,
    utils.reports.salesByCategory,
  ]);

  const handleDeleteCategory = useCallback(
    async (category: CategoryEntity) => {
      if (!canDeleteEntities) {
        toast.error("Deletion is not allowed");
        return;
      }
      const hasProducts = productRows.some(
        product => product.categoryId === category.id
      );
      if (hasProducts) {
        toast.error("Reassign products before deleting this category");
        return;
      }
      try {
        await categoryDeleteMutation.mutateAsync({ id: category.id });
        await utils.category.list.invalidate();
      } catch {
        // Errors are handled by mutation callbacks.
      }
    },
    [
      canDeleteEntities,
      categoryDeleteMutation,
      productRows,
      utils.category.list,
    ]
  );

  const exportOrdersCsv = useCallback(async () => {
    // Export the full filtered result set, not just the current page.
    // Cap at ORDERS_EXPORT_LIMIT so a runaway catalog cannot freeze the browser.
    try {
      const result = await utils.order.list.fetch({
        query: debouncedOrderSearch || undefined,
        status: orderStatusFilter !== "all" ? orderStatusFilter : undefined,
        limit: ORDERS_EXPORT_LIMIT,
        offset: 0,
      });
      const rows = (result?.orders ?? []) as OrderEntity[];
      downloadCsv(
        `orders-${new Date().toISOString().slice(0, 10)}.csv`,
        ["Number", "Customer", "Phone", "Amount", "Payment", "Status", "Date"],
        rows.map(order => [
          order.orderNumber,
          order.customerName,
          order.customerPhone,
          order.totalAmount,
          order.paymentStatus,
          order.status,
          toDateLabel(order.createdAt),
        ])
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Export impossible."));
    }
  }, [debouncedOrderSearch, orderStatusFilter, utils.order.list]);

  const exportProductsCsv = useCallback(() => {
    downloadCsv(
      `products-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Name", "Slug", "Category", "Price", "Stock", "Featured", "Trending"],
      filteredProducts.map(product => [
        product.name,
        product.slug,
        categoryNameById.get(product.categoryId) || product.categoryId,
        product.price,
        product.stockQuantity ?? 0,
        Boolean(product.isFeatured),
        Boolean(product.isTrending),
      ])
    );
  }, [categoryNameById, filteredProducts]);

  const productColumns = useMemo<ColumnDef<ProductEntity>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Product",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">
              /{row.original.slug}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "categoryId",
        header: "Category",
        cell: ({ row }) =>
          categoryNameById.get(row.original.categoryId) || "No category",
      },
      {
        accessorKey: "price",
        header: "Price",
        cell: ({ row }) => formatCFA(row.original.price),
      },
      {
        accessorKey: "stockQuantity",
        header: "Stock",
        cell: ({ row }) => {
          const stock = row.original.stockQuantity ?? 0;
          const stockState =
            stock <= 0 || row.original.inStock === false
              ? "out"
              : stock <= 10
                ? "low"
                : "instock";
          return (
            <div className="space-y-1">
              <StatusBadge status={stockState} context="stock" />
              <p className="text-xs text-muted-foreground">{stock} units</p>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={event => {
                event.stopPropagation();
                openEditProductDialog(row.original);
              }}
              disabled={!canManageProducts}
            >
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={event => {
                event.stopPropagation();
                setProductPendingDelete(row.original);
              }}
              disabled={!canDeleteEntities}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [
      canDeleteEntities,
      canManageProducts,
      categoryNameById,
      openEditProductDialog,
    ]
  );

  const orderColumns = useMemo<ColumnDef<OrderEntity>[]>(
    () => [
      {
        accessorKey: "orderNumber",
        header: "Order",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-medium">{row.original.orderNumber}</p>
            <p className="text-xs text-muted-foreground">
              {toDateLabel(row.original.createdAt)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "customerName",
        header: "Customer",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p>{row.original.customerName}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.customerPhone}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "totalAmount",
        header: "Amount",
        cell: ({ row }) => formatCFA(row.original.totalAmount),
      },
      {
        accessorKey: "paymentStatus",
        header: "Payment",
        cell: ({ row }) => (
          <Select
            value={normalizePaymentStatus(row.original.paymentStatus)}
            onValueChange={(
              value: "pending" | "processing" | "completed" | "failed"
            ) => {
              void handleOrderPaymentStatusChange(row.original.id, value);
            }}
            disabled={!canManageOrders || orderUpdatePaymentMutation.isPending}
          >
            <SelectTrigger
              className="h-8 w-[150px]"
              onClick={event => event.stopPropagation()}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDER_PAYMENT_STATUS_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Select
            value={row.original.status}
            onValueChange={value => {
              void handleOrderStatusChange(row.original.id, value);
            }}
            disabled={!canManageOrders || orderUpdateStatusMutation.isPending}
          >
            <SelectTrigger
              className="h-8 w-[150px]"
              onClick={event => event.stopPropagation()}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDER_STATUS_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
      },
    ],
    [
      canManageOrders,
      handleOrderPaymentStatusChange,
      handleOrderStatusChange,
      orderUpdatePaymentMutation.isPending,
      orderUpdateStatusMutation.isPending,
    ]
  );

  const moduleMeta: Record<
    AdminModuleKey,
    { title: string; description: string }
  > = {
    analytics: {
      title: "Tableau de bord",
      description: "Vue d'ensemble en temps réel et priorités.",
    },
    orders: {
      title: "Commandes",
      description: "Suivez et mettez à jour les commandes clients.",
    },
    customers: {
      title: "Clients",
      description: "Répertoire clients et historique des commandes.",
    },
    products: {
      title: "Produits",
      description: "Gérez le catalogue, le stock et la mise en avant.",
    },
    categories: {
      title: "Catégories",
      description:
        "Taxonomie skincare, préréglages de nettoyage et structure des collections.",
    },
    reviews: {
      title: "Avis",
      description:
        "Modérez les avis clients et publiez une preuve sociale fiable.",
    },
    inventory: {
      title: "Stock",
      description:
        "Contrôle du stock en direct, alertes de stock faible et réapprovisionnement rapide.",
    },
    coupons: {
      title: "Promotions",
      description:
        "Créez et pilotez les remises avec règles d'expiration et d'activation.",
    },
    banners: {
      title: "Éditeur d'accueil",
      description:
        "Modifiez le hero, les promotions et les catégories mises en avant.",
    },
    reports: {
      title: "Rapports",
      description: "Meilleures ventes et alertes de stock.",
    },
    cms: {
      title: "Studio CMS",
      description:
        "Créez, publiez et optimisez les pages de contenu avec le suivi SEO.",
    },
    settings: {
      title: "Paramètres",
      description: "Réglages de la boutique et moyens de paiement.",
    },
    newsletter: {
      title: "Newsletter",
      description: "Abonnés, envois et historique des campagnes.",
    },
    activity: {
      title: "Journal d'audit",
      description: "Toutes les actions effectuées par les administrateurs.",
    },
  };

  if (loading || permissionsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--admin-accent)]" />
      </div>
    );
  }

  if (!user) {
    window.location.href = getLoginUrl();
    return null;
  }

  if (permissionsError || !permissions) {
    return <AdminNotAllowed />;
  }

  if (!isModuleAllowed(permissions, activeModule)) {
    return <AdminNotAllowed />;
  }

  const moduleInfo = moduleMeta[activeModule];

  return (
    <div className="relative min-h-screen bg-[var(--admin-bg)] font-sans">
      <div className="pointer-events-none absolute inset-0 opacity-35 [background:radial-gradient(circle_at_1px_1px,rgba(99,79,63,0.1)_1px,transparent_0)] [background-size:24px_24px]" />
      <div className="relative z-10 flex min-h-screen">
        <motion.aside
          initial={shouldReduceMotion ? false : { opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
          className={cn(
            "sticky top-0 hidden h-screen border-r border-[var(--admin-divider)] bg-[var(--admin-surface-tint)] p-3 lg:block",
            sidebarCollapsed ? "w-[112px]" : "w-[302px]"
          )}
        >
          <SidebarNav
            activeModule={activeModule}
            onModuleChange={navigateToModule}
            allowedModules={allowedModules}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed(prev => !prev)}
            onLogout={() => {
              void logout();
            }}
          />
        </motion.aside>

        <main className="min-w-0 flex-1">
          <div className="flex items-center gap-3 border-b border-[var(--admin-divider)] bg-[var(--admin-surface-tint)] px-4 py-3 lg:hidden">
            <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="h-9 w-9"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] p-3">
                <SidebarNav
                  activeModule={activeModule}
                  onModuleChange={module => {
                    navigateToModule(module);
                    setMobileSidebarOpen(false);
                  }}
                  allowedModules={allowedModules}
                  onLogout={() => {
                    void logout();
                  }}
                />
              </SheetContent>
            </Sheet>
            <div>
              <p className="text-sm font-semibold">Admin panel</p>
              <p className="text-xs text-muted-foreground">
                {moduleInfo.title}
              </p>
            </div>
          </div>

          <TopBar
            userName={user.name}
            notifications={dashboardNotifications}
            onQuickAction={
              permissions.readOnly
                ? undefined
                : action => {
                    if (action === "add_product") {
                      navigateToModule("products");
                      if (canManageProducts) openCreateProductDialog();
                      return;
                    }
                    if (action === "create_coupon") {
                      navigateToModule("coupons");
                      openCreateCouponDialog();
                    }
                  }
            }
            onSearchSubmit={query => {
              const trimmed = query.trim();
              const normalized = trimmed.toLowerCase();

              // Phone number, order number (SBP-xxxxx) or all-digit search → orders
              if (
                /^\+?\d[\d\s-]{5,}$/.test(trimmed) ||
                /^sbp[-\s]?\d/i.test(trimmed)
              ) {
                navigateToModule("orders");
                setOrderSearch(query);
                return;
              }

              // Keyword hints — French and English
              if (/\b(order|commande|customer|client)\b/i.test(normalized)) {
                navigateToModule("orders");
                setOrderSearch(query);
                return;
              }
              if (/\b(coupon|promo|discount|remise)\b/i.test(normalized)) {
                navigateToModule("coupons");
                return;
              }
              if (/\b(review|avis|note)\b/i.test(normalized)) {
                navigateToModule("reviews");
                return;
              }
              if (/\b(categor|rubrique)/i.test(normalized)) {
                navigateToModule("categories");
                return;
              }
              if (
                /\b(cms|page|content|publication|article)\b/i.test(normalized)
              ) {
                navigateToModule("cms");
                return;
              }
              if (/\b(inventory|stock|inventaire)\b/i.test(normalized)) {
                navigateToModule("inventory");
                return;
              }

              navigateToModule("products");
              setProductSearch(query);
            }}
            onLogout={() => {
              void logout();
            }}
          />

          <div className="p-4 md:p-6">
            <div className={cn(adminSpacingScale.page)}>
              <PageHeader
                title={moduleInfo.title}
                description={moduleInfo.description}
                breadcrumbs={[{ label: "Admin" }, { label: moduleInfo.title }]}
                actions={
                  activeModule === "products" ? (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={exportProductsCsv}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                      </Button>
                      <Button
                        type="button"
                        onClick={openCreateProductDialog}
                        disabled={!canManageProducts}
                        className="bg-[var(--admin-accent)] text-white hover:bg-[var(--admin-accent-hover)]"
                      >
                        <PackagePlus className="mr-2 h-4 w-4" />
                        Add product
                      </Button>
                    </div>
                  ) : activeModule === "orders" ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={exportOrdersCsv}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export CSV
                    </Button>
                  ) : activeModule === "coupons" ? (
                    <Button
                      type="button"
                      onClick={openCreateCouponDialog}
                      disabled={!canManageProducts}
                    >
                      <Percent className="mr-2 h-4 w-4" />
                      New promotion
                    </Button>
                  ) : activeModule === "categories" ? (
                    <Button
                      type="button"
                      onClick={() => {
                        void applySkincareCategoryPreset();
                      }}
                      disabled={!canManageProducts || categoryPresetApplying}
                    >
                      {categoryPresetApplying ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="mr-2 h-4 w-4" />
                      )}
                      Apply skincare preset
                    </Button>
                  ) : undefined
                }
              />

              {activeModule === "analytics" ? <AnalyticsModule /> : null}

              {activeModule === "reports" ? <ReportsModule /> : null}

              {activeModule === "orders" ? (
                <OrdersModule canManage={canManageOrders} />
              ) : null}

              {activeModule === "products" ? (
                <ProductsModule
                  canManage={canManageProducts}
                  canDelete={canDeleteEntities}
                  isAdmin={permissions?.role === "ADMIN"}
                />
              ) : null}

              {activeModule === "inventory" ? (
                <InventoryModule canManage={canManageProducts} />
              ) : null}

              {activeModule === "categories" ? (
                <CategoriesModule
                  canManage={canManageProducts}
                  canDelete={canDeleteEntities}
                />
              ) : null}

              {activeModule === "cms" ? (
                <CmsModule
                  canManage={canManageCms}
                  canDelete={canDeleteEntities}
                />
              ) : null}

              {activeModule === "banners" ? (
                <BannersModule canEdit={canEditHomepage} />
              ) : null}

              {activeModule === "coupons" ? (
                <CouponsModule
                  canManage={canManageProducts}
                  canDelete={canDeleteEntities}
                />
              ) : null}

              {activeModule === "reviews" ? (
                <ReviewsModule
                  canManage={canManageProducts}
                  canDelete={canDeleteEntities}
                />
              ) : null}

              {activeModule === "customers" ? <CustomersModule /> : null}

              {activeModule === "newsletter" ? <NewsletterModule /> : null}

              {activeModule === "activity" ? <ActivityModule /> : null}

              {activeModule === "settings" ? (
                <SettingsModule
                  canAccessSettings={Boolean(permissions?.canAccessSettings)}
                />
              ) : null}
            </div>
          </div>
        </main>
      </div>

      <Dialog
        open={productModalOpen}
        onOpenChange={open => {
          setProductModalOpen(open);
          if (!open) {
            setEditingProductId(null);
            setProductRoutineTab("am");
            setProductSlugTouched(false);
            setProductForm(EMPTY_PRODUCT_FORM);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingProductId ? "Edit product" : "Add product"}
            </DialogTitle>
            <DialogDescription>
              All product operations are persisted through tRPC mutations.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={event => {
              event.preventDefault();
              void submitProductForm();
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={productForm.name}
                  onChange={event => {
                    const name = event.target.value;
                    setProductForm(prev => ({
                      ...prev,
                      name,
                      slug: productSlugTouched ? prev.slug : slugify(name),
                    }));
                  }}
                  placeholder="Product name"
                />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={productForm.slug}
                    onChange={event => {
                      setProductSlugTouched(true);
                      setProductForm(prev => ({
                        ...prev,
                        slug: slugify(event.target.value),
                      }));
                    }}
                    placeholder="product-slug"
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    onClick={() =>
                      setProductForm(prev => ({
                        ...prev,
                        slug: slugify(prev.name),
                      }))
                    }
                  >
                    <Wand2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description longue (optionnelle)</Label>
              <Textarea
                rows={4}
                value={productForm.description}
                onChange={event =>
                  setProductForm(prev => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                placeholder="Texte libre pour la fiche produit (optionnel)"
              />
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Benefices cles</p>
                  <p className="text-xs text-muted-foreground">
                    Jusqu'a 10 points
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setProductForm(prev => {
                      if (prev.benefits.length >= PRODUCT_MAX_BULLETS)
                        return prev;
                      return {
                        ...prev,
                        benefits: [...prev.benefits, ""],
                      };
                    })
                  }
                  disabled={productForm.benefits.length >= PRODUCT_MAX_BULLETS}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Ajouter
                </Button>
              </div>
              {productForm.benefits.length ? (
                <div className="space-y-2">
                  {productForm.benefits.map((bullet, index) => (
                    <div
                      key={`benefit-${index}`}
                      className="flex items-center gap-2"
                    >
                      <Input
                        value={bullet}
                        onChange={event =>
                          setProductForm(prev => ({
                            ...prev,
                            benefits: prev.benefits.map((entry, entryIndex) =>
                              entryIndex === index ? event.target.value : entry
                            ),
                          }))
                        }
                        placeholder={`Benefice #${index + 1}`}
                      />
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        onClick={() =>
                          setProductForm(prev => ({
                            ...prev,
                            benefits: moveArrayItem(
                              prev.benefits,
                              index,
                              index - 1
                            ),
                          }))
                        }
                        disabled={index === 0}
                        aria-label="Monter"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        onClick={() =>
                          setProductForm(prev => ({
                            ...prev,
                            benefits: moveArrayItem(
                              prev.benefits,
                              index,
                              index + 1
                            ),
                          }))
                        }
                        disabled={index === productForm.benefits.length - 1}
                        aria-label="Descendre"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={() =>
                          setProductForm(prev => ({
                            ...prev,
                            benefits: prev.benefits.filter(
                              (_, entryIndex) => entryIndex !== index
                            ),
                          }))
                        }
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border/70 bg-background/80 p-3 text-xs text-muted-foreground">
                  Ajoutez les resultats concrets attendus par la cliente.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Routine suggeree</p>
                  <p className="text-xs text-muted-foreground">
                    3 etapes par defaut, max 5
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  Matin/Soir
                </span>
              </div>

              <Tabs
                value={productRoutineTab}
                onValueChange={value =>
                  setProductRoutineTab(value === "pm" ? "pm" : "am")
                }
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="am">Matin</TabsTrigger>
                  <TabsTrigger value="pm">Soir</TabsTrigger>
                </TabsList>

                <TabsContent value="am" className="mt-3 space-y-2">
                  {productForm.routine.am.map((step, index) => {
                    const presetValue = resolveRoutinePresetValue(step.title);
                    return (
                      <div
                        key={`routine-am-${index}`}
                        className="rounded-lg border border-border/70 bg-background p-3"
                      >
                        <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto] md:items-start">
                          <div className="space-y-2">
                            <Select
                              value={presetValue}
                              onValueChange={value =>
                                setProductForm(prev => ({
                                  ...prev,
                                  routine: {
                                    ...prev.routine,
                                    am: prev.routine.am.map(
                                      (entry, entryIndex) =>
                                        entryIndex === index
                                          ? {
                                              ...entry,
                                              title:
                                                value === ROUTINE_CUSTOM_VALUE
                                                  ? ""
                                                  : value,
                                            }
                                          : entry
                                    ),
                                  },
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Choisir un titre" />
                              </SelectTrigger>
                              <SelectContent>
                                {ROUTINE_TITLE_PRESETS.map(title => (
                                  <SelectItem
                                    key={`am-title-${title}`}
                                    value={title}
                                  >
                                    {title}
                                  </SelectItem>
                                ))}
                                <SelectItem value={ROUTINE_CUSTOM_VALUE}>
                                  Autre...
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            {presetValue === ROUTINE_CUSTOM_VALUE ? (
                              <Input
                                value={step.title}
                                onChange={event =>
                                  setProductForm(prev => ({
                                    ...prev,
                                    routine: {
                                      ...prev.routine,
                                      am: prev.routine.am.map(
                                        (entry, entryIndex) =>
                                          entryIndex === index
                                            ? {
                                                ...entry,
                                                title: event.target.value,
                                              }
                                            : entry
                                      ),
                                    },
                                  }))
                                }
                                placeholder="Titre personnalise"
                              />
                            ) : null}
                            <Textarea
                              rows={2}
                              value={step.text}
                              onChange={event =>
                                setProductForm(prev => ({
                                  ...prev,
                                  routine: {
                                    ...prev.routine,
                                    am: prev.routine.am.map(
                                      (entry, entryIndex) =>
                                        entryIndex === index
                                          ? {
                                              ...entry,
                                              text: event.target.value,
                                            }
                                          : entry
                                    ),
                                  },
                                }))
                              }
                              placeholder="Instruction concise pour cette etape"
                            />
                          </div>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            onClick={() =>
                              setProductForm(prev => ({
                                ...prev,
                                routine: {
                                  ...prev.routine,
                                  am: moveArrayItem(
                                    prev.routine.am,
                                    index,
                                    index - 1
                                  ),
                                },
                              }))
                            }
                            disabled={index === 0}
                            aria-label="Monter"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            onClick={() =>
                              setProductForm(prev => ({
                                ...prev,
                                routine: {
                                  ...prev.routine,
                                  am: moveArrayItem(
                                    prev.routine.am,
                                    index,
                                    index + 1
                                  ),
                                },
                              }))
                            }
                            disabled={
                              index === productForm.routine.am.length - 1
                            }
                            aria-label="Descendre"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            onClick={() =>
                              setProductForm(prev => ({
                                ...prev,
                                routine: {
                                  ...prev.routine,
                                  am: prev.routine.am.filter(
                                    (_, entryIndex) => entryIndex !== index
                                  ),
                                },
                              }))
                            }
                            aria-label="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setProductForm(prev => {
                        if (prev.routine.am.length >= PRODUCT_MAX_ROUTINE_STEPS)
                          return prev;
                        return {
                          ...prev,
                          routine: {
                            ...prev.routine,
                            am: [...prev.routine.am, createEmptyRoutineStep()],
                          },
                        };
                      })
                    }
                    disabled={
                      productForm.routine.am.length >= PRODUCT_MAX_ROUTINE_STEPS
                    }
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Ajouter etape matin
                  </Button>
                </TabsContent>

                <TabsContent value="pm" className="mt-3 space-y-2">
                  {productForm.routine.pm.map((step, index) => {
                    const presetValue = resolveRoutinePresetValue(step.title);
                    return (
                      <div
                        key={`routine-pm-${index}`}
                        className="rounded-lg border border-border/70 bg-background p-3"
                      >
                        <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto] md:items-start">
                          <div className="space-y-2">
                            <Select
                              value={presetValue}
                              onValueChange={value =>
                                setProductForm(prev => ({
                                  ...prev,
                                  routine: {
                                    ...prev.routine,
                                    pm: prev.routine.pm.map(
                                      (entry, entryIndex) =>
                                        entryIndex === index
                                          ? {
                                              ...entry,
                                              title:
                                                value === ROUTINE_CUSTOM_VALUE
                                                  ? ""
                                                  : value,
                                            }
                                          : entry
                                    ),
                                  },
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Choisir un titre" />
                              </SelectTrigger>
                              <SelectContent>
                                {ROUTINE_TITLE_PRESETS.map(title => (
                                  <SelectItem
                                    key={`pm-title-${title}`}
                                    value={title}
                                  >
                                    {title}
                                  </SelectItem>
                                ))}
                                <SelectItem value={ROUTINE_CUSTOM_VALUE}>
                                  Autre...
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            {presetValue === ROUTINE_CUSTOM_VALUE ? (
                              <Input
                                value={step.title}
                                onChange={event =>
                                  setProductForm(prev => ({
                                    ...prev,
                                    routine: {
                                      ...prev.routine,
                                      pm: prev.routine.pm.map(
                                        (entry, entryIndex) =>
                                          entryIndex === index
                                            ? {
                                                ...entry,
                                                title: event.target.value,
                                              }
                                            : entry
                                      ),
                                    },
                                  }))
                                }
                                placeholder="Titre personnalise"
                              />
                            ) : null}
                            <Textarea
                              rows={2}
                              value={step.text}
                              onChange={event =>
                                setProductForm(prev => ({
                                  ...prev,
                                  routine: {
                                    ...prev.routine,
                                    pm: prev.routine.pm.map(
                                      (entry, entryIndex) =>
                                        entryIndex === index
                                          ? {
                                              ...entry,
                                              text: event.target.value,
                                            }
                                          : entry
                                    ),
                                  },
                                }))
                              }
                              placeholder="Instruction concise pour cette etape"
                            />
                          </div>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            onClick={() =>
                              setProductForm(prev => ({
                                ...prev,
                                routine: {
                                  ...prev.routine,
                                  pm: moveArrayItem(
                                    prev.routine.pm,
                                    index,
                                    index - 1
                                  ),
                                },
                              }))
                            }
                            disabled={index === 0}
                            aria-label="Monter"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            onClick={() =>
                              setProductForm(prev => ({
                                ...prev,
                                routine: {
                                  ...prev.routine,
                                  pm: moveArrayItem(
                                    prev.routine.pm,
                                    index,
                                    index + 1
                                  ),
                                },
                              }))
                            }
                            disabled={
                              index === productForm.routine.pm.length - 1
                            }
                            aria-label="Descendre"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            onClick={() =>
                              setProductForm(prev => ({
                                ...prev,
                                routine: {
                                  ...prev.routine,
                                  pm: prev.routine.pm.filter(
                                    (_, entryIndex) => entryIndex !== index
                                  ),
                                },
                              }))
                            }
                            aria-label="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setProductForm(prev => {
                        if (prev.routine.pm.length >= PRODUCT_MAX_ROUTINE_STEPS)
                          return prev;
                        return {
                          ...prev,
                          routine: {
                            ...prev.routine,
                            pm: [...prev.routine.pm, createEmptyRoutineStep()],
                          },
                        };
                      })
                    }
                    disabled={
                      productForm.routine.pm.length >= PRODUCT_MAX_ROUTINE_STEPS
                    }
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Ajouter etape soir
                  </Button>
                </TabsContent>
              </Tabs>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Description (puces)</p>
                  <p className="text-xs text-muted-foreground">
                    Obligatoire, jusqu'a 10 points
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setProductForm(prev => {
                      if (prev.descriptionBullets.length >= PRODUCT_MAX_BULLETS)
                        return prev;
                      return {
                        ...prev,
                        descriptionBullets: [...prev.descriptionBullets, ""],
                      };
                    })
                  }
                  disabled={
                    productForm.descriptionBullets.length >= PRODUCT_MAX_BULLETS
                  }
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Ajouter
                </Button>
              </div>
              {productForm.descriptionBullets.length ? (
                <div className="space-y-2">
                  {productForm.descriptionBullets.map((bullet, index) => (
                    <div
                      key={`description-bullet-${index}`}
                      className="flex items-center gap-2"
                    >
                      <Input
                        value={bullet}
                        onChange={event =>
                          setProductForm(prev => ({
                            ...prev,
                            descriptionBullets: prev.descriptionBullets.map(
                              (entry, entryIndex) =>
                                entryIndex === index
                                  ? event.target.value
                                  : entry
                            ),
                          }))
                        }
                        placeholder={`Point description #${index + 1}`}
                      />
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        onClick={() =>
                          setProductForm(prev => ({
                            ...prev,
                            descriptionBullets: moveArrayItem(
                              prev.descriptionBullets,
                              index,
                              index - 1
                            ),
                          }))
                        }
                        disabled={index === 0}
                        aria-label="Monter"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        onClick={() =>
                          setProductForm(prev => ({
                            ...prev,
                            descriptionBullets: moveArrayItem(
                              prev.descriptionBullets,
                              index,
                              index + 1
                            ),
                          }))
                        }
                        disabled={
                          index === productForm.descriptionBullets.length - 1
                        }
                        aria-label="Descendre"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={() =>
                          setProductForm(prev => ({
                            ...prev,
                            descriptionBullets: prev.descriptionBullets.filter(
                              (_, entryIndex) => entryIndex !== index
                            ),
                          }))
                        }
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border/70 bg-background/80 p-3 text-xs text-muted-foreground">
                  Ajoutez au moins un point de description pour enregistrer.
                </p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Price</Label>
                <Input
                  value={productForm.price}
                  onChange={event =>
                    setProductForm(prev => ({
                      ...prev,
                      price: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Compare price</Label>
                <Input
                  value={productForm.comparePrice}
                  onChange={event =>
                    setProductForm(prev => ({
                      ...prev,
                      comparePrice: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Stock</Label>
                <Input
                  value={productForm.stockQuantity}
                  onChange={event =>
                    setProductForm(prev => ({
                      ...prev,
                      stockQuantity: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={productForm.categoryId || undefined}
                onValueChange={value =>
                  setProductForm(prev => ({ ...prev, categoryId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryRows.map(category => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input
                value={productForm.imageUrl}
                onChange={event =>
                  setProductForm(prev => ({
                    ...prev,
                    imageUrl: event.target.value,
                  }))
                }
                placeholder="https://..."
              />
              <ImageUpload
                onImageUploaded={url =>
                  setProductForm(prev => ({ ...prev, imageUrl: url }))
                }
              />
              {productForm.imageUrl ? (
                <img
                  src={productForm.imageUrl}
                  alt="preview"
                  className="h-44 w-full rounded-xl bg-white object-contain"
                />
              ) : null}
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">SEO metadata</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Meta title</Label>
                  <Input
                    value={productForm.metaTitle}
                    onChange={event =>
                      setProductForm(prev => ({
                        ...prev,
                        metaTitle: event.target.value,
                      }))
                    }
                    placeholder="Optimized title for search engines"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Meta description</Label>
                  <Textarea
                    rows={3}
                    value={productForm.metaDescription}
                    onChange={event =>
                      setProductForm(prev => ({
                        ...prev,
                        metaDescription: event.target.value,
                      }))
                    }
                    placeholder="Compelling description shown in search results"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Keywords</Label>
                  <Input
                    value={productForm.metaKeywords}
                    onChange={event =>
                      setProductForm(prev => ({
                        ...prev,
                        metaKeywords: event.target.value,
                      }))
                    }
                    placeholder="serum, skincare, glow..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>OG image</Label>
                  <Input
                    value={productForm.ogImage}
                    onChange={event =>
                      setProductForm(prev => ({
                        ...prev,
                        ogImage: event.target.value,
                      }))
                    }
                    placeholder="https://.../social-preview.jpg"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={productForm.inStock}
                  onCheckedChange={checked =>
                    setProductForm(prev => ({
                      ...prev,
                      inStock: Boolean(checked),
                    }))
                  }
                />
                In stock
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={productForm.isFeatured}
                  onCheckedChange={checked =>
                    setProductForm(prev => ({
                      ...prev,
                      isFeatured: Boolean(checked),
                    }))
                  }
                />
                Featured
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={productForm.isTrending}
                  onCheckedChange={checked =>
                    setProductForm(prev => ({
                      ...prev,
                      isTrending: Boolean(checked),
                    }))
                  }
                />
                Trending
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={productForm.isNew}
                  onCheckedChange={checked =>
                    setProductForm(prev => ({
                      ...prev,
                      isNew: Boolean(checked),
                    }))
                  }
                />
                New
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setProductModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  productCreateMutation.isPending ||
                  productUpdateMutation.isPending
                }
              >
                {productCreateMutation.isPending ||
                productUpdateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(productPendingDelete)}
        onOpenChange={open => {
          if (!open) setProductPendingDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete product</DialogTitle>
            <DialogDescription>
              This action will permanently remove {productPendingDelete?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setProductPendingDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!productPendingDelete) return;
                void handleDeleteProduct(productPendingDelete.id);
              }}
              disabled={productDeleteMutation.isPending}
            >
              {productDeleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={couponModalOpen}
        onOpenChange={open => {
          setCouponModalOpen(open);
          if (!open) {
            resetCouponEditor();
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingCouponId ? "Edit promotion" : "Create promotion"}
            </DialogTitle>
            <DialogDescription>
              Configure discount value, usage limits, and active period.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={event => {
              event.preventDefault();
              void submitCouponForm();
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Promo code</Label>
                <Input
                  value={couponForm.code}
                  onChange={event =>
                    setCouponForm(previous => ({
                      ...previous,
                      code: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="GLOW20"
                />
              </div>
              <div className="space-y-2">
                <Label>Discount type</Label>
                <Select
                  value={couponForm.discountType}
                  onValueChange={(value: "percentage" | "fixed") =>
                    setCouponForm(previous => ({
                      ...previous,
                      discountType: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={couponForm.description}
                onChange={event =>
                  setCouponForm(previous => ({
                    ...previous,
                    description: event.target.value,
                  }))
                }
                placeholder="Premium skincare promo for first orders."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Discount value</Label>
                <Input
                  value={couponForm.discountValue}
                  onChange={event =>
                    setCouponForm(previous => ({
                      ...previous,
                      discountValue: event.target.value,
                    }))
                  }
                  placeholder={
                    couponForm.discountType === "percentage" ? "20" : "5000"
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Min order (CFA)</Label>
                <Input
                  value={couponForm.minOrderAmount}
                  onChange={event =>
                    setCouponForm(previous => ({
                      ...previous,
                      minOrderAmount: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Max uses</Label>
                <Input
                  value={couponForm.maxUses}
                  onChange={event =>
                    setCouponForm(previous => ({
                      ...previous,
                      maxUses: event.target.value,
                    }))
                  }
                  placeholder="Unlimited if empty"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={couponForm.startDate}
                  onChange={event =>
                    setCouponForm(previous => ({
                      ...previous,
                      startDate: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>End date</Label>
                <Input
                  type="date"
                  value={couponForm.endDate}
                  onChange={event =>
                    setCouponForm(previous => ({
                      ...previous,
                      endDate: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={couponForm.isActive}
                onCheckedChange={checked =>
                  setCouponForm(previous => ({
                    ...previous,
                    isActive: Boolean(checked),
                  }))
                }
              />
              Promotion active
            </label>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCouponModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  couponCreateMutation.isPending ||
                  couponUpdateMutation.isPending
                }
              >
                {couponCreateMutation.isPending ||
                couponUpdateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save promotion
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(couponPendingDelete)}
        onOpenChange={open => {
          if (!open) setCouponPendingDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete promotion</DialogTitle>
            <DialogDescription>
              This will remove code {couponPendingDelete?.code}.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCouponPendingDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                void handleDeleteCoupon();
              }}
              disabled={couponDeleteMutation.isPending}
            >
              {couponDeleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(reviewPreview)}
        onOpenChange={open => {
          if (!open) setReviewPreview(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review details</DialogTitle>
            <DialogDescription>
              Review #{reviewPreview?.id} for product #
              {reviewPreview?.productId}
            </DialogDescription>
          </DialogHeader>
          {reviewPreview ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{reviewPreview.customerName}</p>
                  <StatusBadge
                    status={reviewPreview.status}
                    context="generic"
                    label={
                      reviewPreview.status === "approved"
                        ? "Published"
                        : reviewPreview.status === "rejected"
                          ? "Hidden"
                          : "Pending"
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {reviewPreview.customerEmail || "No email"} ·{" "}
                  {new Date(reviewPreview.createdAt).toLocaleString("fr-FR")}
                </p>
                {reviewPreview.isVerifiedPurchase ? (
                  <p className="mt-1 text-xs text-emerald-700">
                    Verified purchase
                  </p>
                ) : null}
              </div>

              <div className="rounded-xl border border-border/70 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Rating
                </p>
                <p className="mt-1 font-medium">
                  {"★".repeat(Math.max(1, Math.min(5, reviewPreview.rating)))} (
                  {reviewPreview.rating}/5)
                </p>
              </div>

              <div className="rounded-xl border border-border/70 p-3">
                <p className="font-medium">{reviewPreview.title || "Review"}</p>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                  {reviewPreview.body || "No text"}
                </p>
              </div>
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setReviewPreview(null)}
            >
              Close
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!reviewPreview) return;
                void handleReviewStatus(reviewPreview, "approved");
              }}
              disabled={!canManageProducts || reviewModerateMutation.isPending}
            >
              <Check className="mr-1 h-3.5 w-3.5" />
              Publish
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!reviewPreview) return;
                void handleReviewStatus(reviewPreview, "rejected");
              }}
              disabled={!canManageProducts || reviewModerateMutation.isPending}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Hide
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!reviewPreview) return;
                void handleDeleteReview(reviewPreview.id);
                setReviewPreview(null);
              }}
              disabled={!canDeleteEntities || reviewDeleteMutation.isPending}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedOrderId !== null}
        onOpenChange={open => {
          if (!open) setSelectedOrderId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Order details</DialogTitle>
          </DialogHeader>
          {orderDetailQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : orderDetailQuery.data ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-xl border bg-muted/20 p-3">
                <p className="font-medium">
                  {orderDetailQuery.data.orderNumber}
                </p>
                <p className="text-muted-foreground">
                  {toDateLabel(orderDetailQuery.data.createdAt)}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Customer
                  </p>
                  <p className="mt-1 font-medium">
                    {orderDetailQuery.data.customerName}
                  </p>
                  <p className="text-muted-foreground">
                    {orderDetailQuery.data.customerPhone}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {(orderDetailQuery.data as OrderDetailEntity)
                      .customerAddress || "Address not available"}
                  </p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Payment
                  </p>
                  <p className="mt-1 font-medium">
                    {formatCFA(orderDetailQuery.data.totalAmount)}
                  </p>
                  <StatusBadge
                    status={orderDetailQuery.data.paymentStatus}
                    context="payment"
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Update order status</Label>
                  <Select
                    value={orderDetailQuery.data.status}
                    onValueChange={value => {
                      void handleOrderStatusChange(
                        orderDetailQuery.data.id,
                        value
                      );
                    }}
                    disabled={
                      !canManageOrders || orderUpdateStatusMutation.isPending
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_STATUS_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Update payment status</Label>
                  <Select
                    value={normalizePaymentStatus(
                      orderDetailQuery.data.paymentStatus
                    )}
                    onValueChange={(
                      value: "pending" | "processing" | "completed" | "failed"
                    ) => {
                      void handleOrderPaymentStatusChange(
                        orderDetailQuery.data.id,
                        value
                      );
                    }}
                    disabled={
                      !canManageOrders || orderUpdatePaymentMutation.isPending
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_PAYMENT_STATUS_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Order not found"
              description="This order could not be loaded."
            />
          )}
        </DialogContent>
      </Dialog>

      <AdminCommandPalette
        allowedModules={allowedModules}
        onNavigate={navigateToModule}
      />
    </div>
  );
}
