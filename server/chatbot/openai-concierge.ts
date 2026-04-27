import { and, desc, eq, like } from "drizzle-orm";
import { chatEvents } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import * as db from "../db";
import * as store from "./store";

type Role = "system" | "user" | "assistant" | "tool";

type OpenAiMessage = {
  role: Role;
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
};

type ConciergeTone = "Luxury skincare" | "Friendly" | "Professional";

type ConciergeSettings = {
  greeting: string;
  tone: ConciergeTone;
  whatsappNumber: string;
  policies: {
    return: string;
    delivery: string;
    payment: string;
  };
};

export type ConciergeProduct = {
  id: number;
  name: string;
  price: number;
  imageUrl: string | null;
  url: string;
  inStock: boolean;
  description: string | null;
};

export type ConciergeToolCallLog = {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
};

export type ConciergeRunInput = {
  message: string;
  locale: string;
  sessionId: string;
  threadId: number;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  settings: ConciergeSettings;
};

export type ConciergeRunOutput = {
  content: string;
  recommendedProducts: ConciergeProduct[];
  quickReplies: string[];
  toolCalls: ConciergeToolCallLog[];
};

const CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const FALLBACK_QUICK_REPLIES = [
  "Trouver une routine",
  "Suivre ma commande",
  "Recommander SPF",
  "Promos",
];
const allowedToolNames = new Set([
  "searchProducts",
  "getProductById",
  "recommendRoutine",
  "addToCart",
  "getCart",
  "trackOrder",
  "estimateShipping",
  "getPolicies",
  "handoffToWhatsApp",
]);

const profanityTerms = ["fuck", "shit", "connard", "salope", "pute", "fdp", "merde"];
const medicalTerms = [
  "eczema",
  "psoriasis",
  "allergie",
  "allergique",
  "dermatite",
  "infection",
  "cancer",
  "grossesse",
  "enceinte",
];
const frustrationTerms = [
  "urgent",
  "immediat",
  "immediately",
  "asap",
  "frustre",
  "frustrated",
  "colere",
  "angry",
  "plainte",
  "reclamation",
  "annuler",
  "cancel",
  "remboursement",
  "refund",
  "help now",
];

type CartLine = {
  productId: number;
  qty: number;
  name: string;
  price: number;
  imageUrl: string | null;
  url: string;
};

const inMemoryCarts = new Map<string, CartLine[]>();

