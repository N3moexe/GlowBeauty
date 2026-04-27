import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter, __resetOrderRateLimitForTests } from "./routers";
import type { TrpcContext } from "./_core/context";

beforeEach(() => {
  __resetOrderRateLimitForTests();
});

// ─── Mock the db module ───
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  getEffectiveAdminRole: vi.fn().mockImplementation(async (user: { role?: string } | null | undefined) => {
    if (!user) return null;
    return user.role === "admin" ? "ADMIN" : null;
  }),
  getAllCategories: vi.fn().mockResolvedValue([
    { id: 1, name: "Cuisine", slug: "cuisine", description: "Cuisine et Art de la Table", imageUrl: null, sortOrder: 0, createdAt: new Date() },
    { id: 2, name: "Électronique", slug: "electronique", description: "Gadgets et appareils", imageUrl: null, sortOrder: 1, createdAt: new Date() },
  ]),
  getCategoryBySlug: vi.fn().mockImplementation(async (slug: string) => {
    if (slug === "cuisine") return { id: 1, name: "Cuisine", slug: "cuisine", description: "Cuisine", imageUrl: null, sortOrder: 0, createdAt: new Date() };
    return undefined;
  }),
  createCategory: vi.fn().mockResolvedValue(3),
  updateCategory: vi.fn().mockResolvedValue(undefined),
  deleteCategory: vi.fn().mockResolvedValue(undefined),
  getProducts: vi.fn().mockResolvedValue({
    products: [
      { id: 1, name: "Écouteurs Bluetooth", slug: "ecouteurs-bluetooth", description: "Super écouteurs", price: 12000, comparePrice: null, categoryId: 2, imageUrl: "https://example.com/img.jpg", images: null, inStock: true, stockQuantity: 100, isFeatured: true, isNew: true, isTrending: false, createdAt: new Date(), updatedAt: new Date() },
    ],
    total: 1,
  }),
  getProductById: vi.fn().mockImplementation(async (id: number) => {
    if (id === 1) return { id: 1, name: "Écouteurs Bluetooth", slug: "ecouteurs-bluetooth", description: "Super écouteurs", price: 12000, comparePrice: null, categoryId: 2, imageUrl: "https://example.com/img.jpg", images: null, inStock: true, stockQuantity: 100, isFeatured: true, isNew: true, isTrending: false, createdAt: new Date(), updatedAt: new Date() };
    if (id === 2) return { id: 2, name: "Enceinte Bluetooth", slug: "enceinte-bluetooth", description: "Super enceinte", price: 15000, comparePrice: null, categoryId: 2, imageUrl: "https://example.com/enceinte.jpg", images: null, inStock: true, stockQuantity: 100, isFeatured: false, isNew: true, isTrending: false, createdAt: new Date(), updatedAt: new Date() };
    return undefined;
  }),
  getProductBySlug: vi.fn().mockImplementation(async (slug: string) => {
    if (slug === "ecouteurs-bluetooth") return { id: 1, name: "Écouteurs Bluetooth", slug: "ecouteurs-bluetooth", description: "Super écouteurs", price: 12000, comparePrice: null, categoryId: 2, imageUrl: "https://example.com/img.jpg", images: null, inStock: true, stockQuantity: 100, isFeatured: true, isNew: true, isTrending: false, createdAt: new Date(), updatedAt: new Date() };
    return undefined;
  }),
  getRelatedProducts: vi.fn().mockResolvedValue([]),
  createProduct: vi.fn().mockResolvedValue(10),
  updateProduct: vi.fn().mockResolvedValue(undefined),
  deleteProduct: vi.fn().mockResolvedValue(undefined),
  getProductCount: vi.fn().mockResolvedValue(28),
  createOrder: vi.fn().mockResolvedValue(1),
  getOrders: vi.fn().mockResolvedValue({ orders: [], total: 0 }),
  getOrderById: vi.fn().mockImplementation(async (id: number) => {
    if (id === 1) return { id: 1, orderNumber: "SBP-TEST-0001", customerName: "Moussa", customerPhone: "+221771234567", customerAddress: "Dakar", customerCity: "Dakar", totalAmount: 12000, status: "pending", paymentMethod: "orange_money", paymentStatus: "pending", paymentReference: null, notes: null, userId: null, createdAt: new Date(), updatedAt: new Date(), items: [{ id: 1, orderId: 1, productId: 1, productName: "Écouteurs Bluetooth", productImage: null, quantity: 1, unitPrice: 12000, totalPrice: 12000 }] };
    return undefined;
  }),
  getOrderByNumber: vi.fn().mockImplementation(async (orderNumber: string) => {
    if (orderNumber === "SBP-TEST-0001") return { id: 1, orderNumber: "SBP-TEST-0001", customerName: "Moussa", customerPhone: "+221771234567", customerAddress: "Dakar", customerCity: "Dakar", totalAmount: 12000, status: "pending", paymentMethod: "orange_money", paymentStatus: "pending", paymentReference: null, notes: null, userId: null, createdAt: new Date(), updatedAt: new Date(), items: [] };
    return undefined;
  }),
  updateOrderStatus: vi.fn().mockResolvedValue(undefined),
  updatePaymentStatus: vi.fn().mockResolvedValue(undefined),
  getOrCreateCustomer: vi.fn().mockResolvedValue({
    id: 1,
    name: "Moussa",
    phone: "+221771234567",
    email: "moussa@example.com",
    address: "Dakar",
    city: "Dakar",
  }),
  getCustomerByPhone: vi.fn().mockResolvedValue({
    id: 1,
    name: "Moussa",
    phone: "+221771234567",
    email: "moussa@example.com",
    address: "Dakar",
    city: "Dakar",
  }),
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
  recordPageView: vi.fn().mockResolvedValue(undefined),
  getAnalytics: vi.fn().mockResolvedValue({
    totalViews: 150, uniqueVisitors: 80, totalOrders: 5, totalRevenue: 75000,
    conversionRate: 6.25, recentViews: [], ordersByStatus: [{ status: "pending", count: 3 }, { status: "delivered", count: 2 }],
  }),
}));

