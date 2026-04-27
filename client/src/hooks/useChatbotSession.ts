import type { ChatMessage, ChatRole, ChatSettings } from "@shared/chatbot";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createOrResumeChatThread,
  logChatHandoff,
  streamChatMessage,
  type ChatDoneEvent,
  type ChatRecommendedProduct,
} from "@/lib/chatbotApi";

export type ChatAttachmentInput = {
  name: string;
  type: string;
  dataUrl: string;
};

export type ChatSendContext = {
  page?: string;
  cartItems?: Array<{
    productId: number;
    name: string;
    quantity: number;
    price: number;
  }>;
  attachments?: ChatAttachmentInput[];
};

export type ChatUiMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  status: "pending" | "streaming" | "done" | "error";
  quickReplies?: string[];
  recommendedProducts?: ChatRecommendedProduct[];
  ticketId?: number | null;
  suggestedWhatsAppHandoff?: boolean;
};

type SessionSnapshot = {
  sessionId: string;
  threadId: number | null;
  locale: string;
};

const SESSION_KEY = "sbp_chatbot_session_id_v1";
const THREAD_CACHE_PREFIX = "sbp_chatbot_thread_cache_v1_";
const SESSION_CACHE_PREFIX = "sbp_chatbot_session_cache_v1_";
const DUPLICATE_SEND_WINDOW_MS = 1500;
const DEFAULT_QUICK_REPLIES = [
  "Trouver une routine",
  "Suivre ma commande",
  "Recommander SPF",
  "Promos",
];
const globalSessionSendLocks = new Set<string>();
const globalRecentSessionSend = new Map<string, { signature: string; at: number }>();

