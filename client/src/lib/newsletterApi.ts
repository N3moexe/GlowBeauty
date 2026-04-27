type SubscribeNewsletterInput = {
  email: string;
  source?: string;
  locale?: string;
};

type SubscribeNewsletterResponse = {
  ok: true;
  already: boolean;
  /** True when a confirmation email was just dispatched and the subscriber
   *  must click the link to finish opt-in (RGPD). */
  pending: boolean;
};

type ApiErrorPayload = {
  ok?: false;
  error?: string;
};

function parseApiError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const message = (payload as ApiErrorPayload).error;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }
  return fallback;
}

export async function subscribeNewsletter(input: SubscribeNewsletterInput) {
  const response = await fetch("/api/newsletter/subscribe", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as
    | SubscribeNewsletterResponse
    | ApiErrorPayload
    | null;
  if (!response.ok || !payload || (payload as ApiErrorPayload).ok === false) {
    throw new Error(
      parseApiError(payload, "Impossible de vous inscrire pour le moment.")
    );
  }

  if ((payload as SubscribeNewsletterResponse).ok !== true) {
    throw new Error("Reponse newsletter invalide.");
  }

  return payload as SubscribeNewsletterResponse;
}
