import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter, __resetOrderRateLimitForTests } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  getEffectiveAdminRole: vi.fn().mockResolvedValue(null),
  getProductById: vi.fn().mockResolvedValue({
    id: 1,
    name: "Produit test",
    price: 1000,
    inStock: true,
    imageUrl: null,
  }),
  getDeliveryZoneById: vi.fn().mockResolvedValue(undefined),
  createOrder: vi.fn().mockResolvedValue(1),
  getOrCreateCustomer: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./coupon-service", () => ({
  getAppliedCouponForCheckout: vi.fn().mockResolvedValue({
    couponId: null,
    couponCode: null,
    discountAmount: 0,
    discountType: null,
  }),
  clearSessionCart: vi.fn().mockResolvedValue(undefined),
  createCouponRedemption: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./email-service", () => ({
  sendOrderConfirmationEmail: vi.fn().mockResolvedValue(true),
  sendAdminOrderNotification: vi.fn().mockResolvedValue(true),
  sendOrderStatusUpdateEmail: vi.fn().mockResolvedValue(true),
}));

function ctxWithIp(ip: string): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: { "x-forwarded-for": ip },
    } as unknown as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

const baseInput = {
  customerName: "Test",
  customerPhone: "+221770000000",
  customerAddress: "Dakar",
  paymentMethod: "orange_money",
  items: [{ productId: 1, quantity: 1 }],
};

describe("order.create rate limit", () => {
  beforeEach(() => {
    __resetOrderRateLimitForTests();
  });

  it("allows the first 6 orders and blocks the 7th from the same origin", async () => {
    const caller = appRouter.createCaller(ctxWithIp("203.0.113.5"));
    for (let i = 0; i < 6; i++) {
      await caller.order.create(baseInput);
    }
    await expect(caller.order.create(baseInput)).rejects.toThrow(
      /Trop de commandes/
    );
  });

  it("tracks per-IP, so a different IP is not affected", async () => {
    const attacker = appRouter.createCaller(ctxWithIp("198.51.100.1"));
    for (let i = 0; i < 6; i++) {
      await attacker.order.create(baseInput);
    }
    await expect(attacker.order.create(baseInput)).rejects.toThrow(
      /Trop de commandes/
    );

    const innocent = appRouter.createCaller(ctxWithIp("198.51.100.2"));
    await expect(innocent.order.create(baseInput)).resolves.toMatchObject({
      orderNumber: expect.stringMatching(/^SBP-/),
    });
  });
});
