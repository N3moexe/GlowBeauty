export type AdminAnalyticsOverviewPayload = {
  rangeDays: number;
  revenue: number;
  orders: number;
  customers: number;
  aov: number;
  conversionRate: number | null;
  bestSellers: Array<{
    productId: number;
    name: string;
    soldQty: number;
    revenue: number;
    imageUrl: string | null;
  }>;
  ordersByStatus: Array<{ status: string; count: number }>;
  revenueSeries: Array<{ date: string; revenue: number; orders: number }>;
  lowStock: Array<{ productId: number; name: string; stock: number; threshold: number }>;
  failedPayments: Array<{ orderId: number; amount: number; createdAt: string }>;
  recentOrders?: Array<{
    orderId: number;
    orderNumber: string;
    customerName: string;
    totalAmount: number;
    status: string;
    paymentStatus: string;
    createdAt: string;
  }>;
  topCustomers?: Array<{
    customerPhone: string;
    customerName: string;
    orderCount: number;
    totalSpent: number;
  }>;
};

export type AdminAnalyticsOverviewResponse = {
  ok: true;
  data?: AdminAnalyticsOverviewPayload;
} & AdminAnalyticsOverviewPayload;

type AdminAnalyticsError = {
  ok?: false;
  error?: string;
};

function parseErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const message = (payload as AdminAnalyticsError).error;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }
  return fallback;
}

export async function fetchAdminAnalyticsOverview(days: number) {
  const response = await fetch(`/api/admin/analytics/overview?days=${days}`, {
    credentials: "include",
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | AdminAnalyticsOverviewResponse
    | AdminAnalyticsError
    | null;

  if (!response.ok || !payload || (payload as AdminAnalyticsError).ok === false) {
    throw new Error(parseErrorMessage(payload, "Unable to load analytics overview."));
  }

  const normalized = payload as AdminAnalyticsOverviewResponse;
  if (normalized.data) {
    return {
      ok: true as const,
      ...normalized.data,
    };
  }
  return normalized;
}
