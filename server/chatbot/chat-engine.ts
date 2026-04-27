import type { ChatMessageRequest, ChatSettings } from "@shared/chatbot";
import {
  createSupportTicketTool,
  getFaqAnswerTool,
  getOrderStatusTool,
  getShippingOptionsTool,
  searchProductsTool,
  type ProductToolResult,
} from "./tools";
import { generateLlmReply } from "./llm-adapter";
import * as store from "./store";

type EngineContext = {
  threadId: number;
  settings: ChatSettings;
  history: Array<{ role: "user" | "assistant"; content: string }>;
};

export type EngineOutput = {
  content: string;
  quickReplies: string[];
  recommendedProducts: ProductToolResult[];
  ticketId: number | null;
  intent: string;
  suggestedWhatsAppHandoff: boolean;
  metadata: Record<string, unknown>;
};

const profanityList = [
  "fuck",
  "shit",
  "merde",
  "pute",
  "salope",
  "connard",
  "batard",
  "fdp",
];

const medicalKeywords = [
  "eczema",
  "psoriasis",
  "allergie",
  "allergique",
  "enceinte",
  "grossesse",
  "dermatite",
  "mycose",
  "infection",
  "cancer",
];

function normalize(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function containsProfanity(input: string) {
  const value = normalize(input);
  return profanityList.some(term => value.includes(term));
}

function isMedicalQuestion(input: string) {
  const value = normalize(input);
  return medicalKeywords.some(term => value.includes(term));
}

function detectIntent(input: string): EngineOutput["intent"] {
  const value = normalize(input);
  if (/ticket|support|agent|humain|human|whatsapp|conseiller|service client/.test(value)) {
    return "escalation";
  }
  if (/commande|order|suivi|tracking|sbp[-#]?\d+|\b77\d{7}\b|\b7\d{8}\b/.test(value)) {
    return "order_tracking";
  }
  if (/livraison|shipping|delai|frais de livraison|zone|expedition/.test(value)) {
    return "shipping";
  }
  if (/produit|serum|creme|routine|recommande|recommandation|peau|acne|tache|hydrat/.test(value)) {
    return "product";
  }
  return "faq";
}

function buildDisclaimer(locale: string) {
  if (locale.startsWith("fr")) {
    return "Important: je ne suis pas medecin. Pour un avis medical adapte a votre situation, consultez un dermatologue ou votre pharmacien.";
  }
  return "Important: I am not a doctor. For medical advice, please consult a pharmacist or dermatologist.";
}

function buildQuickReplies(intent: EngineOutput["intent"]): string[] {
  if (intent === "product") {
    return [
      "Routine peau grasse",
      "Routine anti-taches",
      "Produits peau sensible",
      "Parler a un humain",
    ];
  }
  if (intent === "order_tracking") {
    return [
      "Suivre avec numero commande",
      "Suivre avec numero telephone",
      "Delais de livraison",
      "Parler a un humain",
    ];
  }
  if (intent === "shipping") {
    return [
      "Frais Dakar centre",
      "Delai banlieue",
      "Modes de paiement",
      "Parler a un humain",
    ];
  }
  return ["Produits recommandes", "Suivi commande", "Livraison", "Parler a un humain"];
}

function formatOrderStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: "En attente",
    confirmed: "Confirmee",
    processing: "En preparation",
    shipped: "Expediee",
    delivered: "Livree",
    cancelled: "Annulee",
  };
  return map[status] || status;
}

function formatPaymentStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: "En attente",
    processing: "En cours",
    completed: "Paye",
    failed: "Echec",
  };
  return map[status] || status;
}

function summarizeToolData(data: Record<string, unknown>) {
  return Object.entries(data)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join("\n");
}

function parsePhoneCandidate(input: string) {
  const match = input.replace(/[^\d+]/g, "");
  return match.length >= 8 ? match : undefined;
}

