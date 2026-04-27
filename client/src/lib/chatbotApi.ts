import type {
  ChatAnalytics,
  ChatKbArticle,
  ChatMessage,
  ChatSettings,
  ChatSettingsUpdate,
  ChatThreadSummary,
  ChatTicket,
  ChatTicketStatus,
  CreateChatKbArticleInput,
  CreateChatThreadInput,
  UpdateChatKbArticleInput,
} from "@shared/chatbot";

export type ChatRecommendedProduct = {
  id: number;
  name: string;
  price: number;
  imageUrl: string | null;
  url: string;
  inStock: boolean;
  description: string | null;
  category: string | null;
};

export type ChatToolEvent =
  | { type: "recommended_products"; data: ChatRecommendedProduct[] }
  | { type: "ticket"; data: { id: number } };

export type ChatDoneEvent = {
  threadId?: number;
  message: ChatMessage;
  quickReplies: string[];
  recommendedProducts: ChatRecommendedProduct[];
  ticketId?: number | null;
  intent?: string;
  suggestedWhatsAppHandoff?: boolean;
  handoff?: {
    whatsappUrl?: string | null;
    message?: string;
  } | null;
};

export type ChatStreamRequest = {
  threadId?: number;
  sessionId: string;
  message: string;
  locale?: string;
  context?: {
    page?: string;
    cartItems?: Array<{
      productId: number;
      quantity: number;
      price: number;
      name?: string;
    }>;
    attachments?: Array<{
      name: string;
      type: string;
      dataUrl?: string;
    }>;
  };
};

export type ChatThreadInitResponse = {
  thread: ChatThreadSummary;
  messages: ChatMessage[];
  settings: ChatSettings;
};

export type ChatThreadTranscript = {
  thread: ChatThreadSummary | null;
  messages: ChatMessage[];
  notes: Array<{
    id: number;
    note: string;
    createdAt: string;
    actorUserId: number | null;
  }>;
};

type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
  error?: string;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.ok) {
    const message = payload?.error || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload.data;
}

function parseEventBlock(block: string): { event: string; data: string } | null {
  const lines = block.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return null;

  let event = "message";
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim() || "message";
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
    }
  }

  return {
    event,
    data: dataLines.join("\n"),
  };
}

