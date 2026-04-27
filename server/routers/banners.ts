import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as bannerDb from "../db-banners";
import { TRPCError } from "@trpc/server";

export const bannersRouter = router({
  /**
   * Get active banners for a specific page
   */
  getForPage: publicProcedure
    .input(z.object({
      page: z.enum(["homepage", "shop", "all"]).default("all"),
      position: z.enum(["top", "bottom", "sidebar", "hero", "custom"]).optional(),
    }))
    .query(async ({ input }) => {
      try {
        console.info("[Banners] getForPage", { page: input.page, position: input.position ?? "all" });
        let banners = await bannerDb.getBannersForPage(input.page);
        
        if (input.position) {
          banners = banners.filter((b) => b.position === input.position);
        }

        return {
          count: banners.length,
          banners,
        };
      } catch (error) {
        console.error("[tRPC] Failed to get banners:", error);
        return { count: 0, banners: [] };
      }
    }),

  /**
   * Get banners by position
   */
  getByPosition: publicProcedure
    .input(z.object({
      position: z.enum(["top", "bottom", "sidebar", "hero", "custom"]),
    }))
    .query(async ({ input }) => {
      try {
        const banners = await bannerDb.getBannersByPosition(input.position);
        return {
          count: banners.length,
          banners,
        };
      } catch (error) {
        console.error("[tRPC] Failed to get banners by position:", error);
        return { count: 0, banners: [] };
      }
    }),

  /**
   * Get all active banners
   */
  getActive: publicProcedure
    .query(async () => {
      try {
        const banners = await bannerDb.getActiveBanners();
        return {
          count: banners.length,
          banners,
        };
      } catch (error) {
        console.error("[tRPC] Failed to get active banners:", error);
        return { count: 0, banners: [] };
      }
    }),

  /**
   * Admin: Get all banners
   */
  getAll: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      try {
        const banners = await bannerDb.getAllBanners();
        return {
          count: banners.length,
          banners,
        };
      } catch (error) {
        console.error("[tRPC] Failed to get all banners:", error);
        return { count: 0, banners: [] };
      }
    }),

  /**
   * Admin: Get banner by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      try {
        const banner = await bannerDb.getBannerById(input.id);
        return banner || null;
      } catch (error) {
        console.error("[tRPC] Failed to get banner:", error);
        return null;
      }
    }),

  /**
   * Admin: Create banner
   */
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      imageUrl: z
        .string()
        .refine(
          val =>
            val.startsWith("http://") ||
            val.startsWith("https://") ||
            val.startsWith("data:image/"),
          "Image URL must be http(s) or data:image/*"
        )
        .optional(),
      backgroundColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
      textColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
      buttonText: z.string().max(100).optional(),
      buttonLink: z.string().refine(
        (val) => !val || val.startsWith('/') || val.startsWith('http'),
        'Must be a relative path (e.g., /shop) or full URL'
      ).optional(),
      position: z.enum(["top", "bottom", "sidebar", "hero", "custom"]).default("top"),
      displayOn: z.enum(["homepage", "shop", "all", "custom"]).default("all"),
      layout: z.enum(["full-width", "centered", "side-by-side", "overlay"]).default("full-width"),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      try {
        console.info("[Banners] create request", {
          userId: ctx.user.id,
          title: input.title,
          position: input.position,
          displayOn: input.displayOn,
          isActive: true,
        });
        const banner = await bannerDb.createBanner({
          ...input,
          isActive: true,
        });

        if (!banner) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "La banniere n'a pas pu etre enregistree." });
        }

        console.info("[Banners] created", { id: banner.id, title: banner.title, isActive: banner.isActive });
        return banner;
      } catch (error) {
        console.error("[tRPC] Failed to create banner:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erreur serveur lors de la creation de la banniere." });
      }
    }),

  /**
   * Admin: Update banner
   */
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      imageUrl: z
        .string()
        .refine(
          val =>
            val.startsWith("http://") ||
            val.startsWith("https://") ||
            val.startsWith("data:image/"),
          "Image URL must be http(s) or data:image/*"
        )
        .optional(),
      backgroundColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
      textColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
      buttonText: z.string().max(100).optional(),
      buttonLink: z.string().refine(
        (val) => !val || val.startsWith('/') || val.startsWith('http'),
        'Must be a relative path (e.g., /shop) or full URL'
      ).optional(),
      position: z.enum(["top", "bottom", "sidebar", "hero", "custom"]).optional(),
      displayOn: z.enum(["homepage", "shop", "all", "custom"]).optional(),
      layout: z.enum(["full-width", "centered", "side-by-side", "overlay"]).optional(),
      isActive: z.boolean().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      try {
        const { id, ...data } = input;
        console.info("[Banners] update request", { userId: ctx.user.id, id, data });
        const banner = await bannerDb.updateBanner(id, data);

        if (!banner) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Banner not found" });
        }

        return banner;
      } catch (error) {
        console.error("[tRPC] Failed to update banner:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erreur serveur lors de la mise a jour de la banniere." });
      }
    }),

  /**
   * Admin: Delete banner
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      try {
        console.info("[Banners] delete request", { userId: ctx.user.id, id: input.id });
        const success = await bannerDb.deleteBanner(input.id);

        if (!success) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Banner not found" });
        }

        return { success: true };
      } catch (error) {
        console.error("[tRPC] Failed to delete banner:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erreur serveur lors de la suppression de la banniere." });
      }
    }),

  /**
   * Admin: Toggle banner active status
   */
  toggleActive: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      try {
        console.info("[Banners] toggleActive request", { userId: ctx.user.id, id: input.id });
        const banner = await bannerDb.toggleBannerStatus(input.id);

        if (!banner) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Banner not found" });
        }

        console.info("[Banners] toggled", { id: banner.id, isActive: banner.isActive });
        return banner;
      } catch (error) {
        console.error("[tRPC] Failed to toggle banner status:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erreur serveur lors du changement de statut." });
      }
    }),
});