function generateUuid() {
  const globalCrypto = globalThis.crypto;
  if (globalCrypto?.randomUUID) return globalCrypto.randomUUID();
  return `${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
}

function generateSessionId() {
  return `v_${generateUuid()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function createRequestId() {
  return `req-${generateUuid()}`;
}

function createLocalUserMessageId() {
  return `local-${generateUuid()}`;
}

function createAssistantMessageId() {
  return `asst-${generateUuid()}`;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toUiMessage(message: ChatMessage): ChatUiMessage {
  const meta = (message.meta || {}) as Record<string, unknown>;
  return {
    id: String(message.id),
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    status: "done",
    quickReplies: Array.isArray(meta.quickReplies)
      ? (meta.quickReplies as string[])
      : undefined,
    recommendedProducts: Array.isArray(meta.recommendedProducts)
      ? (meta.recommendedProducts as ChatRecommendedProduct[])
      : undefined,
    ticketId: typeof meta.ticketId === "number" ? meta.ticketId : null,
    suggestedWhatsAppHandoff: Boolean(meta.suggestedWhatsAppHandoff),
  };
}

function sanitizeWhatsappNumber(input: string) {
  return input.replace(/[^\d]/g, "");
}

function parseMessageTime(value: string) {
  const parsed = Number(new Date(value));
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function mergeMessagesById(...collections: ChatUiMessage[][]) {
  const order = new Map<string, number>();
  const mergedById = new Map<string, ChatUiMessage>();
  let orderIndex = 0;

  for (const collection of collections) {
    for (const message of collection) {
      if (!message?.id) continue;
      if (!order.has(message.id)) {
        order.set(message.id, orderIndex);
        orderIndex += 1;
      }
      mergedById.set(message.id, message);
    }
  }

  return Array.from(mergedById.values()).sort((a, b) => {
    const delta = parseMessageTime(a.createdAt) - parseMessageTime(b.createdAt);
    if (delta !== 0) return delta;
    return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  });
}

function buildMessageSignature(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function useChatbotSession(defaultLocale = "fr-SN") {
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [threadId, setThreadId] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [quickReplies, setQuickReplies] = useState<string[]>(DEFAULT_QUICK_REPLIES);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locale] = useState(defaultLocale);
  const pendingToolsRef = useRef<{
    recommendedProducts: ChatRecommendedProduct[];
    ticketId: number | null;
  }>({
    recommendedProducts: [],
    ticketId: null,
  });
  const messageIdsRef = useRef<Set<string>>(new Set());
  const inFlightRequestIdsRef = useRef<Set<string>>(new Set());
  const activeRequestIdRef = useRef<string | null>(null);

  const sessionSnapshot = useMemo<SessionSnapshot>(() => {
    const persisted = parseJson<SessionSnapshot | null>(
      typeof window !== "undefined" ? window.localStorage.getItem(SESSION_KEY) : null,
      null
    );
    if (persisted?.sessionId) {
      return {
        sessionId: persisted.sessionId,
        threadId: persisted.threadId ?? null,
        locale: persisted.locale || defaultLocale,
      };
    }
    return {
      sessionId: generateSessionId(),
      threadId: null,
      locale: defaultLocale,
    };
  }, [defaultLocale]);

  useEffect(() => {
    setSessionId(sessionSnapshot.sessionId);
    setThreadId(sessionSnapshot.threadId);
    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        sessionId: sessionSnapshot.sessionId,
        threadId: sessionSnapshot.threadId ?? null,
        locale: sessionSnapshot.locale || defaultLocale,
      })
    );

    if (sessionSnapshot.threadId) {
      const cached = parseJson<ChatUiMessage[]>(
        window.localStorage.getItem(`${THREAD_CACHE_PREFIX}${sessionSnapshot.threadId}`),
        []
      );
      if (cached.length > 0) {
        setMessages((prev) => mergeMessagesById(prev, cached));
      }
    } else {
      const sessionCached = parseJson<ChatUiMessage[]>(
        window.localStorage.getItem(`${SESSION_CACHE_PREFIX}${sessionSnapshot.sessionId}`),
        []
      );
      if (sessionCached.length > 0) {
        setMessages((prev) => mergeMessagesById(prev, sessionCached));
      }
    }
  }, [defaultLocale, sessionSnapshot.locale, sessionSnapshot.threadId, sessionSnapshot.sessionId]);

  const persistSession = useCallback(
    (nextThreadId: number | null) => {
      const payload: SessionSnapshot = {
        sessionId: sessionSnapshot.sessionId,
        threadId: nextThreadId,
        locale,
      };
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    },
    [locale, sessionSnapshot.sessionId]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    createOrResumeChatThread({
      visitorId: sessionSnapshot.sessionId,
      threadId: sessionSnapshot.threadId || undefined,
      locale,
    })
      .then((data) => {
        if (!active) return;
        setSettings(data.settings);
        setThreadId(data.thread.id);
        const uiMessages = mergeMessagesById(data.messages.map(toUiMessage));
        setMessages((prev) => mergeMessagesById(prev, uiMessages));
        const lastQuickReplies = [...uiMessages]
          .reverse()
          .find((entry) => entry.quickReplies && entry.quickReplies.length > 0)?.quickReplies;
        setQuickReplies(lastQuickReplies || DEFAULT_QUICK_REPLIES);
        persistSession(data.thread.id);
        if (data.thread.id) {
          window.localStorage.setItem(
            `${THREAD_CACHE_PREFIX}${data.thread.id}`,
            JSON.stringify(uiMessages)
          );
        }
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Failed to initialize chatbot."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [locale, persistSession, sessionSnapshot.threadId, sessionSnapshot.sessionId]);

  useEffect(() => {
    if (sessionSnapshot.sessionId) {
      window.localStorage.setItem(
        `${SESSION_CACHE_PREFIX}${sessionSnapshot.sessionId}`,
        JSON.stringify(messages)
      );
    }
    if (!threadId) return;
    window.localStorage.setItem(`${THREAD_CACHE_PREFIX}${threadId}`, JSON.stringify(messages));
  }, [messages, sessionSnapshot.sessionId, threadId]);

  useEffect(() => {
    messageIdsRef.current = new Set(messages.map((message) => message.id));
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string, context?: ChatSendContext): Promise<boolean> => {
      const trimmed = text.trim();
      if (!trimmed) return false;
      if (sending) return false;
      if (activeRequestIdRef.current) return false;
      if (globalSessionSendLocks.has(sessionSnapshot.sessionId)) return false;

      const signature = buildMessageSignature(trimmed);
      const now = Date.now();
      const lastSent = globalRecentSessionSend.get(sessionSnapshot.sessionId);
      if (
        lastSent &&
        lastSent.signature === signature &&
        now - lastSent.at < DUPLICATE_SEND_WINDOW_MS
      ) {
        return false;
      }
      globalRecentSessionSend.set(sessionSnapshot.sessionId, {
        signature,
        at: now,
      });
      globalSessionSendLocks.add(sessionSnapshot.sessionId);

      const requestId = createRequestId();
      if (inFlightRequestIdsRef.current.has(requestId)) {
        globalSessionSendLocks.delete(sessionSnapshot.sessionId);
        return false;
      }
      inFlightRequestIdsRef.current.add(requestId);
      activeRequestIdRef.current = requestId;

      const userLocalId = createLocalUserMessageId();
      const assistantLocalId = createAssistantMessageId();
      const userMessage: ChatUiMessage = {
        id: userLocalId,
        role: "user",
        content: trimmed,
        createdAt: nowIso(),
        status: "pending",
      };
      const assistantMessage: ChatUiMessage = {
        id: assistantLocalId,
        role: "assistant",
        content: "",
        createdAt: nowIso(),
        status: "streaming",
      };

      pendingToolsRef.current = {
        recommendedProducts: [],
        ticketId: null,
      };
      let completedPayload: ChatDoneEvent | null = null;
      setSending(true);
      setError(null);

      setMessages((prev) => {
        const next = [...prev];
        if (!messageIdsRef.current.has(userMessage.id) && !next.some((item) => item.id === userMessage.id)) {
          next.push(userMessage);
        }
        if (
          !messageIdsRef.current.has(assistantMessage.id) &&
          !next.some((item) => item.id === assistantMessage.id)
        ) {
          next.push(assistantMessage);
        }
        return mergeMessagesById(next);
      });

      try {
        await streamChatMessage(
          {
            threadId: threadId || undefined,
            sessionId: sessionSnapshot.sessionId,
            message: trimmed,
            locale,
            context,
          },
          {
            onChunk: (delta) => {
              if (activeRequestIdRef.current !== requestId) return;
              if (!delta) return;
              setMessages((prev) =>
                mergeMessagesById(
                  prev.map((entry) =>
                    entry.id === assistantLocalId
                      ? { ...entry, content: `${entry.content}${delta}`, status: "streaming" as const }
                      : entry
                  )
                )
              );
            },
            onToolResult: (event) => {
              if (event.type === "recommended_products") {
                pendingToolsRef.current.recommendedProducts = event.data || [];
              }
              if (event.type === "ticket") {
                pendingToolsRef.current.ticketId = event.data?.id || null;
              }
            },
            onDone: (payload) => {
              completedPayload = payload;
              if (payload.threadId && payload.threadId !== threadId) {
                setThreadId(payload.threadId);
                persistSession(payload.threadId);
              }
            },
            onError: (message) => {
              setError(message || "Chatbot returned an error.");
            },
          }
        );

        setMessages((prev) => {
          let next = prev.map((entry) =>
            entry.id === userLocalId ? { ...entry, status: "done" as const } : entry
          );

          const donePayload = completedPayload;
          if (donePayload?.message) {
            const finalId = String(donePayload.message.id);
            next = next
              .filter((item) => item.id !== finalId || item.id === assistantLocalId)
              .map((item) => {
                if (item.id !== assistantLocalId) return item;
                return {
                  ...toUiMessage(donePayload.message),
                  id: finalId,
                  quickReplies: donePayload.quickReplies || [],
                  recommendedProducts:
                    donePayload.recommendedProducts ||
                    pendingToolsRef.current.recommendedProducts,
                  ticketId:
                    donePayload.ticketId ?? pendingToolsRef.current.ticketId ?? null,
                  suggestedWhatsAppHandoff: donePayload.suggestedWhatsAppHandoff,
                  status: "done" as const,
                };
              });
          } else {
            next = next.map((item) =>
              item.id === assistantLocalId
                ? {
                    ...item,
                    status: "done" as const,
                    recommendedProducts: pendingToolsRef.current.recommendedProducts,
                    ticketId: pendingToolsRef.current.ticketId,
                  }
                : item
            );
          }

          return mergeMessagesById(next);
        });

        const completed = completedPayload as {
          quickReplies?: string[];
        } | null;
        if (completed?.quickReplies?.length) {
          setQuickReplies(completed.quickReplies);
        } else {
          setQuickReplies(DEFAULT_QUICK_REPLIES);
        }
        return true;
      } catch (requestError: unknown) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Unable to send message";
        setError(message);
        setMessages((prev) =>
          mergeMessagesById(
            prev.map((entry) => {
              if (entry.id === userLocalId || entry.id === assistantLocalId) {
                return {
                  ...entry,
                  status: "error" as const,
                };
              }
              return entry;
            })
          )
        );
        return false;
      } finally {
        inFlightRequestIdsRef.current.delete(requestId);
        if (activeRequestIdRef.current === requestId) {
          activeRequestIdRef.current = null;
        }
        globalSessionSendLocks.delete(sessionSnapshot.sessionId);
        setSending(false);
      }
    },
    [locale, persistSession, sending, sessionSnapshot.sessionId, threadId]
  );

  const startWhatsAppHandoff = useCallback(
    async (prefilledMessage?: string) => {
      if (!threadId || !settings) return null;

      try {
        await logChatHandoff(threadId);
      } catch {
        // silent fallback
      }

      const number = sanitizeWhatsappNumber(settings.whatsappNumber || "");
      if (!number) return null;

      const lastUserMessage = [...messages]
        .reverse()
        .find((entry) => entry.role === "user")?.content;

      const defaultPrefill = `Bonjour, j'ai besoin d'aide pour ma commande. Thread #${threadId}.`;
      const finalMessage = prefilledMessage || lastUserMessage || defaultPrefill;
      return `https://wa.me/${number}?text=${encodeURIComponent(finalMessage)}`;
    },
    [messages, settings, threadId]
  );

  return {
    settings,
    threadId,
    sessionId,
    messages,
    quickReplies,
    loading,
    sending,
    isTyping: sending,
    error,
    sendMessage,
    startWhatsAppHandoff,
    setQuickReplies,
  };
}
