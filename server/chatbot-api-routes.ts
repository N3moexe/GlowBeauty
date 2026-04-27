import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import {
  chatMessageRequestSchema,
  createChatThreadNoteSchema,
  createChatThreadSchema,
  createChatKbArticleSchema,
  updateChatKbArticleSchema,
  chatSettingsUpdateSchema,
  updateChatTicketStatusSchema,
} from "@shared/chatbot";
import { createContext } from "./_core/context";
import * as db from "./db";
import * as store from "./chatbot/store";
import { runChatEngine } from "./chatbot/chat-engine";
import { runConcierge } from "./chatbot/openai-concierge";

type AdminRequest = Request & {
  adminUser?: {
    id: number;
    name: string | null;
    role: "ADMIN" | "MANAGER" | "STAFF";
  };
};

const chatWriteBuckets = new Map<string, { count: number; resetAt: number }>();
const chatSessionBuckets = new Map<string, { count: number; resetAt: number }>();
const chatSensitiveKeyPattern =
  /(phone|email|address|token|secret|password|order|customer|whatsapp)/i;

function getRequestIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim().length > 0) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return req.ip || req.socket.remoteAddress || null;
}

function sendError(res: Response, statusCode: number, message: string, details?: unknown) {
  res.status(statusCode).json({
    ok: false,
    error: message,
    ...(details !== undefined ? { details } : {}),
  });
}

function isChatMessageAllowed(req: Request) {
  const now = Date.now();
  const key = `${getRequestIp(req) || "unknown"}:${req.path}`;
  const bucket = chatWriteBuckets.get(key);
  const windowMs = 60 * 1000;
  const max = 25;

  if (!bucket || now > bucket.resetAt) {
    chatWriteBuckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  bucket.count += 1;
  return bucket.count <= max;
}

function isChatSessionAllowed(sessionId: string) {
  const key = sessionId.trim().toLowerCase();
  if (!key) return true;
  const now = Date.now();
  const bucket = chatSessionBuckets.get(key);
  const windowMs = 60_000;
  const max = 24;

  if (!bucket || now > bucket.resetAt) {
    chatSessionBuckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  bucket.count += 1;
  return bucket.count <= max;
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const ctx = await createContext({ req, res } as any);
    const role = await db.getEffectiveAdminRole(ctx.user);
    if (!ctx.user || !role || (role !== "ADMIN" && role !== "MANAGER")) {
      sendError(res, 403, "Admin access required");
      return;
    }

    (req as AdminRequest).adminUser = {
      id: ctx.user.id,
      name: ctx.user.name ?? null,
      role,
    };
    next();
  } catch (error) {
    console.error("[Chatbot API] admin auth failed:", error);
    sendError(res, 401, "Authentication failed");
  }
}

function sendSseHeaders(res: Response) {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
}

function writeSseEvent(res: Response, event: string, payload: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function chunkText(input: string, size = 26) {
  const normalized = input.replace(/\r\n/g, "\n");
  const words = normalized.split(/(\s+)/);
  const chunks: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + word).length > size && current.length > 0) {
      chunks.push(current);
      current = word;
    } else {
      current += word;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function redactSensitiveToolPayload(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[TRUNCATED]";
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 30).map((entry) => redactSensitiveToolPayload(entry, depth + 1));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      output[key] = chatSensitiveKeyPattern.test(key)
        ? "[REDACTED]"
        : redactSensitiveToolPayload(raw, depth + 1);
    }
    return output;
  }
  if (typeof value === "string" && value.length > 400) {
    return `${value.slice(0, 400)}...`;
  }
  return value;
}

