import { z } from "zod";

export const settingsStoreSchema = z.object({
  name: z.string().trim().min(1).max(160),
  logoUrl: z.string().trim().max(2000).default(""),
  phone: z.string().trim().max(60).default(""),
  email: z.union([z.string().trim().email().max(320), z.literal("")]).default(""),
  address: z.string().trim().max(1000).default(""),
  currency: z.string().trim().min(1).max(20).default("CFA"),
  socials: z.record(z.string().trim().min(1).max(120), z.string().trim().max(500)).default({}),
});

export const settingsStoreUpdateSchema = settingsStoreSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export const settingsPaymentsSchema = z.object({
  waveEnabled: z.boolean().default(true),
  omEnabled: z.boolean().default(true),
  cardEnabled: z.boolean().default(false),
  waveKey: z.string().trim().max(500).default(""),
  omKey: z.string().trim().max(500).default(""),
  cardPublicKey: z.string().trim().max(500).default(""),
  cardSecretKey: z.string().trim().max(500).default(""),
});

export const settingsPaymentsUpdateSchema = settingsPaymentsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export const adminChatbotToneSchema = z.enum([
  "Luxury skincare",
  "Friendly",
  "Professional",
]);

export const adminChatbotPoliciesSchema = z.object({
  return: z.string().trim().min(1).max(3000),
  delivery: z.string().trim().min(1).max(3000),
  payment: z.string().trim().min(1).max(3000),
});

export const adminChatbotSettingsSchema = z.object({
  id: z.number().int().positive(),
  greeting: z.string().trim().min(1).max(4000),
  tone: adminChatbotToneSchema,
  whatsappNumber: z.string().trim().min(5).max(40),
  policies: adminChatbotPoliciesSchema,
  updatedAt: z.string(),
});

export const adminChatbotSettingsUpdateSchema = adminChatbotSettingsSchema
  .pick({
    greeting: true,
    tone: true,
    whatsappNumber: true,
    policies: true,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export const shippingZoneSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(255),
  slug: z.string().trim().min(1).max(255),
  description: z.string().nullable().optional(),
  deliveryFee: z.number().int().min(0),
  deliveryDays: z.number().int().min(0),
  isActive: z.boolean(),
  displayOrder: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const shippingZoneCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  slug: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(1000).optional(),
  deliveryFee: z.number().int().min(0).default(0),
  deliveryDays: z.number().int().min(0).default(2),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().min(0).default(0),
});

export const shippingZoneUpdateSchema = shippingZoneCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export const shippingRateSchema = z.object({
  id: z.number().int().positive(),
  zoneId: z.number().int().positive(),
  label: z.string().trim().min(1).max(120),
  minAmountCfa: z.number().int().min(0),
  maxAmountCfa: z.number().int().min(0).nullable(),
  feeCfa: z.number().int().min(0),
  etaMinHours: z.number().int().min(0),
  etaMaxHours: z.number().int().min(0),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const shippingRateCreateSchema = z
  .object({
    zoneId: z.number().int().positive(),
    label: z.string().trim().min(1).max(120),
    minAmountCfa: z.number().int().min(0).default(0),
    maxAmountCfa: z.number().int().min(0).nullable().default(null),
    feeCfa: z.number().int().min(0),
    etaMinHours: z.number().int().min(0).default(24),
    etaMaxHours: z.number().int().min(0).default(72),
    isActive: z.boolean().default(true),
  })
  .refine((value) => value.maxAmountCfa === null || value.maxAmountCfa >= value.minAmountCfa, {
    path: ["maxAmountCfa"],
    message: "Max amount must be greater than or equal to min amount.",
  })
  .refine((value) => value.etaMaxHours >= value.etaMinHours, {
    path: ["etaMaxHours"],
    message: "Max ETA must be greater than or equal to min ETA.",
  });

const _shippingRateUpdateBase = z.object({
  label: z.string().trim().min(1).max(120),
  minAmountCfa: z.number().int().min(0).default(0),
  maxAmountCfa: z.number().int().min(0).nullable().default(null),
  feeCfa: z.number().int().min(0),
  etaMinHours: z.number().int().min(0).default(24),
  etaMaxHours: z.number().int().min(0).default(72),
  isActive: z.boolean().default(true),
});

export const shippingRateUpdateSchema = _shippingRateUpdateBase
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export const adminUserRoleSchema = z.enum(["admin", "manager", "editor"]);

export const adminUserSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(160),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  role: adminUserRoleSchema,
  isActive: z.boolean(),
  username: z.string().nullable(),
  createdAt: z.string(),
  lastLoginAt: z.string().nullable(),
});

