import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { invokeLLM } from "../_core/llm";
import * as db from "../db";
import { TRPCError } from "@trpc/server";

export const aiChatbotRouter = router({
  /**
   * Send message to AI chatbot
   */
  sendMessage: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      message: z.string().min(1),
      customerName: z.string().optional(),
      customerEmail: z.string().email().optional(),
    }))
    .mutation(async ({ input }: any) => {
      try {
        // Build conversation context
        const systemPrompt = `You are a helpful customer support chatbot for SenBonsPlans, an e-commerce platform in Senegal.
You help customers with:
- Product information and recommendations
- Order tracking and status
- Delivery and shipping questions
- Payment methods (Orange Money, Wave, Free Money)
- Returns and refunds
- General inquiries

Be friendly, professional, and helpful. Keep responses concise and in French when appropriate.`;

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: input.message,
            },
          ],
        });

        const assistantMessage =
          typeof response.choices[0].message.content === "string"
            ? response.choices[0].message.content
            : "Je suis désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer.";

        return {
          sessionId: input.sessionId,
          userMessage: input.message,
          assistantMessage,
          timestamp: new Date(),
        };
      } catch (error) {
        return {
          sessionId: input.sessionId,
          userMessage: input.message,
          assistantMessage:
            "Une erreur est survenue. Veuillez réessayer ou contacter notre équipe support.",
          timestamp: new Date(),
        };
      }
    }),

  /**
   * Get FAQ responses
   */
  getFAQResponse: publicProcedure
    .input(z.object({
      question: z.string(),
    }))
    .query(async ({ input }: any) => {
      try {
        const faqs = [
          {
            q: "Quels sont les modes de paiement acceptés?",
            a: "Nous acceptons Orange Money, Wave, Free Money et le paiement à la livraison (cash).",
          },
          {
            q: "Combien de temps prend la livraison?",
            a: "La livraison prend généralement 1-3 jours ouvrables selon votre zone de livraison.",
          },
          {
            q: "Puis-je retourner un produit?",
            a: "Oui, vous pouvez retourner un produit dans les 14 jours suivant la livraison s'il est en bon état.",
          },
          {
            q: "Comment puis-je suivre ma commande?",
            a: "Vous pouvez suivre votre commande en utilisant le numéro de commande sur notre page de suivi.",
          },
          {
            q: "Y a-t-il des frais de livraison?",
            a: "Les frais de livraison dépendent de votre zone. Ils sont calculés automatiquement lors du checkout.",
          },
        ];

        // Find matching FAQ
        const lowerQuestion = input.question.toLowerCase();
        const match = faqs.find(
          (faq) =>
            lowerQuestion.includes(faq.q.toLowerCase().split(" ")[0]) ||
            faq.q.toLowerCase().includes(lowerQuestion.split(" ")[0])
        );

        if (match) {
          return {
            found: true,
            question: match.q,
            answer: match.a,
          };
        }

        return {
          found: false,
          question: input.question,
          answer: null,
        };
      } catch (error) {
        return {
          found: false,
          question: input.question,
          answer: null,
        };
      }
    }),

  /**
   * Get product recommendations from chatbot
   */
  getProductRecommendation: publicProcedure
    .input(z.object({
      preference: z.string(),
      limit: z.number().default(3),
    }))
    .query(async ({ input }: any) => {
      try {
        // Get all products
        const result = await db.getProducts({ limit: 50 });
        const products = result.products || [];

        if (products.length === 0) {
          return {
            recommendations: [],
            message: "Aucun produit disponible pour le moment.",
          };
        }

        // Use LLM to recommend products
        const productList = products
          .slice(0, 20)
          .map((p: any) => `${p.name} (${p.price} CFA)`)
          .join(", ");

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "You are a product recommendation expert. Given customer preferences and available products, recommend the best matching products. Return a JSON object with 'recommendations' array of product names and 'message' with a friendly recommendation message.",
            },
            {
              role: "user",
              content: `Customer preference: ${input.preference}\n\nAvailable products: ${productList}\n\nRecommend ${input.limit} products.`,
            },
          ],
        });

        try {
          const content = response.choices[0].message.content;
          if (typeof content === "string") {
            const data = JSON.parse(content);
            const recommended = products.filter((p: any) =>
              data.recommendations?.some((r: string) =>
                p.name.toLowerCase().includes(r.toLowerCase())
              )
            );

            return {
              recommendations: recommended.slice(0, input.limit),
              message:
                data.message ||
                "Voici nos recommandations pour vous.",
            };
          }
        } catch (e) {
          // Fallback
        }

        return {
          recommendations: products.slice(0, input.limit),
          message: "Voici nos produits populaires.",
        };
      } catch (error) {
        return {
          recommendations: [],
          message: "Je n'ai pas pu récupérer les recommandations.",
        };
      }
    }),

  /**
   * Admin endpoint to get chat analytics
   */
  getChatAnalytics: protectedProcedure
    .query(async ({ ctx }: any) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin access required",
        });
      }

      return {
        totalChats: 0,
        averageResponseTime: "< 1s",
        customerSatisfaction: "N/A",
        message: "Chat analytics would be populated with real data.",
      };
    }),
});
