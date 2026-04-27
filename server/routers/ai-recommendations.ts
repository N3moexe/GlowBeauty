import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { invokeLLM } from "../_core/llm";
import * as db from "../db";

export const aiRecommendationsRouter = router({
  /**
   * Get personalized product recommendations
   */
  getRecommendations: publicProcedure
    .input(z.object({
      productId: z.number().optional(),
      categoryId: z.number().optional(),
      limit: z.number().default(8),
    }))
    .query(async ({ input }: any) => {
      try {
        // Get products from the same category or all products
        const result = await db.getProducts({
          categoryId: input.categoryId,
          limit: input.limit * 2,
        });

        let products = result.products || [];

        // Filter out the current product if specified
        if (input.productId) {
          products = products.filter((p: any) => p.id !== input.productId);
        }

        // Shuffle and limit
        const shuffled = products
          .sort(() => Math.random() - 0.5)
          .slice(0, input.limit);

        return {
          recommendations: shuffled,
          count: shuffled.length,
        };
      } catch (error) {
        return {
          recommendations: [],
          count: 0,
        };
      }
    }),

  /**
   * Get "customers also bought" recommendations
   */
  getAlsoBought: publicProcedure
    .input(z.object({
      productId: z.number(),
      limit: z.number().default(5),
    }))
    .query(async ({ input }: any) => {
      try {
        const product = await db.getProductById(input.productId);
        if (!product) return { products: [], count: 0 };

        // Get related products from the same category
        const related = await db.getRelatedProducts(
          product.categoryId,
          input.productId,
          input.limit
        );

        return {
          products: related || [],
          count: (related || []).length,
        };
      } catch (error) {
        return {
          products: [],
          count: 0,
        };
      }
    }),

  /**
   * Get AI-powered product suggestions based on user preferences
   */
  getSuggestedProducts: publicProcedure
    .input(z.object({
      preferences: z.string(),
      limit: z.number().default(10),
    }))
    .query(async ({ input }: any) => {
      try {
        // Get all products
        const result = await db.getProducts({ limit: 100 });
        const allProducts = result.products || [];

        // Use LLM to score products based on preferences
        const productList = allProducts
          .slice(0, 20)
          .map((p: any) => `${p.name} - ${p.description || ""}`)
          .join("\n");

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "You are a product recommendation expert. Given user preferences and a list of products, recommend the best matching products. Return a JSON array with product names in order of relevance.",
            },
            {
              role: "user",
              content: `User preferences: ${input.preferences}\n\nAvailable products:\n${productList}\n\nReturn JSON array of product names.`,
            },
          ],
        });

        // Parse recommendations
        try {
          const content = response.choices[0].message.content;
          const recommendations = JSON.parse(
            typeof content === "string" ? content : ""
          );
          const recommendedProducts = allProducts.filter((p: any) =>
            Array.isArray(recommendations) &&
            recommendations.some(
              (r: any) =>
                (typeof r === "string" && p.name.includes(r)) ||
                (typeof r === "object" && r.name === p.name)
            )
          );

          return {
            suggestions: recommendedProducts.slice(0, input.limit),
            count: recommendedProducts.length,
          };
        } catch (e) {
          // Fallback to random products
          const random = allProducts.sort(() => Math.random() - 0.5);
          return {
            suggestions: random.slice(0, input.limit),
            count: random.length,
          };
        }
      } catch (error) {
        return {
          suggestions: [],
          count: 0,
        };
      }
    }),
});
