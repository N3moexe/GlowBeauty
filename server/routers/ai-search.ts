import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { invokeLLM } from "../_core/llm";
import * as db from "../db";

export const aiSearchRouter = router({
  /**
   * Natural language search with AI intent understanding
   */
  intelligentSearch: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().default(20),
    }))
    .query(async ({ input }: any) => {
      try {
        // Use LLM to understand search intent
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "Extract search intent and keywords. Return JSON with 'intent' and 'keywords' array.",
            },
            {
              role: "user",
              content: input.query,
            },
          ],
        });

        let searchData = { intent: "general", keywords: [input.query] };

        try {
          const content = response.choices[0].message.content;
          if (typeof content === "string") {
            searchData = JSON.parse(content);
          }
        } catch (e) {
          // Use fallback
        }

        // Search products using keywords
        const result = await db.getProducts({
          search: searchData.keywords.join(" "),
          limit: input.limit,
        });

        return {
          query: input.query,
          intent: searchData.intent,
          keywords: searchData.keywords,
          products: result.products || [],
          count: (result.products || []).length,
        };
      } catch (error) {
        // Fallback to basic search
        const result = await db.getProducts({
          search: input.query,
          limit: input.limit,
        });

        return {
          query: input.query,
          intent: "search",
          keywords: [input.query],
          products: result.products || [],
          count: (result.products || []).length,
        };
      }
    }),

  /**
   * Get search suggestions with autocomplete
   */
  getSearchSuggestions: publicProcedure
    .input(z.object({
      query: z.string().min(2),
      limit: z.number().default(5),
    }))
    .query(async ({ input }: any) => {
      try {
        const result = await db.getProducts({
          search: input.query,
          limit: 50,
        });

        const suggestions = new Set<string>();
        (result.products || []).forEach((p: any) => {
          if (p.name.toLowerCase().includes(input.query.toLowerCase())) {
            suggestions.add(p.name);
          }
        });

        return Array.from(suggestions).slice(0, input.limit);
      } catch (error) {
        return [];
      }
    }),

  /**
   * Get trending searches
   */
  getTrendingSearches: publicProcedure
    .query(async () => {
      try {
        // Return popular categories as trending searches
        const categories = await db.getAllCategories();
        return (categories || []).slice(0, 5).map((c: any) => c.name);
      } catch (error) {
        return [];
      }
    }),
});