function parseThreadIdParam(req: Request) {
  const id = Number(req.params.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

const conciergeChatRequestSchema = z.object({
  threadId: z.number().int().positive().optional(),
  sessionId: z.string().min(3).max(120),
  message: z.string().min(1).max(4000),
  locale: z.string().min(2).max(16).default("fr-SN"),
  context: z
    .object({
      page: z.string().max(500).optional(),
      cartItems: z
        .array(
          z.object({
            productId: z.number().int().positive(),
            quantity: z.number().int().positive(),
            price: z.number().nonnegative(),
          })
        )
        .max(50)
        .optional(),
      attachments: z
        .array(
          z.object({
            name: z.string().max(200),
            type: z.string().max(120),
          })
        )
        .max(3)
        .optional(),
    })
    .optional(),
});

export function registerChatbotApiRoutes(app: Express) {
  app.post("/api/chat", async (req: Request, res: Response) => {
    let isClosed = false;
    req.on("close", () => {
      isClosed = true;
    });

    try {
      const parsed = conciergeChatRequestSchema.parse(req.body || {});
      if (!isChatSessionAllowed(parsed.sessionId)) {
        sendError(res, 429, "Too many chat requests for this session. Please wait a minute.");
        return;
      }

      const threadResult = await store.createOrResumeThread({
        threadId: parsed.threadId,
        visitorId: parsed.sessionId,
        sessionId: parsed.sessionId,
        locale: parsed.locale,
      } as any);
      const threadId = threadResult.thread.id;

      await store.appendThreadMessage({
        threadId,
        role: "user",
        content: parsed.message,
        meta: {
          locale: parsed.locale,
          context: parsed.context || {},
          source: "api_chat",
        },
      });

      if (parsed.context?.attachments?.length) {
        await store.logChatEvent({
          type: "attachment_uploaded",
          threadId,
          payload: {
            count: parsed.context.attachments.length,
          },
        });
      }

      const transcript = await store.getThreadTranscript(threadId);
      const settings = await db.getAdminChatbotSettings();

      sendSseHeaders(res);
      writeSseEvent(res, "message_start", {
        threadId,
        startedAt: new Date().toISOString(),
      });

      let streamedContent = "";
      const concierge = await runConcierge(
        {
          message: parsed.message,
          locale: parsed.locale,
          sessionId: parsed.sessionId,
          threadId,
          history: transcript.messages
            .slice(-14)
            .filter(item => item.role === "user" || item.role === "assistant")
            .map(item => ({
              role: item.role as "user" | "assistant",
              content: item.content || "",
            })),
          settings: {
            greeting: settings.greeting,
            tone: settings.tone as "Luxury skincare" | "Friendly" | "Professional",
            whatsappNumber: settings.whatsappNumber,
            policies: settings.policies,
          },
        },
        {
          onDelta: (chunk) => {
            if (isClosed) return;
            streamedContent += chunk;
            writeSseEvent(res, "chunk", { delta: chunk });
          },
        }
      );

      if (concierge.recommendedProducts.length > 0) {
        writeSseEvent(res, "tool_result", {
          type: "recommended_products",
          data: concierge.recommendedProducts,
        });
      }

      for (const toolCall of concierge.toolCalls) {
        await store.logChatEvent({
          type: "tool_call",
          threadId,
          payload: {
            name: toolCall.name,
            args: redactSensitiveToolPayload(toolCall.args),
            result: redactSensitiveToolPayload(toolCall.result),
          },
        });
      }

      const handoffResult = concierge.toolCalls.find(call => call.name === "handoffToWhatsApp");
      const handoffPayload =
        handoffResult && handoffResult.result && typeof handoffResult.result === "object"
          ? (handoffResult.result as Record<string, unknown>)
          : null;

      const savedAssistant = await store.appendThreadMessage({
        threadId,
        role: "assistant",
        content: streamedContent || concierge.content,
        meta: {
          quickReplies: concierge.quickReplies,
          recommendedProducts: concierge.recommendedProducts,
          source: "api_chat",
          handoff: handoffPayload,
        },
      });

      writeSseEvent(res, "done", {
        threadId,
        message: savedAssistant,
        quickReplies: concierge.quickReplies,
        recommendedProducts: concierge.recommendedProducts,
        handoff: handoffPayload,
      });
      res.end();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendSseHeaders(res);
        writeSseEvent(res, "error", {
          message: error.issues[0]?.message || "Invalid chat payload",
        });
        writeSseEvent(res, "done", { finished: true });
        res.end();
        return;
      }

      console.error("[Chatbot API] /api/chat failed:", error);
      sendSseHeaders(res);
      writeSseEvent(res, "error", {
        message: "Une erreur est survenue pendant la reponse du concierge.",
      });
      writeSseEvent(res, "done", { finished: true });
      res.end();
    }
  });

  app.post("/api/chat/threads", async (req: Request, res: Response) => {
    try {
      const parsed = createChatThreadSchema.parse(req.body || {});
      const settings = await store.ensureChatSettings();
      const conciergeSettings = await db.getAdminChatbotSettings().catch(() => null);
      if (conciergeSettings) {
        settings.whatsappNumber = conciergeSettings.whatsappNumber;
        settings.welcomeMessage = conciergeSettings.greeting;
      }
      const result = await store.createOrResumeThread(parsed);
      let messages = result.messages;

      if (messages.length === 0) {
        const welcome = await store.appendThreadMessage({
          threadId: result.thread.id,
          role: "assistant",
          content: settings.welcomeMessage,
          meta: {
            kind: "welcome",
          },
        });
        messages = [welcome];
      }

      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      res.json({
        ok: true,
        data: {
          thread: result.thread,
          messages,
          settings,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Invalid thread payload");
        return;
      }
      console.error("[Chatbot API] create/resume thread failed:", error);
      sendError(res, 500, error?.message || "Failed to initialize chat thread");
    }
  });

  app.post("/api/chat/handoff", async (req: Request, res: Response) => {
    try {
      const payload = z
        .object({
          threadId: z.number().int().positive(),
          channel: z.enum(["whatsapp"]).default("whatsapp"),
        })
        .parse(req.body || {});
      await store.logChatEvent({
        type: "handoff_whatsapp",
        threadId: payload.threadId,
        payload: {
          channel: payload.channel,
        },
      });
      res.json({ ok: true, data: { success: true } });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Invalid payload");
        return;
      }
      console.error("[Chatbot API] handoff log failed:", error);
      sendError(res, 500, "Failed to log handoff");
    }
  });

  app.post("/api/chat/message", async (req: Request, res: Response) => {
    if (!isChatMessageAllowed(req)) {
      sendError(res, 429, "Too many chat requests. Please try again in a minute.");
      return;
    }

    let isClosed = false;
    req.on("close", () => {
      isClosed = true;
    });

    try {
      const parsed = chatMessageRequestSchema.parse(req.body || {});
      const settings = await store.ensureChatSettings();
      if (!settings.isEnabled) {
        sendSseHeaders(res);
        writeSseEvent(res, "error", {
          message:
            "Le chatbot est temporairement indisponible. Merci de nous contacter via WhatsApp.",
        });
        writeSseEvent(res, "done", { finished: true });
        res.end();
        return;
      }

      const transcript = await store.getThreadTranscript(parsed.threadId);
      if (!transcript.thread) {
        sendError(res, 404, "Thread not found");
        return;
      }

      await store.appendThreadMessage({
        threadId: parsed.threadId,
        role: "user",
        content: parsed.message,
        meta: {
          locale: parsed.locale,
          context: parsed.context || {},
        },
      });

      if (parsed.context?.attachments?.length) {
        await store.logChatEvent({
          type: "attachment_uploaded",
          threadId: parsed.threadId,
          payload: {
            count: parsed.context.attachments.length,
          },
        });
      }

      sendSseHeaders(res);
      writeSseEvent(res, "message_start", {
        threadId: parsed.threadId,
        startedAt: new Date().toISOString(),
      });

      const history = transcript.messages
        .slice(-12)
        .map(item => ({ role: item.role as "user" | "assistant", content: item.content }))
        .filter(item => item.role === "user" || item.role === "assistant");

      const engineOutput = await runChatEngine(parsed, {
        threadId: parsed.threadId,
        settings,
        history,
      });

      if (engineOutput.recommendedProducts.length > 0) {
        writeSseEvent(res, "tool_result", {
          type: "recommended_products",
          data: engineOutput.recommendedProducts,
        });
      }

      if (engineOutput.ticketId) {
        writeSseEvent(res, "tool_result", {
          type: "ticket",
          data: { id: engineOutput.ticketId },
        });
      }

      if (engineOutput.suggestedWhatsAppHandoff) {
        await store.logChatEvent({
          type: "handoff_suggested",
          threadId: parsed.threadId,
          payload: {
            intent: engineOutput.intent,
          },
        });
      }

      const chunks = chunkText(engineOutput.content, 28);
      let streamedContent = "";
      for (const chunk of chunks) {
        if (isClosed) return;
        streamedContent += chunk;
        writeSseEvent(res, "chunk", { delta: chunk });
        await new Promise(resolve => setTimeout(resolve, 16));
      }

      const savedAssistant = await store.appendThreadMessage({
        threadId: parsed.threadId,
        role: "assistant",
        content: streamedContent,
        meta: {
          quickReplies: engineOutput.quickReplies,
          recommendedProducts: engineOutput.recommendedProducts,
          ticketId: engineOutput.ticketId,
          intent: engineOutput.intent,
          suggestedWhatsAppHandoff: engineOutput.suggestedWhatsAppHandoff,
          engine: engineOutput.metadata,
        },
      });

      writeSseEvent(res, "done", {
        message: savedAssistant,
        quickReplies: engineOutput.quickReplies,
        recommendedProducts: engineOutput.recommendedProducts,
        ticketId: engineOutput.ticketId,
        intent: engineOutput.intent,
        suggestedWhatsAppHandoff: engineOutput.suggestedWhatsAppHandoff,
      });
      res.end();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendSseHeaders(res);
        writeSseEvent(res, "error", {
          message: error.issues[0]?.message || "Invalid chat payload",
        });
        writeSseEvent(res, "done", { finished: true });
        res.end();
        return;
      }
      console.error("[Chatbot API] message failed:", error);
      sendSseHeaders(res);
      writeSseEvent(res, "error", {
        message: "Une erreur est survenue. Reessayez dans un instant.",
      });
      writeSseEvent(res, "done", { finished: true });
      res.end();
    }
  });

  app.get("/api/admin/chatbot/settings", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const settings = await store.ensureChatSettings();
      res.json({ ok: true, data: settings });
    } catch (error: any) {
      console.error("[Chatbot API] admin settings read failed:", error);
      sendError(res, 500, error?.message || "Failed to load chatbot settings");
    }
  });

  app.put("/api/admin/chatbot/settings", requireAdmin, async (req: Request, res: Response) => {
    try {
      const payload = chatSettingsUpdateSchema.parse(req.body || {});
      const updated = await store.updateChatSettings(payload);
      await store.logChatEvent({
        type: "admin_settings_updated",
        payload: {
          actorUserId: (req as AdminRequest).adminUser?.id || null,
        },
      });
      res.json({ ok: true, data: updated });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Invalid settings payload");
        return;
      }
      console.error("[Chatbot API] admin settings update failed:", error);
      sendError(res, 500, error?.message || "Failed to update chatbot settings");
    }
  });

  app.get("/api/admin/chatbot/kb", requireAdmin, async (req: Request, res: Response) => {
    try {
      const query = z
        .object({
          q: z.string().optional(),
          tag: z.string().optional(),
          locale: z.string().optional(),
          publishedOnly: z
            .enum(["true", "false"])
            .optional()
            .transform(value => value === "true"),
        })
        .parse(req.query || {});
      const articles = await store.listKbArticles({
        query: query.q,
        tag: query.tag,
        locale: query.locale,
        publishedOnly: query.publishedOnly,
      });
      res.json({ ok: true, data: articles });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Invalid query");
        return;
      }
      console.error("[Chatbot API] KB list failed:", error);
      sendError(res, 500, error?.message || "Failed to list KB articles");
    }
  });

  app.post("/api/admin/chatbot/kb", requireAdmin, async (req: Request, res: Response) => {
    try {
      const payload = createChatKbArticleSchema.parse(req.body || {});
      const created = await store.upsertKbArticle(payload);
      res.status(201).json({ ok: true, data: created });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Invalid KB payload");
        return;
      }
      console.error("[Chatbot API] KB create failed:", error);
      sendError(res, 500, error?.message || "Failed to create KB article");
    }
  });

  app.put("/api/admin/chatbot/kb/:id", requireAdmin, async (req: Request, res: Response) => {
    const id = parseThreadIdParam(req);
    if (!id) {
      sendError(res, 400, "Invalid article id");
      return;
    }
    try {
      const payload = updateChatKbArticleSchema.parse(req.body || {});
      const updated = await store.upsertKbArticle({ ...payload, id });
      res.json({ ok: true, data: updated });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Invalid KB payload");
        return;
      }
      console.error("[Chatbot API] KB update failed:", error);
      sendError(res, 500, error?.message || "Failed to update KB article");
    }
  });

  app.delete("/api/admin/chatbot/kb/:id", requireAdmin, async (req: Request, res: Response) => {
    const id = parseThreadIdParam(req);
    if (!id) {
      sendError(res, 400, "Invalid article id");
      return;
    }
    try {
      const deleted = await store.deleteKbArticle(id);
      res.json({ ok: true, data: { deleted } });
    } catch (error: any) {
      console.error("[Chatbot API] KB delete failed:", error);
      sendError(res, 500, error?.message || "Failed to delete KB article");
    }
  });

  app.get("/api/admin/chatbot/threads", requireAdmin, async (req: Request, res: Response) => {
    try {
      const query = z
        .object({
          status: z.enum(["open", "closed"]).optional(),
          q: z.string().optional(),
          limit: z.coerce.number().min(1).max(500).optional(),
          offset: z.coerce.number().min(0).optional(),
        })
        .parse(req.query || {});
      const threads = await store.listThreadSummaries({
        status: query.status,
        query: query.q,
        limit: query.limit,
        offset: query.offset,
      });
      res.json({ ok: true, data: threads });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Invalid query");
        return;
      }
      console.error("[Chatbot API] thread list failed:", error);
      sendError(res, 500, error?.message || "Failed to list chat threads");
    }
  });

  app.get("/api/admin/chatbot/threads/:id", requireAdmin, async (req: Request, res: Response) => {
    const id = parseThreadIdParam(req);
    if (!id) {
      sendError(res, 400, "Invalid thread id");
      return;
    }
    try {
      const transcript = await store.getThreadTranscript(id);
      if (!transcript.thread) {
        sendError(res, 404, "Thread not found");
        return;
      }
      res.json({ ok: true, data: transcript });
    } catch (error: any) {
      console.error("[Chatbot API] thread detail failed:", error);
      sendError(res, 500, error?.message || "Failed to load thread transcript");
    }
  });

  app.post("/api/admin/chatbot/threads/:id/note", requireAdmin, async (req: Request, res: Response) => {
    const id = parseThreadIdParam(req);
    if (!id) {
      sendError(res, 400, "Invalid thread id");
      return;
    }
    try {
      const payload = createChatThreadNoteSchema.parse(req.body || {});
      await store.addThreadInternalNote({
        threadId: id,
        note: payload.note,
        actorUserId: (req as AdminRequest).adminUser?.id ?? null,
      });
      res.json({ ok: true, data: { success: true } });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Invalid note payload");
        return;
      }
      console.error("[Chatbot API] add note failed:", error);
      sendError(res, 500, error?.message || "Failed to add internal note");
    }
  });

  app.post("/api/admin/chatbot/threads/:id/close", requireAdmin, async (req: Request, res: Response) => {
    const id = parseThreadIdParam(req);
    if (!id) {
      sendError(res, 400, "Invalid thread id");
      return;
    }
    try {
      const closed = await store.closeThread(id);
      res.json({ ok: true, data: { closed } });
    } catch (error: any) {
      console.error("[Chatbot API] close thread failed:", error);
      sendError(res, 500, error?.message || "Failed to close thread");
    }
  });

  app.get("/api/admin/chatbot/tickets", requireAdmin, async (req: Request, res: Response) => {
    try {
      const query = z
        .object({
          status: z.enum(["open", "closed"]).optional(),
          limit: z.coerce.number().min(1).max(500).optional(),
        })
        .parse(req.query || {});
      const tickets = await store.listTickets({
        status: query.status,
        limit: query.limit,
      });
      res.json({ ok: true, data: tickets });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Invalid query");
        return;
      }
      console.error("[Chatbot API] ticket list failed:", error);
      sendError(res, 500, error?.message || "Failed to list tickets");
    }
  });

  app.patch("/api/admin/chatbot/tickets/:id", requireAdmin, async (req: Request, res: Response) => {
    const id = parseThreadIdParam(req);
    if (!id) {
      sendError(res, 400, "Invalid ticket id");
      return;
    }
    try {
      const payload = updateChatTicketStatusSchema.parse(req.body || {});
      const updated = await store.updateTicketStatus(id, payload.status);
      if (!updated) {
        sendError(res, 404, "Ticket not found");
        return;
      }
      res.json({ ok: true, data: updated });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        sendError(res, 400, error.issues[0]?.message || "Invalid ticket payload");
        return;
      }
      console.error("[Chatbot API] ticket update failed:", error);
      sendError(res, 500, error?.message || "Failed to update ticket");
    }
  });

  app.get("/api/admin/chatbot/analytics", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const analytics = await store.getChatAnalytics();
      res.json({ ok: true, data: analytics });
    } catch (error: any) {
      console.error("[Chatbot API] analytics failed:", error);
      sendError(res, 500, error?.message || "Failed to load chatbot analytics");
    }
  });
}
