import { z } from "zod";

export const MAX_PRODUCT_BULLETS = 10;
export const MAX_PRODUCT_DESCRIPTION_BULLETS = 20;
export const MAX_PRODUCT_ROUTINE_STEPS = 5;

const bulletLineSchema = z.string().trim().min(1).max(260);

export const productRoutineStepSchema = z.object({
  title: z.string().trim().min(1).max(80),
  text: z.string().trim().min(1).max(700),
});

export const productRoutineSchema = z.object({
  am: z.array(productRoutineStepSchema).max(MAX_PRODUCT_ROUTINE_STEPS).default([]),
  pm: z.array(productRoutineStepSchema).max(MAX_PRODUCT_ROUTINE_STEPS).default([]),
});

export const productBenefitsSchema = z
  .array(bulletLineSchema)
  .max(MAX_PRODUCT_BULLETS)
  .default([]);

export const productDescriptionBulletsSchema = z
  .array(bulletLineSchema)
  .max(MAX_PRODUCT_DESCRIPTION_BULLETS)
  .default([]);

export const productContentSchema = z.object({
  benefits: productBenefitsSchema.default([]),
  descriptionBullets: productDescriptionBulletsSchema.default([]),
  routine: productRoutineSchema.default({ am: [], pm: [] }),
});

export type ProductRoutineStep = z.infer<typeof productRoutineStepSchema>;
export type ProductRoutine = z.infer<typeof productRoutineSchema>;
export type ProductContentFields = z.infer<typeof productContentSchema>;
