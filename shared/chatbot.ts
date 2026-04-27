import { z } from "zod";

export const chatBotToneSchema = z.enum([
  "luxury_skincare",
  "friendly",
  "professional",
]);

export const chatEnabledToolSchema = z.enum([
  "searchProducts",
  "getProduct",
  "getOrderStatus",
  "getShippingOptions",
  "getFaqAnswer",
  "createSupportTicket",
]);

export const chatSettingsSchema = z.object({
  id: z.number(),
  businessName: z.string().min(1).max(160),
  whatsappNumber: z.string().min(5).max(40),
  welcomeMessage: z.string().min(1).max(4000),
  primaryColor: z.string().min(3).max(20),
  botTone: chatBotToneSchema,
  enabledTools: z.array(chatEnabledToolSchema),
  isEnabled: z.boolean(),
  updatedAt: z.string(),
});

export const chatSettingsUpdateSchema = chatSettingsSchema
  .pick({
    businessName: true,
    whatsappNumber: true,
    welcomeMessage: true,
    primaryColor: true,
    botTone: true,
    enabledTools: true,
    isEnabled: true,
  })
  .partial()
  .refine(value => Object.keys(value).length > 0, {
    message: "At least one setting must be provided",
  });

export const chatRoleSchema = z.enum(["user", "assistant", "system"]);
export const chatThreadStatusSchema = z.enum(["open", "closed"]);
export const chatTicketStatusSchema = z.enum(["open", "closed"]);

export const chatAttachmentSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(120),
  dataUrl: z.string().min(1).max(5_000_000),
});

export const chatContextSchema = z.object({
  page: z.string().max(300).optional(),
  cartItems: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        name: z.string().max(300),
        quantity: z.number().int().positive(),
        price: z.number().nonnegative(),
      })
    )
    .max(30)
    .optional(),
  attachments: z.array(chatAttachmentSchema).max(3).optional(),
});

export const createChatThreadSchema = z.object({
  threadId: z.number().int().positive().optional(),
  visitorId: z.string().min(3).max(100),
  locale: z.string().min(2).max(16).default("fr-SN"),
});

export const chatMessageRequestSchema = z.object({
  threadId: z.number().int().positive(),
  message: z.string().min(1).max(4000),
  locale: z.string().min(2).max(16).default("fr-SN"),
  context: chatContextSchema.optional(),
});

export const chatKbArticleSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(12000),
  tags: z.array(z.string().min(1).max(80)).max(30),
  locale: z.string().min(2).max(16).default("fr-SN"),
  isPublished: z.boolean(),
  updatedAt: z.string(),
  createdAt: z.string(),
});

export const createChatKbArticleSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(12000),
  tags: z.array(z.string().min(1).max(80)).max(30),
  locale: z.string().min(2).max(16).default("fr-SN"),
  isPublished: z.boolean().default(true),
});

export const updateChatKbArticleSchema = createChatKbArticleSchema
  .partial()
  .refine(value => Object.keys(value).length > 0, {
    message: "At least one field must be updated",
  });

export const chatThreadSummarySchema = z.object({
  id: z.number().int().positive(),
  visitorId: z.string(),
  status: chatThreadStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  messageCount: z.number().int().nonnegative(),
  lastMessage: z.string().nullable(),
  lastMessageAt: z.string().nullable(),
});

export const chatMessageSchema = z.object({
  id: z.number().int().positive(),
  threadId: z.number().int().positive(),
  role: chatRoleSchema,
  content: z.string(),
  createdAt: z.string(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const chatTicketSchema = z.object({
  id: z.number().int().positive(),
  threadId: z.number().int().positive(),
  message: z.string(),
  phone: z.string().nullable(),
  status: chatTicketStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createChatTicketSchema = z.object({
  threadId: z.number().int().positive(),
  message: z.string().min(1).max(3000),
  phone: z.string().max(40).optional(),
});

export const createChatThreadNoteSchema = z.object({
  note: z.string().min(1).max(3000),
});

export const updateChatTicketStatusSchema = z.object({
  status: chatTicketStatusSchema,
});

export const chatAnalyticsSchema = z.object({
  totalChats: z.number().int().nonnegative(),
  openThreads: z.number().int().nonnegative(),
  closedThreads: z.number().int().nonnegative(),
  avgMessagesPerThread: z.number().nonnegative(),
  ticketCount: z.number().int().nonnegative(),
  handoffRate: z.number().nonnegative(),
  topIntents: z.array(z.object({ intent: z.string(), count: z.number().int().nonnegative() })),
  topSearchedProducts: z.array(
    z.object({
      query: z.string(),
      count: z.number().int().nonnegative(),
    })
  ),
});

export type ChatSettings = z.infer<typeof chatSettingsSchema>;
export type ChatSettingsUpdate = z.infer<typeof chatSettingsUpdateSchema>;
export type ChatRole = z.infer<typeof chatRoleSchema>;
export type ChatThreadStatus = z.infer<typeof chatThreadStatusSchema>;
export type ChatTicketStatus = z.infer<typeof chatTicketStatusSchema>;
export type CreateChatThreadInput = z.infer<typeof createChatThreadSchema>;
export type ChatMessageRequest = z.infer<typeof chatMessageRequestSchema>;
export type ChatKbArticle = z.infer<typeof chatKbArticleSchema>;
export type CreateChatKbArticleInput = z.infer<typeof createChatKbArticleSchema>;
export type UpdateChatKbArticleInput = z.infer<typeof updateChatKbArticleSchema>;
export type ChatThreadSummary = z.infer<typeof chatThreadSummarySchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatTicket = z.infer<typeof chatTicketSchema>;
export type CreateChatTicketInput = z.infer<typeof createChatTicketSchema>;
export type UpdateChatTicketStatusInput = z.infer<typeof updateChatTicketStatusSchema>;
export type ChatAnalytics = z.infer<typeof chatAnalyticsSchema>;
