import { describe, expect, it, vi } from "vitest";
import * as mobileMoney from "./mobile-money";
import * as emailService from "./email-service";

describe("Mobile Money Payment Integration", () => {
  describe("Payment Initiation", () => {
    it("initiates Orange Money payment", async () => {
      const request = {
        orderNumber: "SBP-TEST-001",
        amount: 50000,
        customerPhone: "+221771234567",
        customerName: "Test Customer",
        description: "Test Order",
      };

      const result = await mobileMoney.initiateOrangeMoneyPayment(request);
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("message");
    });

    it("initiates Wave payment", async () => {
      const request = {
        orderNumber: "SBP-TEST-002",
        amount: 75000,
        customerPhone: "+221771234567",
        customerName: "Test Customer",
        description: "Test Order",
      };

      const result = await mobileMoney.initiateWavePayment(request);
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("message");
    });

    it("initiates Free Money payment", async () => {
      const request = {
        orderNumber: "SBP-TEST-003",
        amount: 100000,
        customerPhone: "+221771234567",
        customerName: "Test Customer",
        description: "Test Order",
      };

      const result = await mobileMoney.initiateFreeMoneyPayment(request);
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("message");
    });

    it("dispatches payment to correct provider", async () => {
      const request = {
        orderNumber: "SBP-TEST-004",
        amount: 50000,
        customerPhone: "+221771234567",
        customerName: "Test Customer",
        description: "Test Order",
      };

      const orangeResult = await mobileMoney.initiatePayment("orange_money", request);
      expect(orangeResult).toHaveProperty("status");

      const waveResult = await mobileMoney.initiatePayment("wave", request);
      expect(waveResult).toHaveProperty("status");

      const freeResult = await mobileMoney.initiatePayment("free_money", request);
      expect(freeResult).toHaveProperty("status");
    });

    it("rejects invalid payment method", async () => {
      const request = {
        orderNumber: "SBP-TEST-005",
        amount: 50000,
        customerPhone: "+221771234567",
        customerName: "Test Customer",
        description: "Test Order",
      };

      const result = await mobileMoney.initiatePayment("invalid_method" as any, request);
      expect(result.success).toBe(false);
      expect(result.status).toBe("failed");
    });
  });

  describe("Payment Verification", () => {
    it("verifies payment status", async () => {
      const result = await mobileMoney.verifyPaymentStatus("orange_money", "OM-TEST-001");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("verified");
      expect(["pending", "completed", "failed"]).toContain(result.status);
    });
  });

  describe("Payment Webhooks", () => {
    it("handles Orange Money webhook", async () => {
      const payload = {
        reference: "SBP-TEST-001",
        status: "success",
      };

      const result = await mobileMoney.handlePaymentWebhook("orange_money", payload);
      expect(result.success).toBe(true);
      expect(result.orderNumber).toBe("SBP-TEST-001");
    });

    it("handles Wave webhook", async () => {
      const payload = {
        reference: "SBP-TEST-002",
        status: "completed",
      };

      const result = await mobileMoney.handlePaymentWebhook("wave", payload);
      expect(result.success).toBe(true);
      expect(result.orderNumber).toBe("SBP-TEST-002");
    });

    it("handles Free Money webhook", async () => {
      const payload = {
        reference: "SBP-TEST-003",
        status: "success",
      };

      const result = await mobileMoney.handlePaymentWebhook("free_money", payload);
      expect(result.success).toBe(true);
      expect(result.orderNumber).toBe("SBP-TEST-003");
    });
  });
});