// ─── Context helpers ───
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1, openId: "admin-user", email: "admin@senbonsplans.com",
    name: "Admin", loginMethod: "manus", role: "admin",
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2, openId: "regular-user", email: "user@example.com",
    name: "User", loginMethod: "manus", role: "user",
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Category Tests ───
describe("category", () => {
  it("lists all categories (public)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.category.list();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Cuisine");
    expect(result[1].name).toBe("Électronique");
  });

  it("gets category by slug (public)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.category.bySlug({ slug: "cuisine" });
    expect(result).toBeDefined();
    expect(result?.name).toBe("Cuisine");
  });

  it("returns undefined for unknown slug", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.category.bySlug({ slug: "unknown" });
    expect(result).toBeUndefined();
  });

  it("admin can create a category", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.category.create({ name: "Test", slug: "test" });
    expect(result).toEqual({ id: 3 });
  });

  it("non-admin cannot create a category", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.category.create({ name: "Test", slug: "test" })).rejects.toThrow();
  });

  it("unauthenticated user cannot create a category", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.category.create({ name: "Test", slug: "test" })).rejects.toThrow();
  });

  it("admin can update a category", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.category.update({ id: 1, name: "Updated" });
    expect(result).toEqual({ success: true });
  });

  it("admin can delete a category", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.category.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });
});

// ─── Product Tests ───
describe("product", () => {
  it("lists products (public)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.product.list();
    expect(result.products).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.products[0].name).toBe("Écouteurs Bluetooth");
  });

  it("gets product by id (public)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.product.byId({ id: 1 });
    expect(result.name).toBe("Écouteurs Bluetooth");
    expect(result.price).toBe(12000);
  });

  it("throws NOT_FOUND for unknown product id", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.product.byId({ id: 999 })).rejects.toThrow("Produit non trouvé");
  });

  it("gets product by slug (public)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.product.bySlug({ slug: "ecouteurs-bluetooth" });
    expect(result.name).toBe("Écouteurs Bluetooth");
  });

  it("throws NOT_FOUND for unknown product slug", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.product.bySlug({ slug: "unknown" })).rejects.toThrow("Produit non trouvé");
  });

  it("gets related products (public)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.product.related({ categoryId: 2, excludeId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("gets product count (public)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.product.count();
    expect(result).toBe(28);
  });

  it("admin can create a product", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.product.create({
      name: "Nouveau Produit", slug: "nouveau-produit", price: 5000, categoryId: 1,
    });
    expect(result).toEqual({ id: 10 });
  });

  it("non-admin cannot create a product", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.product.create({
      name: "Test", slug: "test", price: 1000, categoryId: 1,
    })).rejects.toThrow();
  });

  it("admin can update a product", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.product.update({ id: 1, price: 15000 });
    expect(result).toEqual({ success: true });
  });

  it("admin can delete a product", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.product.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });
});