export async function runChatEngine(
  input: ChatMessageRequest,
  context: EngineContext
): Promise<EngineOutput> {
  const locale = input.locale || "fr-SN";
  const enabled = new Set(context.settings.enabledTools || []);
  const text = input.message.trim();
  const intent = detectIntent(text);

  await store.logChatEvent({
    type: "intent_detected",
    threadId: context.threadId,
    payload: { intent },
  });

  if (containsProfanity(text)) {
    const content = locale.startsWith("fr")
      ? "Je peux vous aider, mais restons respectueux pour une assistance rapide. Dites-moi ce que vous cherchez et je m'en occupe."
      : "I can help, but please keep it respectful so I can assist quickly.";
    return {
      content,
      quickReplies: buildQuickReplies("faq"),
      recommendedProducts: [],
      ticketId: null,
      intent: "moderation",
      suggestedWhatsAppHandoff: false,
      metadata: { moderated: true },
    };
  }

  const toolData: Record<string, unknown> = {};
  let recommendedProducts: ProductToolResult[] = [];
  let ticketId: number | null = null;
  let suggestedWhatsAppHandoff = false;

  let faqAnswer: Awaited<ReturnType<typeof getFaqAnswerTool>> | null = null;
  if (enabled.has("getFaqAnswer")) {
    faqAnswer = await getFaqAnswerTool(text, locale);
    if (faqAnswer) {
      toolData.faq = faqAnswer;
    }
  }

  let response = "";
  if (faqAnswer && intent === "faq") {
    response = faqAnswer.answer;
  }

  if (!response && intent === "order_tracking" && enabled.has("getOrderStatus")) {
    const orderResult = await getOrderStatusTool(text);
    toolData.order = orderResult;
    if (!orderResult.found) {
      response =
        locale.startsWith("fr")
          ? "Je peux suivre votre commande. Envoyez le numero de commande (ex: SBP-1234) ou votre numero de telephone utilise a la commande."
          : "I can track your order. Please share your order number or phone used at checkout.";
    } else {
      const lines = orderResult.orders.map(order => {
        return `- ${order.orderNumber}: ${formatOrderStatusLabel(order.status)} | Paiement: ${formatPaymentStatusLabel(order.paymentStatus)} | ${new Intl.NumberFormat("fr-FR").format(order.totalAmount)} CFA`;
      });
      response = [
        locale.startsWith("fr") ? "Voici votre statut de commande :" : "Here is your order status:",
        ...lines,
      ].join("\n");
      suggestedWhatsAppHandoff = true;
    }
  }

  if (!response && intent === "shipping" && enabled.has("getShippingOptions")) {
    const shipping = await getShippingOptionsTool(text);
    toolData.shipping = shipping;
    if (!shipping.found) {
      response =
        locale.startsWith("fr")
          ? "Je n'ai pas trouve votre zone. Donnez-moi votre ville ou quartier (ex: Dakar, Pikine, Rufisque)."
          : "I could not match your delivery zone. Please share your city or area.";
    } else {
      const lines: string[] = [];
      for (const zone of shipping.zones.slice(0, 3)) {
        const bestRate = zone.rates.find(rate => rate.isActive) || zone.rates[0];
        if (bestRate) {
          lines.push(
            `- ${zone.name}: ${new Intl.NumberFormat("fr-FR").format(bestRate.feeCfa)} CFA (${bestRate.etaMinHours}-${bestRate.etaMaxHours}h)`
          );
        } else {
          lines.push(`- ${zone.name}: ${new Intl.NumberFormat("fr-FR").format(zone.deliveryFee)} CFA`);
        }
      }
      response = [
        locale.startsWith("fr")
          ? "Voici les options de livraison disponibles :"
          : "Here are available shipping options:",
        ...lines,
      ].join("\n");
    }
  }

  if (!response && intent === "product" && enabled.has("searchProducts")) {
    recommendedProducts = await searchProductsTool(text, undefined, 3);
    toolData.products = recommendedProducts;
    if (recommendedProducts.length === 0) {
      response =
        locale.startsWith("fr")
          ? "Je n'ai pas trouve de produit correspondant. Dites-moi votre type de peau et objectif (hydratation, anti-taches, anti-imperfections)."
          : "I couldn't find matching products. Tell me your skin type and goal.";
    } else {
      const productLines = recommendedProducts
        .map(item => `- ${item.name} (${new Intl.NumberFormat("fr-FR").format(item.price)} CFA)`)
        .join("\n");
      response = [
        locale.startsWith("fr")
          ? "Je vous recommande ces 3 produits :"
          : "I recommend these 3 products:",
        productLines,
        locale.startsWith("fr")
          ? "Voulez-vous une routine complete matin/soir avec ces options ?"
          : "Would you like a full AM/PM routine with these picks?",
      ].join("\n");
    }
  }

  if (!response && faqAnswer) {
    response = faqAnswer.answer;
  }

  const wantsHuman = /humain|human|agent|whatsapp|support|conseiller|service client/.test(
    normalize(text)
  );
  if (wantsHuman && enabled.has("createSupportTicket")) {
    const ticket = await createSupportTicketTool({
      threadId: context.threadId,
      message: text,
      phone: parsePhoneCandidate(text),
    });
    ticketId = ticket.id;
    suggestedWhatsAppHandoff = true;
    if (!response) {
      response = locale.startsWith("fr")
        ? `C'est note. J'ai ouvert un ticket support #${ticket.id}. Vous pouvez aussi continuer sur WhatsApp pour un traitement prioritaire.`
        : `Done. I opened support ticket #${ticket.id}. You can continue on WhatsApp for priority support.`;
    } else {
      response += locale.startsWith("fr")
        ? `\n\nJ'ai aussi cree un ticket support #${ticket.id} pour suivi humain.`
        : `\n\nI also created support ticket #${ticket.id} for human follow-up.`;
    }
    toolData.ticketId = ticket.id;
  }

  if (!response) {
    response = locale.startsWith("fr")
      ? "Je peux vous aider sur les produits, la livraison, le suivi de commande et le support. Dites-moi votre besoin."
      : "I can help with products, shipping, order tracking, and support.";
  }

  if (isMedicalQuestion(text)) {
    response = `${response}\n\n${buildDisclaimer(locale)}`;
  }

  const llmToolSummary = summarizeToolData(toolData);
  const llmReply = await generateLlmReply({
    locale,
    tone: context.settings.botTone,
    systemPolicy: [
      "When user asks product questions, suggest practical options and avoid medical claims.",
      "When user asks tracking, request order number or phone if missing.",
      "When user asks medical questions, include safety disclaimer.",
      "Use short paragraphs and plain language.",
    ].join("\n"),
    userMessage: text,
    conversationContext: context.history,
    toolSummary: llmToolSummary,
  });
  if (llmReply?.content) {
    response = llmReply.content;
    if (isMedicalQuestion(text) && !normalize(response).includes("pas medecin")) {
      response += `\n\n${buildDisclaimer(locale)}`;
    }
  }

  return {
    content: response,
    quickReplies: buildQuickReplies(intent),
    recommendedProducts,
    ticketId,
    intent,
    suggestedWhatsAppHandoff,
    metadata: {
      usedFaq: Boolean(faqAnswer),
      usedLlm: Boolean(llmReply?.content),
      tools: Object.keys(toolData),
    },
  };
}
