import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as db from "./db";

vi.mock("./_core/context", () => ({
  createContext: vi.fn(async ({ req, res }: any) => {
    const now = new Date();
    return {
      req,
      res,
      user: {
        id: 1,
        openId: "qa-admin-user",
        name: "QA Admin",
        email: "qa-admin@senbonsplans.local",
        loginMethod: "admin",
        role: "admin" as const,
        createdAt: now,
        updatedAt: now,
        lastSignedIn: now,
      },
    };
  }),
}));

import { registerAnalyticsApiRoutes } from "./analytics-api-routes";
import { registerCouponApiRoutes } from "./coupon-api-routes";
import { registerNewsletterApiRoutes } from "./newsletter-api-routes";
import { registerReviewApiRoutes } from "./review-api-routes";
import { registerSettingsApiRoutes } from "./settings-api-routes";

let server: ReturnType<express.Express["listen"]>;
let baseUrl = "";

async function apiRequest<T = any>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });
  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok || !payload) {
    throw new Error(
      `Request failed (${response.status} ${response.statusText}) for ${path}: ${JSON.stringify(
        payload
      )}`
    );
  }

  return payload;
}

describe("Admin REST modules", () => {
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    registerSettingsApiRoutes(app);
    registerReviewApiRoutes(app);
    registerAnalyticsApiRoutes(app);
    registerCouponApiRoutes(app);
    registerNewsletterApiRoutes(app);

    await new Promise<void>(resolve => {
      server = app.listen(0, () => resolve());
    });

    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close(error => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  it("supports shipping zones/rates CRUD and writes audit logs", async () => {
    const suffix = Date.now();

    const createdZone = await apiRequest<any>("/api/admin/shipping/zones", {
      method: "POST",
      body: JSON.stringify({
        name: `QA Zone ${suffix}`,
        slug: `qa-zone-${suffix}`,
        description: "QA zone for shipping CRUD",
        deliveryFee: 2500,
        deliveryDays: 2,
        isActive: true,
        displayOrder: 999,
      }),
    });
    expect(createdZone.ok).toBe(true);
    expect(createdZone.data.id).toBeGreaterThan(0);
    const zoneId = Number(createdZone.data.id);

    const updatedZone = await apiRequest<any>(
      `/api/admin/shipping/zones/${zoneId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          deliveryFee: 2700,
          deliveryDays: 3,
        }),
      }
    );
    expect(updatedZone.ok).toBe(true);
    expect(updatedZone.data.deliveryFee).toBe(2700);
    expect(updatedZone.data.deliveryDays).toBe(3);

    const createdRate = await apiRequest<any>("/api/admin/shipping/rates", {
      method: "POST",
      body: JSON.stringify({
        zoneId,
        label: "QA Express",
        minAmountCfa: 0,
        maxAmountCfa: 50000,
        feeCfa: 2000,
        etaMinHours: 12,
        etaMaxHours: 24,
        isActive: true,
      }),
    });
    expect(createdRate.ok).toBe(true);
    expect(createdRate.data.id).toBeGreaterThan(0);
    const rateId = Number(createdRate.data.id);

    const updatedRate = await apiRequest<any>(
      `/api/admin/shipping/rates/${rateId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          feeCfa: 1800,
          etaMaxHours: 20,
        }),
      }
    );
    expect(updatedRate.ok).toBe(true);
    expect(updatedRate.data.feeCfa).toBe(1800);
    expect(updatedRate.data.etaMaxHours).toBe(20);

    const deletedRate = await apiRequest<any>(
      `/api/admin/shipping/rates/${rateId}`,
      {
        method: "DELETE",
      }
    );
    expect(deletedRate.ok).toBe(true);

    const deletedZone = await apiRequest<any>(
      `/api/admin/shipping/zones/${zoneId}`,
      {
        method: "DELETE",
      }
    );
    expect(deletedZone.ok).toBe(true);

    const auditLogs = await apiRequest<any>(
      "/api/admin/audit-logs?entityType=shipping&limit=100"
    );
    const actions = (auditLogs.data?.items || []).map(
      (entry: any) => entry.action
    );
    expect(actions).toContain("shipping.zone.create");
    expect(actions).toContain("shipping.zone.update");
    expect(actions).toContain("shipping.rate.create");
    expect(actions).toContain("shipping.rate.update");
  });

  it("supports users list/create-invite/update/disable/reset-password", async () => {
    const suffix = Date.now();
    const username = `qa_user_${suffix}`;

    const listBefore = await apiRequest<any>("/api/admin/users");
    expect(Array.isArray(listBefore.data)).toBe(true);

    const created = await apiRequest<any>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        name: "QA Invite User",
        email: `qa-invite-${suffix}@senbonsplans.local`,
        username,
        inviteOnly: true,
        role: "editor",
        isActive: true,
      }),
    });
    expect(created.ok).toBe(true);
    expect(created.data.id).toBeGreaterThan(0);
    expect(created.data.inviteCreated).toBe(true);
    expect(typeof created.data.tempPassword).toBe("string");
    expect(created.data.tempPassword.length).toBeGreaterThanOrEqual(8);
    const userId = Number(created.data.id);

    const updated = await apiRequest<any>(`/api/admin/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify({
        role: "manager",
        isActive: false,
      }),
    });
    expect(updated.ok).toBe(true);
    expect(updated.data.id).toBe(userId);
    expect(updated.data.role).toBe("manager");
    expect(updated.data.isActive).toBe(false);

    const reset = await apiRequest<any>(
      `/api/admin/users/${userId}/reset-password`,
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );
    expect(reset.ok).toBe(true);
    expect(reset.data.userId).toBe(userId);
    expect(typeof reset.data.tempPassword).toBe("string");
    expect(reset.data.tempPassword.length).toBeGreaterThanOrEqual(8);

    const listAfter = await apiRequest<any>("/api/admin/users");
    expect(
      listAfter.data.some((entry: any) => Number(entry.id) === userId)
    ).toBe(true);
  });

  it("supports reviews moderation and storefront publication", async () => {
    const suffix = Date.now();
    const createdReview = await apiRequest<any>("/api/reviews", {
      method: "POST",
      body: JSON.stringify({
        productId: 1,
        customerName: "QA Reviewer",
        customerEmail: `qa-review-${suffix}@senbonsplans.local`,
        rating: 5,
        title: "QA review",
        body: "This review is created by tests and should be moderated.",
      }),
    });
    expect(createdReview.ok).toBe(true);
    expect(createdReview.data.id).toBeGreaterThan(0);
    expect(createdReview.data.status).toBe("pending");
    const reviewId = Number(createdReview.data.id);

    const adminPending = await apiRequest<any>(
      "/api/admin/reviews?status=pending&limit=100"
    );
    expect(
      adminPending.data.reviews.some(
        (entry: any) => Number(entry.id) === reviewId
      )
    ).toBe(true);

    const approved = await apiRequest<any>(`/api/admin/reviews/${reviewId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "approved" }),
    });
    expect(approved.ok).toBe(true);
    expect(approved.data.status).toBe("approved");

    const storefrontPublished = await apiRequest<any>(
      "/api/products/1/reviews?limit=50"
    );
    expect(
      storefrontPublished.data.reviews.some(
        (entry: any) => Number(entry.id) === reviewId
      )
    ).toBe(true);

    const hidden = await apiRequest<any>(`/api/admin/reviews/${reviewId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "rejected" }),
    });
    expect(hidden.ok).toBe(true);
    expect(hidden.data.status).toBe("rejected");

    const storefrontAfterHide = await apiRequest<any>(
      "/api/products/1/reviews?limit=50"
    );
    expect(
      storefrontAfterHide.data.reviews.some(
        (entry: any) => Number(entry.id) === reviewId
      )
    ).toBe(false);
  });

  it("returns analytics overview with orders, revenue and conversion basics", async () => {
    const suffix = Date.now();
    const orderId = await db.createOrder({
      orderNumber: `SBP-QA-${suffix}`,
      customerName: "QA Analytics",
      customerPhone: `+2217700${String(suffix).slice(-6)}`,
      customerAddress: "QA Street",
      customerCity: "Dakar",
      totalAmount: 42000,
      paymentMethod: "cash",
      notes: "Created by analytics integration test",
      items: [
        {
          productId: 1,
          productName: "QA Product",
          quantity: 1,
          unitPrice: 42000,
          totalPrice: 42000,
        },
      ],
    });
    await db.updateOrderStatus(orderId, "delivered");
    await db.updatePaymentStatus(orderId, "completed", `qa-ref-${suffix}`);

    const sessionId = `qa-session-${suffix}`;
    await db.recordAnalyticsEvent({
      type: "page_view",
      sessionId,
      path: "/boutique",
      meta: { source: "qa-test" },
    });
    await db.recordAnalyticsEvent({
      type: "purchase",
      sessionId,
      path: "/commande",
      meta: { orderId },
    });

    const response = await apiRequest<any>(
      "/api/admin/analytics/overview?days=30"
    );
    expect(response.ok).toBe(true);

    const overview = response.data ?? response;
    expect(typeof overview.rangeDays).toBe("number");
    expect(Number(overview.orders)).toBeGreaterThan(0);
    expect(Number(overview.revenue)).toBeGreaterThan(0);
    expect(Array.isArray(overview.revenueSeries)).toBe(true);
    expect(Array.isArray(overview.ordersByStatus)).toBe(true);
    expect(
      overview.conversionRate === null ||
        typeof overview.conversionRate === "number"
    ).toBe(true);
  });

  it("supports coupons admin CRUD and checkout apply/remove/preview flow", async () => {
    const suffix = Date.now();
    const code = `QA${String(suffix).slice(-6)}`;
    const sessionId = `qa-coupon-session-${suffix}`;

    const created = await apiRequest<any>("/api/admin/coupons", {
      method: "POST",
      body: JSON.stringify({
        code,
        type: "FIXED",
        value: 1200,
        minSubtotal: 0,
        maxDiscount: null,
        startAt: null,
        endAt: null,
        usageLimit: 5,
        perSessionLimit: 1,
        active: true,
        appliesTo: "ALL",
      }),
    });
    expect(created.ok).toBe(true);
    expect(created.data.code).toBe(code);
    expect(created.data.perSessionLimit).toBe(1);
    const couponId = String(created.data.id);

    const updated = await apiRequest<any>(`/api/admin/coupons/${couponId}`, {
      method: "PUT",
      body: JSON.stringify({
        value: 1500,
        minSubtotal: 1000,
      }),
    });
    expect(updated.ok).toBe(true);
    expect(updated.data.value).toBe(1500);

    const list = await apiRequest<any>("/api/admin/coupons?limit=200");
    expect(list.ok).toBe(true);
    expect(list.data.some((entry: any) => String(entry.id) === couponId)).toBe(
      true
    );

    const synced = await apiRequest<any>("/api/coupons/cart/sync", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        items: [{ productId: 1, quantity: 1 }],
      }),
    });
    expect(synced.ok).toBe(true);
    expect(Number(synced.data.subtotal)).toBeGreaterThan(0);

    const invalidPreviewResponse = await fetch(
      `${baseUrl}/api/coupons/preview`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          code: "INVALID",
        }),
      }
    );
    const invalidPreviewPayload = await invalidPreviewResponse.json();
    expect(invalidPreviewResponse.status).toBe(404);
    expect(invalidPreviewPayload.ok).toBe(false);
    expect(invalidPreviewPayload.error?.code).toBe("INVALID_CODE");

    const preview = await apiRequest<any>("/api/coupons/preview", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        code,
        shippingFee: 2000,
      }),
    });
    expect(preview.ok).toBe(true);
    expect(preview.data.couponCode).toBe(code);
    expect(Number(preview.data.discountAmount)).toBeGreaterThan(0);

    const applied = await apiRequest<any>("/api/coupons/apply", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        code,
        shippingFee: 2000,
      }),
    });
    expect(applied.ok).toBe(true);
    expect(applied.data.couponCode).toBe(code);
    expect(Number(applied.data.discountAmount)).toBeGreaterThan(0);
    expect(Number(applied.data.total)).toBeGreaterThanOrEqual(0);

    const removed = await apiRequest<any>("/api/coupons/remove", {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    });
    expect(removed.ok).toBe(true);
    expect(removed.data.couponCode).toBeNull();
    expect(removed.data.discountAmount).toBe(0);

    const deactivated = await apiRequest<any>(
      `/api/admin/coupons/${couponId}`,
      {
        method: "DELETE",
      }
    );
    expect(deactivated.ok).toBe(true);
    expect(deactivated.data.coupon.active).toBe(false);
  });

  it("supports newsletter subscribe/unsubscribe and admin list/export", async () => {
    const suffix = Date.now();
    const email = `qa-newsletter-${suffix}@senbonsplans.local`;

    const subscribed = await apiRequest<any>("/api/newsletter/subscribe", {
      method: "POST",
      body: JSON.stringify({
        email,
        source: "homepage",
        locale: "fr",
      }),
    });
    expect(subscribed.ok).toBe(true);
    expect(subscribed.already).toBe(false);
    // RGPD: first submission is always PENDING until the user clicks confirm.
    expect(subscribed.pending).toBe(true);

    // A re-submission while still PENDING re-issues a fresh token; it is NOT
    // treated as "already" (that is reserved for SUBSCRIBED rows).
    const duplicate = await apiRequest<any>("/api/newsletter/subscribe", {
      method: "POST",
      body: JSON.stringify({
        email,
        source: "homepage",
        locale: "fr",
      }),
    });
    expect(duplicate.ok).toBe(true);
    expect(duplicate.already).toBe(false);
    expect(duplicate.pending).toBe(true);

    const invalidEmailResponse = await fetch(
      `${baseUrl}/api/newsletter/subscribe`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "invalid-email",
          source: "homepage",
        }),
      }
    );
    const invalidEmailPayload = await invalidEmailResponse.json();
    expect(invalidEmailResponse.status).toBe(400);
    expect(invalidEmailPayload.ok).toBe(false);

    const unsubscribed = await apiRequest<any>("/api/newsletter/unsubscribe", {
      method: "POST",
      body: JSON.stringify({
        email,
      }),
    });
    expect(unsubscribed.ok).toBe(true);

    const adminList = await apiRequest<any>(
      `/api/admin/newsletter?search=${encodeURIComponent(email)}&limit=20&offset=0`
    );
    expect(adminList.ok).toBe(true);
    expect(Array.isArray(adminList.data.items)).toBe(true);
    const match = adminList.data.items.find(
      (entry: any) => entry.email === email
    );
    expect(match).toBeTruthy();
    expect(match.status).toBe("UNSUBSCRIBED");

    const exportResponse = await fetch(
      `${baseUrl}/api/admin/newsletter/export?search=${encodeURIComponent(email)}`
    );
    const exportBody = await exportResponse.text();
    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers.get("content-type") || "").toContain(
      "text/csv"
    );
    expect(exportBody).toContain(
      "email,status,source,locale,ip,userAgent,createdAt,unsubscribedAt"
    );
    expect(exportBody).toContain(email);
  });
});
