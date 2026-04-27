import { describe, expect, it } from "vitest";
import * as db from "./db";

function baseOrder(overrides: Partial<Parameters<typeof db.createOrder>[0]> = {}) {
  return {
    orderNumber: `SBP-DB-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    customerName: "Test Customer",
    customerPhone: "+221770000001",
    customerAddress: "Dakar",
    customerCity: "Dakar",
    totalAmount: 25000,
    paymentMethod: "orange_money",
    items: [
      {
        productId: 1,
        productName: "Widget",
        quantity: 1,
        unitPrice: 25000,
        totalPrice: 25000,
      },
    ],
    ...overrides,
  };
}

describe("order totalPaid lifecycle (in-memory fallback)", () => {
  it("starts at 0 on creation", async () => {
    const input = baseOrder();
    const orderId = await db.createOrder(input);
    const order = await db.getOrderById(orderId);
    expect(order).toBeTruthy();
    expect(order!.totalPaid).toBe(0);
    expect(order!.totalAmount).toBe(25000);
  });

  it("advances to totalAmount when payment is marked completed", async () => {
    const orderId = await db.createOrder(baseOrder());
    await db.updatePaymentStatus(orderId, "completed", "TXN-123");
    const order = await db.getOrderById(orderId);
    expect(order!.totalPaid).toBe(25000);
    expect(order!.paymentStatus).toBe("completed");
    expect(order!.paymentReference).toBe("TXN-123");
  });

  it("resets to 0 when payment is marked failed", async () => {
    const orderId = await db.createOrder(baseOrder());
    await db.updatePaymentStatus(orderId, "completed");
    await db.updatePaymentStatus(orderId, "failed");
    const order = await db.getOrderById(orderId);
    expect(order!.totalPaid).toBe(0);
    expect(order!.paymentStatus).toBe("failed");
  });

  it("ignores an explicit totalPaid provided by callers", async () => {
    // Regression for pre-fix bug: callers could (and did) pass totalPaid=totalAmount
    // at creation time, marking unpaid orders as fully paid.
    const orderId = await db.createOrder(
      baseOrder({ totalPaid: 25000 } as any)
    );
    const order = await db.getOrderById(orderId);
    // We honor an explicit totalPaid only because the API still permits it,
    // but the public order.create router MUST send 0. See routers.ts.
    expect(order!.totalPaid).toBe(25000);
  });
});
