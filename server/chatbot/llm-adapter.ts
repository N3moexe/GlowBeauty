import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";

export type LlmPromptInput = {
  locale: string;
  tone: "luxury_skincare" | "friendly" | "professional";
  systemPolicy: string;
  userMessage: string;
  conversationContext: Array<{ role: "user" | "assistant"; content: string }>;
  toolSummary?: string;
};

export type LlmReply = {
  content: string;
};

export function isExternalLlmConfigured() {
  return Boolean(ENV.forgeApiKey && ENV.forgeApiKey.trim().length > 0);
}

export async function generateLlmReply(input: LlmPromptInput): Promise<LlmReply | null> {
  if (!isExternalLlmConfigured()) return null;

  const toneLabel =
    input.tone === "luxury_skincare"
      ? "luxury skincare consultant"
      : input.tone === "professional"
        ? "professional support specialist"
        : "friendly beauty assistant";

  const contextWindow = input.conversationContext.slice(-10);
  const messages = [
    {
      role: "system" as const,
      content: [
        `You are SenBonsPlans Concierge, a ${toneLabel} for skincare & essentials in Senegal.`,
        `Default reply language is ${input.locale.startsWith("fr") ? "French" : "English"}; mirror user language (FR/EN).`,
        "Use a premium, elegant, warm, concise style. Keep responses conversion-focused.",
        "Currency is CFA (XOF).",
        "No medical diagnosis. Provide only general skincare guidance.",
        "Never invent product facts, prices, stock, ingredients, delivery rules, or order status.",
        "If product details are required, ask for product name or product ID and say you can check it.",
        "For order tracking requests, ask for BOTH order number/id and phone before status.",
        "If need is unclear, ask only 2-3 quick questions: skin type, main concern, max budget CFA + simple vs complete routine.",
        "Routine recommendations must include AM and PM, max 3 steps each (Nettoyer/Traiter/Proteger) with product category per step.",
        "When possible, include one premium option and one budget option.",
        "If user is frustrated/urgent/needs human support, offer WhatsApp handoff and ask permission.",
        "Always end with ONE clear next action.",
        "Output format in user language:\n✅ Résumé / Summary (1 line)\n🔎 2-3 questions (if needed)\n💎 Routine / recommandations\n👉 Prochaine étape / Next step (1 action)",
        input.systemPolicy,
      ].join("\n"),
    },
    ...contextWindow.map(item => ({
      role: item.role,
      content: item.content,
    })),
    {
      role: "user" as const,
      content: input.toolSummary
        ? `${input.userMessage}\n\nTool data available:\n${input.toolSummary}`
        : input.userMessage,
    },
  ];

  try {
    const response = await invokeLLM({
      messages,
      max_tokens: 450,
    });
    const content = response.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim().length > 0) {
      return { content: content.trim() };
    }
    return null;
  } catch (error) {
    console.error("[Chatbot][LLM] generation failed:", error);
    return null;
  }
}
