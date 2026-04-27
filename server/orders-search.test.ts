import { beforeEach, describe, expect, it } from "vitest";
import { createOrder, getOrders, __resetDemoOrdersForTests } from "./db";

const baseItems = [
  {
    productId: 1,
    productName: "Crème éclat",
    quantity: 1,
    unitPrice: 12000,
    totalPrice: 12000,
  },
];

beforeEach(() => {
  __resetDemoOrdersForTests();
});

describe("db.getOrders — query filter (demo branch)", () => {
  it("returns only orders whose customerName contains the query (case-insensitive)", async () => {
    await createOrder({
      orderNumber: "SBP-Q-0001",
      customerName: "Moussa Diop",
      customerPhone: "+221770000001",
      customerAddress: "Dakar",
      totalAmount: 12000,
      paymentMethod: "orange_money",
      items: baseItems,
    });
    await createOrder({
      orderNumber: "SBP-Q-0002",
      customerName: "Fatou Ndiaye",
      customerPhone: "+221770000002",
      customerAddress: "Dakar",
      totalAmount: 12000,
      paymentMethod: "wave",
      items: baseItems,
    });

    const { orders, total } = await getOrders({ query: "moussa" });

    expect(total).toBe(1);
    expect(orders).toHaveLength(1);
    expect(orders[0].customerName).toBe("Moussa Diop");
  });

  it("matches by orderNumber substring", async () => {
    await createOrder({
      orderNumber: "SBP-Q-1234",
      customerName: "Alpha",
      customerPhone: "+221770000003",
      customerAddress: "Dakar",
      totalAmount: 5000,
      paymentMethod: "orange_money",
      items: baseItems,
    });
    await createOrder({
      orderNumber: "SBP-Q-5678",
      customerName: "Beta",
      customerPhone: "+221770000004",
      customerAddress: "Dakar",
      totalAmount: 5000,
      paymentMethod: "wave",
      items: baseItems,
    });

    const { orders, total } = await getOrders({ query: "1234" });

    expect(total).toBe(1);
    expect(orders[0].orderNumber).toBe("SBP-Q-1234");
  });

  it("matches by customerPhone substring", async () => {
    await createOrder({
      orderNumber: "SBP-Q-P1",
      customerName: "Aicha",
      customerPhone: "+221778889999",
      customerAddress: "Dakar",
      totalAmount: 5000,
      paymentMethod: "orange_money",
      items: baseItems,
    });
    await createOrder({
      orderNumber: "SBP-Q-P2",
      customerName: "Bineta",
      customerPhone: "+221770001111",
      customerAddress: "Dakar",
      totalAmount: 5000,
      paymentMethod: "wave",
      items: baseItems,
    });

    const { orders, total } = await getOrders({ query: "888" });

    expect(total).toBe(1);
    expect(orders[0].customerPhone).toBe("+221778889999");
  });

  it("combines query and status filters", async () => {
    await createOrder({
      orderNumber: "SBP-Q-S1",
      customerName: "Moussa",
      customerPhone: "+221770000001",
      customerAddress: "Dakar",
      totalAmount: 5000,
      paymentMethod: "orange_money",
      items: baseItems,
    });
    const secondId = await createOrder({
      orderNumber: "SBP-Q-S2",
      customerName: "Moussa",
      customerPhone: "+221770000002",
      customerAddress: "Dakar",
      totalAmount: 5000,
      paymentMethod: "cash_on_delivery",
      items: baseItems,
    });
    const { orders: all } = await getOrders({});
    const target = all.find(o => o.id === secondId);
    if (target) target.status = "delivered";

    const { orders, total } = await getOrders({
      query: "moussa",
      status: "pending",
    });

    expect(total).toBe(1);
    expect(orders[0].orderNumber).toBe("SBP-Q-S1");
  });

  it("returns empty when query matches nothing", async () => {
    await createOrder({
      orderNumber: "SBP-Q-N1",
      customerName: "Aicha",
      customerPhone: "+221770000001",
      customerAddress: "Dakar",
      totalAmount: 5000,
      paymentMethod: "orange_money",
      items: baseItems,
    });

    const { orders, total } = await getOrders({ query: "notfound" });

    expect(total).toBe(0);
    expect(orders).toHaveLength(0);
  });

  it("honors limit and offset on filtered results", async () => {
    for (let i = 0; i < 5; i++) {
      await createOrder({
        orderNumber: `SBP-Q-L${i}`,
        customerName: `Target-${i}`,
        customerPhone: "+22177000" + String(i).padStart(4, "0"),
        customerAddress: "Dakar",
        totalAmount: 1000 * (i + 1),
        paymentMethod: "orange_money",
        items: baseItems,
      });
    }

    const page1 = await getOrders({ query: "Target", limit: 2, offset: 0 });
    const page2 = await getOrders({ query: "Target", limit: 2, offset: 2 });

    expect(page1.total).toBe(5);
    expect(page1.orders).toHaveLength(2);
    expect(page2.total).toBe(5);
    expect(page2.orders).toHaveLength(2);
    expect(page1.orders[0].id).not.toBe(page2.orders[0].id);
  });
});
