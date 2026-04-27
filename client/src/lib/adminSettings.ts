import type {
  AdminChatbotSettings,
  AdminChatbotSettingsUpdate,
  AdminUser,
  AdminUserCreate,
  AdminUserUpdate,
  AuditLogListQuery,
  AuditLogListResponse,
  SettingsPayments,
  SettingsPaymentsUpdate,
  SettingsStore,
  SettingsStoreUpdate,
  ShippingRate,
  ShippingRateCreate,
  ShippingRateUpdate,
  ShippingZone,
  ShippingZoneCreate,
  ShippingZoneUpdate,
} from "@shared/admin-settings";

type ApiSuccess<T> = { ok: true; data: T };
type ApiError = { ok?: false; error?: string };

function parseError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const message = (payload as ApiError).error;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }
  return fallback;
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
  const payload = (await response.json().catch(() => null)) as ApiSuccess<T> | ApiError | null;
  if (!response.ok || !payload || (payload as ApiError).ok === false) {
    throw new Error(parseError(payload, "Request failed"));
  }
  if (!("data" in payload)) {
    throw new Error("Invalid API response");
  }
  return payload.data;
}

export function fetchAdminStoreSettings() {
  return apiRequest<SettingsStore>("/api/admin/settings/store", { method: "GET" });
}

export function updateAdminStoreSettings(input: SettingsStoreUpdate) {
  return apiRequest<SettingsStore>("/api/admin/settings/store", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function fetchAdminPaymentSettings() {
  return apiRequest<SettingsPayments>("/api/admin/settings/payments", { method: "GET" });
}

export function updateAdminPaymentSettings(input: SettingsPaymentsUpdate) {
  return apiRequest<SettingsPayments>("/api/admin/settings/payments", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function fetchAdminChatbotSettings() {
  return apiRequest<AdminChatbotSettings>("/api/admin/settings/chatbot", {
    method: "GET",
  });
}

export function updateAdminChatbotSettings(input: AdminChatbotSettingsUpdate) {
  return apiRequest<AdminChatbotSettings>("/api/admin/settings/chatbot", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export type ShippingZoneWithRates = ShippingZone & { rates: ShippingRate[] };
export type AdminUserCreateResponse = AdminUser & {
  inviteCreated?: boolean;
  tempPassword?: string;
};

export function fetchShippingZones() {
  return apiRequest<ShippingZoneWithRates[]>("/api/admin/shipping/zones", { method: "GET" });
}

export function createShippingZone(input: ShippingZoneCreate) {
  return apiRequest<ShippingZone>("/api/admin/shipping/zones", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateShippingZone(id: number, input: ShippingZoneUpdate) {
  return apiRequest<ShippingZone>(`/api/admin/shipping/zones/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteShippingZone(id: number) {
  return apiRequest<{ success: true }>(`/api/admin/shipping/zones/${id}`, {
    method: "DELETE",
  });
}

export function fetchShippingRates(zoneId: number) {
  return apiRequest<ShippingRate[]>(`/api/admin/shipping/rates?zoneId=${zoneId}`, {
    method: "GET",
  });
}

export function createShippingRate(input: ShippingRateCreate) {
  return apiRequest<ShippingRate>("/api/admin/shipping/rates", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateShippingRate(id: number, input: ShippingRateUpdate) {
  return apiRequest<ShippingRate>(`/api/admin/shipping/rates/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteShippingRate(id: number) {
  return apiRequest<{ success: true }>(`/api/admin/shipping/rates/${id}`, {
    method: "DELETE",
  });
}

export function fetchAdminUsers() {
  return apiRequest<AdminUser[]>("/api/admin/users", { method: "GET" });
}

export function createAdminUser(input: AdminUserCreate) {
  return apiRequest<AdminUserCreateResponse>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateAdminUser(id: number, input: AdminUserUpdate) {
  return apiRequest<AdminUser>(`/api/admin/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function resetAdminUserPassword(id: number, newPassword?: string) {
  return apiRequest<{ userId: number; tempPassword: string }>(`/api/admin/users/${id}/reset-password`, {
    method: "POST",
    body: JSON.stringify(newPassword ? { newPassword } : {}),
  });
}

export function fetchAuditLogs(query: Partial<AuditLogListQuery> = {}) {
  const params = new URLSearchParams();
  if (query.limit) params.set("limit", String(query.limit));
  if (query.cursor) params.set("cursor", String(query.cursor));
  if (query.action) params.set("action", query.action);
  if (query.entityType) params.set("entityType", query.entityType);
  const suffix = params.toString();
  return apiRequest<AuditLogListResponse>(`/api/admin/audit-logs${suffix ? `?${suffix}` : ""}`, {
    method: "GET",
  });
}
