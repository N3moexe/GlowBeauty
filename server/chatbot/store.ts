import { and, asc, count, desc, eq, like, or, sql } from "drizzle-orm";
import {
  chatEvents,
  chatKbArticles,
  chatMessages,
  chatSettings,
  chatThreads,
  chatTickets,
  orders,
} from "../../drizzle/schema";
import type {
  ChatAnalytics,
  ChatKbArticle,
  ChatMessage,
  ChatRole,
  ChatSettings,
  ChatSettingsUpdate,
  ChatThreadStatus,
  ChatThreadSummary,
  ChatTicket,
  ChatTicketStatus,
  CreateChatKbArticleInput,
  UpdateChatKbArticleInput,
} from "@shared/chatbot";
import * as db from "../db";

type ChatMessageMeta = Record<string, unknown>;

const defaultEnabledTools: ChatSettings["enabledTools"] = [
  "searchProducts",
  "getProduct",
  "getOrderStatus",
  "getShippingOptions",
  "getFaqAnswer",
  "createSupportTicket",
];

const defaultChatSettings: ChatSettings = {
  id: 1,
  businessName: "SenBonsPlans",
  whatsappNumber: "+221788911010",
  welcomeMessage:
    "Bienvenue chez SenBonsPlans ✨ Je peux vous aider pour vos produits, le suivi de commande et la livraison.",
  primaryColor: "#8f5f68",
  botTone: "luxury_skincare",
  enabledTools: defaultEnabledTools,
  isEnabled: true,
  updatedAt: new Date().toISOString(),
};
defaultChatSettings.welcomeMessage =
  "Bienvenue chez SenBonsPlans. Je peux vous aider pour les produits, le suivi de commande et la livraison.";

let demoThreadIdSeq = 1;
let demoMessageIdSeq = 1;
let demoKbIdSeq = 1;
let demoTicketIdSeq = 1;
let demoEventIdSeq = 1;

const demoThreads: Array<{
  id: number;
  visitorId: string;
  sessionId: string | null;
  userId: number | null;
  locale: string;
  status: ChatThreadStatus;
  createdAt: Date;
  updatedAt: Date;
}> = [];

const demoMessages: Array<{
  id: number;
  threadId: number;
  role: ChatRole;
  content: string;
  meta: ChatMessageMeta;
  createdAt: Date;
}> = [];

const demoKbArticles: Array<{
  id: number;
  title: string;
  content: string;
  tags: string[];
  locale: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}> = [];

const demoTickets: Array<{
  id: number;
  threadId: number;
  message: string;
  phone: string | null;
  status: ChatTicketStatus;
  createdAt: Date;
  updatedAt: Date;
}> = [];

const demoEvents: Array<{
  id: number;
  type: string;
  threadId: number | null;
  payload: Record<string, unknown>;
  createdAt: Date;
}> = [];

let demoSettings: ChatSettings = { ...defaultChatSettings };

const defaultKbSeed = [
  {
    title: "Delais de livraison Dakar",
    content:
      "Dakar centre est livre en 24h. Banlieue et regions proches: 24h a 48h selon la zone.",
    tags: ["shipping", "dakar", "delivery"],
    locale: "fr-SN",
  },
  {
    title: "Frais de livraison",
    content:
      "Les frais varient selon la zone. Le bot peut verifier votre quartier pour confirmer le tarif exact.",
    tags: ["shipping", "fees", "zones"],
    locale: "fr-SN",
  },
  {
    title: "Modes de paiement",
    content:
      "Vous pouvez payer via Wave, Orange Money, Free Money, et selon disponibilite par carte.",
    tags: ["payments", "wave", "orange-money"],
    locale: "fr-SN",
  },
  {
    title: "Politique de retour",
    content:
      "Les retours sont acceptes selon l'etat du produit et delai. Contactez le support WhatsApp pour validation.",
    tags: ["returns", "policy"],
    locale: "fr-SN",
  },
  {
    title: "Routine peau grasse",
    content:
      "Routine recommandee: nettoyant doux, serum niacinamide, hydratant leger, SPF le matin.",
    tags: ["routine", "oily-skin", "niacinamide"],
    locale: "fr-SN",
  },
  {
    title: "Routine anti-taches",
    content:
      "Routine recommandee: vitamine C le matin, SPF quotidien, acide doux le soir 2 a 3 fois par semaine.",
    tags: ["routine", "dark-spots", "vitamin-c", "spf"],
    locale: "fr-SN",
  },
  {
    title: "Suivi de commande",
    content:
      "Pour suivre une commande, fournissez le numero de commande (ex: SBP-1024) ou le numero de telephone utilise.",
    tags: ["order", "tracking", "support"],
    locale: "fr-SN",
  },
  {
    title: "Conseils securite peau sensible",
    content:
      "Commencez doucement, faites un test sur une petite zone et consultez un pharmacien en cas de reaction.",
    tags: ["sensitive-skin", "safety", "routine"],
    locale: "fr-SN",
  },
];

