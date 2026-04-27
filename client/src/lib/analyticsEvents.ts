export type AnalyticsEventType =
  | "page_view"
  | "add_to_cart"
  | "checkout_start"
  | "purchase";

type AnalyticsEventPayload = {
  type: AnalyticsEventType;
  path: string;
  meta?: Record<string, unknown>;
};

const SESSION_STORAGE_KEY = "sbp_analytics_session";

export function getAnalyticsSessionId() {
  if (typeof window === "undefined") return "";
  const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (stored) return stored;

  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, generated);
  return generated;
}

export function trackAnalyticsEvent(payload: AnalyticsEventPayload) {
  if (typeof window === "undefined") return;
  if (!payload.path.trim()) return;

  const body = JSON.stringify({
    ...payload,
    sessionId: getAnalyticsSessionId(),
  });

  const url = "/api/analytics/event";

  if (navigator.sendBeacon) {
    try {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    } catch {
      // Fall back to fetch if beacon fails.
    }
  }

  void fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    keepalive: true,
    body,
  }).catch(() => {
    // Swallow analytics write errors by design.
  });
}
