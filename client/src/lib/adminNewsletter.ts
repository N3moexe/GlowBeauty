export type NewsletterStatus = "PENDING" | "SUBSCRIBED" | "UNSUBSCRIBED";

export type NewsletterSubscriber = {
  id: string;
  email: string;
  status: NewsletterStatus;
  source: string | null;
  locale: string | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
};

export type NewsletterListPayload = {
  items: NewsletterSubscriber[];
  total: number;
  limit: number;
  offset: number;
};

type NewsletterListResponse = {
  ok?: boolean;
  data?: NewsletterListPayload;
  error?: string;
};

function parseErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const message = (payload as { error?: unknown }).error;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }
  return fallback;
}

export async function fetchNewsletterSubscribers(input?: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<NewsletterListPayload> {
  const params = new URLSearchParams();
  if (input?.search) params.set("search", input.search);
  params.set("limit", String(input?.limit ?? 500));
  params.set("offset", String(input?.offset ?? 0));

  const response = await fetch(`/api/admin/newsletter?${params.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });
  const payload = (await response
    .json()
    .catch(() => null)) as NewsletterListResponse | null;

  if (!response.ok || !payload || payload.ok === false || !payload.data) {
    throw new Error(
      parseErrorMessage(payload, "Impossible de charger les abonnés.")
    );
  }
  return payload.data;
}

/** URL for the server-streamed CSV export (sends the admin cookie via same-origin nav). */
export function newsletterExportUrl(search?: string) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  const qs = params.toString();
  return `/api/admin/newsletter/export${qs ? `?${qs}` : ""}`;
}