function initializeDemoSeed() {
  if (demoKbArticles.length === 0) {
    const now = new Date();
    for (const article of defaultKbSeed) {
      demoKbArticles.push({
        id: demoKbIdSeq++,
        title: article.title,
        content: article.content,
        tags: [...article.tags],
        locale: article.locale,
        isPublished: true,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      });
    }
  }

  if (demoThreads.length === 0) {
    const now = Date.now();
    const firstThreadId = demoThreadIdSeq++;
    const secondThreadId = demoThreadIdSeq++;
    demoThreads.push(
      {
        id: firstThreadId,
        visitorId: "demo-visitor-1",
        sessionId: "demo-visitor-1",
        userId: null,
        locale: "fr-SN",
        status: "open",
        createdAt: new Date(now - 1000 * 60 * 90),
        updatedAt: new Date(now - 1000 * 60 * 12),
      },
      {
        id: secondThreadId,
        visitorId: "demo-visitor-2",
        sessionId: "demo-visitor-2",
        userId: null,
        locale: "fr-SN",
        status: "closed",
        createdAt: new Date(now - 1000 * 60 * 60 * 24),
        updatedAt: new Date(now - 1000 * 60 * 40),
      }
    );
    demoMessages.push(
      {
        id: demoMessageIdSeq++,
        threadId: firstThreadId,
        role: "assistant",
        content:
          "Bonjour, je peux vous aider avec une routine, un suivi de commande ou la livraison.",
        meta: { kind: "welcome" },
        createdAt: new Date(now - 1000 * 60 * 89),
      },
      {
        id: demoMessageIdSeq++,
        threadId: firstThreadId,
        role: "user",
        content: "Je cherche une routine anti-taches.",
        meta: {},
        createdAt: new Date(now - 1000 * 60 * 13),
      },
      {
        id: demoMessageIdSeq++,
        threadId: firstThreadId,
        role: "assistant",
        content:
          "Je recommande vitamine C le matin, SPF quotidien et serum le soir. Voulez-vous 3 produits adaptes ?",
        meta: {
          quickReplies: ["Oui, montre 3 produits", "Parler a un humain"],
        },
        createdAt: new Date(now - 1000 * 60 * 12),
      },
      {
        id: demoMessageIdSeq++,
        threadId: secondThreadId,
        role: "user",
        content: "Ou est ma commande SBP-2091 ?",
        meta: {},
        createdAt: new Date(now - 1000 * 60 * 50),
      },
      {
        id: demoMessageIdSeq++,
        threadId: secondThreadId,
        role: "assistant",
        content: "Votre commande est en preparation. Livraison estimee demain.",
        meta: {},
        createdAt: new Date(now - 1000 * 60 * 48),
      }
    );
    demoTickets.push({
      id: demoTicketIdSeq++,
      threadId: secondThreadId,
      message: "Client veut confirmation horaire de livraison.",
      phone: "+221770001122",
      status: "open",
      createdAt: new Date(now - 1000 * 60 * 45),
      updatedAt: new Date(now - 1000 * 60 * 45),
    });
  }
}