export const adminUserCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    email: z.union([z.string().trim().email().max(320), z.literal("")]).default(""),
    phone: z.string().trim().max(60).optional(),
    username: z.string().trim().min(3).max(80),
    password: z.string().trim().min(10).max(128).optional(),
    inviteOnly: z.boolean().default(false),
    role: adminUserRoleSchema.default("editor"),
    isActive: z.boolean().default(true),
  })
  .refine((value) => Boolean(value.inviteOnly || value.password), {
    path: ["password"],
    message: "Password is required unless invite mode is enabled.",
  })
  .refine((value) => {
    if (!value.password) return true;
    return (
      /[a-z]/.test(value.password) &&
      /[A-Z]/.test(value.password) &&
      /[0-9]/.test(value.password) &&
      /[^A-Za-z0-9]/.test(value.password)
    );
  }, {
    path: ["password"],
    message:
      "Password must include upper/lowercase letters, a number, and a special character.",
  });

export const adminUserUpdateSchema = z
  .object({
    role: adminUserRoleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export const auditLogSchema = z.object({
  id: z.number().int().positive(),
  actorUserId: z.number().int().positive().nullable(),
  actorName: z.string().nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  beforeJson: z.unknown().nullable(),
  afterJson: z.unknown().nullable(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string(),
});

export const auditLogListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.coerce.number().int().positive().optional(),
  action: z.string().trim().max(120).optional(),
  entityType: z.string().trim().max(120).optional(),
});

export const auditLogListResponseSchema = z.object({
  items: z.array(auditLogSchema),
  nextCursor: z.number().int().positive().nullable(),
});

export type SettingsStore = z.infer<typeof settingsStoreSchema>;
export type SettingsStoreUpdate = z.infer<typeof settingsStoreUpdateSchema>;
export type SettingsPayments = z.infer<typeof settingsPaymentsSchema>;
export type SettingsPaymentsUpdate = z.infer<typeof settingsPaymentsUpdateSchema>;
export type AdminChatbotTone = z.infer<typeof adminChatbotToneSchema>;
export type AdminChatbotPolicies = z.infer<typeof adminChatbotPoliciesSchema>;
export type AdminChatbotSettings = z.infer<typeof adminChatbotSettingsSchema>;
export type AdminChatbotSettingsUpdate = z.infer<typeof adminChatbotSettingsUpdateSchema>;
export type ShippingZone = z.infer<typeof shippingZoneSchema>;
export type ShippingZoneCreate = z.infer<typeof shippingZoneCreateSchema>;
export type ShippingZoneUpdate = z.infer<typeof shippingZoneUpdateSchema>;
export type ShippingRate = z.infer<typeof shippingRateSchema>;
export type ShippingRateCreate = z.infer<typeof shippingRateCreateSchema>;
export type ShippingRateUpdate = z.infer<typeof shippingRateUpdateSchema>;
export type AdminUserRole = z.infer<typeof adminUserRoleSchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;
export type AdminUserCreate = z.infer<typeof adminUserCreateSchema>;
export type AdminUserUpdate = z.infer<typeof adminUserUpdateSchema>;
export type AuditLogItem = z.infer<typeof auditLogSchema>;
export type AuditLogListQuery = z.infer<typeof auditLogListQuerySchema>;
export type AuditLogListResponse = z.infer<typeof auditLogListResponseSchema>;
