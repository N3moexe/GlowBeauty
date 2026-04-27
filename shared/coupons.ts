import { z } from "zod";

export const couponTypeSchema = z.enum(["PERCENT", "FIXED", "FREE_SHIPPING"]);
export const couponAppliesToSchema = z.enum(["ALL", "CATEGORY", "PRODUCT"]);

export const couponErrorCodeSchema = z.enum([
  "INVALID_CODE",
  "EXPIRED",
  "NOT_STARTED",
  "INACTIVE",
  "MIN_SUBTOTAL_NOT_MET",
  "USAGE_LIMIT_REACHED",
  "PER_SESSION_LIMIT_REACHED",
  "NOT_APPLICABLE",
  "CART_NOT_FOUND",
]);

export const couponRecordSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(2).max(80),
  type: couponTypeSchema,
  value: z.number().int().min(0),
  minSubtotal: z.number().int().min(0),
  maxDiscount: z.number().int().min(0).nullable(),
  startAt: z.string().nullable(),
  endAt: z.string().nullable(),
  usageLimit: z.number().int().positive().nullable(),
  perSessionLimit: z.number().int().positive().nullable(),
  active: z.boolean(),
  appliesTo: couponAppliesToSchema,
  categoryId: z.string().nullable(),
  productId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  usageCount: z.number().int().min(0).default(0),
});

const couponWriteBaseSchema = z.object({
  code: z.string().trim().min(2).max(80).transform((value) => value.toUpperCase()),
  type: couponTypeSchema,
  value: z.number().int().min(0),
  minSubtotal: z.number().int().min(0).default(0),
  maxDiscount: z.number().int().min(0).nullable().optional(),
  startAt: z.string().datetime().nullable().optional(),
  endAt: z.string().datetime().nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  perSessionLimit: z.number().int().positive().nullable().optional(),
  active: z.boolean().default(true),
  appliesTo: couponAppliesToSchema.default("ALL"),
  categoryId: z.string().trim().min(1).max(191).nullable().optional(),
  productId: z.string().trim().min(1).max(191).nullable().optional(),
});

function validateCouponWriteShape(
  value: z.infer<typeof couponWriteBaseSchema>,
  ctx: z.RefinementCtx
) {
  if (value.type === "PERCENT" && (value.value < 1 || value.value > 100)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["value"],
      message: "Percent coupon value must be between 1 and 100.",
    });
  }

  if (value.type === "FIXED" && value.value < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["value"],
      message: "Fixed coupon value must be greater than 0.",
    });
  }

  if (value.type === "FREE_SHIPPING" && value.value !== 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["value"],
      message: "Free shipping coupon value must be 0.",
    });
  }

  if (
    value.startAt &&
    value.endAt &&
    Number(new Date(value.startAt)) > Number(new Date(value.endAt))
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endAt"],
      message: "endAt must be later than startAt.",
    });
  }

  if (value.appliesTo === "CATEGORY" && !value.categoryId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["categoryId"],
      message: "categoryId is required when appliesTo is CATEGORY.",
    });
  }

  if (value.appliesTo === "PRODUCT" && !value.productId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["productId"],
      message: "productId is required when appliesTo is PRODUCT.",
    });
  }
}

export const createCouponSchema = couponWriteBaseSchema.superRefine(validateCouponWriteShape);

export const updateCouponSchema = couponWriteBaseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one coupon field is required.",
  })
  .superRefine((value, ctx) => {
    validateCouponWriteShape(
      {
        code: value.code ?? "X",
        type: value.type ?? "FIXED",
        value: value.value ?? 0,
        minSubtotal: value.minSubtotal ?? 0,
        maxDiscount: value.maxDiscount,
        startAt: value.startAt,
        endAt: value.endAt,
        usageLimit: value.usageLimit,
        perSessionLimit: value.perSessionLimit,
        active: value.active ?? true,
        appliesTo: value.appliesTo ?? "ALL",
        categoryId: value.categoryId,
        productId: value.productId,
      },
      ctx
    );
  });

export const couponPreviewRequestSchema = z.object({
  sessionId: z.string().trim().min(8).max(120),
  code: z.string().trim().min(2).max(80),
  shippingFee: z.number().int().min(0).optional(),
});

export const applyCouponRequestSchema = couponPreviewRequestSchema;

export const removeCouponRequestSchema = z.object({
  sessionId: z.string().trim().min(8).max(120),
});

export const cartSyncItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

export const cartSyncRequestSchema = z.object({
  sessionId: z.string().trim().min(8).max(120),
  deliveryZoneId: z.number().int().positive().nullable().optional(),
  items: z.array(cartSyncItemSchema).max(100),
});

export const couponValidationResultSchema = z.object({
  ok: z.boolean(),
  code: couponErrorCodeSchema.optional(),
  message: z.string(),
  coupon: couponRecordSchema.optional(),
  discountAmount: z.number().int().min(0).default(0),
  discountType: couponTypeSchema.optional(),
  eligibleSubtotal: z.number().int().min(0).default(0),
});

export const cartSummarySchema = z.object({
  sessionId: z.string().min(1),
  subtotal: z.number().int().min(0),
  shippingFee: z.number().int().min(0),
  discountAmount: z.number().int().min(0),
  discountType: couponTypeSchema.nullable(),
  couponCode: z.string().nullable(),
  total: z.number().int().min(0),
});

export type CouponType = z.infer<typeof couponTypeSchema>;
export type CouponAppliesTo = z.infer<typeof couponAppliesToSchema>;
export type CouponErrorCode = z.infer<typeof couponErrorCodeSchema>;
export type CouponRecord = z.infer<typeof couponRecordSchema>;
export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
export type CouponPreviewRequest = z.infer<typeof couponPreviewRequestSchema>;
export type ApplyCouponRequest = z.infer<typeof applyCouponRequestSchema>;
export type RemoveCouponRequest = z.infer<typeof removeCouponRequestSchema>;
export type CartSyncRequest = z.infer<typeof cartSyncRequestSchema>;
export type CartSummary = z.infer<typeof cartSummarySchema>;
export type CouponValidationResult = z.infer<typeof couponValidationResultSchema>;