export async function createOrResumeChatThread(
  payload: CreateChatThreadInput
): Promise<ChatThreadInitResponse> {
  return requestJson<ChatThreadInitResponse>("/api/chat/threads", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logChatHandoff(threadId: number): Promise<void> {
  await requestJson<{ success: boolean }>("/api/chat/handoff", {
    method: "POST",
    body: JSON.stringify({ threadId, channel: "whatsapp" }),
  });
}

export async function streamChatMessage(
  payload: ChatStreamRequest,
  handlers: {
    onStart?: (data: { threadId: number; startedAt: string }) => void;
    onChunk?: (delta: string) => void;
    onToolResult?: (toolEvent: ChatToolEvent) => void;
    onDone?: (data: ChatDoneEvent) => void;
    onError?: (message: string) => void;
  }
): Promise<void> {
  const response = await fetch("/api/chat", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    let message = `Chat request failed (${response.status})`;
    try {
      const payloadJson = (await response.json()) as { error?: string };
      if (payloadJson?.error) message = payloadJson.error;
    } catch {
      // ignore json parse errors
    }
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIndex = buffer.indexOf("\n\n");
    while (sepIndex >= 0) {
      const rawBlock = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);

      const event = parseEventBlock(rawBlock);
      if (event) {
        try {
          const parsedData = event.data ? JSON.parse(event.data) : {};
          if (event.event === "message_start") {
            handlers.onStart?.(parsedData as { threadId: number; startedAt: string });
          } else if (event.event === "chunk") {
            if (finished) continue;
            handlers.onChunk?.(String((parsedData as { delta?: string }).delta || ""));
          } else if (event.event === "tool_result") {
            if (finished) continue;
            handlers.onToolResult?.(parsedData as ChatToolEvent);
          } else if (event.event === "done") {
            if (finished) continue;
            finished = true;
            handlers.onDone?.(parsedData as ChatDoneEvent);
            return;
          } else if (event.event === "error") {
            if (finished) continue;
            handlers.onError?.(
              String((parsedData as { message?: string }).message || "Chatbot error")
            );
          }
        } catch {
          // ignore malformed chunks
        }
      }

      sepIndex = buffer.indexOf("\n\n");
    }
  }
}

export async function getAdminChatSettings(): Promise<ChatSettings> {
  return requestJson<ChatSettings>("/api/admin/chatbot/settings");
}

export async function updateAdminChatSettings(
  payload: ChatSettingsUpdate
): Promise<ChatSettings> {
  return requestJson<ChatSettings>("/api/admin/chatbot/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function listAdminKbArticles(query?: {
  q?: string;
  tag?: string;
  locale?: string;
  publishedOnly?: boolean;
}): Promise<ChatKbArticle[]> {
  const search = new URLSearchParams();
  if (query?.q) search.set("q", query.q);
  if (query?.tag) search.set("tag", query.tag);
  if (query?.locale) search.set("locale", query.locale);
  if (query?.publishedOnly !== undefined) {
    search.set("publishedOnly", query.publishedOnly ? "true" : "false");
  }
  const suffix = search.toString();
  return requestJson<ChatKbArticle[]>(`/api/admin/chatbot/kb${suffix ? `?${suffix}` : ""}`);
}

export async function createAdminKbArticle(
  payload: CreateChatKbArticleInput
): Promise<ChatKbArticle> {
  return requestJson<ChatKbArticle>("/api/admin/chatbot/kb", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminKbArticle(
  id: number,
  payload: UpdateChatKbArticleInput
): Promise<ChatKbArticle> {
  return requestJson<ChatKbArticle>(`/api/admin/chatbot/kb/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminKbArticle(id: number): Promise<boolean> {
  const data = await requestJson<{ deleted: boolean }>(`/api/admin/chatbot/kb/${id}`, {
    method: "DELETE",
  });
  return Boolean(data.deleted);
}

export async function listAdminChatThreads(query?: {
  status?: "open" | "closed";
  q?: string;
}): Promise<ChatThreadSummary[]> {
  const search = new URLSearchParams();
  if (query?.status) search.set("status", query.status);
  if (query?.q) search.set("q", query.q);
  const suffix = search.toString();
  return requestJson<ChatThreadSummary[]>(
    `/api/admin/chatbot/threads${suffix ? `?${suffix}` : ""}`
  );
}

export async function getAdminChatThread(threadId: number): Promise<ChatThreadTranscript> {
  return requestJson<ChatThreadTranscript>(`/api/admin/chatbot/threads/${threadId}`);
}

export async function addAdminChatNote(threadId: number, note: string): Promise<void> {
  await requestJson<{ success: boolean }>(`/api/admin/chatbot/threads/${threadId}/note`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function closeAdminChatThread(threadId: number): Promise<void> {
  await requestJson<{ closed: boolean }>(`/api/admin/chatbot/threads/${threadId}/close`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function listAdminChatTickets(query?: {
  status?: ChatTicketStatus;
}): Promise<ChatTicket[]> {
  const search = new URLSearchParams();
  if (query?.status) search.set("status", query.status);
  const suffix = search.toString();
  return requestJson<ChatTicket[]>(
    `/api/admin/chatbot/tickets${suffix ? `?${suffix}` : ""}`
  );
}

export async function updateAdminChatTicketStatus(
  id: number,
  status: ChatTicketStatus
): Promise<ChatTicket> {
  return requestJson<ChatTicket>(`/api/admin/chatbot/tickets/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function getAdminChatAnalytics(): Promise<ChatAnalytics> {
  return requestJson<ChatAnalytics>("/api/admin/chatbot/analytics");
}
