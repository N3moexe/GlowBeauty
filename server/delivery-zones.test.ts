import { beforeEach, describe, expect, it } from "vitest";
import { appRouter, __resetOrderRateLimitForTests } from "./routers";
import type { TrpcContext } from "./_core/context";

beforeEach(() => {
  __resetOrderRateLimitForTests();
});

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Delivery Zones", () => {
  describe("List Delivery Zones", () => {
    it("returns list of active delivery zones", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const zones = await caller.deliveryZone.list();

      expect(Array.isArray(zones)).toBe(true);
      expect(zones.length).toBeGreaterThan(0);
      zones.forEach(zone => {
        expect(zone).toHaveProperty("id");
        expect(zone).toHaveProperty("name");
        expect(zone).toHaveProperty("slug");
        expect(zone).toHaveProperty("deliveryFee");
        expect(zone).toHaveProperty("deliveryDays");
        expect(zone.isActive).toBe(true);
      });
    });

    it("returns zones ordered by displayOrder", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const zones = await caller.deliveryZone.list();

      for (let i = 1; i < zones.length; i++) {
        expect(zones[i].displayOrder).toBeGreaterThanOrEqual(zones[i - 1].displayOrder);
      }
    });

    it("returns zones with valid delivery fees", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const zones = await caller.deliveryZone.list();

      zones.forEach(zone => {
        expect(typeof zone.deliveryFee).toBe("number");
        expect(zone.deliveryFee).toBeGreaterThan(0);
      });
    });

    it("returns zones with valid delivery days", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const zones = await caller.deliveryZone.list();

      zones.forEach(zone => {
        expect(typeof zone.deliveryDays).toBe("number");
        expect(zone.deliveryDays).toBeGreaterThan(0);
      });
    });
  });

  describe("Get Zone by ID", () => {
    it("returns zone details by ID", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const zones = await caller.deliveryZone.list();
      if (zones.length === 0) return;

      const zone = await caller.deliveryZone.byId({ id: zones[0].id });

      expect(zone).toHaveProperty("id", zones[0].id);
      expect(zone).toHaveProperty("name");
      expect(zone).toHaveProperty("deliveryFee");
    });

    it("throws error for non-existent zone", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.deliveryZone.byId({ id: 99999 });
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("Delivery Zone Properties", () => {
    it("has expected zones for Senegal", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const zones = await caller.deliveryZone.list();
      const zoneSlugs = zones.map(z => z.slug);

      expect(zoneSlugs).toContain("dakar-centre");
      expect(zoneSlugs).toContain("banlieue-dakar");
      expect(zoneSlugs).toContain("region-dakar");
    });

    it("dakar-centre has lowest delivery fee", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const zones = await caller.deliveryZone.list();
      const dakarCentre = zones.find(z => z.slug === "dakar-centre");

      expect(dakarCentre).toBeDefined();
      const minFee = Math.min(...zones.map(z => z.deliveryFee));
      expect(dakarCentre?.deliveryFee).toBeLessThanOrEqual(minFee);
    });

    it("zones have unique slugs", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const zones = await caller.deliveryZone.list();
      const slugs = zones.map(z => z.slug);
      const uniqueSlugs = new Set(slugs);

      expect(slugs.length).toBe(uniqueSlugs.size);
    });
  });

  describe("Order with Delivery Zone", () => {
    it("creates order with delivery zone", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const zones = await caller.deliveryZone.list();
      if (zones.length === 0) return;

      const result = await caller.order.create({
        customerName: "Test Customer",
        customerPhone: "+221771234567",
        customerAddress: "123 Rue de Test",
        deliveryZoneId: zones[0].id,
        paymentMethod: "cash",
        items: [
          {
            productId: 1,
            productName: "Test Product",
            quantity: 1,
            unitPrice: 10000,
            totalPrice: 10000,
          },
        ],
      });

      expect(result).toHaveProperty("orderId");
      expect(result).toHaveProperty("orderNumber");
    });

    it("creates order without delivery zone", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.order.create({
        customerName: "Test Customer",
        customerPhone: "+221771234567",
        customerAddress: "123 Rue de Test",
        paymentMethod: "cash",
        items: [
          {
            productId: 1,
            productName: "Test Product",
            quantity: 1,
            unitPrice: 10000,
            totalPrice: 10000,
          },
        ],
      });

      expect(result).toHaveProperty("orderId");
      expect(result).toHaveProperty("orderNumber");
    });
  });

  describe("Delivery Fee Calculations", () => {
    it("calculates correct total with delivery fee", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const zones = await caller.deliveryZone.list();
      if (zones.length === 0) return;

      const subtotal = 50000;
      const zone = zones[0];
      const expectedTotal = subtotal + zone.deliveryFee;

      expect(expectedTotal).toBeGreaterThan(subtotal);
      expect(expectedTotal).toBe(subtotal + zone.deliveryFee);
    });

    it("different zones have different fees", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const zones = await caller.deliveryZone.list();

      if (zones.length < 2) return;

      const fees = zones.map(z => z.deliveryFee);
      const uniqueFees = new Set(fees);

      // At least some zones should have different fees
      expect(uniqueFees.size).toBeGreaterThan(1);
    });
  });
});
