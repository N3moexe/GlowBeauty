import { describe, expect, it, vi } from "vitest";
import { getOrderStatusTool } from "./chatbot/tools";
import * as db from "./db";
import * as store from "./chatbot/store";

vi.mock("./db", () => ({
  getOrderByNumber: vi.fn().mockImplementation(async (orderNumber: string) => {
    if (orderNumber !== "SBP-TEST-0001") return undefined;
    return {
      id: 1,
      orderNumber,
      status: "processing",
      paymentStatus: "completed",
      totalAmount: 12000,
      customerPhone: "+221771234567",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
  }),
}));

vi.mock("./chatbot/store", () => ({
  logChatEvent: vi.fn().mockResolvedValue(undefined),
  findOrdersByPhone: vi.fn().mockResolvedValue([]),
}));

describe("chatbot order status privacy", () => {
  it("requires both order number and phone last4", async () => {
    const result = await getOrderStatusTool("SBP-TEST-0001");

    expect(result.found).toBe(false);
    expect(db.getOrderByNumber).not.toHaveBeenCalled();
    expect(store.findOrdersByPhone).not.toHaveBeenCalled();
  });

  it("rejects a wrong phone last4 without falling back to phone search", async () => {
    const result = await getOrderStatusTool("SBP-TEST-0001 0000");

    expect(result.found).toBe(false);
    expect(store.findOrdersByPhone).not.toHaveBeenCalled();
  });

  it("returns masked phone data when proof matches", async () => {
    const result = await getOrderStatusTool("SBP-TEST-0001 4567");

    expect(result.found).toBe(true);
    expect(result.orders[0]).toMatchObject({
      orderNumber: "SBP-TEST-0001",
      customerPhone: "****4567",
    });
  });
});