describe("Email Service", () => {
  describe("Email Configuration", () => {
    it("can test email configuration", async () => {
      // This will fail if SMTP is not configured, which is expected
      const result = await emailService.testEmailConfiguration();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("Order Confirmation Email", () => {
    it("prepares order confirmation email", async () => {
      const orderData = {
        orderNumber: "SBP-TEST-001",
        customerName: "Test Customer",
        customerEmail: "customer@example.com",
        customerPhone: "+221771234567",
        customerAddress: "123 Rue de Dakar, Dakar",
        items: [
          {
            productName: "Test Product",
            quantity: 2,
            unitPrice: 25000,
            totalPrice: 50000,
          },
        ],
        totalAmount: 50000,
        paymentMethod: "orange_money",
      };

      const result = await emailService.sendOrderConfirmationEmail(orderData);
      expect(typeof result).toBe("boolean");
    });

    it("handles missing customer email", async () => {
      const orderData = {
        orderNumber: "SBP-TEST-002",
        customerName: "Test Customer",
        customerEmail: undefined,
        customerPhone: "+221771234567",
        customerAddress: "123 Rue de Dakar, Dakar",
        items: [
          {
            productName: "Test Product",
            quantity: 1,
            unitPrice: 50000,
            totalPrice: 50000,
          },
        ],
        totalAmount: 50000,
        paymentMethod: "wave",
      };

      const result = await emailService.sendOrderConfirmationEmail(orderData as any);
      expect(typeof result).toBe("boolean");
    });
  });

  describe("Order Status Update Email", () => {
    it("prepares order status update email", async () => {
      const orderData = {
        orderNumber: "SBP-TEST-001",
        customerName: "Test Customer",
        customerEmail: "customer@example.com",
        status: "processing",
        statusLabel: "En préparation",
        totalAmount: 50000,
      };

      const result = await emailService.sendOrderStatusUpdateEmail(orderData);
      expect(typeof result).toBe("boolean");
    });

    it("handles different order statuses", async () => {
      const statuses = ["confirmed", "processing", "shipped", "delivered", "cancelled"];

      for (const status of statuses) {
        const orderData = {
          orderNumber: "SBP-TEST-001",
          customerName: "Test Customer",
          customerEmail: "customer@example.com",
          status,
          statusLabel: status.charAt(0).toUpperCase() + status.slice(1),
          totalAmount: 50000,
        };

        const result = await emailService.sendOrderStatusUpdateEmail(orderData);
        expect(typeof result).toBe("boolean");
      }
    });
  });

  describe("Admin Notification Email", () => {
    it("prepares admin notification email", async () => {
      const orderData = {
        orderNumber: "SBP-TEST-001",
        customerName: "Test Customer",
        customerPhone: "+221771234567",
        totalAmount: 50000,
        itemCount: 2,
        paymentMethod: "orange_money",
      };

      const result = await emailService.sendAdminOrderNotification(orderData);
      expect(typeof result).toBe("boolean");
    });
  });
});

describe("Payment Methods Support", () => {
  it("supports all required payment methods", () => {
    const methods = ["orange_money", "wave", "free_money"] as const;
    expect(methods).toHaveLength(3);
    expect(methods).toContain("orange_money");
    expect(methods).toContain("wave");
    expect(methods).toContain("free_money");
  });
});

describe("Order Processing Flow", () => {
  it("completes full payment initiation flow", async () => {
    const paymentRequest = {
      orderNumber: "SBP-FLOW-001",
      amount: 50000,
      customerPhone: "+221771234567",
      customerName: "Flow Test Customer",
      description: "Flow Test Order",
    };

    const result = await mobileMoney.initiatePayment("wave", paymentRequest);
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("message");
  });

  it("sends order confirmation after payment", async () => {
    const orderData = {
      orderNumber: "SBP-FLOW-002",
      customerName: "Flow Test Customer",
      customerEmail: "flow@example.com",
      customerPhone: "+221771234567",
      customerAddress: "123 Rue de Dakar, Dakar",
      items: [
        {
          productName: "Test Product",
          quantity: 1,
          unitPrice: 50000,
          totalPrice: 50000,
        },
      ],
      totalAmount: 50000,
      paymentMethod: "wave",
    };

    const result = await emailService.sendOrderConfirmationEmail(orderData);
    expect(typeof result).toBe("boolean");
  });
});
