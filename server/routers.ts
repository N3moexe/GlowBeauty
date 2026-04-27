import { COOKIE_NAME } from "@shared/const";
import {
  productBenefitsSchema,
  productDescriptionBulletsSchema,
  productRoutineSchema,
} from "@shared/product-content";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { parse as parseCookieHeader } from "cookie";
import * as db from "./db";
import * as adminSecurity from "./admin-security";
import * as mobileMoney from "./mobile-money";
import * as emailService from "./email-service";
import * as couponService from "./coupon-service";
import { aiRecommendationsRouter } from "./routers/ai-recommendations";
import { aiSearchRouter } from "./routers/ai-search";
import { aiChatbotRouter } from "./routers/ai-chatbot";
import { bannersRouter } from "./routers/banners";

// Admin guard - for Manus OAuth admins
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin")
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Accès réservé aux administrateurs",
    });
  return next({ ctx });
});

type AdminRole = "ADMIN" | "MANAGER" | "STAFF";

type AdminPermissions = {
  role: AdminRole;
  allowedModules: string[];
  canWriteOrders: boolean;
  canWriteProducts: boolean;
  canWriteCms: boolean;
  canDelete: boolean;
  canAccessSettings: boolean;
  readOnly: boolean;
};

function buildPermissions(role: AdminRole): AdminPermissions {
  const managerModules = ["orders", "products", "categories", "cms"];
  if (role === "ADMIN") {
    return {
      role,
      allowedModules: [
        "analytics",
        "orders",
        "search",
        "products",
        "categories",
        "reviews",
        "inventory",
        "coupons",
        "banners",
        "reports",
        "cms",
        "settings",
      ],
      canWriteOrders: true,
      canWriteProducts: true,
      canWriteCms: true,
      canDelete: true,
      canAccessSettings: true,
      readOnly: false,
    };
  }
  if (role === "MANAGER") {
    return {
      role,
      allowedModules: [...managerModules],
      canWriteOrders: true,
      canWriteProducts: true,
      canWriteCms: true,
      canDelete: true,
      canAccessSettings: false,
      readOnly: false,
    };
  }
  return {
    role,
    allowedModules: [...managerModules],
    canWriteOrders: false,
    canWriteProducts: false,
    canWriteCms: false,
    canDelete: false,
    canAccessSettings: false,
    readOnly: true,
  };
}

const roleProcedure = (allowedRoles: AdminRole[]) =>
  protectedProcedure.use(async ({ ctx, next }) => {
    const role = await db.getEffectiveAdminRole(ctx.user);
    if (!role || !allowedRoles.includes(role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Acces non autorise" });
    }
    return next({ ctx });
  });

const adminReadProcedure = roleProcedure(["ADMIN", "MANAGER", "STAFF"]);
const managerWriteProcedure = roleProcedure(["ADMIN", "MANAGER"]);
const adminOnlyProcedure = roleProcedure(["ADMIN"]);

function resolveRequestIp(req: any) {
  const forwarded = req?.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim().length > 0) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return req?.ip || req?.socket?.remoteAddress || null;
}

async function writeTrpcAudit(
  ctx: any,
  input: {
    action: string;
    entityType: string;
    entityId?: string | number | null;
    beforeJson?: unknown;
    afterJson?: unknown;
  }
) {
  try {
    await db.writeAuditLog({
      actorUserId: ctx?.user?.id ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      beforeJson: input.beforeJson,
      afterJson: input.afterJson,
      ip: resolveRequestIp(ctx?.req),
      userAgent: ctx?.req?.headers?.["user-agent"] || null,
    });
  } catch (error) {
    console.error("[Audit] Failed to write tRPC audit log:", error);
  }
}

function normalizeEmail(value?: string | null) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

// ─── Order creation rate limit (in-memory; sized for single-node) ───
const ORDER_CREATE_WINDOW_MS = 60_000;
const ORDER_CREATE_MAX_PER_WINDOW = 6;
type OrderRateBucket = { count: number; resetAt: number };
const orderRateBuckets = new Map<string, OrderRateBucket>();

function getRequestIpFromCtx(req: {
  headers: Record<string, any>;
  socket?: any;
  ip?: string;
}) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim().length > 0) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return req.ip || req.socket?.remoteAddress || null;
}

function enforceOrderRateLimit(key: string) {
  const now = Date.now();
  const bucket = orderRateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    orderRateBuckets.set(key, {
      count: 1,
      resetAt: now + ORDER_CREATE_WINDOW_MS,
    });
    return;
  }
  bucket.count += 1;
  if (bucket.count > ORDER_CREATE_MAX_PER_WINDOW) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Trop de commandes recentes. Reessayez dans une minute.",
    });
  }
}

export function __resetOrderRateLimitForTests() {
  orderRateBuckets.clear();
}

function normalizePhoneLast4(phone: string | null | undefined) {
  if (!phone) return "";
  return phone.replace(/\D/g, "").slice(-4);
}

function orderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "En attente",
    confirmed: "Confirmee",
    processing: "En preparation",
    shipped: "Expediee",
    delivered: "Livree",
    cancelled: "Annulee",
  };
  return labels[status] || status;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Admin Authentication ───
  rbac: router({
    me: protectedProcedure.query(async ({ ctx }) => {
      const role = await db.getEffectiveAdminRole(ctx.user);
      if (!role) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Acces admin requis",
        });
      }
      return buildPermissions(role);
    }),
  }),

  adminAuth: router({
    login: publicProcedure
      .input(
        z.object({
          username: z.string().min(1),
          password: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const lockState = adminSecurity.getLoginLockState(input.username);
        if (lockState.locked) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Compte temporairement verrouille. Reessayez dans ${lockState.retryAfterSeconds}s.`,
          });
        }

        const primaryCredential =
          await adminSecurity.getAdminCredentialsByUsername(input.username);
        const localFallbackCredential =
          adminSecurity.getLocalAdminFallbackCredentials(input.username);
        const candidateCredentials = [
          primaryCredential,
          localFallbackCredential,
        ].filter(
          (
            credential,
            index,
            array
          ): credential is NonNullable<typeof credential> => {
            if (!credential) return false;
            return (
              array.findIndex(existing => existing?.id === credential.id) ===
              index
            );
          }
        );

        const adminCred = candidateCredentials.find(credential =>
          adminSecurity.verifyPassword(input.password, credential.passwordHash)
        );

        if (!adminCred) {
          adminSecurity.recordFailedLoginAttempt(input.username);
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Identifiants invalides",
          });
        }
        adminSecurity.clearFailedLoginAttempts(input.username);

        const sessionToken = await adminSecurity.createAdminSession(
          adminCred.id,
          !adminCred.twoFactorEnabled // If 2FA is not enabled, mark as verified
        );

        // Set admin session cookie (localhost-safe options)
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie("admin_session", sessionToken, {
          ...cookieOptions,
          maxAge: 24 * 60 * 60 * 1000,
        });

        return {
          sessionToken: adminCred.twoFactorEnabled ? sessionToken : undefined,
          requiresTwoFactor: adminCred.twoFactorEnabled,
        };
      }),

    verifyTwoFactor: publicProcedure
      .input(
        z.object({
          sessionToken: z.string().optional(),
          code: z.string().min(6).max(8), // 6-digit TOTP code or backup code
        })
      )
      .mutation(async ({ input, ctx }) => {
        const cookieHeader = ctx.req.headers.cookie;
        const cookies = cookieHeader ? parseCookieHeader(cookieHeader) : {};
        const sessionToken = input.sessionToken || cookies["admin_session"];
        if (!sessionToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Session invalide",
          });
        }

        const session =
          await adminSecurity.getAdminSessionByToken(sessionToken);
        if (!session)
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Session invalide",
          });

        // Accept backup codes (8 characters) or TOTP codes (6 digits)
        const isBackupCode = input.code.length === 8;
        let verified = false;

        if (isBackupCode) {
          verified = await adminSecurity.verifyAndUseBackupCode(
            session.adminCredentialId,
            input.code
          );
        } else if (/^\d{6}$/.test(input.code)) {
          verified = await adminSecurity.verifyTotpCode(
            session.adminCredentialId,
            input.code
          );
        }

        if (!verified)
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Code invalide",
          });

        await adminSecurity.verifySessionTwoFactor(sessionToken);
        return { success: true };
      }),

    logoutAdmin: publicProcedure
      .input(
        z.object({
          sessionToken: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const cookieHeader = ctx.req.headers.cookie;
        const cookies = cookieHeader ? parseCookieHeader(cookieHeader) : {};
        const sessionToken = input.sessionToken || cookies["admin_session"];
        if (sessionToken) {
          await adminSecurity.invalidateAdminSession(sessionToken);
        }
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.clearCookie("admin_session", { ...cookieOptions, maxAge: -1 });
        return { success: true };
      }),

    setupTwoFactor: adminProcedure
      .input(
        z.object({
          adminCredentialId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        const secret = adminSecurity.generateTwoFactorSecret();
        const backupCodes = await adminSecurity.enableTwoFactor(
          input.adminCredentialId,
          secret
        );
        return { secret, backupCodes };
      }),

    disableTwoFactor: adminProcedure
      .input(
        z.object({
          adminCredentialId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        await adminSecurity.disableTwoFactor(input.adminCredentialId);
        return { success: true };
      }),

    changePassword: adminProcedure
      .input(
        z.object({
          adminCredentialId: z.number(),
          currentPassword: z.string(),
          newPassword: z.string().min(10),
        })
      )
      .mutation(async ({ input }) => {
        const adminCred = await adminSecurity.getAdminCredentialById(
          input.adminCredentialId
        );
        if (!adminCred)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Admin non trouvé",
          });

        if (
          !adminSecurity.verifyPassword(
            input.currentPassword,
            adminCred.passwordHash
          )
        ) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Mot de passe actuel incorrect",
          });
        }

        const passwordPolicy = adminSecurity.validatePasswordStrength(
          input.newPassword
        );
        if (!passwordPolicy.ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              passwordPolicy.message ||
              "Le mot de passe ne respecte pas la politique de securite.",
          });
        }

        await adminSecurity.updateAdminPassword(
          adminCred.id,
          input.newPassword
        );
        return { success: true };
      }),
  }),

  // ─── Categories ───
  category: router({
    list: publicProcedure.query(async () => {
      return db.getAllCategories();
    }),
    bySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        return db.getCategoryBySlug(input.slug);
      }),
    create: managerWriteProcedure
      .input(
        z.object({
          name: z.string().min(1),
          slug: z.string().min(1),
          description: z.string().optional(),
          imageUrl: z.string().optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const id = await db.createCategory(input);
        return { id };
      }),
    update: managerWriteProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          slug: z.string().min(1).optional(),
          description: z.string().optional(),
          imageUrl: z.string().optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateCategory(id, data);
        return { success: true };
      }),
    delete: managerWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCategory(input.id);
        return { success: true };
      }),
  }),

  // ─── Products ───
  cms: router({
    list: adminReadProcedure
      .input(
        z
          .object({
            search: z.string().optional(),
            status: z.enum(["all", "draft", "published"]).optional(),
            limit: z.number().optional(),
            offset: z.number().optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        return db.getCmsPages({
          search: input?.search,
          status: input?.status,
          limit: input?.limit,
          offset: input?.offset,
        });
      }),
    byId: adminReadProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const page = await db.getCmsPageById(input.id);
        if (!page)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Page CMS introuvable",
          });
        return page;
      }),
    create: managerWriteProcedure
      .input(
        z.object({
          title: z.string().min(1),
          slug: z.string().min(1),
          status: z.enum(["draft", "published"]).optional(),
          content: z.string().min(1),
          seoTitle: z.string().optional(),
          seoDescription: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const id = await db.createCmsPage(input);
        return { id };
      }),
    update: managerWriteProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().min(1).optional(),
          slug: z.string().min(1).optional(),
          status: z.enum(["draft", "published"]).optional(),
          content: z.string().min(1).optional(),
          seoTitle: z.string().optional(),
          seoDescription: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateCmsPage(id, data);
        return { success: true };
      }),
    setStatus: managerWriteProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["draft", "published"]),
        })
      )
      .mutation(async ({ input }) => {
        await db.updateCmsPage(input.id, { status: input.status });
        return { success: true };
      }),
    delete: managerWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCmsPage(input.id);
        return { success: true };
      }),
  }),

  product: router({
    list: publicProcedure
      .input(
        z
          .object({
            categoryId: z.number().optional(),
            search: z.string().optional(),
            featured: z.boolean().optional(),
            isNew: z.boolean().optional(),
            trending: z.boolean().optional(),
            limit: z.number().optional(),
            offset: z.number().optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        return db.getProducts(input || {});
      }),
    byId: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const product = await db.getProductById(input.id);
        if (!product)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Produit non trouvé",
          });
        return product;
      }),
    bySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const product = await db.getProductBySlug(input.slug);
        if (!product)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Produit non trouvé",
          });
        return product;
      }),
    related: publicProcedure
      .input(
        z.object({
          categoryId: z.number(),
          excludeId: z.number(),
          limit: z.number().optional(),
        })
      )
      .query(async ({ input }) => {
        return db.getRelatedProducts(
          input.categoryId,
          input.excludeId,
          input.limit
        );
      }),
    create: managerWriteProcedure
      .input(
        z.object({
          name: z.string().min(1),
          slug: z.string().min(1),
          description: z.string().optional(),
          benefits: productBenefitsSchema.default([]),
          descriptionBullets: productDescriptionBulletsSchema.default([]),
          routine: productRoutineSchema.default({ am: [], pm: [] }),
          price: z.number().min(0),
          comparePrice: z.number().optional(),
          categoryId: z.number(),
          imageUrl: z.string().optional(),
          images: z.string().optional(),
          inStock: z.boolean().optional(),
          stockQuantity: z.number().optional(),
          isFeatured: z.boolean().optional(),
          isNew: z.boolean().optional(),
          isTrending: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const id = await db.createProduct(input);
        await writeTrpcAudit(ctx, {
          action: "product.create",
          entityType: "product",
          entityId: id,
          afterJson: input,
        });
        return { id };
      }),
    update: managerWriteProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          slug: z.string().min(1).optional(),
          description: z.string().optional(),
          benefits: productBenefitsSchema.optional(),
          descriptionBullets: productDescriptionBulletsSchema.optional(),
          routine: productRoutineSchema.optional(),
          price: z.number().min(0).optional(),
          comparePrice: z.number().nullable().optional(),
          categoryId: z.number().optional(),
          imageUrl: z.string().optional(),
          images: z.string().optional(),
          inStock: z.boolean().optional(),
          stockQuantity: z.number().optional(),
          isFeatured: z.boolean().optional(),
          isNew: z.boolean().optional(),
          isTrending: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const before = await db.getProductById(id);
        await db.updateProduct(id, data as any);
        const after = await db.getProductById(id);
        await writeTrpcAudit(ctx, {
          action: "product.update",
          entityType: "product",
          entityId: id,
          beforeJson: before,
          afterJson: after,
        });
        return { success: true };
      }),
    delete: managerWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const before = await db.getProductById(input.id);
        await db.deleteProduct(input.id);
        await writeTrpcAudit(ctx, {
          action: "product.delete",
          entityType: "product",
          entityId: input.id,
          beforeJson: before,
        });
        return { success: true };
      }),
    count: publicProcedure.query(async () => {
      return db.getProductCount();
    }),
  }),

  // ─── Orders ───
  order: router({
    create: publicProcedure
      .input(
        z.object({
          customerName: z.string().min(1),
          customerPhone: z.string().min(1),
          customerEmail: z.string().email().optional(),
          customerAddress: z.string().min(1),
          customerCity: z.string().optional(),
          sessionId: z.string().min(8).max(120).optional(),
          deliveryZoneId: z.number().optional(),
          paymentMethod: z.string().min(1),
          notes: z.string().optional(),
          items: z
            .array(
              z.object({
                productId: z.number(),
                quantity: z.number().min(1),
              })
            )
            .min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Rate-limit per IP+session to prevent email bombing and order spam.
        const ip = getRequestIpFromCtx(ctx.req) || "unknown";
        const rateKey = `${ip}:${input.sessionId || "anon"}`;
        enforceOrderRateLimit(rateKey);

        const orderNumber = `SBP-${Date.now().toString(36).toUpperCase()}-${nanoid(4).toUpperCase()}`;
        const resolvedItems = await Promise.all(
          input.items.map(async item => {
            const product = await db.getProductById(item.productId);
            if (!product) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Produit introuvable: ${item.productId}`,
              });
            }
            if (product.inStock === false) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Produit indisponible: ${product.name}`,
              });
            }

            const unitPrice = product.price;
            return {
              productId: product.id,
              productName: product.name,
              productImage: product.imageUrl ?? undefined,
              quantity: item.quantity,
              unitPrice,
              totalPrice: unitPrice * item.quantity,
            };
          })
        );

        let deliveryFee = 0;
        if (input.deliveryZoneId) {
          const zone = await db.getDeliveryZoneById(input.deliveryZoneId);
          if (!zone) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Zone de livraison invalide",
            });
          }
          deliveryFee = zone.deliveryFee;
        }

        const productsTotal = resolvedItems.reduce(
          (sum, item) => sum + item.totalPrice,
          0
        );
        const sessionId =
          input.sessionId && input.sessionId.trim().length > 0
            ? input.sessionId.trim()
            : `checkout-${Date.now()}-${nanoid(6)}`;
        const couponForCheckout =
          await couponService.getAppliedCouponForCheckout({
            sessionId,
            cartItems: resolvedItems,
            subtotal: productsTotal,
            shippingFee: deliveryFee,
          });
        const discountAmount = Number(couponForCheckout.discountAmount || 0);
        const totalAmount = Math.max(
          0,
          productsTotal + deliveryFee - discountAmount
        );
        const customerEmail =
          normalizeEmail(input.customerEmail) ||
          normalizeEmail(ctx.user?.email);

        const {
          items,
          customerEmail: _customerEmail,
          sessionId: _sessionId,
          ...orderPayload
        } = input;
        const orderId = await db.createOrder({
          ...orderPayload,
          items: resolvedItems,
          orderNumber,
          subtotalAmount: productsTotal,
          shippingFee: deliveryFee,
          couponCode: couponForCheckout.couponCode,
          discountAmount,
          discountType: couponForCheckout.discountType,
          totalAmount,
          // totalPaid stays 0 until payment is confirmed (cash-on-delivery handler,
          // mobile-money webhook, or admin manual `order.updatePayment`).
          totalPaid: 0,
          userId: ctx.user?.id,
        });

        if (couponForCheckout.couponId) {
          try {
            await couponService.createCouponRedemption({
              couponId: couponForCheckout.couponId,
              sessionId,
              userId: ctx.user?.id ?? null,
              orderId,
            });
          } catch (error) {
            console.error("[Order] coupon redemption insert failed:", error);
          }
        }

        try {
          await couponService.clearSessionCart(sessionId);
        } catch (error) {
          console.error("[Order] cart clear failed:", error);
        }

        // Keep customer directory in sync for follow-up notifications.
        try {
          await db.getOrCreateCustomer(
            input.customerName,
            input.customerPhone,
            customerEmail,
            input.customerAddress,
            input.customerCity
          );
        } catch (error) {
          console.error("[Order] customer upsert failed:", error);
        }

        // Fire-and-forget notifications so checkout is never blocked by SMTP latency.
        void (async () => {
          try {
            if (customerEmail) {
              await emailService.sendOrderConfirmationEmail({
                orderNumber,
                customerName: input.customerName,
                customerEmail,
                customerPhone: input.customerPhone,
                customerAddress: input.customerAddress,
                items: resolvedItems.map(item => ({
                  productName: item.productName,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  totalPrice: item.totalPrice,
                })),
                totalAmount,
                paymentMethod: input.paymentMethod,
              });
            }
            await emailService.sendAdminOrderNotification({
              orderNumber,
              customerName: input.customerName,
              customerPhone: input.customerPhone,
              totalAmount,
              itemCount: resolvedItems.reduce(
                (sum, item) => sum + item.quantity,
                0
              ),
              paymentMethod: input.paymentMethod,
            });
          } catch (error) {
            console.error("[Order] email notification failed:", error);
          }
        })();

        return { orderId, orderNumber };
      }),
    byNumber: publicProcedure
      .input(
        z.object({
          orderNumber: z.string(),
          // Last 4 digits of the phone used at checkout. Required for public callers
          // to prevent order-number enumeration leaking customer PII.
          phoneLast4: z
            .string()
            .regex(/^\d{4}$/)
            .optional(),
        })
      )
      .query(async ({ input, ctx }) => {
        const order = await db.getOrderByNumber(input.orderNumber);
        if (!order)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Commande non trouvée",
          });

        const isAdmin = ctx.user?.role === "admin";
        const isOwner = !!ctx.user?.id && order.userId === ctx.user.id;
        if (!isAdmin && !isOwner) {
          const expected = normalizePhoneLast4(order.customerPhone);
          if (!input.phoneLast4 || input.phoneLast4 !== expected) {
            // Return the same error for "wrong phone" and "unknown order" so
            // attackers cannot confirm an order number exists.
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Commande non trouvée",
            });
          }
        }
        return order;
      }),
    // Admin routes
    list: adminReadProcedure
      .input(
        z
          .object({
            status: z.string().optional(),
            paymentStatus: z.string().optional(),
            query: z.string().optional(),
            limit: z.number().optional(),
            offset: z.number().optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        return db.getOrders(input || {});
      }),
    byId: adminReadProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const order = await db.getOrderById(input.id);
        if (!order)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Commande non trouvée",
          });
        return order;
      }),
    updateStatus: managerWriteProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        await db.updateOrderStatus(input.id, input.status);
        const updatedOrder = await db.getOrderById(input.id);
        if (updatedOrder) {
          const recipientEmail =
            normalizeEmail((updatedOrder as any).customerEmail) ||
            normalizeEmail(
              (await db.getCustomerByPhone(updatedOrder.customerPhone))?.email
            );

          if (recipientEmail) {
            void emailService.sendOrderStatusUpdateEmail({
              orderNumber: updatedOrder.orderNumber,
              customerName: updatedOrder.customerName,
              customerEmail: recipientEmail,
              customerPhone: updatedOrder.customerPhone,
              status: updatedOrder.status,
              statusLabel: orderStatusLabel(updatedOrder.status),
              totalAmount: updatedOrder.totalAmount,
            });
          }
        }
        return { success: true };
      }),
    updatePayment: managerWriteProcedure
      .input(
        z.object({
          id: z.number(),
          paymentStatus: z
            .enum(["pending", "processing", "completed", "failed", "paid"])
            .transform(value => (value === "paid" ? "completed" : value)),
          paymentReference: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await db.updatePaymentStatus(
          input.id,
          input.paymentStatus,
          input.paymentReference
        );
        return { success: true };
      }),
  }),

  // ─── Analytics ───
  analytics: router({
    track: publicProcedure
      .input(
        z.object({
          page: z.string(),
          visitorId: z.string(),
          sessionId: z.string().optional(),
          referrer: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await db.recordPageView({
          ...input,
          userAgent: ctx.req.headers["user-agent"] || undefined,
        });
        return { success: true };
      }),
    dashboard: adminProcedure
      .input(z.object({ days: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return db.getAnalytics(input?.days || 30);
      }),
  }),

  payment: router({
    initiate: publicProcedure
      .input(
        z.object({
          orderNumber: z.string(),
          paymentMethod: z.enum(["orange_money", "wave", "free_money"]),
        })
      )
      .mutation(async ({ input }) => {
        const order = await db.getOrderByNumber(input.orderNumber);
        if (!order) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Commande non trouvée",
          });
        }
        if (order.paymentStatus === "completed") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cette commande est déjà payée",
          });
        }

        const result = await mobileMoney.initiatePayment(input.paymentMethod, {
          orderNumber: input.orderNumber,
          amount: order.totalAmount,
          customerPhone: order.customerPhone,
          customerName: order.customerName,
          description: `Commande SenBonsPlans ${input.orderNumber}`,
        });
        if (result.success) {
          await db.updatePaymentStatus(
            order.id,
            "processing",
            result.transactionId
          );
        }
        return result;
      }),
  }),

  email: router({
    sendOrderConfirmation: publicProcedure
      .input(
        z.object({
          orderNumber: z.string(),
          customerName: z.string(),
          customerEmail: z.string().email().optional(),
          customerPhone: z.string(),
          customerAddress: z.string(),
          items: z.array(
            z.object({
              productName: z.string(),
              quantity: z.number(),
              unitPrice: z.number(),
              totalPrice: z.number(),
            })
          ),
          totalAmount: z.number(),
          paymentMethod: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const success = await emailService.sendOrderConfirmationEmail(input);
        return { success };
      }),

    sendStatusUpdate: adminProcedure
      .input(
        z.object({
          orderNumber: z.string(),
          customerName: z.string(),
          customerEmail: z.string().email().optional(),
          status: z.string(),
          statusLabel: z.string(),
          totalAmount: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        const success = await emailService.sendOrderStatusUpdateEmail(input);
        return { success };
      }),
  }),

  deliveryZone: router({
    list: publicProcedure.query(async () => {
      return db.getDeliveryZones();
    }),
    byId: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const zone = await db.getDeliveryZoneById(input.id);
        if (!zone)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Zone de livraison non trouvée",
          });
        return zone;
      }),
  }),

  // Customer Management
  customers: router({
    list: adminReadProcedure
      .input(
        z.object({
          query: z.string().trim().max(200).optional(),
          limit: z.number().default(50),
          offset: z.number().default(0),
        })
      )
      .query(async ({ input }) => {
        return db.getCustomers({
          query: input.query,
          limit: input.limit,
          offset: input.offset,
        });
      }),
    byId: adminReadProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getCustomerById(input.id);
      }),
  }),

  // Reports
  reports: router({
    bestSellers: adminProcedure
      .input(z.object({ limit: z.number().default(10) }))
      .query(async ({ input }) => {
        return db.getBestSellingProducts(input.limit);
      }),
    lowStock: adminProcedure
      .input(z.object({ threshold: z.number().default(10) }))
      .query(async ({ input }) => {
        return db.getLowStockProducts(input.threshold);
      }),
    salesByCategory: adminProcedure.query(async () => {
      return db.getSalesByCategory();
    }),
  }),

  // Activity Logs
  activityLogs: router({
    list: adminProcedure
      .input(
        z.object({
          limit: z.number().default(100),
          offset: z.number().default(0),
        })
      )
      .query(async ({ input }) => {
        return db.getActivityLogs(input.limit, input.offset);
      }),
  }),

  // Store Settings
  settings: router({
    storefront: publicProcedure.query(async () => {
      try {
        const settings = await db.getStorefrontSettings();
        console.info("[Settings] storefront read", {
          storeName: settings.storeName,
        });
        return settings;
      } catch (error) {
        console.error("[Settings] storefront read failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de charger les parametres de la boutique.",
        });
      }
    }),
    list: adminOnlyProcedure
      .input(z.object({ prefix: z.string().optional() }).optional())
      .query(async ({ input, ctx }) => {
        try {
          console.info("[Settings] list", {
            userId: ctx.user.id,
            prefix: input?.prefix || "all",
          });
          return await db.listStoreSettings(input?.prefix);
        } catch (error) {
          console.error("[Settings] list failed:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Impossible de charger les parametres.",
          });
        }
      }),
    get: adminOnlyProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ input, ctx }) => {
        try {
          console.info("[Settings] get", {
            userId: ctx.user.id,
            key: input.key,
          });
          return await db.getStoreSetting(input.key);
        } catch (error) {
          console.error("[Settings] get failed:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Impossible de lire ce parametre.",
          });
        }
      }),
    set: adminOnlyProcedure
      .input(z.object({ key: z.string(), value: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          console.info("[Settings] set", {
            userId: ctx.user.id,
            key: input.key,
          });
          const before = await db.getStoreSetting(input.key);
          await db.setStoreSetting(input.key, input.value);
          await writeTrpcAudit(ctx, {
            action: "settings.kv.update",
            entityType: "store_setting",
            entityId: input.key,
            beforeJson: { key: input.key, value: before },
            afterJson: input,
          });
          return { success: true };
        } catch (error) {
          console.error("[Settings] set failed:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Enregistrement impossible. Verifiez les logs serveur.",
          });
        }
      }),
  }),

  staff: router({
    list: adminOnlyProcedure
      .input(
        z
          .object({
            limit: z.number().default(100),
            offset: z.number().default(0),
          })
          .optional()
      )
      .query(async ({ input }) => {
        return db.listAdminUsers(input?.limit ?? 100, input?.offset ?? 0);
      }),
    updateRole: adminOnlyProcedure
      .input(
        z.object({
          userId: z.number(),
          role: z.enum(["ADMIN", "MANAGER", "STAFF"]),
          isActive: z.boolean().default(true),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const beforeList = await db.listAdminUsers(5000, 0);
        const before =
          beforeList.find(
            (item: any) => Number(item.userId || item.id) === input.userId
          ) || null;
        await db.updateAdminUserRole(input.userId, input.role, input.isActive);
        const afterList = await db.listAdminUsers(5000, 0);
        const after =
          afterList.find(
            (item: any) => Number(item.userId || item.id) === input.userId
          ) || null;
        await writeTrpcAudit(ctx, {
          action: "user.role.update",
          entityType: "user",
          entityId: input.userId,
          beforeJson: before,
          afterJson: after,
        });
        return { success: true };
      }),
  }),

  // Image Upload
  imageUpload: router({
    uploadProductImage: adminProcedure
      .input(
        z.object({
          fileName: z.string(),
          fileData: z.string(),
          contentType: z
            .enum(["image/jpeg", "image/png", "image/webp"])
            .default("image/jpeg"),
        })
      )
      .mutation(async ({ input }) => {
        const { uploadProductImage, validateImageFile } =
          await import("./image-upload");
        const { verifyImageMime } = await import("./upload-security");
        const buffer = Buffer.from(input.fileData, "base64");
        const validation = validateImageFile(buffer, input.fileName, 5);
        if (!validation.valid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: validation.error,
          });
        }
        // Verify the file's real magic bytes match the declared content type.
        // Extension-only checks can be bypassed by renaming; this catches that.
        const mimeCheck = verifyImageMime(buffer, input.contentType);
        if (!mimeCheck.valid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: mimeCheck.detected
              ? `Le type de fichier ne correspond pas (détecté: ${mimeCheck.detected})`
              : "Fichier image invalide ou non supporté",
          });
        }
        const url = await uploadProductImage(
          buffer,
          input.fileName,
          input.contentType
        );
        return { url, success: true };
      }),
  }),

  // Order Management Enhancements
  // Note: `search` removed — it duplicated `order.list` and silently ignored its `query` param.
  // Use `appRouter.order.list({ query, status, paymentStatus, limit, offset })` instead.
  orderManagement: router({
    addNote: adminProcedure
      .input(
        z.object({
          orderId: z.number(),
          note: z.string(),
          isInternal: z.boolean().default(true),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
        await db.addOrderNote(
          input.orderId,
          ctx.user.id,
          input.note,
          input.isInternal
        );
        return { success: true };
      }),
    getNotes: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        return db.getOrderNotes(input.orderId);
      }),
  }),

  // Product Reviews
  reviews: router({
    create: publicProcedure
      .input(
        z.object({
          productId: z.number(),
          orderId: z.number().optional(),
          customerName: z.string(),
          customerEmail: z.string().email().optional(),
          rating: z.number().min(1).max(5),
          title: z.string(),
          comment: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const review = await db.createProductReview({
          ...input,
          isVerifiedPurchase: !!input.orderId,
          isApproved: false,
        });
        return { success: true, review };
      }),
    list: publicProcedure
      .input(
        z.object({
          productId: z.number(),
          limit: z.number().default(10),
          offset: z.number().default(0),
        })
      )
      .query(async ({ input }) => {
        return db.getProductReviews(input.productId, input.limit, input.offset);
      }),
    averageRating: publicProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        const rating = await db.getProductAverageRating(input.productId);
        return { rating };
      }),
    pending: adminProcedure.query(async () => {
      return db.getPendingReviews();
    }),
    adminList: adminReadProcedure
      .input(
        z
          .object({
            status: z
              .enum(["all", "approved", "pending", "rejected"])
              .default("all"),
            limit: z.number().default(100),
            offset: z.number().default(0),
            productId: z.number().optional(),
            q: z.string().optional(),
            cursor: z.number().optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        if (input?.cursor || input?.productId || input?.q) {
          return db.listAdminReviewsByCursor({
            status:
              input?.status && input.status !== "all"
                ? input.status
                : undefined,
            limit: input?.limit ?? 100,
            cursor: input?.cursor ?? undefined,
            productId: input?.productId,
            q: input?.q,
          });
        }
        return db.getAllReviews({
          status: input?.status || "all",
          limit: input?.limit ?? 100,
          offset: input?.offset ?? 0,
        });
      }),
    moderate: managerWriteProcedure
      .input(
        z
          .object({
            id: z.number(),
            status: z.enum(["pending", "approved", "rejected"]).optional(),
            title: z.string().max(255).optional(),
            body: z.string().max(6000).optional(),
          })
          .refine(
            payload =>
              payload.status !== undefined ||
              payload.title !== undefined ||
              payload.body !== undefined,
            {
              message: "At least one field is required",
            }
          )
      )
      .mutation(async ({ input, ctx }) => {
        const before = await db.getReviewByIdRaw(input.id);
        const review = await db.updateReviewById(input.id, {
          status: input.status,
          title: input.title,
          body: input.body,
        });
        if (!review) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Review not found",
          });
        }
        await writeTrpcAudit(ctx, {
          action: input.status
            ? `review.status.${input.status}`
            : "review.content.update",
          entityType: "review",
          entityId: input.id,
          beforeJson: before,
          afterJson: review,
        });
        return { success: true, review };
      }),
    approve: managerWriteProcedure
      .input(
        z.object({
          id: z.number(),
          approved: z.boolean().default(true),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const before = await db.getReviewByIdRaw(input.id);
        const review = await db.approveReview(input.id, input.approved);
        await writeTrpcAudit(ctx, {
          action: input.approved
            ? "review.status.approved"
            : "review.status.pending",
          entityType: "review",
          entityId: input.id,
          beforeJson: before,
          afterJson: review,
        });
        return { success: true, review };
      }),
    delete: managerWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const before = await db.getReviewByIdRaw(input.id);
        await db.deleteReview(input.id);
        await writeTrpcAudit(ctx, {
          action: "review.delete",
          entityType: "review",
          entityId: input.id,
          beforeJson: before,
        });
        return { success: true };
      }),
    replies: adminReadProcedure
      .input(z.object({ reviewId: z.number() }))
      .query(async ({ input }) => {
        return db.listReviewReplies(input.reviewId);
      }),
    reply: managerWriteProcedure
      .input(
        z.object({
          reviewId: z.number(),
          body: z.string().min(2).max(4000),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const created = await db.createReviewReply({
          reviewId: input.reviewId,
          adminUserId: ctx.user?.id ?? null,
          body: input.body,
        });
        await writeTrpcAudit(ctx, {
          action: "review.reply.create",
          entityType: "review_reply",
          entityId: created.id,
          afterJson: created,
        });
        return { success: true, reply: created };
      }),
  }),

  // Wishlist
  wishlist: router({
    add: publicProcedure
      .input(
        z.object({
          customerEmail: z.string().email(),
          productId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        await db.addToWishlist(input.customerEmail, input.productId);
        return { success: true };
      }),
    remove: publicProcedure
      .input(
        z.object({
          customerEmail: z.string().email(),
          productId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        await db.removeFromWishlist(input.customerEmail, input.productId);
        return { success: true };
      }),
    list: publicProcedure
      .input(z.object({ customerEmail: z.string().email() }))
      .query(async ({ input }) => {
        return db.getWishlist(input.customerEmail);
      }),
  }),

  // Coupons
  coupons: router({
    validate: publicProcedure
      .input(
        z.object({
          code: z.string(),
          orderAmount: z.number(),
        })
      )
      .query(async ({ input }) => {
        const coupon = await db.validateCoupon(input.code, input.orderAmount);
        if (!coupon)
          throw new TRPCError({ code: "NOT_FOUND", message: "Code invalide" });
        return coupon;
      }),
    useCoupon: publicProcedure
      .input(z.object({ couponId: z.number() }))
      .mutation(async ({ input }) => {
        await db.applyCoupon(input.couponId);
        return { success: true };
      }),
    list: adminReadProcedure
      .input(
        z
          .object({
            limit: z.number().default(200),
          })
          .optional()
      )
      .query(async ({ input }) => {
        return db.getCoupons(input?.limit ?? 200);
      }),
    create: managerWriteProcedure
      .input(
        z.object({
          code: z.string().min(2).max(50),
          description: z.string().optional(),
          discountType: z.enum(["percentage", "fixed"]),
          discountValue: z.number().min(1),
          minOrderAmount: z.number().min(0).default(0),
          maxUses: z.number().min(1).nullable().optional(),
          isActive: z.boolean().default(true),
          startDate: z.string().nullable().optional(),
          endDate: z.string().nullable().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const startDate =
          input.startDate && !Number.isNaN(new Date(input.startDate).getTime())
            ? new Date(input.startDate)
            : null;
        const endDate =
          input.endDate && !Number.isNaN(new Date(input.endDate).getTime())
            ? new Date(input.endDate)
            : null;
        const coupon = await db.createCoupon({
          code: input.code,
          description: input.description,
          discountType: input.discountType,
          discountValue: input.discountValue,
          minOrderAmount: input.minOrderAmount,
          maxUses: input.maxUses,
          isActive: input.isActive,
          startDate,
          endDate,
        });
        return { success: true, coupon };
      }),
    update: managerWriteProcedure
      .input(
        z.object({
          id: z.number(),
          code: z.string().min(2).max(50).optional(),
          description: z.string().nullable().optional(),
          discountType: z.enum(["percentage", "fixed"]).optional(),
          discountValue: z.number().min(1).optional(),
          minOrderAmount: z.number().min(0).optional(),
          maxUses: z.number().min(1).nullable().optional(),
          isActive: z.boolean().optional(),
          startDate: z.string().nullable().optional(),
          endDate: z.string().nullable().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, startDate, endDate, ...rest } = input;
        const coupon = await db.updateCoupon(id, {
          ...rest,
          startDate:
            startDate !== undefined
              ? startDate && !Number.isNaN(new Date(startDate).getTime())
                ? new Date(startDate)
                : null
              : undefined,
          endDate:
            endDate !== undefined
              ? endDate && !Number.isNaN(new Date(endDate).getTime())
                ? new Date(endDate)
                : null
              : undefined,
        });
        return { success: true, coupon };
      }),
    toggleActive: managerWriteProcedure
      .input(
        z.object({
          id: z.number(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const coupon = await db.toggleCouponStatus(input.id, input.isActive);
        return { success: true, coupon };
      }),
    delete: managerWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCoupon(input.id);
        return { success: true };
      }),
  }),

  // Flash Sales
  flashSales: router({
    active: publicProcedure.query(async () => {
      return db.getActiveFlashSales();
    }),
    forProduct: publicProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        return db.getFlashSaleForProduct(input.productId);
      }),
  }),

  // Referrals
  referrals: router({
    create: publicProcedure
      .input(z.object({ referrerEmail: z.string().email() }))
      .mutation(async ({ input }) => {
        const result = await db.createReferral(input.referrerEmail);
        return { success: true, result };
      }),
    validate: publicProcedure
      .input(z.object({ code: z.string() }))
      .query(async ({ input }) => {
        const referral = await db.getReferralByCode(input.code);
        if (!referral) throw new TRPCError({ code: "NOT_FOUND" });
        return referral;
      }),
  }),

  // Saved Addresses
  addresses: router({
    save: publicProcedure
      .input(
        z.object({
          customerEmail: z.string().email(),
          label: z.string().optional(),
          fullName: z.string(),
          phone: z.string(),
          address: z.string(),
          deliveryZoneId: z.number().optional(),
          isDefault: z.boolean().default(false),
        })
      )
      .mutation(async ({ input }) => {
        const result = await db.saveCustAddress(input.customerEmail, input);
        return { success: true, result };
      }),
    list: publicProcedure
      .input(z.object({ customerEmail: z.string().email() }))
      .query(async ({ input }) => {
        return db.getSavedAddresses(input.customerEmail);
      }),
  }),

  // Email Subscriptions
  emailSubscriptions: router({
    subscribe: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          subscriptionType: z
            .enum(["all", "promotions", "orders", "none"])
            .default("all"),
        })
      )
      .mutation(async ({ input }) => {
        await db.subscribeToEmails(input.email, input.subscriptionType);
        return { success: true };
      }),
    unsubscribe: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        await db.unsubscribeFromEmails(input.email);
        return { success: true };
      }),
  }),

  // Live Chat
  chat: router({
    send: publicProcedure
      .input(
        z.object({
          sessionId: z.string(),
          customerName: z.string(),
          customerEmail: z.string().email(),
          message: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const result = await db.saveChatMessage({
          ...input,
          isFromCustomer: true,
        });
        return { success: true, result };
      }),
    history: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        return db.getChatHistory(input.sessionId);
      }),
  }),

  // AI Features
  ai: router({
    recommendations: aiRecommendationsRouter,
    search: aiSearchRouter,
    chatbot: aiChatbotRouter,
  }),

  // Banners
  banners: bannersRouter,
});

export type AppRouter = typeof appRouter;
