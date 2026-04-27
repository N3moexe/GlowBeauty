import crypto from "node:crypto";
import { and, count, desc, eq } from "drizzle-orm";
import type {
  CartSummary,
  CouponRecord,
  CouponType,
  CouponValidationResult,
  CreateCouponInput,
  UpdateCouponInput,
} from "@shared/coupons";
import * as dbCore from "./db";

type SessionUserIdentity = {
  sessionId: string;
};

type ResolvedCartItem = {
  productId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

type CartSnapshot = {
  id: string;
  sessionId: string;
  userId: number | null;
  deliveryZoneId: number | null;
  couponCode: string | null;
  discountAmount: number;
  discountType: CouponType | null;
  shippingFee: number;
  subtotalAmount: number;
  totalAmount: number;
  items: ResolvedCartItem[];
};

type CouponValidationInput = {
  code: string;
  sessionId: string;
  cartItems: ResolvedCartItem[];
  subtotal: number;
  shippingFee: number;
  now?: Date;
};

type CouponApplyResult = {
  summary: CartSummary;
  validation: CouponValidationResult;
};

const demoCoupons: CouponRecord[] = [
  {
    id: "demo-coupon-sen10",
    code: "SEN10",
    type: "PERCENT",
    value: 10,
    minSubtotal: 15000,
    maxDiscount: null,
    startAt: null,
    endAt: null,
    usageLimit: null,
    perSessionLimit: null,
    active: true,
    appliesTo: "ALL",
    categoryId: null,
    productId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: "demo-coupon-welcome2000",
    code: "WELCOME2000",
    type: "FIXED",
    value: 2000,
    minSubtotal: 10000,
    maxDiscount: null,
    startAt: null,
    endAt: null,
    usageLimit: null,
    perSessionLimit: null,
    active: true,
    appliesTo: "ALL",
    categoryId: null,
    productId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: "demo-coupon-freeship",
    code: "FREESHIP",
    type: "FREE_SHIPPING",
    value: 0,
    minSubtotal: 20000,
    maxDiscount: null,
    startAt: null,
    endAt: null,
    usageLimit: null,
    perSessionLimit: null,
    active: true,
    appliesTo: "ALL",
    categoryId: null,
    productId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: 0,
  },
];

const demoCouponRedemptions: Array<{
  id: string;
  couponId: string;
  sessionId: string;
  userId: string | null;
  orderId: string | null;
  redeemedAt: Date;
}> = [];

const demoCarts = new Map<string, CartSnapshot>();

function buildId(prefix: string) {
  const random = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${random}`;
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeLimit(value: number | null | undefined) {
  if (typeof value !== "number") return null;
  if (!Number.isFinite(value)) return null;
  if (value <= 0) return null;
  return Math.trunc(value);
}

function mapCouponRow(row: any, usageCount = 0): CouponRecord {
  return {
    id: String(row.id),
    code: normalizeCode(String(row.code || "")),
    type: String(row.type || "FIXED") as CouponType,
    value: Number(row.value || 0),
    minSubtotal: Number(row.minSubtotal || 0),
    maxDiscount: row.maxDiscount == null ? null : Number(row.maxDiscount),
    startAt: toIso(row.startAt),
    endAt: toIso(row.endAt),
    usageLimit: normalizeLimit(row.usageLimit),
    perSessionLimit: normalizeLimit(row.perSessionLimit),
    active: Boolean(row.active),
    appliesTo: String(row.appliesTo || "ALL") as CouponRecord["appliesTo"],
    categoryId: row.categoryId == null ? null : String(row.categoryId),
    productId: row.productId == null ? null : String(row.productId),
    createdAt: toIso(row.createdAt) || new Date().toISOString(),
    updatedAt: toIso(row.updatedAt) || new Date().toISOString(),
    usageCount,
  };
}

function buildCartSummary(snapshot: CartSnapshot): CartSummary {
  const subtotal = Number(snapshot.subtotalAmount || 0);
  const shippingFee = Number(snapshot.shippingFee || 0);
  const discountAmount = Math.max(0, Number(snapshot.discountAmount || 0));
  return {
    sessionId: snapshot.sessionId,
    subtotal,
    shippingFee,
    discountAmount,
    discountType: snapshot.discountType || null,
    couponCode: snapshot.couponCode || null,
    total: Math.max(0, subtotal + shippingFee - discountAmount),
  };
}

export function computeCartSubtotal(items: Array<{ totalPrice: number }>) {
  return items.reduce((sum, item) => sum + Math.max(0, Math.trunc(Number(item.totalPrice || 0))), 0);
}

export function computeEligibleSubtotal(items: ResolvedCartItem[]) {
  return computeCartSubtotal(items);
}

async function resolveCartItems(
  rawItems: Array<{ productId: number; quantity: number }>
): Promise<ResolvedCartItem[]> {
  const output: ResolvedCartItem[] = [];
  for (const item of rawItems) {
    const product = await dbCore.getProductById(Number(item.productId));
    if (!product) {
      throw new Error(`Product not found: ${item.productId}`);
    }
    const quantity = Math.max(1, Math.trunc(Number(item.quantity || 0)));
    const unitPrice = Number((product as any).price || 0);
    output.push({
      productId: Number(product.id),
      quantity,
      unitPrice,
      totalPrice: unitPrice * quantity,
    });
  }
  return output;
}

async function getCouponUsageCount(couponId: string) {
  const db = await dbCore.getDb();
  if (!db) {
    return demoCouponRedemptions.filter((entry) => entry.couponId === couponId).length;
  }
  const { couponRedemptions } = await import("../drizzle/schema");
  const rows = await db
    .select({ value: count() })
    .from(couponRedemptions)
    .where(eq(couponRedemptions.couponId, couponId));
  return Number(rows[0]?.value || 0);
}

async function getCouponRedemptionCountByIdentity(
  couponId: string,
  identity: SessionUserIdentity
) {
  const db = await dbCore.getDb();

  if (!db) {
    return demoCouponRedemptions.filter(
      (entry) => entry.couponId === couponId && entry.sessionId === identity.sessionId
    ).length;
  }

  const { couponRedemptions } = await import("../drizzle/schema");
  const where = and(
    eq(couponRedemptions.couponId, couponId),
    eq(couponRedemptions.sessionId, identity.sessionId)
  );
  const rows = await db
    .select({ value: count() })
    .from(couponRedemptions)
    .where(where);
  return Number(rows[0]?.value || 0);
}

async function loadCouponByCode(code: string): Promise<CouponRecord | null> {
  const normalized = normalizeCode(code);
  const db = await dbCore.getDb();
  if (!db) {
    const found = demoCoupons.find((entry) => normalizeCode(entry.code) === normalized);
    return found ? { ...found, usageCount: await getCouponUsageCount(found.id) } : null;
  }

  const { coupons } = await import("../drizzle/schema");
  const rows = await db
    .select()
    .from(coupons)
    .where(eq(coupons.code, normalized))
    .limit(1);
  if (!rows[0]) return null;
  const usageCount = await getCouponUsageCount(String(rows[0].id));
  return mapCouponRow(rows[0], usageCount);
}

async function loadCouponById(id: string): Promise<CouponRecord | null> {
  const db = await dbCore.getDb();
  if (!db) {
    const found = demoCoupons.find((entry) => entry.id === id);
    return found ? { ...found, usageCount: await getCouponUsageCount(found.id) } : null;
  }

  const { coupons } = await import("../drizzle/schema");
  const rows = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1);
  if (!rows[0]) return null;
  const usageCount = await getCouponUsageCount(String(rows[0].id));
  return mapCouponRow(rows[0], usageCount);
}

async function saveCartSnapshot(snapshot: CartSnapshot) {
  const db = await dbCore.getDb();
  if (!db) {
    demoCarts.set(snapshot.sessionId, { ...snapshot });
    return;
  }

  const { carts, cartItems } = await import("../drizzle/schema");
  const existing = await db
    .select()
    .from(carts)
    .where(eq(carts.sessionId, snapshot.sessionId))
    .limit(1);
  const cartId = existing[0]?.id || snapshot.id;

  if (existing[0]) {
    await db
      .update(carts)
      .set({
        userId: snapshot.userId,
        deliveryZoneId: snapshot.deliveryZoneId,
        subtotalAmount: snapshot.subtotalAmount,
        shippingFee: snapshot.shippingFee,
        couponCode: snapshot.couponCode,
        discountAmount: snapshot.discountAmount,
        discountType: snapshot.discountType,
        totalAmount: snapshot.totalAmount,
      })
      .where(eq(carts.id, cartId));
  } else {
    await db.insert(carts).values({
      id: cartId,
      sessionId: snapshot.sessionId,
      userId: snapshot.userId,
      deliveryZoneId: snapshot.deliveryZoneId,
      subtotalAmount: snapshot.subtotalAmount,
      shippingFee: snapshot.shippingFee,
      couponCode: snapshot.couponCode,
      discountAmount: snapshot.discountAmount,
      discountType: snapshot.discountType,
      totalAmount: snapshot.totalAmount,
    });
  }

  await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
  if (snapshot.items.length > 0) {
    await db.insert(cartItems).values(
      snapshot.items.map((item) => ({
        id: buildId("cart-item"),
        cartId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      }))
    );
  }
}

async function loadCartSnapshotBySessionId(sessionId: string): Promise<CartSnapshot | null> {
  const db = await dbCore.getDb();
  if (!db) {
    const found = demoCarts.get(sessionId);
    return found ? { ...found, items: [...found.items] } : null;
  }

  const { carts, cartItems } = await import("../drizzle/schema");
  const cartRows = await db.select().from(carts).where(eq(carts.sessionId, sessionId)).limit(1);
  const cart = cartRows[0];
  if (!cart) return null;

  const items = await db.select().from(cartItems).where(eq(cartItems.cartId, cart.id));
  return {
    id: String(cart.id),
    sessionId: String(cart.sessionId),
    userId: cart.userId == null ? null : Number(cart.userId),
    deliveryZoneId: cart.deliveryZoneId == null ? null : Number(cart.deliveryZoneId),
    couponCode: cart.couponCode == null ? null : String(cart.couponCode),
    discountAmount: Number(cart.discountAmount || 0),
    discountType: (cart.discountType as CouponType | null) || null,
    shippingFee: Number(cart.shippingFee || 0),
    subtotalAmount: Number(cart.subtotalAmount || 0),
    totalAmount: Number(cart.totalAmount || 0),
    items: items.map((item) => ({
      productId: Number(item.productId),
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
      totalPrice: Number(item.totalPrice || 0),
    })),
  };
}

async function setCartDiscount(
  sessionId: string,
  input: {
    couponCode: string | null;
    discountAmount: number;
    discountType: CouponType | null;
    shippingFee?: number;
  }
) {
  const snapshot = await loadCartSnapshotBySessionId(sessionId);
  if (!snapshot) return null;
  const subtotal = Number(snapshot.subtotalAmount || 0);
  const shippingFee =
    input.shippingFee == null
      ? Number(snapshot.shippingFee || 0)
      : Math.max(0, Math.trunc(Number(input.shippingFee || 0)));
  const discountAmount = Math.max(0, Number(input.discountAmount || 0));
  const totalAmount = Math.max(0, subtotal + shippingFee - discountAmount);
  const next: CartSnapshot = {
    ...snapshot,
    shippingFee,
    couponCode: input.couponCode,
    discountAmount,
    discountType: input.discountType,
    totalAmount,
  };
  await saveCartSnapshot(next);
  return next;
}

function buildValidationError(
  code: CouponValidationResult["code"],
  message: string
): CouponValidationResult {
  return {
    ok: false,
    code,
    message,
    discountAmount: 0,
    eligibleSubtotal: 0,
  };
}

export async function validateCoupon(
  input: CouponValidationInput
): Promise<CouponValidationResult> {
  const code = normalizeCode(input.code);
  const coupon = await loadCouponByCode(code);
  if (!coupon) {
    return buildValidationError("INVALID_CODE", "Coupon code is invalid.");
  }

  const now = input.now || new Date();
  const startAt = coupon.startAt ? new Date(coupon.startAt) : null;
  const endAt = coupon.endAt ? new Date(coupon.endAt) : null;

  if (!coupon.active) {
    return buildValidationError("INACTIVE", "Coupon is inactive.");
  }

  if (startAt && now < startAt) {
    return buildValidationError("NOT_STARTED", "Coupon is not active yet.");
  }

  if (endAt && now > endAt) {
    return buildValidationError("EXPIRED", "Coupon has expired.");
  }

  if (input.subtotal < coupon.minSubtotal) {
    return buildValidationError(
      "MIN_SUBTOTAL_NOT_MET",
      `Minimum subtotal is ${coupon.minSubtotal} CFA.`
    );
  }

  const usageCount = await getCouponUsageCount(coupon.id);
  if (coupon.usageLimit !== null && usageCount >= coupon.usageLimit) {
    return buildValidationError("USAGE_LIMIT_REACHED", "Coupon global usage limit reached.");
  }

  const perIdentityUsage = await getCouponRedemptionCountByIdentity(coupon.id, {
    sessionId: input.sessionId,
  });
  if (coupon.perSessionLimit !== null && perIdentityUsage >= coupon.perSessionLimit) {
    return buildValidationError(
      "PER_SESSION_LIMIT_REACHED",
      "Coupon session usage limit reached."
    );
  }

  const eligibleSubtotal = computeEligibleSubtotal(input.cartItems);

  if (eligibleSubtotal <= 0 && coupon.type !== "FREE_SHIPPING") {
    return buildValidationError(
      "NOT_APPLICABLE",
      "Coupon does not apply to cart items."
    );
  }

  let discountAmount = 0;
  if (coupon.type === "PERCENT") {
    discountAmount = Math.floor((eligibleSubtotal * coupon.value) / 100);
  } else if (coupon.type === "FIXED") {
    discountAmount = Math.min(coupon.value, eligibleSubtotal);
  } else {
    discountAmount = Math.max(0, input.shippingFee);
  }

  if (coupon.maxDiscount !== null) {
    discountAmount = Math.min(discountAmount, coupon.maxDiscount);
  }

  discountAmount = Math.max(0, Math.floor(discountAmount));

  return {
    ok: true,
    message: `Coupon ${coupon.code} applied.`,
    coupon,
    discountAmount,
    discountType: coupon.type,
    eligibleSubtotal,
  };
}

export async function syncSessionCart(input: {
  sessionId: string;
  userId?: number | null;
  deliveryZoneId?: number | null;
  items: Array<{ productId: number; quantity: number }>;
}): Promise<CartSummary> {
  const existing = await loadCartSnapshotBySessionId(input.sessionId);
  const resolvedItems = await resolveCartItems(input.items);
  const subtotalAmount = computeCartSubtotal(resolvedItems);

  let shippingFee = 0;
  if (input.deliveryZoneId != null) {
    const zone = await dbCore.getDeliveryZoneById(Number(input.deliveryZoneId));
    shippingFee = Number(zone?.deliveryFee || 0);
  } else {
    shippingFee = Number(existing?.shippingFee || 0);
  }

  const next: CartSnapshot = {
    id: existing?.id || buildId("cart"),
    sessionId: input.sessionId,
    userId: input.userId == null ? existing?.userId ?? null : Number(input.userId),
    deliveryZoneId:
      input.deliveryZoneId == null
        ? existing?.deliveryZoneId ?? null
        : Number(input.deliveryZoneId),
    couponCode: existing?.couponCode || null,
    discountAmount: 0,
    discountType: null,
    shippingFee,
    subtotalAmount,
    totalAmount: subtotalAmount + shippingFee,
    items: resolvedItems,
  };

  await saveCartSnapshot(next);

  if (!next.couponCode) {
    return buildCartSummary(next);
  }

  const validation = await validateCoupon({
    code: next.couponCode,
    sessionId: next.sessionId,
    cartItems: next.items,
    subtotal: next.subtotalAmount,
    shippingFee: next.shippingFee,
  });

  if (!validation.ok) {
    const cleared = await setCartDiscount(next.sessionId, {
      couponCode: null,
      discountAmount: 0,
      discountType: null,
    });
    return buildCartSummary(cleared || next);
  }

  const updated = await setCartDiscount(next.sessionId, {
    couponCode: validation.coupon?.code || null,
    discountAmount: validation.discountAmount,
    discountType: validation.discountType || null,
  });
  return buildCartSummary(updated || next);
}

export async function getSessionCartSummary(sessionId: string): Promise<CartSummary | null> {
  const snapshot = await loadCartSnapshotBySessionId(sessionId);
  if (!snapshot) return null;
  return buildCartSummary(snapshot);
}

export async function applyCouponToSessionCart(input: {
  sessionId: string;
  code: string;
  shippingFee?: number;
}): Promise<CouponApplyResult> {
  const snapshot = await loadCartSnapshotBySessionId(input.sessionId);
  if (!snapshot) {
    return {
      summary: {
        sessionId: input.sessionId,
        subtotal: 0,
        shippingFee: 0,
        discountAmount: 0,
        discountType: null,
        couponCode: null,
        total: 0,
      },
      validation: buildValidationError("CART_NOT_FOUND", "Cart session not found."),
    };
  }

  const validation = await validateCoupon({
    code: input.code,
    sessionId: input.sessionId,
    cartItems: snapshot.items,
    subtotal: snapshot.subtotalAmount,
    shippingFee:
      input.shippingFee == null
        ? snapshot.shippingFee
        : Math.max(0, Math.trunc(Number(input.shippingFee || 0))),
  });

  if (!validation.ok) {
    return {
      summary: buildCartSummary(snapshot),
      validation,
    };
  }

  const updated = await setCartDiscount(input.sessionId, {
    couponCode: validation.coupon?.code || null,
    discountAmount: validation.discountAmount,
    discountType: validation.discountType || null,
    shippingFee:
      input.shippingFee == null
        ? undefined
        : Math.max(0, Math.trunc(Number(input.shippingFee || 0))),
  });

  return {
    summary: buildCartSummary(updated || snapshot),
    validation,
  };
}

export async function previewCouponForSessionCart(input: {
  sessionId: string;
  code: string;
  shippingFee?: number;
}): Promise<CouponApplyResult> {
  const snapshot = await loadCartSnapshotBySessionId(input.sessionId);
  if (!snapshot) {
    return {
      summary: {
        sessionId: input.sessionId,
        subtotal: 0,
        shippingFee: 0,
        discountAmount: 0,
        discountType: null,
        couponCode: null,
        total: 0,
      },
      validation: buildValidationError("CART_NOT_FOUND", "Cart session not found."),
    };
  }

  const validation = await validateCoupon({
    code: input.code,
    sessionId: input.sessionId,
    cartItems: snapshot.items,
    subtotal: snapshot.subtotalAmount,
    shippingFee:
      input.shippingFee == null
        ? snapshot.shippingFee
        : Math.max(0, Math.trunc(Number(input.shippingFee || 0))),
  });

  if (!validation.ok) {
    return {
      summary: buildCartSummary(snapshot),
      validation,
    };
  }

  const discountAmount = validation.discountAmount;
  const effectiveShippingFee =
    input.shippingFee == null
      ? Number(snapshot.shippingFee || 0)
      : Math.max(0, Math.trunc(Number(input.shippingFee || 0)));
  const total = Math.max(
    0,
    Number(snapshot.subtotalAmount || 0) + effectiveShippingFee - discountAmount
  );

  return {
    summary: {
      sessionId: snapshot.sessionId,
      subtotal: snapshot.subtotalAmount,
      shippingFee: effectiveShippingFee,
      discountAmount,
      discountType: validation.discountType || null,
      couponCode: validation.coupon?.code || null,
      total,
    },
    validation,
  };
}

export async function removeCouponFromSessionCart(sessionId: string): Promise<CartSummary | null> {
  const updated = await setCartDiscount(sessionId, {
    couponCode: null,
    discountAmount: 0,
    discountType: null,
  });
  if (!updated) return null;
  return buildCartSummary(updated);
}

export async function getAppliedCouponForCheckout(input: {
  sessionId: string;
  cartItems: ResolvedCartItem[];
  subtotal: number;
  shippingFee: number;
}) {
  const snapshot = await loadCartSnapshotBySessionId(input.sessionId);
  if (!snapshot?.couponCode) {
    return {
      couponId: null as string | null,
      couponCode: null as string | null,
      discountAmount: 0,
      discountType: null as CouponType | null,
    };
  }

  const validation = await validateCoupon({
    code: snapshot.couponCode,
    sessionId: input.sessionId,
    cartItems: input.cartItems,
    subtotal: input.subtotal,
    shippingFee: input.shippingFee,
  });

  if (!validation.ok) {
    await setCartDiscount(input.sessionId, {
      couponCode: null,
      discountAmount: 0,
      discountType: null,
    });
    return {
      couponId: null as string | null,
      couponCode: null as string | null,
      discountAmount: 0,
      discountType: null as CouponType | null,
    };
  }

  await setCartDiscount(input.sessionId, {
    couponCode: validation.coupon?.code || null,
    discountAmount: validation.discountAmount,
    discountType: validation.discountType || null,
    shippingFee: input.shippingFee,
  });

  return {
    couponId: validation.coupon?.id || null,
    couponCode: validation.coupon?.code || null,
    discountAmount: validation.discountAmount,
    discountType: validation.discountType || null,
  };
}

export async function createCouponRedemption(input: {
  couponId: string;
  sessionId: string;
  userId?: string | number | null;
  orderId?: string | number | null;
}) {
  const row = {
    id: buildId("coupon-redemption"),
    couponId: input.couponId,
    sessionId: input.sessionId,
    userId:
      input.userId == null || String(input.userId).trim().length === 0
        ? null
        : String(input.userId),
    orderId:
      input.orderId == null || String(input.orderId).trim().length === 0
        ? null
        : String(input.orderId),
    redeemedAt: new Date(),
  };

  const db = await dbCore.getDb();
  if (!db) {
    demoCouponRedemptions.push(row);
    return row;
  }

  const { couponRedemptions } = await import("../drizzle/schema");
  await db.insert(couponRedemptions).values({
    id: row.id,
    couponId: row.couponId,
    sessionId: row.sessionId,
    userId: row.userId,
    orderId: row.orderId,
    redeemedAt: row.redeemedAt,
  });
  return row;
}

export async function clearSessionCart(sessionId: string) {
  const db = await dbCore.getDb();
  if (!db) {
    demoCarts.delete(sessionId);
    return;
  }
  const { carts, cartItems } = await import("../drizzle/schema");
  const existing = await db.select().from(carts).where(eq(carts.sessionId, sessionId)).limit(1);
  if (!existing[0]) return;
  await db.delete(cartItems).where(eq(cartItems.cartId, existing[0].id));
  await db.delete(carts).where(eq(carts.id, existing[0].id));
}

export async function listAdminCoupons(limit = 200): Promise<CouponRecord[]> {
  const db = await dbCore.getDb();
  if (!db) {
    const rows = [...demoCoupons]
      .sort(
        (left, right) =>
          Number(new Date(right.createdAt)) - Number(new Date(left.createdAt))
      )
      .slice(0, Math.max(1, limit));
    return Promise.all(
      rows.map(async (entry) => ({
        ...entry,
        usageCount: await getCouponUsageCount(entry.id),
      }))
    );
  }

  const { coupons } = await import("../drizzle/schema");
  const rows = await db
    .select()
    .from(coupons)
    .orderBy(desc(coupons.createdAt))
    .limit(Math.max(1, limit));

  const result: CouponRecord[] = [];
  for (const row of rows) {
    const usageCount = await getCouponUsageCount(String(row.id));
    result.push(mapCouponRow(row, usageCount));
  }
  return result;
}

export async function createAdminCoupon(input: CreateCouponInput): Promise<CouponRecord> {
  const code = normalizeCode(input.code);
  const duplicate = await loadCouponByCode(code);
  if (duplicate) {
    throw new Error("Coupon code already exists.");
  }

  const now = new Date();
  const payload = {
    id: buildId("coupon"),
    code,
    type: input.type,
    value: Math.trunc(input.value),
    minSubtotal: Math.max(0, Math.trunc(input.minSubtotal ?? 0)),
    maxDiscount: normalizeLimit(input.maxDiscount) ?? null,
    startAt: input.startAt ? new Date(input.startAt) : null,
    endAt: input.endAt ? new Date(input.endAt) : null,
    usageLimit: normalizeLimit(input.usageLimit) ?? null,
    perSessionLimit: normalizeLimit(input.perSessionLimit) ?? null,
    active: input.active ?? true,
    appliesTo: input.appliesTo ?? "ALL",
    categoryId: input.categoryId ?? null,
    productId: input.productId ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const db = await dbCore.getDb();
  if (!db) {
    const row = mapCouponRow(payload, 0);
    demoCoupons.unshift(row);
    return row;
  }

  const { coupons } = await import("../drizzle/schema");
  await db.insert(coupons).values(payload as any);
  const inserted = await loadCouponById(payload.id);
  if (!inserted) throw new Error("Failed to reload created coupon.");
  return inserted;
}

export async function updateAdminCoupon(
  id: string,
  input: UpdateCouponInput
): Promise<CouponRecord> {
  const current = await loadCouponById(id);
  if (!current) throw new Error("Coupon not found.");

  const nextCode =
    input.code !== undefined ? normalizeCode(String(input.code)) : current.code;
  if (nextCode !== current.code) {
    const duplicate = await loadCouponByCode(nextCode);
    if (duplicate && duplicate.id !== id) {
      throw new Error("Coupon code already exists.");
    }
  }

  const db = await dbCore.getDb();
  if (!db) {
    const index = demoCoupons.findIndex((entry) => entry.id === id);
    if (index < 0) throw new Error("Coupon not found.");
    const updated: CouponRecord = {
      ...demoCoupons[index],
      ...(input.code !== undefined ? { code: nextCode } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.value !== undefined ? { value: Math.trunc(input.value) } : {}),
      ...(input.minSubtotal !== undefined
        ? { minSubtotal: Math.max(0, Math.trunc(input.minSubtotal)) }
        : {}),
      ...(input.maxDiscount !== undefined
        ? { maxDiscount: normalizeLimit(input.maxDiscount) ?? null }
        : {}),
      ...(input.startAt !== undefined ? { startAt: input.startAt } : {}),
      ...(input.endAt !== undefined ? { endAt: input.endAt } : {}),
      ...(input.usageLimit !== undefined
        ? { usageLimit: normalizeLimit(input.usageLimit) ?? null }
        : {}),
      ...(input.perSessionLimit !== undefined
        ? { perSessionLimit: normalizeLimit(input.perSessionLimit) ?? null }
        : {}),
      ...(input.active !== undefined ? { active: Boolean(input.active) } : {}),
      ...(input.appliesTo !== undefined ? { appliesTo: input.appliesTo } : {}),
      ...(input.categoryId !== undefined
        ? { categoryId: input.categoryId ?? null }
        : {}),
      ...(input.productId !== undefined ? { productId: input.productId ?? null } : {}),
      updatedAt: new Date().toISOString(),
    };
    demoCoupons[index] = updated;
    return {
      ...updated,
      usageCount: await getCouponUsageCount(updated.id),
    };
  }

  const { coupons } = await import("../drizzle/schema");
  const payload: Record<string, unknown> = {};
  if (input.code !== undefined) payload.code = nextCode;
  if (input.type !== undefined) payload.type = input.type;
  if (input.value !== undefined) payload.value = Math.trunc(input.value);
  if (input.minSubtotal !== undefined) payload.minSubtotal = Math.max(0, Math.trunc(input.minSubtotal));
  if (input.maxDiscount !== undefined) payload.maxDiscount = normalizeLimit(input.maxDiscount) ?? null;
  if (input.startAt !== undefined) payload.startAt = input.startAt ? new Date(input.startAt) : null;
  if (input.endAt !== undefined) payload.endAt = input.endAt ? new Date(input.endAt) : null;
  if (input.usageLimit !== undefined) payload.usageLimit = normalizeLimit(input.usageLimit) ?? null;
  if (input.perSessionLimit !== undefined)
    payload.perSessionLimit = normalizeLimit(input.perSessionLimit) ?? null;
  if (input.active !== undefined) payload.active = Boolean(input.active);
  if (input.appliesTo !== undefined) payload.appliesTo = input.appliesTo;
  if (input.categoryId !== undefined) payload.categoryId = input.categoryId ?? null;
  if (input.productId !== undefined) payload.productId = input.productId ?? null;

  if (Object.keys(payload).length > 0) {
    await db.update(coupons).set(payload as any).where(eq(coupons.id, id));
  }
  const updated = await loadCouponById(id);
  if (!updated) throw new Error("Coupon not found.");
  return updated;
}

export async function deactivateAdminCoupon(id: string): Promise<CouponRecord> {
  return updateAdminCoupon(id, { active: false });
}
