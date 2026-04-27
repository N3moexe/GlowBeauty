import { z } from "zod";

export const reviewStatusSchema = z.enum(["pending", "approved", "rejected"]);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

export const reviewImageListSchema = z.array(z.string().trim().max(2000)).max(8);

export const createReviewSchema = z.object({
  productId: z.coerce.number().int().positive(),
  orderId: z.coerce.number().int().positive().optional(),
  customerName: z.string().trim().min(2).max(120),
  customerEmail: z.union([z.string().trim().email().max(320), z.literal("")]).optional(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(255).optional(),
  body: z.string().trim().min(8).max(6000),
  images: reviewImageListSchema.optional(),
  honeypot: z.string().max(0).optional(),
});

export const publicProductReviewsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  cursor: z.coerce.number().int().positive().optional(),
});

export const adminReviewsQuerySchema = z.object({
  status: reviewStatusSchema.optional(),
  productId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(300).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.coerce.number().int().positive().optional(),
});

export const adminReviewUpdateSchema = z
  .object({
    status: reviewStatusSchema.optional(),
    title: z.string().trim().max(255).optional(),
    body: z.string().trim().max(6000).optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required.",
  });

export const reviewReplyCreateSchema = z.object({
  body: z.string().trim().min(2).max(4000),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type PublicProductReviewsQuery = z.infer<typeof publicProductReviewsQuerySchema>;
export type AdminReviewsQuery = z.infer<typeof adminReviewsQuerySchema>;
export type AdminReviewUpdateInput = z.infer<typeof adminReviewUpdateSchema>;
export type ReviewReplyCreateInput = z.infer<typeof reviewReplyCreateSchema>;

export type ReviewBreakdownItem = {
  star: number;
  count: number;
};

export type ProductReviewSummary = {
  avgRating: number;
  reviewsCount: number;
  breakdown: ReviewBreakdownItem[];
};

export type ProductReviewItem = {
  id: number;
  productId: number;
  orderId: number | null;
  customerName: string;
  customerEmail: string | null;
  rating: number;
  title: string | null;
  body: string;
  images: string[];
  status: ReviewStatus;
  isVerifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PublicProductReviewsResponse = {
  summary: ProductReviewSummary;
  reviews: ProductReviewItem[];
  nextCursor: number | null;
};

export type AdminReviewListResponse = {
  reviews: ProductReviewItem[];
  nextCursor: number | null;
};