function normalize(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasAnyKeyword(input: string, list: string[]) {
  const value = normalize(input);
  return list.some((item) => value.includes(item));
}

function isFrenchLocale(locale: string) {
  return String(locale || "").toLowerCase().startsWith("fr");
}

function formatConciergeOutput(input: {
  locale: string;
  summary: string;
  questions?: string[];
  routineLines?: string[];
  nextAction: string;
}) {
  const isFr = isFrenchLocale(input.locale);
  const lines: string[] = [
    `${isFr ? "✅ Résumé" : "✅ Summary"}: ${input.summary}`,
  ];

  if (Array.isArray(input.questions) && input.questions.length > 0) {
    lines.push(`${isFr ? "🔎 Questions rapides" : "🔎 Quick questions"}:`);
    input.questions.slice(0, 3).forEach((question, index) => {
      lines.push(`${index + 1}. ${question}`);
    });
  }

  lines.push(`${isFr ? "💎 Routine / recommandations" : "💎 Routine / recommendations"}:`);
  if (Array.isArray(input.routineLines) && input.routineLines.length > 0) {
    lines.push(...input.routineLines);
  } else {
    lines.push(
      isFr
        ? "Je peux vous proposer une routine AM/PM des que vous confirmez vos besoins."
        : "I can propose an AM/PM routine as soon as you confirm your needs."
    );
  }

  lines.push(`${isFr ? "👉 Prochaine étape" : "👉 Next step"}: ${input.nextAction}`);
  return lines.join("\n");
}

function escapeLike(input: string) {
  return input.replace(/[\\%_]/g, "\\$&");
}

function parseJsonSafely<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function sanitizeWhatsappNumber(input: string) {
  return String(input || "").replace(/[^\d]/g, "");
}

function mapProduct(row: any): ConciergeProduct {
  const slug =
    typeof row?.slug === "string" && row.slug.trim().length > 0
      ? row.slug
      : String(row?.id || "");
  return {
    id: Number(row?.id || 0),
    name: String(row?.name || "Produit"),
    price: Number(row?.price || 0),
    imageUrl: row?.imageUrl || null,
    url: `/produit/${encodeURIComponent(slug)}`,
    inStock: Boolean(row?.inStock),
    description: row?.description || null,
  };
}

function productListToText(products: ConciergeProduct[]) {
  if (!products.length) return "No product found.";
  return products
    .slice(0, 6)
    .map((product) => `- ${product.name} (${Math.round(product.price)} CFA)`)
    .join("\n");
}

function buildSystemPrompt(input: {
  locale: string;
  settings: ConciergeSettings;
  policiesText: string;
}) {
  const toneLabel =
    input.settings.tone === "Friendly"
      ? "friendly, warm and premium"
      : input.settings.tone === "Professional"
        ? "professional, concise and premium"
        : "elegant luxury skincare concierge";

  return [
    `You are SenBonsPlans Concierge, a ${toneLabel} assistant for skincare & essentials in Senegal.`,
    "Use a premium, elegant, warm, concise tone.",
    "Default language is French. Mirror user language (FR/EN).",
    "Currency is CFA (XOF).",
    "Never overwhelm users. Keep short, clear, conversion-focused steps.",
    "No medical diagnosis. Provide only general skincare guidance.",
    "Never invent product facts, prices, stock, ingredients, delivery rules, or order status.",
    "If product details are required, ask for product name or product ID and say you can check it.",
    "For order tracking, request BOTH orderId/order number AND phone before any status check.",
    "If intent is unclear, ask only 2-3 quick questions exactly around: skin type, main concern, budget max CFA + simple vs complete routine preference.",
    "When recommending routines: provide AM and PM, max 3 steps each (Nettoyer / Traiter / Proteger), and mention product category per step.",
    "When possible, include one Option premium and one Option budget.",
    "If user is frustrated, urgent, or asks human help: offer WhatsApp handoff and ask permission to transfer.",
    "Always end with ONE clear next action.",
    "Output format strictly with section headers in user language:",
    "✅ Résumé / Summary (1 line)",
    "🔎 2–3 questions (if needed)",
    "💎 Routine / recommandations (AM + PM when applicable)",
    "👉 Prochaine étape / Next step (1 action)",
    "When user asks FAQ topics, prioritize policies and known knowledge first.",
    "For medical claims/symptoms, include safety disclaimer that you are not a doctor and suggest pharmacist/dermatologist consultation.",
    `Greeting baseline: ${input.settings.greeting}`,
    `Policies:\n${input.policiesText}`,
  ].join("\n");
}

function createToolSpecs() {
  return [
    {
      type: "function",
      function: {
        name: "searchProducts",
        description:
          "Search matching products from catalog with optional skincare filters and budget cap.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
            category: { type: "string" },
            concern: { type: "string" },
            skinType: { type: "string" },
            priceMax: { type: "number" },
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "getProductById",
        description: "Get exact product details by id.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "number" },
          },
          required: ["id"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "recommendRoutine",
        description:
          "Build a concise routine recommendation using products from catalog.",
        parameters: {
          type: "object",
          properties: {
            skinType: { type: "string" },
            concerns: { type: "array", items: { type: "string" } },
            budget: { type: "number" },
            timeOfDay: { type: "string", enum: ["AM", "PM", "both"] },
          },
          required: ["skinType"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "addToCart",
        description:
          "Add a product to cart for a visitor session. Use after user confirms intent.",
        parameters: {
          type: "object",
          properties: {
            sessionId: { type: "string" },
            productId: { type: "number" },
            qty: { type: "number" },
          },
          required: ["sessionId", "productId"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "getCart",
        description: "Get current cart for a session.",
        parameters: {
          type: "object",
          properties: {
            sessionId: { type: "string" },
          },
          required: ["sessionId"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "trackOrder",
        description: "Track order status securely using BOTH order id/number and customer phone.",
        parameters: {
          type: "object",
          properties: {
            orderId: { type: "string" },
            phone: { type: "string" },
          },
          required: ["orderId", "phone"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "estimateShipping",
        description: "Estimate shipping fee and ETA by city/zone and cart weight.",
        parameters: {
          type: "object",
          properties: {
            city: { type: "string" },
            zoneId: { type: "number" },
            cartTotalWeight: { type: "number" },
          },
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "getPolicies",
        description: "Return return/delivery/payment policy texts.",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "handoffToWhatsApp",
        description: "Prepare WhatsApp support handoff deep link and message.",
        parameters: {
          type: "object",
          properties: {
            reason: { type: "string" },
            summary: { type: "string" },
          },
          required: ["reason"],
          additionalProperties: false,
        },
      },
    },
  ] as const;
}

async function openAiJsonCompletion(payload: Record<string, unknown>) {
  const response = await fetch(CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.openAiApiKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${text}`);
  }
  return response.json() as Promise<any>;
}

async function openAiStreamCompletion(
  payload: Record<string, unknown>,
  onDelta: (chunk: string) => void
) {
  const response = await fetch(CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.openAiApiKey}`,
    },
    body: JSON.stringify({
      ...payload,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI stream failed: ${response.status} ${text}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let output = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const lines = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice("data:".length).trim())
        .filter(Boolean);

      for (const line of lines) {
        if (line === "[DONE]") {
          return output;
        }
        const payloadChunk = parseJsonSafely<any>(line, null);
        const delta = payloadChunk?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) {
          output += delta;
          onDelta(delta);
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
  }

  return output;
}

async function findCategoryId(category: string | undefined) {
  if (!category || !category.trim()) return undefined;
  const needle = normalize(category);
  const categories = await db.getAllCategories();
  const matched = categories.find((row: any) => {
    const corpus = normalize(`${row.name || ""} ${row.slug || ""}`);
    return corpus.includes(needle);
  });
  return matched ? Number((matched as any).id) : undefined;
}

async function searchProductsTool(args: {
  query?: string;
  category?: string;
  concern?: string;
  skinType?: string;
  priceMax?: number;
}): Promise<ConciergeProduct[]> {
  const query = [
    args.query?.trim(),
    args.concern?.trim(),
    args.skinType?.trim(),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const categoryId = await findCategoryId(args.category);
  const result = await db.getProducts({
    categoryId,
    search: query || undefined,
    limit: 60,
  });

  let products = (result.products || []).map(mapProduct);
  if (args.priceMax != null && Number.isFinite(Number(args.priceMax))) {
    const ceiling = Number(args.priceMax);
    products = products.filter((item) => item.price <= ceiling);
  }
  products = products.filter((item) => item.inStock).slice(0, 6);
  return products;
}

async function getProductByIdTool(id: number) {
  const product = await db.getProductById(Number(id));
  if (!product) return null;
  return mapProduct(product);
}

async function recommendRoutineTool(args: {
  skinType?: string;
  concerns?: string[];
  budget?: number;
  timeOfDay?: "AM" | "PM" | "both";
}) {
  const concerns = Array.isArray(args.concerns) ? args.concerns.filter(Boolean) : [];
  const concernText = concerns.join(" ");

  const cleanser = (await searchProductsTool({
    query: "nettoyant doux",
    skinType: args.skinType,
    concern: concernText,
    priceMax: args.budget,
  }))[0];

  const serumQuery = normalize(concernText).includes("tache")
    ? "vitamine c serum"
    : normalize(concernText).includes("acne")
      ? "niacinamide serum"
      : "serum hydratant";

  const serum = (await searchProductsTool({
    query: serumQuery,
    skinType: args.skinType,
    concern: concernText,
    priceMax: args.budget,
  }))[0];

  const moisturizer = (await searchProductsTool({
    query: "creme hydratante",
    skinType: args.skinType,
    concern: concernText,
    priceMax: args.budget,
  }))[0];

  const spf = (await searchProductsTool({
    query: "spf solaire",
    skinType: args.skinType,
    concern: concernText,
    priceMax: args.budget,
  }))[0];

  const amSteps = [cleanser, serum, spf || moisturizer]
    .filter(Boolean)
    .slice(0, 3)
    .map((product, index) => ({
      step: index + 1,
      action:
        index === 0 ? "Nettoyer" : index === 1 ? "Traiter" : "Proteger/Hydrater",
      product,
    }));

  const pmSteps = [cleanser, serum, moisturizer]
    .filter(Boolean)
    .slice(0, 3)
    .map((product, index) => ({
      step: index + 1,
      action: index === 0 ? "Nettoyer" : index === 1 ? "Traiter" : "Hydrater",
      product,
    }));

  const selection = [
    ...amSteps.map((item) => item.product),
    ...pmSteps.map((item) => item.product),
  ].filter(Boolean) as ConciergeProduct[];

  const uniqueProducts = Array.from(
    new Map(selection.map((product) => [product.id, product])).values()
  );

  return {
    skinType: args.skinType || "non precise",
    concerns,
    timeOfDay: args.timeOfDay || "both",
    am: args.timeOfDay === "PM" ? [] : amSteps,
    pm: args.timeOfDay === "AM" ? [] : pmSteps,
    products: uniqueProducts,
  };
}

async function loadPersistedCart(sessionId: string): Promise<CartLine[]> {
  const conn = await db.getDb();
  if (!conn) return inMemoryCarts.get(sessionId) || [];

  try {
    const rows = await conn
      .select()
      .from(chatEvents)
      .where(
        and(
          eq(chatEvents.type, "cart_snapshot"),
          like(chatEvents.payload, `%\"sessionId\":\"${escapeLike(sessionId)}\"%`)
        )
      )
      .orderBy(desc(chatEvents.id))
      .limit(1);
    const payload = parseJsonSafely<any>(rows[0]?.payload || "", {});
    const items: CartLine[] = Array.isArray(payload?.items)
      ? payload.items
          .map((item: any) => ({
            productId: Number(item.productId || 0),
            qty: Math.max(1, Number(item.qty || 1)),
            name: String(item.name || ""),
            price: Number(item.price || 0),
            imageUrl: item.imageUrl || null,
            url: String(item.url || ""),
          }))
          .filter((item: any) => item.productId > 0)
      : [];
    if (items.length > 0) inMemoryCarts.set(sessionId, items);
    return items;
  } catch {
    return inMemoryCarts.get(sessionId) || [];
  }
}

async function savePersistedCart(
  sessionId: string,
  threadId: number,
  items: CartLine[]
) {
  inMemoryCarts.set(sessionId, items);
  await store.logChatEvent({
    type: "cart_snapshot",
    threadId,
    payload: {
      sessionId,
      items,
      totalItems: items.reduce((sum, item) => sum + item.qty, 0),
      totalAmount: items.reduce((sum, item) => sum + item.price * item.qty, 0),
    },
  });
}

async function addToCartTool(args: {
  sessionId?: string;
  productId?: number;
  qty?: number;
  threadId: number;
}) {
  const sessionId = String(args.sessionId || "").trim();
  const productId = Number(args.productId || 0);
  const qty = Math.max(1, Math.floor(Number(args.qty || 1)));
  if (!sessionId || productId <= 0) {
    return { ok: false, message: "sessionId and productId are required." };
  }

  const product = await db.getProductById(productId);
  if (!product) return { ok: false, message: "Product not found." };
  const mapped = mapProduct(product);

  const current = await loadPersistedCart(sessionId);
  const index = current.findIndex((item) => item.productId === productId);
  if (index >= 0) {
    current[index] = {
      ...current[index],
      qty: current[index].qty + qty,
    };
  } else {
    current.push({
      productId: mapped.id,
      qty,
      name: mapped.name,
      price: mapped.price,
      imageUrl: mapped.imageUrl,
      url: mapped.url,
    });
  }
  await savePersistedCart(sessionId, args.threadId, current);
  return {
    ok: true,
    cart: current,
    totalItems: current.reduce((sum, item) => sum + item.qty, 0),
    totalAmount: current.reduce((sum, item) => sum + item.price * item.qty, 0),
  };
}

async function getCartTool(sessionId: string) {
  if (!sessionId.trim()) {
    return { ok: false, message: "sessionId is required.", cart: [] };
  }
  const cart = await loadPersistedCart(sessionId);
  return {
    ok: true,
    cart,
    totalItems: cart.reduce((sum, item) => sum + item.qty, 0),
    totalAmount: cart.reduce((sum, item) => sum + item.price * item.qty, 0),
  };
}

async function trackOrderTool(args: { orderId?: string; phone?: string }) {
  const orderId = String(args.orderId || "").trim();
  const phone = String(args.phone || "").trim();
  const normalizedPhone = phone.replace(/[^\d]/g, "");

  if (!orderId || normalizedPhone.length < 8) {
    return {
      found: false,
      message:
        "Pour securiser le suivi, partagez votre numero de commande ET le numero de telephone utilise a la commande.",
    };
  }

  let order: any = null;
  if (/^\d+$/.test(orderId)) {
    order = await db.getOrderById(Number(orderId));
  }
  if (!order) {
    order = await db.getOrderByNumber(orderId);
  }
  if (!order) {
    return { found: false, message: "Commande introuvable." };
  }

  const orderPhone = String(order.customerPhone || "").replace(/[^\d]/g, "");
  if (!orderPhone || !orderPhone.includes(normalizedPhone)) {
    return {
      found: false,
      message: "Numero de telephone non associe a cette commande.",
    };
  }

  return {
    found: true,
    orders: [
      {
        id: Number(order.id),
        orderNumber: String(order.orderNumber || ""),
        status: String(order.status || ""),
        paymentStatus: String(order.paymentStatus || ""),
        totalAmount: Number(order.totalAmount || 0),
        customerPhone: String(order.customerPhone || ""),
        createdAt: new Date(order.createdAt || Date.now()).toISOString(),
      },
    ],
  };
}

async function estimateShippingTool(args: {
  city?: string;
  zoneId?: number;
  cartTotalWeight?: number;
}) {
  const zones = await db.getDeliveryZones();
  let zone = null as any;

  if (args.zoneId != null && Number(args.zoneId) > 0) {
    zone = zones.find((item: any) => Number(item.id) === Number(args.zoneId)) || null;
  }

  if (!zone && args.city) {
    const needle = normalize(args.city);
    zone =
      zones.find((item: any) => {
        const corpus = normalize(`${item.name || ""} ${item.slug || ""} ${item.description || ""}`);
        return corpus.includes(needle);
      }) || null;
  }

  if (!zone) {
    return {
      found: false,
      message: "Zone de livraison introuvable.",
      availableZones: zones.slice(0, 8).map((item: any) => ({
        id: Number(item.id),
        name: String(item.name || ""),
      })),
    };
  }

  const rates = await db.listShippingRates(Number(zone.id));
  const activeRate = rates.find((rate) => rate.isActive) || rates[0] || null;
  const baseFee = activeRate ? Number(activeRate.feeCfa || 0) : Number(zone.deliveryFee || 0);
  const weight = Number(args.cartTotalWeight || 0);
  const surcharge = weight > 1 ? Math.ceil((weight - 1) * 500) : 0;
  const feeCfa = baseFee + surcharge;

  return {
    found: true,
    zone: {
      id: Number(zone.id),
      name: String(zone.name || ""),
      slug: String(zone.slug || ""),
    },
    feeCfa,
    etaMinHours: activeRate ? Number(activeRate.etaMinHours || 24) : Number(zone.deliveryDays || 1) * 24,
    etaMaxHours: activeRate ? Number(activeRate.etaMaxHours || 48) : Number(zone.deliveryDays || 2) * 24,
  };
}

function getPoliciesTool(settings: ConciergeSettings) {
  return {
    return: settings.policies.return,
    delivery: settings.policies.delivery,
    payment: settings.policies.payment,
  };
}

function handoffToWhatsAppTool(
  settings: ConciergeSettings,
  args: { reason?: string; summary?: string }
) {
  const number = sanitizeWhatsappNumber(settings.whatsappNumber);
  const reason = String(args.reason || "Support").trim();
  const summary = String(args.summary || "").trim();
  const message = summary
    ? `Bonjour, j'ai besoin d'une assistance humaine.\nRaison: ${reason}\nResume: ${summary}`
    : `Bonjour, j'ai besoin d'une assistance humaine.\nRaison: ${reason}`;
  return {
    whatsappUrl: number
      ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
      : null,
    message,
  };
}

async function executeTool(
  name: string,
  rawArgs: Record<string, unknown>,
  context: {
    sessionId: string;
    threadId: number;
    settings: ConciergeSettings;
  }
) {
  switch (name) {
    case "searchProducts": {
      const result = await searchProductsTool({
        query: typeof rawArgs.query === "string" ? rawArgs.query : "",
        category: typeof rawArgs.category === "string" ? rawArgs.category : undefined,
        concern: typeof rawArgs.concern === "string" ? rawArgs.concern : undefined,
        skinType: typeof rawArgs.skinType === "string" ? rawArgs.skinType : undefined,
        priceMax:
          typeof rawArgs.priceMax === "number"
            ? rawArgs.priceMax
            : typeof rawArgs.priceMax === "string"
              ? Number(rawArgs.priceMax)
              : undefined,
      });
      return { result, products: result };
    }
    case "getProductById": {
      const result = await getProductByIdTool(Number(rawArgs.id || 0));
      return { result, products: result ? [result] : [] };
    }
    case "recommendRoutine": {
      const routine = await recommendRoutineTool({
        skinType: typeof rawArgs.skinType === "string" ? rawArgs.skinType : undefined,
        concerns: Array.isArray(rawArgs.concerns)
          ? rawArgs.concerns.map((item) => String(item))
          : undefined,
        budget:
          typeof rawArgs.budget === "number"
            ? rawArgs.budget
            : typeof rawArgs.budget === "string"
              ? Number(rawArgs.budget)
              : undefined,
        timeOfDay:
          rawArgs.timeOfDay === "AM" || rawArgs.timeOfDay === "PM" || rawArgs.timeOfDay === "both"
            ? rawArgs.timeOfDay
            : undefined,
      });
      return { result: routine, products: routine.products || [] };
    }
    case "addToCart": {
      const result = await addToCartTool({
        sessionId:
          typeof rawArgs.sessionId === "string" && rawArgs.sessionId.trim().length > 0
            ? rawArgs.sessionId
            : context.sessionId,
        productId: Number(rawArgs.productId || 0),
        qty:
          typeof rawArgs.qty === "number"
            ? rawArgs.qty
            : typeof rawArgs.qty === "string"
              ? Number(rawArgs.qty)
              : undefined,
        threadId: context.threadId,
      });
      return { result, products: [] };
    }
    case "getCart": {
      const result = await getCartTool(
        typeof rawArgs.sessionId === "string" && rawArgs.sessionId.trim().length > 0
          ? rawArgs.sessionId
          : context.sessionId
      );
      return { result, products: [] };
    }
    case "trackOrder": {
      const result = await trackOrderTool({
        orderId: typeof rawArgs.orderId === "string" ? rawArgs.orderId : undefined,
        phone: typeof rawArgs.phone === "string" ? rawArgs.phone : undefined,
      });
      return { result, products: [] };
    }
    case "estimateShipping": {
      const result = await estimateShippingTool({
        city: typeof rawArgs.city === "string" ? rawArgs.city : undefined,
        zoneId:
          typeof rawArgs.zoneId === "number"
            ? rawArgs.zoneId
            : typeof rawArgs.zoneId === "string"
              ? Number(rawArgs.zoneId)
              : undefined,
        cartTotalWeight:
          typeof rawArgs.cartTotalWeight === "number"
            ? rawArgs.cartTotalWeight
            : typeof rawArgs.cartTotalWeight === "string"
              ? Number(rawArgs.cartTotalWeight)
              : undefined,
      });
      return { result, products: [] };
    }
    case "getPolicies": {
      return { result: getPoliciesTool(context.settings), products: [] };
    }
    case "handoffToWhatsApp": {
      return {
        result: handoffToWhatsAppTool(context.settings, {
          reason: typeof rawArgs.reason === "string" ? rawArgs.reason : undefined,
          summary: typeof rawArgs.summary === "string" ? rawArgs.summary : undefined,
        }),
        products: [],
      };
    }
    default:
      return {
        result: {
          ok: false,
          message: `Unknown tool ${name}`,
        },
        products: [],
      };
  }
}

function buildMedicalDisclaimer(locale: string) {
  return locale.startsWith("fr")
    ? "Important: je ne suis pas medecin. Consultez un pharmacien ou un dermatologue pour un avis adapte."
    : "Important: I am not a doctor. Please consult a pharmacist or dermatologist.";
}

function buildFallbackResponse(input: ConciergeRunInput, kbAnswer: string | null) {
  const text = input.message.trim();
  const normalized = normalize(text);
  const isFr = isFrenchLocale(input.locale);

  if (hasAnyKeyword(text, profanityTerms)) {
    return formatConciergeOutput({
      locale: input.locale,
      summary: isFr
        ? "Je suis la pour vous aider rapidement."
        : "I am here to help you quickly.",
      routineLines: [
        isFr
          ? "Assistance disponible: routine, suivi commande, livraison, support."
          : "Available support: routine, order tracking, delivery, support.",
      ],
      nextAction: isFr
        ? "Dites-moi votre besoin principal en une phrase."
        : "Tell me your main need in one sentence.",
    });
  }

  if (hasAnyKeyword(text, frustrationTerms)) {
    return formatConciergeOutput({
      locale: input.locale,
      summary: isFr
        ? "Je priorise votre demande tout de suite."
        : "I am prioritizing your request now.",
      routineLines: [
        isFr
          ? "Je peux vous assister ici ou vous passer a un conseiller humain."
          : "I can assist here or transfer you to a human advisor.",
      ],
      nextAction: isFr
        ? "Souhaitez-vous que je vous transfere sur WhatsApp ?"
        : "Would you like me to transfer you to WhatsApp?",
    });
  }

  if (kbAnswer && !/routine|produit|commande|order|tracking|cart|panier/.test(normalized)) {
    return formatConciergeOutput({
      locale: input.locale,
      summary: isFr ? "Voici l'information essentielle." : "Here is the key information.",
      routineLines: [kbAnswer],
      nextAction: isFr
        ? "Souhaitez-vous voir des produits adaptes maintenant ?"
        : "Would you like to see matching products now?",
    });
  }

  if (/commande|tracking|suivi|order/.test(normalized)) {
    return formatConciergeOutput({
      locale: input.locale,
      summary: isFr
        ? "Je peux verifier votre commande de facon securisee."
        : "I can verify your order securely.",
      questions: [
        isFr ? "Numero de commande (ex: SBP-1234) ?" : "Order number (e.g. SBP-1234)?",
        isFr
          ? "Numero de telephone utilise a la commande ?"
          : "Phone number used at checkout?",
      ],
      routineLines: [
        isFr
          ? "Je ne partage aucun statut sans ces 2 informations."
          : "I do not share status without these 2 details.",
      ],
      nextAction: isFr
        ? "Envoyez numero de commande + telephone."
        : "Send order number + phone.",
    });
  }

  if (/routine|peau|serum|spf|acne|tache|hydrat/.test(normalized)) {
    return formatConciergeOutput({
      locale: input.locale,
      summary: isFr
        ? "Je peux vous preparer une routine courte et performante."
        : "I can prepare a short high-performance routine.",
      questions: [
        isFr
          ? "Type de peau: grasse, seche, mixte, sensible ou normale ?"
          : "Skin type: oily, dry, combination, sensitive, or normal?",
        isFr
          ? "Preoccupation principale: acne, taches, eclat, hydratation, anti-age, SPF ?"
          : "Main concern: acne, dark spots, glow, hydration, anti-aging, SPF?",
        isFr
          ? "Budget max (CFA) + preference: routine simple ou complete ?"
          : "Max budget (CFA) + preference: simple or complete routine?",
      ],
      routineLines: [
        isFr
          ? "AM (max 3): Nettoyant doux / Serum cible / SPF 50."
          : "AM (max 3): Gentle cleanser / Target serum / SPF 50.",
        isFr
          ? "PM (max 3): Nettoyant / Traitement / Hydratant."
          : "PM (max 3): Cleanser / Treatment / Moisturizer.",
        isFr
          ? "Option premium et option budget disponibles."
          : "Premium and budget options available.",
      ],
      nextAction: isFr
        ? "Donnez votre budget max CFA et je prepare votre routine."
        : "Share your max CFA budget and I will prepare your routine.",
    });
  }

  return formatConciergeOutput({
    locale: input.locale,
    summary: isFr
      ? "Je vous accompagne sur skincare, commande, livraison et support."
      : "I can support skincare, order tracking, delivery, and support.",
    questions: [
      isFr
        ? "Type de peau: grasse, seche, mixte, sensible ou normale ?"
        : "Skin type: oily, dry, combination, sensitive, or normal?",
      isFr
        ? "Preoccupation principale: acne, taches, eclat, hydratation, anti-age, SPF ?"
        : "Main concern: acne, dark spots, glow, hydration, anti-aging, SPF?",
      isFr
        ? "Budget max (CFA) + routine simple ou complete ?"
        : "Max budget (CFA) + simple or complete routine?",
    ],
    nextAction: isFr
      ? "Repondez a ces 3 points pour une recommandation precise."
      : "Reply to these 3 points for a precise recommendation.",
  });
}

export async function runConcierge(
  input: ConciergeRunInput,
  handlers: {
    onDelta: (chunk: string) => void;
  }
): Promise<ConciergeRunOutput> {
  if (hasAnyKeyword(input.message, profanityTerms)) {
    const moderated = formatConciergeOutput({
      locale: input.locale,
      summary: isFrenchLocale(input.locale)
        ? "Je suis la pour vous aider rapidement."
        : "I am here to help you quickly.",
      routineLines: [
        isFrenchLocale(input.locale)
          ? "Restons respectueux pour avancer efficacement."
          : "Let us keep it respectful so we can move fast.",
      ],
      nextAction: isFrenchLocale(input.locale)
        ? "Donnez votre besoin principal en une phrase."
        : "Share your main need in one sentence.",
    });
    const chunks = moderated.split(/(\s+)/).filter(Boolean);
    for (const chunk of chunks) {
      handlers.onDelta(chunk);
      await new Promise((resolve) => setTimeout(resolve, 8));
    }
    return {
      content: moderated,
      recommendedProducts: [],
      quickReplies: [...FALLBACK_QUICK_REPLIES],
      toolCalls: [],
    };
  }

  const kbArticle = await store.findBestKbAnswer(input.message, input.locale);
  const kbAnswer = kbArticle?.content || null;

  const toolCalls: ConciergeToolCallLog[] = [];
  let recommendedProducts: ConciergeProduct[] = [];
  let content = "";

  const policiesText = [
    `Return: ${input.settings.policies.return}`,
    `Delivery: ${input.settings.policies.delivery}`,
    `Payment: ${input.settings.policies.payment}`,
  ].join("\n");

  const conversation = input.history
    .slice(-10)
    .map((item) => ({
      role: item.role,
      content: item.content,
    })) as Array<{ role: "user" | "assistant"; content: string }>;

  const systemPrompt = buildSystemPrompt({
    locale: input.locale,
    settings: input.settings,
    policiesText: kbAnswer
      ? `${policiesText}\n\nKB candidate:\n${kbAnswer}`
      : policiesText,
  });

  if (!ENV.openAiApiKey) {
    content = buildFallbackResponse(input, kbAnswer);

    if (/routine|spf|serum|acne|tache|produit|product/.test(normalize(input.message))) {
      const products = await searchProductsTool({
        query: input.message,
      });
      recommendedProducts = products.slice(0, 3);
      if (recommendedProducts.length > 0) {
        content = `${content}\n\nProduits suggeres:\n${productListToText(recommendedProducts)}`;
      }
    }

    if (hasAnyKeyword(input.message, medicalTerms)) {
      content = `${content}\n\n${buildMedicalDisclaimer(input.locale)}`;
    }

    const chunks = content.split(/(\s+)/).filter(Boolean);
    for (const chunk of chunks) {
      handlers.onDelta(chunk);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    return {
      content,
      recommendedProducts,
      quickReplies: [...FALLBACK_QUICK_REPLIES],
      toolCalls,
    };
  }

  const baseMessages: OpenAiMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversation.map((item) => ({
      role: item.role,
      content: item.content,
    })),
    { role: "user", content: input.message },
  ];

  try {
    const planning = await openAiJsonCompletion({
      model: ENV.openAiModel || "gpt-4o-mini",
      temperature: 0.3,
      messages: baseMessages,
      tools: createToolSpecs(),
      tool_choice: "auto",
    });

    const planningMessage = planning?.choices?.[0]?.message || null;
    const rawToolCalls = Array.isArray(planningMessage?.tool_calls)
      ? planningMessage.tool_calls
      : [];

    const finalMessages: OpenAiMessage[] = [...baseMessages];

    if (rawToolCalls.length > 0) {
      finalMessages.push({
        role: "assistant",
        content:
          typeof planningMessage?.content === "string" ? planningMessage.content : "",
        tool_calls: rawToolCalls,
      });

      for (const rawCall of rawToolCalls.slice(0, 6)) {
        const name = String(rawCall?.function?.name || "");
        const args = parseJsonSafely<Record<string, unknown>>(
          rawCall?.function?.arguments || "{}",
          {}
        );
        if (!allowedToolNames.has(name)) {
          toolCalls.push({
            name,
            args,
            result: {
              ok: false,
              message: `Blocked tool ${name}`,
            },
          });
          continue;
        }
        const executed = await executeTool(name, args, {
          sessionId: input.sessionId,
          threadId: input.threadId,
          settings: input.settings,
        });

        if (executed.products.length > 0) {
          const merged = [
            ...recommendedProducts,
            ...executed.products,
          ];
          recommendedProducts = Array.from(
            new Map(merged.map((product) => [product.id, product])).values()
          ).slice(0, 6);
        }

        toolCalls.push({
          name,
          args,
          result: executed.result,
        });

        finalMessages.push({
          role: "tool",
          tool_call_id: String(rawCall.id),
          content: JSON.stringify(executed.result),
        });
      }
    }

    const streamed = await openAiStreamCompletion(
      {
        model: ENV.openAiModel || "gpt-4o-mini",
        temperature: 0.35,
        messages: rawToolCalls.length > 0 ? finalMessages : baseMessages,
      },
      handlers.onDelta
    );
    content = streamed?.trim() || "";

    if (!content && typeof planningMessage?.content === "string") {
      content = planningMessage.content.trim();
      if (content) handlers.onDelta(content);
    }
  } catch (error) {
    console.error("[Chatbot][OpenAI] failed, falling back:", error);
    content = buildFallbackResponse(input, kbAnswer);
    const chunks = content.split(/(\s+)/).filter(Boolean);
    for (const chunk of chunks) {
      handlers.onDelta(chunk);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  if (hasAnyKeyword(input.message, medicalTerms) && !normalize(content).includes("pas medecin")) {
    const disclaimer = buildMedicalDisclaimer(input.locale);
    handlers.onDelta(`\n\n${disclaimer}`);
    content = `${content}\n\n${disclaimer}`;
  }

  if (!/(👉|prochaine etape|next step|next action|action suivante)/i.test(content)) {
    const isFr = isFrenchLocale(input.locale);
    const nextAction = recommendedProducts.length
      ? isFr
        ? "👉 Prochaine étape: je vous propose 3 produits. Vous voulez budget ou premium ?"
        : "👉 Next step: I can shortlist 3 products. Do you want budget or premium?"
      : isFr
        ? "👉 Prochaine étape: souhaitez-vous continuer ici ou passer sur WhatsApp ?"
        : "👉 Next step: would you like to continue here or switch to WhatsApp?";
    handlers.onDelta(`\n\n${nextAction}`);
    content = `${content}\n\n${nextAction}`;
  }

  return {
    content,
    recommendedProducts: recommendedProducts.slice(0, 3),
    quickReplies: [...FALLBACK_QUICK_REPLIES],
    toolCalls,
  };
}