// ─── Order Tests ───
describe("order", () => {
  it("creates an order (public, guest checkout)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.order.create({
      customerName: "Moussa Diop",
      customerPhone: "+221771234567",
      customerAddress: "Médina, Rue 10",
      customerCity: "Dakar",
      paymentMethod: "orange_money",
      items: [{
        productId: 1,
        quantity: 1,
      }],
    });
    expect(result.orderId).toBe(1);
    expect(result.orderNumber).toMatch(/^SBP-/);
  });

  it("creates an order with multiple items", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.order.create({
      customerName: "Fatou Sow",
      customerPhone: "+221761234567",
      customerAddress: "Almadies",
      paymentMethod: "wave",
      items: [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 1 },
      ],
    });
    expect(result.orderId).toBe(1);
    expect(result.orderNumber).toMatch(/^SBP-/);
  });

  it("rejects order with empty items", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.order.create({
      customerName: "Test",
      customerPhone: "+221770000000",
      customerAddress: "Test",
      paymentMethod: "wave",
      items: [],
    })).rejects.toThrow();
  });

  it("rejects order with missing required fields", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.order.create({
      customerName: "",
      customerPhone: "+221770000000",
      customerAddress: "Test",
      paymentMethod: "wave",
      items: [{
        productId: 1,
        quantity: 1,
      }],
    })).rejects.toThrow();
  });

  it("gets order by number with correct phone last4 (public)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    // customerPhone is +221771234567 → last 4 digits = "4567"
    const result = await caller.order.byNumber({ orderNumber: "SBP-TEST-0001", phoneLast4: "4567" });
    expect(result.customerName).toBe("Moussa");
    expect(result.paymentMethod).toBe("orange_money");
  });

  it("rejects public byNumber without phone last4", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.order.byNumber({ orderNumber: "SBP-TEST-0001" })
    ).rejects.toThrow("Commande non trouvée");
  });

  it("rejects public byNumber with wrong phone last4", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.order.byNumber({ orderNumber: "SBP-TEST-0001", phoneLast4: "0000" })
    ).rejects.toThrow("Commande non trouvée");
  });

  it("admin can read order without phone last4", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.order.byNumber({ orderNumber: "SBP-TEST-0001" });
    expect(result.customerName).toBe("Moussa");
  });

  it("throws NOT_FOUND for unknown order number", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.order.byNumber({ orderNumber: "SBP-UNKNOWN", phoneLast4: "0000" })).rejects.toThrow("Commande non trouvée");
  });

  it("admin can list orders", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.order.list();
    expect(result).toHaveProperty("orders");
    expect(result).toHaveProperty("total");
  });

  it("non-admin cannot list orders", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.order.list()).rejects.toThrow();
  });

  it("admin can get order by id", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.order.byId({ id: 1 });
    expect(result.orderNumber).toBe("SBP-TEST-0001");
    expect(result.items).toHaveLength(1);
  });

  it("admin can update order status", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.order.updateStatus({ id: 1, status: "confirmed" });
    expect(result).toEqual({ success: true });
  });

  it("admin can update payment status", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.order.updatePayment({ id: 1, paymentStatus: "completed", paymentReference: "PAY-123" });
    expect(result).toEqual({ success: true });
  });

  it("non-admin cannot update order status", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.order.updateStatus({ id: 1, status: "confirmed" })).rejects.toThrow();
  });
});

// ─── Analytics Tests ───
describe("analytics", () => {
  it("tracks page view (public)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.analytics.track({
      page: "/boutique",
      visitorId: "visitor-abc123",
      sessionId: "session-xyz",
    });
    expect(result).toEqual({ success: true });
  });

  it("admin can view dashboard analytics", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.analytics.dashboard({ days: 30 });
    expect(result.totalViews).toBe(150);
    expect(result.uniqueVisitors).toBe(80);
    expect(result.totalOrders).toBe(5);
    expect(result.totalRevenue).toBe(75000);
    expect(result.conversionRate).toBe(6.25);
    expect(result.ordersByStatus).toHaveLength(2);
  });

  it("non-admin cannot view dashboard analytics", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.analytics.dashboard({ days: 30 })).rejects.toThrow();
  });

  it("unauthenticated user cannot view dashboard analytics", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.analytics.dashboard({ days: 30 })).rejects.toThrow();
  });
});

// ─── Auth Tests ───
describe("auth", () => {
  it("returns null for unauthenticated user", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user for authenticated user", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.name).toBe("Admin");
    expect(result?.role).toBe("admin");
  });
});