initializeDemoSeed();

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toIso(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function mapDbMessage(row: any): ChatMessage {
  return {
    id: Number(row.id),
    threadId: Number(row.threadId),
    role: (row.role || "user") as ChatRole,
    content: row.content || row.message || "",
    createdAt: toIso(row.createdAt),
    meta: parseJson<Record<string, unknown>>(row.meta, {}),
  };
}

function mapDbArticle(row: any): ChatKbArticle {
  return {
    id: Number(row.id),
    title: row.title,
    content: row.content,
    tags: parseJson<string[]>(row.tags, []),
    locale: row.locale || "fr-SN",
    isPublished: Boolean(row.isPublished),
    updatedAt: toIso(row.updatedAt),
    createdAt: toIso(row.createdAt),
  };
}

function mapDbTicket(row: any): ChatTicket {
  return {
    id: Number(row.id),
    threadId: Number(row.threadId),
    message: row.message || "",
    phone: row.phone || null,
    status: (row.status || "open") as ChatTicketStatus,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function buildMessageFromDemo(row: (typeof demoMessages)[number]): ChatMessage {
  return {
    id: row.id,
    threadId: row.threadId,
    role: row.role,
    content: row.content,
    createdAt: toIso(row.createdAt),
    meta: row.meta,
  };
}

function tokenize(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function computeMatchScore(input: string, corpus: string): number {
  const inputTokens = tokenize(input);
  if (inputTokens.length === 0) return 0;
  const target = tokenize(corpus);
  if (target.length === 0) return 0;

  const targetSet = new Set(target);
  let score = 0;
  for (const token of inputTokens) {
    if (targetSet.has(token)) score += 2;
    else if (target.some(candidate => candidate.includes(token) || token.includes(candidate))) score += 1;
  }
  return score;
}

export async function ensureChatSettings(): Promise<ChatSettings> {
  const conn = await db.getDb();
  if (!conn) return { ...demoSettings };

  const existing = await conn.select().from(chatSettings).where(eq(chatSettings.id, 1)).limit(1);
  if (!existing[0]) {
    await conn.insert(chatSettings).values({
      id: 1,
      businessName: defaultChatSettings.businessName,
      whatsappNumber: defaultChatSettings.whatsappNumber,
      welcomeMessage: defaultChatSettings.welcomeMessage,
      primaryColor: defaultChatSettings.primaryColor,
      botTone: defaultChatSettings.botTone,
      enabledTools: JSON.stringify(defaultEnabledTools),
      isEnabled: true,
    });
    return { ...defaultChatSettings };
  }

  const row = existing[0];
  return {
    id: Number(row.id),
    businessName: row.businessName || defaultChatSettings.businessName,
    whatsappNumber: row.whatsappNumber || defaultChatSettings.whatsappNumber,
    welcomeMessage: row.welcomeMessage || defaultChatSettings.welcomeMessage,
    primaryColor: row.primaryColor || defaultChatSettings.primaryColor,
    botTone: (row.botTone || defaultChatSettings.botTone) as ChatSettings["botTone"],
    enabledTools: parseJson<ChatSettings["enabledTools"]>(
      row.enabledTools,
      defaultEnabledTools
    ),
    isEnabled: Boolean(row.isEnabled),
    updatedAt: toIso(row.updatedAt),
  };
}

export async function updateChatSettings(input: ChatSettingsUpdate): Promise<ChatSettings> {
  const conn = await db.getDb();
  if (!conn) {
    demoSettings = {
      ...demoSettings,
      ...input,
      enabledTools: input.enabledTools ? [...input.enabledTools] : demoSettings.enabledTools,
      updatedAt: new Date().toISOString(),
    };
    return { ...demoSettings };
  }

  const current = await ensureChatSettings();
  const payload: Partial<typeof chatSettings.$inferInsert> = {};
  if (input.businessName !== undefined) payload.businessName = input.businessName;
  if (input.whatsappNumber !== undefined) payload.whatsappNumber = input.whatsappNumber;
  if (input.welcomeMessage !== undefined) payload.welcomeMessage = input.welcomeMessage;
  if (input.primaryColor !== undefined) payload.primaryColor = input.primaryColor;
  if (input.botTone !== undefined) payload.botTone = input.botTone;
  if (input.enabledTools !== undefined) payload.enabledTools = JSON.stringify(input.enabledTools);
  if (input.isEnabled !== undefined) payload.isEnabled = input.isEnabled;

  if (Object.keys(payload).length > 0) {
    await conn.update(chatSettings).set(payload).where(eq(chatSettings.id, 1));
  }

  return ensureChatSettings();
}

export async function createOrResumeThread(input: {
  threadId?: number;
  visitorId: string;
  sessionId?: string;
  userId?: number | null;
  locale?: string;
}): Promise<{ thread: ChatThreadSummary; messages: ChatMessage[] }> {
  const conn = await db.getDb();
  if (!conn) {
    let thread = demoThreads.find(item => item.id === input.threadId && item.visitorId === input.visitorId);
    if (!thread) {
      const now = new Date();
      thread = {
        id: demoThreadIdSeq++,
        visitorId: input.visitorId,
        sessionId: input.sessionId || input.visitorId,
        userId: input.userId ?? null,
        locale: input.locale || "fr-SN",
        status: "open",
        createdAt: now,
        updatedAt: now,
      };
      demoThreads.push(thread);
    } else {
      thread.updatedAt = new Date();
    }
    const messages = demoMessages
      .filter(item => item.threadId === thread!.id)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map(buildMessageFromDemo);

    const last = messages[messages.length - 1];
    return {
      thread: {
        id: thread.id,
        visitorId: thread.visitorId,
        status: thread.status,
        createdAt: toIso(thread.createdAt),
        updatedAt: toIso(thread.updatedAt),
        messageCount: messages.length,
        lastMessage: last?.content || null,
        lastMessageAt: last?.createdAt || null,
      },
      messages,
    };
  }

  let threadRow: any | undefined;
  if (input.threadId) {
    const found = await conn
      .select()
      .from(chatThreads)
      .where(and(eq(chatThreads.id, input.threadId), eq(chatThreads.visitorId, input.visitorId)))
      .limit(1);
    threadRow = found[0];
  }

  if (!threadRow) {
    const inserted = await conn
      .insert(chatThreads)
      .values({
        sessionId: input.sessionId || input.visitorId,
        visitorId: input.visitorId,
        userId: input.userId ?? null,
        locale: input.locale || "fr-SN",
        status: "open",
      });
    const nextId = Number(inserted[0]?.insertId || 0);
    const created = await conn.select().from(chatThreads).where(eq(chatThreads.id, nextId)).limit(1);
    threadRow = created[0];
  } else {
    await conn
      .update(chatThreads)
      .set({
        updatedAt: new Date(),
        sessionId: input.sessionId || threadRow.sessionId || input.visitorId,
        locale: input.locale || threadRow.locale || "fr-SN",
        userId: input.userId === undefined ? threadRow.userId : input.userId,
      } as any)
      .where(eq(chatThreads.id, threadRow.id));
    const refreshed = await conn.select().from(chatThreads).where(eq(chatThreads.id, threadRow.id)).limit(1);
    threadRow = refreshed[0] || threadRow;
  }

  const rows = await conn
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.threadId, threadRow.id))
    .orderBy(asc(chatMessages.createdAt));
  const messages = rows.map(mapDbMessage);
  const last = messages[messages.length - 1];
  return {
    thread: {
      id: Number(threadRow.id),
      visitorId: threadRow.visitorId,
      status: (threadRow.status || "open") as ChatThreadStatus,
      createdAt: toIso(threadRow.createdAt),
      updatedAt: toIso(threadRow.updatedAt),
      messageCount: messages.length,
      lastMessage: last?.content || null,
      lastMessageAt: last?.createdAt || null,
    },
    messages,
  };
}

export async function appendThreadMessage(input: {
  threadId: number;
  role: ChatRole;
  content: string;
  meta?: ChatMessageMeta;
}): Promise<ChatMessage> {
  const conn = await db.getDb();
  const normalizedContent = normalizeText(input.content);
  const payloadMeta = input.meta || {};

  if (!conn) {
    const row = {
      id: demoMessageIdSeq++,
      threadId: input.threadId,
      role: input.role,
      content: normalizedContent,
      meta: payloadMeta,
      createdAt: new Date(),
    };
    demoMessages.push(row);
    const thread = demoThreads.find(item => item.id === input.threadId);
    if (thread) thread.updatedAt = new Date();
    return buildMessageFromDemo(row);
  }

  const inserted = await conn.insert(chatMessages).values({
    threadId: input.threadId,
    role: input.role,
    content: normalizedContent,
    meta: JSON.stringify(payloadMeta),
    // legacy compatibility
    sessionId: String(input.threadId),
    customerName: input.role === "user" ? "Customer" : "Assistant",
    customerEmail: "chat@local",
    message: normalizedContent,
    isFromCustomer: input.role === "user",
  } as any);

  await conn
    .update(chatThreads)
    .set({ updatedAt: new Date() })
    .where(eq(chatThreads.id, input.threadId));

  const messageId = Number(inserted[0]?.insertId || 0);
  if (!messageId) {
    return {
      id: -1,
      threadId: input.threadId,
      role: input.role,
      content: normalizedContent,
      createdAt: new Date().toISOString(),
      meta: payloadMeta,
    };
  }

  const rows = await conn.select().from(chatMessages).where(eq(chatMessages.id, messageId)).limit(1);
  return mapDbMessage(rows[0]);
}

export async function listKbArticles(input: {
  query?: string;
  tag?: string;
  locale?: string;
  publishedOnly?: boolean;
  limit?: number;
} = {}): Promise<ChatKbArticle[]> {
  const conn = await db.getDb();
  const query = normalizeText(input.query);
  const tag = normalizeText(input.tag).toLowerCase();
  const locale = normalizeText(input.locale);
  const limit = input.limit && input.limit > 0 ? input.limit : 200;

  if (!conn) {
    return demoKbArticles
      .filter(item => (input.publishedOnly ? item.isPublished : true))
      .filter(item => (locale ? item.locale === locale : true))
      .filter(item => {
        if (!query) return true;
        const corpus = `${item.title} ${item.content} ${item.tags.join(" ")}`;
        return computeMatchScore(query, corpus) > 0;
      })
      .filter(item => (!tag ? true : item.tags.some(entry => entry.toLowerCase() === tag)))
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
      .slice(0, limit)
      .map(item => ({
        id: item.id,
        title: item.title,
        content: item.content,
        tags: [...item.tags],
        locale: item.locale,
        isPublished: item.isPublished,
        updatedAt: toIso(item.updatedAt),
        createdAt: toIso(item.createdAt),
      }));
  }

  const conditions = [];
  if (input.publishedOnly) conditions.push(eq(chatKbArticles.isPublished, true));
  if (locale) conditions.push(eq(chatKbArticles.locale, locale));
  if (query) {
    conditions.push(
      or(
        like(chatKbArticles.title, `%${query}%`),
        like(chatKbArticles.content, `%${query}%`),
        like(chatKbArticles.tags, `%${query}%`)
      )!
    );
  }
  if (tag) {
    conditions.push(like(chatKbArticles.tags, `%${tag}%`));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await conn
    .select()
    .from(chatKbArticles)
    .where(where)
    .orderBy(desc(chatKbArticles.updatedAt))
    .limit(limit);

  return rows.map(mapDbArticle);
}

export async function upsertKbArticle(
  input: CreateChatKbArticleInput | (UpdateChatKbArticleInput & { id: number })
): Promise<ChatKbArticle> {
  const conn = await db.getDb();
  const hasId = "id" in input;

  if (!conn) {
    const now = new Date();
    if (hasId) {
      const target = demoKbArticles.find(item => item.id === input.id);
      if (!target) throw new Error("KB article not found");
      if (input.title !== undefined) target.title = input.title;
      if (input.content !== undefined) target.content = input.content;
      if (input.tags !== undefined) target.tags = [...input.tags];
      if (input.locale !== undefined) target.locale = input.locale;
      if (input.isPublished !== undefined) target.isPublished = input.isPublished;
      target.updatedAt = now;
      return {
        id: target.id,
        title: target.title,
        content: target.content,
        tags: [...target.tags],
        locale: target.locale,
        isPublished: target.isPublished,
        updatedAt: toIso(target.updatedAt),
        createdAt: toIso(target.createdAt),
      };
    }

    const created = {
      id: demoKbIdSeq++,
      title: input.title,
      content: input.content,
      tags: [...input.tags],
      locale: input.locale,
      isPublished: input.isPublished,
      createdAt: now,
      updatedAt: now,
    };
    demoKbArticles.push(created);
    return {
      id: created.id,
      title: created.title,
      content: created.content,
      tags: [...created.tags],
      locale: created.locale,
      isPublished: created.isPublished,
      updatedAt: toIso(created.updatedAt),
      createdAt: toIso(created.createdAt),
    };
  }

  if (hasId) {
    const payload: Partial<typeof chatKbArticles.$inferInsert> = {};
    if (input.title !== undefined) payload.title = input.title;
    if (input.content !== undefined) payload.content = input.content;
    if (input.tags !== undefined) payload.tags = JSON.stringify(input.tags);
    if (input.locale !== undefined) payload.locale = input.locale;
    if (input.isPublished !== undefined) payload.isPublished = input.isPublished;
    if (Object.keys(payload).length > 0) {
      await conn.update(chatKbArticles).set(payload).where(eq(chatKbArticles.id, input.id));
    }
    const rows = await conn.select().from(chatKbArticles).where(eq(chatKbArticles.id, input.id)).limit(1);
    if (!rows[0]) throw new Error("KB article not found");
    return mapDbArticle(rows[0]);
  }

  const inserted = await conn.insert(chatKbArticles).values({
    title: input.title,
    content: input.content,
    tags: JSON.stringify(input.tags),
    locale: input.locale,
    isPublished: input.isPublished,
  });
  const articleId = Number(inserted[0]?.insertId || 0);
  const rows = await conn.select().from(chatKbArticles).where(eq(chatKbArticles.id, articleId)).limit(1);
  if (!rows[0]) throw new Error("Failed to create KB article");
  return mapDbArticle(rows[0]);
}

export async function deleteKbArticle(id: number): Promise<boolean> {
  const conn = await db.getDb();
  if (!conn) {
    const next = demoKbArticles.filter(item => item.id !== id);
    const deleted = next.length !== demoKbArticles.length;
    demoKbArticles.splice(0, demoKbArticles.length, ...next);
    return deleted;
  }
  const result = await conn.delete(chatKbArticles).where(eq(chatKbArticles.id, id));
  return Number((result as any)[0]?.affectedRows || 0) > 0;
}

export async function findBestKbAnswer(query: string, locale: string): Promise<ChatKbArticle | null> {
  const articles = await listKbArticles({
    locale,
    publishedOnly: true,
    limit: 80,
  });
  if (articles.length === 0) return null;

  let winner: ChatKbArticle | null = null;
  let winnerScore = 0;
  for (const article of articles) {
    const score = computeMatchScore(query, `${article.title} ${article.content} ${article.tags.join(" ")}`);
    if (score > winnerScore) {
      winner = article;
      winnerScore = score;
    }
  }
  return winnerScore >= 3 ? winner : null;
}

export async function createSupportTicket(input: {
  threadId: number;
  message: string;
  phone?: string;
}): Promise<ChatTicket> {
  const conn = await db.getDb();
  const phone = normalizeText(input.phone) || null;
  const message = normalizeText(input.message);
  if (!conn) {
    const now = new Date();
    const row = {
      id: demoTicketIdSeq++,
      threadId: input.threadId,
      message,
      phone,
      status: "open" as ChatTicketStatus,
      createdAt: now,
      updatedAt: now,
    };
    demoTickets.push(row);
    return mapDbTicket(row);
  }

  const inserted = await conn.insert(chatTickets).values({
    threadId: input.threadId,
    message,
    phone,
    status: "open",
  });
  const ticketId = Number(inserted[0]?.insertId || 0);
  const rows = await conn.select().from(chatTickets).where(eq(chatTickets.id, ticketId)).limit(1);
  if (!rows[0]) throw new Error("Failed to create support ticket");
  return mapDbTicket(rows[0]);
}

export async function listTickets(input: { status?: ChatTicketStatus; limit?: number } = {}) {
  const conn = await db.getDb();
  const limit = input.limit && input.limit > 0 ? input.limit : 200;
  if (!conn) {
    return demoTickets
      .filter(item => (input.status ? item.status === input.status : true))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, limit)
      .map(mapDbTicket);
  }

  const where = input.status ? eq(chatTickets.status, input.status) : undefined;
  const rows = await conn.select().from(chatTickets).where(where).orderBy(desc(chatTickets.createdAt)).limit(limit);
  return rows.map(mapDbTicket);
}

export async function updateTicketStatus(id: number, status: ChatTicketStatus): Promise<ChatTicket | null> {
  const conn = await db.getDb();
  if (!conn) {
    const ticket = demoTickets.find(item => item.id === id);
    if (!ticket) return null;
    ticket.status = status;
    ticket.updatedAt = new Date();
    return mapDbTicket(ticket);
  }

  await conn.update(chatTickets).set({ status }).where(eq(chatTickets.id, id));
  const rows = await conn.select().from(chatTickets).where(eq(chatTickets.id, id)).limit(1);
  return rows[0] ? mapDbTicket(rows[0]) : null;
}

export async function listThreadSummaries(input: {
  status?: ChatThreadStatus;
  query?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<ChatThreadSummary[]> {
  const conn = await db.getDb();
  const limit = input.limit && input.limit > 0 ? input.limit : 200;
  const offset = input.offset || 0;
  const q = normalizeText(input.query).toLowerCase();

  if (!conn) {
    const rows = demoThreads
      .filter(item => (input.status ? item.status === input.status : true))
      .filter(item => (!q ? true : item.visitorId.toLowerCase().includes(q)))
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
      .slice(offset, offset + limit)
      .map(thread => {
        const messages = demoMessages
          .filter(item => item.threadId === thread.id)
          .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
        const last = messages[messages.length - 1];
        return {
          id: thread.id,
          visitorId: thread.visitorId,
          status: thread.status,
          createdAt: toIso(thread.createdAt),
          updatedAt: toIso(thread.updatedAt),
          messageCount: messages.length,
          lastMessage: last?.content || null,
          lastMessageAt: last ? toIso(last.createdAt) : null,
        };
      });
    return rows;
  }

  const conditions = [];
  if (input.status) conditions.push(eq(chatThreads.status, input.status));
  if (q) conditions.push(like(chatThreads.visitorId, `%${q}%`));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await conn
    .select()
    .from(chatThreads)
    .where(where)
    .orderBy(desc(chatThreads.updatedAt))
    .limit(limit)
    .offset(offset);

  if (rows.length === 0) return [];

  const summaries: ChatThreadSummary[] = [];
  for (const thread of rows) {
    const [messageCountResult, latestRows] = await Promise.all([
      conn
        .select({ count: count() })
        .from(chatMessages)
        .where(eq(chatMessages.threadId, Number(thread.id))),
      conn
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.threadId, Number(thread.id)))
        .orderBy(desc(chatMessages.createdAt))
        .limit(1),
    ]);
    const latest = latestRows[0];
    summaries.push({
      id: Number(thread.id),
      visitorId: thread.visitorId,
      status: (thread.status || "open") as ChatThreadStatus,
      createdAt: toIso(thread.createdAt),
      updatedAt: toIso(thread.updatedAt),
      messageCount: Number(messageCountResult[0]?.count || 0),
      lastMessage: latest ? latest.content || latest.message || "" : null,
      lastMessageAt: latest ? toIso(latest.createdAt) : null,
    });
  }
  return summaries;
}

export async function getThreadTranscript(threadId: number): Promise<{
  thread: ChatThreadSummary | null;
  messages: ChatMessage[];
  notes: Array<{ id: number; note: string; createdAt: string; actorUserId: number | null }>;
}> {
  const conn = await db.getDb();
  if (!conn) {
    const thread = demoThreads.find(item => item.id === threadId);
    if (!thread) return { thread: null, messages: [], notes: [] };
    const messages = demoMessages
      .filter(item => item.threadId === threadId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map(buildMessageFromDemo);
    const notes = demoEvents
      .filter(item => item.threadId === threadId && item.type === "internal_note")
      .map(item => ({
        id: item.id,
        note: String(item.payload.note || ""),
        createdAt: toIso(item.createdAt),
        actorUserId: (item.payload.actorUserId as number | null) ?? null,
      }));
    const summary = await listThreadSummaries({ limit: 1, query: thread.visitorId });
    return {
      thread: summary.find(item => item.id === threadId) || null,
      messages,
      notes,
    };
  }

  const [threadRows, messageRows, noteRows] = await Promise.all([
    conn.select().from(chatThreads).where(eq(chatThreads.id, threadId)).limit(1),
    conn.select().from(chatMessages).where(eq(chatMessages.threadId, threadId)).orderBy(asc(chatMessages.createdAt)),
    conn
      .select()
      .from(chatEvents)
      .where(and(eq(chatEvents.threadId, threadId), eq(chatEvents.type, "internal_note")))
      .orderBy(desc(chatEvents.createdAt)),
  ]);
  if (!threadRows[0]) return { thread: null, messages: [], notes: [] };
  const summaries = await listThreadSummaries({ limit: 1, query: threadRows[0].visitorId });
  return {
    thread: summaries.find(item => item.id === threadId) || null,
    messages: messageRows.map(mapDbMessage),
    notes: noteRows.map(row => {
      const payload = parseJson<Record<string, unknown>>(row.payload, {});
      return {
        id: Number(row.id),
        note: String(payload.note || ""),
        createdAt: toIso(row.createdAt),
        actorUserId: typeof payload.actorUserId === "number" ? payload.actorUserId : null,
      };
    }),
  };
}

export async function closeThread(threadId: number): Promise<boolean> {
  const conn = await db.getDb();
  if (!conn) {
    const thread = demoThreads.find(item => item.id === threadId);
    if (!thread) return false;
    thread.status = "closed";
    thread.updatedAt = new Date();
    return true;
  }
  await conn.update(chatThreads).set({ status: "closed" }).where(eq(chatThreads.id, threadId));
  return true;
}

export async function addThreadInternalNote(input: {
  threadId: number;
  note: string;
  actorUserId?: number | null;
}) {
  return logChatEvent({
    type: "internal_note",
    threadId: input.threadId,
    payload: {
      note: input.note,
      actorUserId: input.actorUserId ?? null,
    },
  });
}

export async function logChatEvent(input: {
  type: string;
  threadId?: number | null;
  payload?: Record<string, unknown>;
}) {
  const conn = await db.getDb();
  const threadId = input.threadId ?? null;
  const payload = input.payload || {};

  if (!conn) {
    demoEvents.push({
      id: demoEventIdSeq++,
      type: input.type,
      threadId,
      payload,
      createdAt: new Date(),
    });
    return;
  }

  await conn.insert(chatEvents).values({
    type: input.type,
    threadId,
    payload: JSON.stringify(payload),
  });
}

export async function getChatAnalytics(): Promise<ChatAnalytics> {
  const conn = await db.getDb();
  if (!conn) {
    const totalChats = demoThreads.length;
    const openThreads = demoThreads.filter(item => item.status === "open").length;
    const closedThreads = demoThreads.filter(item => item.status === "closed").length;
    const avgMessagesPerThread =
      totalChats > 0 ? Math.round((demoMessages.length / totalChats) * 100) / 100 : 0;
    const ticketCount = demoTickets.length;
    const handoffEvents = demoEvents.filter(item => item.type === "handoff_whatsapp").length;
    const handoffRate = totalChats > 0 ? Math.round((handoffEvents / totalChats) * 10_000) / 100 : 0;

    const topIntentCounts = new Map<string, number>();
    const topSearchCounts = new Map<string, number>();
    for (const event of demoEvents) {
      if (event.type === "intent_detected") {
        const intent = String(event.payload.intent || "unknown");
        topIntentCounts.set(intent, (topIntentCounts.get(intent) || 0) + 1);
      }
      if (event.type === "product_search") {
        const query = String(event.payload.query || "");
        if (query) topSearchCounts.set(query, (topSearchCounts.get(query) || 0) + 1);
      }
    }

    return {
      totalChats,
      openThreads,
      closedThreads,
      avgMessagesPerThread,
      ticketCount,
      handoffRate,
      topIntents: Array.from(topIntentCounts.entries())
        .map(([intent, count]) => ({ intent, count }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 8),
      topSearchedProducts: Array.from(topSearchCounts.entries())
        .map(([query, count]) => ({ query, count }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 8),
    };
  }

  const [total, open, closed, messagesAgg, ticketsAgg, handoffAgg, intentRows, searchRows] =
    await Promise.all([
      conn.select({ count: count() }).from(chatThreads),
      conn.select({ count: count() }).from(chatThreads).where(eq(chatThreads.status, "open")),
      conn.select({ count: count() }).from(chatThreads).where(eq(chatThreads.status, "closed")),
      conn.select({ count: count() }).from(chatMessages),
      conn.select({ count: count() }).from(chatTickets),
      conn.select({ count: count() }).from(chatEvents).where(eq(chatEvents.type, "handoff_whatsapp")),
      conn
        .select({
          payload: chatEvents.payload,
          count: sql<number>`count(*)`,
        })
        .from(chatEvents)
        .where(eq(chatEvents.type, "intent_detected"))
        .groupBy(chatEvents.payload),
      conn
        .select({
          payload: chatEvents.payload,
          count: sql<number>`count(*)`,
        })
        .from(chatEvents)
        .where(eq(chatEvents.type, "product_search"))
        .groupBy(chatEvents.payload),
    ]);

  const totalChats = Number(total[0]?.count || 0);
  const totalMessages = Number(messagesAgg[0]?.count || 0);
  const topIntents = intentRows
    .map(row => {
      const payload = parseJson<Record<string, unknown>>(row.payload, {});
      return {
        intent: String(payload.intent || "unknown"),
        count: Number(row.count || 0),
      };
    })
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);
  const topSearchedProducts = searchRows
    .map(row => {
      const payload = parseJson<Record<string, unknown>>(row.payload, {});
      return {
        query: String(payload.query || ""),
        count: Number(row.count || 0),
      };
    })
    .filter(item => item.query.length > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);

  return {
    totalChats,
    openThreads: Number(open[0]?.count || 0),
    closedThreads: Number(closed[0]?.count || 0),
    avgMessagesPerThread: totalChats > 0 ? Math.round((totalMessages / totalChats) * 100) / 100 : 0,
    ticketCount: Number(ticketsAgg[0]?.count || 0),
    handoffRate:
      totalChats > 0 ? Math.round((Number(handoffAgg[0]?.count || 0) / totalChats) * 10_000) / 100 : 0,
    topIntents,
    topSearchedProducts,
  };
}

export async function findOrdersByPhone(phone: string, limit = 5) {
  const conn = await db.getDb();
  const normalized = normalizeText(phone);
  if (!normalized) return [];
  if (!conn) {
    const result = await db.getOrders({ limit: 200 });
    return (result.orders || [])
      .filter((item: any) => String(item.customerPhone || "").includes(normalized))
      .slice(0, limit);
  }
  return conn
    .select()
    .from(orders)
    .where(like(orders.customerPhone, `%${normalized}%`))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}
