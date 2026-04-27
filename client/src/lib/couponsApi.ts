import type {
  ApplyCouponRequest,
  CartSummary,
  CartSyncRequest,
  CouponPreviewRequest,
  CouponRecord,
  CreateCouponInput,
  UpdateCouponInput,
} from "@shared/coupons";

type ApiSuccess<T> = { ok: true; data: T };
type CouponErrorPayload = {
  ok?: false;
  error?: string | { code?: string; message?: string };
};

export class CouponApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "CouponApiError";
    this.code = code;
  }
}

function parseCouponError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const raw = (payload as CouponErrorPayload).error;
    if (typeof raw === "string" && raw.trim().length > 0) {
      return { message: raw, code: undefined };
    }
    if (raw && typeof raw === "object") {
      const message =
        typeof raw.message === "string" && raw.message.trim().length > 0
          ? raw.message
          : fallback;
      const code =
        typeof raw.code === "string" && raw.code.trim().length > 0
          ? raw.code
          : undefined;
      return { message, code };
    }
  }
  return { message: fallback, code: undefined };
}

async function apiRequest<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as ApiSuccess<T> | CouponErrorPayload | null;
  if (!response.ok || !payload || (payload as CouponErrorPayload).ok === false) {
    const parsed = parseCouponError(payload, "Coupon request failed");
    throw new CouponApiError(parsed.message, parsed.code);
  }
  if (!("data" in payload)) {
    throw new CouponApiError("Invalid coupon API response");
  }
  return payload.data;
}

export function syncSessionCart(input: CartSyncRequest) {
  return apiRequest<CartSummary>("/api/coupons/cart/sync", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchSessionCart(sessionId: string) {
  return apiRequest<CartSummary>(
    `/api/coupons/cart?sessionId=${encodeURIComponent(sessionId)}`
  );
}

export function applySessionCoupon(input: ApplyCouponRequest) {
  return apiRequest<
    CartSummary & {
      coupon?: CouponRecord;
      message?: string;
    }
  >("/api/coupons/apply", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function removeSessionCoupon(sessionId: string) {
  return apiRequest<CartSummary>("/api/coupons/remove", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export function previewSessionCoupon(input: CouponPreviewRequest) {
  return apiRequest<
    CartSummary & {
      coupon?: CouponRecord;
      message?: string;
    }
  >("/api/coupons/preview", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listAdminCoupons(limit = 200) {
  return apiRequest<CouponRecord[]>(`/api/admin/coupons?limit=${limit}`, {
    method: "GET",
  });
}

export function createAdminCoupon(input: CreateCouponInput) {
  return apiRequest<CouponRecord>("/api/admin/coupons", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateAdminCoupon(id: string, input: UpdateCouponInput) {
  return apiRequest<CouponRecord>(`/api/admin/coupons/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deactivateAdminCoupon(id: string) {
  return apiRequest<{ success: true; coupon: CouponRecord }>(
    `/api/admin/coupons/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    }
  );
}
