import type {
  AdminReviewListResponse,
  AdminReviewUpdateInput,
  CreateReviewInput,
  PublicProductReviewsResponse,
  ReviewReplyCreateInput,
} from "@shared/reviews";

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

export function fetchProductReviews(
  productId: number,
  input: { limit?: number; cursor?: number | null } = {}
) {
  const params = new URLSearchParams();
  if (input.limit) params.set("limit", String(input.limit));
  if (input.cursor) params.set("cursor", String(input.cursor));
  const suffix = params.toString();
  return apiRequest<PublicProductReviewsResponse>(
    `/api/products/${productId}/reviews${suffix ? `?${suffix}` : ""}`,
    { method: "GET" }
  );
}

export function createProductReview(input: CreateReviewInput) {
  return apiRequest<{ id: number; status: "pending" | "approved" | "rejected" }>("/api/reviews", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchAdminReviews(input: {
  status?: "pending" | "approved" | "rejected";
  productId?: number;
  q?: string;
  limit?: number;
  cursor?: number | null;
}) {
  const params = new URLSearchParams();
  if (input.status) params.set("status", input.status);
  if (input.productId) params.set("productId", String(input.productId));
  if (input.q?.trim()) params.set("q", input.q.trim());
  if (input.limit) params.set("limit", String(input.limit));
  if (input.cursor) params.set("cursor", String(input.cursor));
  const suffix = params.toString();
  return apiRequest<AdminReviewListResponse>(`/api/admin/reviews${suffix ? `?${suffix}` : ""}`, {
    method: "GET",
  });
}

export function updateAdminReview(id: number, input: AdminReviewUpdateInput) {
  return apiRequest<any>(`/api/admin/reviews/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteAdminReview(id: number) {
  return apiRequest<{ success: true }>(`/api/admin/reviews/${id}`, {
    method: "DELETE",
  });
}

export function createAdminReviewReply(id: number, input: ReviewReplyCreateInput) {
  return apiRequest<{ id: number; reviewId: number; body: string; createdAt: string }>(
    `/api/admin/reviews/${id}/reply`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

