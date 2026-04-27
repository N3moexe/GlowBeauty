/**
 * Mobile Money Payment Integration for Senegal
 * Supports: Orange Money, Wave, Free Money
 */

import { ENV } from "./_core/env";

export type PaymentMethod = "orange_money" | "wave" | "free_money";

function getAppUrl(): string {
  const url = process.env.APP_URL?.trim();
  if (url) return url.replace(/\/+$/, "");
  if (ENV.isProduction) {
    throw new Error(
      "[Payment] APP_URL must be set in production so webhook/redirect URLs resolve"
    );
  }
  // Local-dev fallback so simulated payments don't crash.
  return "http://localhost:3000";
}

export interface PaymentRequest {
  orderNumber: string;
  amount: number; // in CFA
  customerPhone: string;
  customerName: string;
  description: string;
}

export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  status: "pending" | "processing" | "completed" | "failed";
  message: string;
  redirectUrl?: string;
}

// ─── Orange Money Integration ───
export async function initiateOrangeMoneyPayment(
  request: PaymentRequest
): Promise<PaymentResponse> {
  try {
    // Orange Money API credentials should be in environment
    const orangeApiKey = process.env.ORANGE_MONEY_API_KEY;
    const orangeApiUrl = process.env.ORANGE_MONEY_API_URL || "https://api.orange.com/payment";

    if (!orangeApiKey) {
      console.warn("[Orange Money] API key not configured");
      if (!ENV.isProduction) {
        return {
          success: true,
          transactionId: `OM-SIM-${Date.now()}`,
          status: "processing",
          message: "Orange Money simulation (local dev)",
        };
      }
      return {
        success: false,
        status: "failed",
        message: "Orange Money is not configured. Please contact support.",
      };
    }

    // Generate transaction ID
    const transactionId = `OM-${request.orderNumber}-${Date.now()}`;

    // In production, call actual Orange Money API
    // For now, return a pending response
    const response = await fetch(`${orangeApiUrl}/initiate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${orangeApiKey}`,
      },
      body: JSON.stringify({
        amount: request.amount,
        currency: "XOF",
        phone: request.customerPhone,
        reference: request.orderNumber,
        description: request.description,
        notificationUrl: `${getAppUrl()}/api/webhooks/orange-money`,
        redirectUrl: `${getAppUrl()}/suivi?order=${request.orderNumber}`,
      }),
    }).catch(() => null);

    if (!response || !response.ok) {
      return {
        success: false,
        status: "failed",
        message: "Failed to initiate Orange Money payment",
      };
    }

    const data = await response.json();

    return {
      success: true,
      transactionId,
      status: "processing",
      message: "Payment initiated with Orange Money",
      redirectUrl: data.redirectUrl || `${getAppUrl()}/suivi?order=${request.orderNumber}`,
    };
  } catch (error) {
    console.error("[Orange Money] Error:", error);
    return {
      success: false,
      status: "failed",
      message: "Error processing Orange Money payment",
    };
  }
}

// ─── Wave Integration ───
export async function initiateWavePayment(
  request: PaymentRequest
): Promise<PaymentResponse> {
  try {
    const waveApiKey = process.env.WAVE_API_KEY;
    const waveApiUrl = process.env.WAVE_API_URL || "https://api.wave.com/v1/payments";

    if (!waveApiKey) {
      console.warn("[Wave] API key not configured");
      if (!ENV.isProduction) {
        return {
          success: true,
          transactionId: `WAVE-SIM-${Date.now()}`,
          status: "processing",
          message: "Wave simulation (local dev)",
        };
      }
      return {
        success: false,
        status: "failed",
        message: "Wave is not configured. Please contact support.",
      };
    }

    const transactionId = `WAVE-${request.orderNumber}-${Date.now()}`;

    // In production, call actual Wave API
    const response = await fetch(waveApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${waveApiKey}`,
      },
      body: JSON.stringify({
        amount: request.amount,
        currency: "XOF",
        phone: request.customerPhone,
        reference: request.orderNumber,
        description: request.description,
        callbackUrl: `${getAppUrl()}/api/webhooks/wave`,
        returnUrl: `${getAppUrl()}/suivi?order=${request.orderNumber}`,
      }),
    }).catch(() => null);

    if (!response || !response.ok) {
      return {
        success: false,
        status: "failed",
        message: "Failed to initiate Wave payment",
      };
    }

    const data = await response.json();

    return {
      success: true,
      transactionId,
      status: "processing",
      message: "Payment initiated with Wave",
      redirectUrl: data.redirectUrl || `${getAppUrl()}/suivi?order=${request.orderNumber}`,
    };
  } catch (error) {
    console.error("[Wave] Error:", error);
    return {
      success: false,
      status: "failed",
      message: "Error processing Wave payment",
    };
  }
}

// ─── Free Money Integration ───
export async function initiateFreeMoneyPayment(
  request: PaymentRequest
): Promise<PaymentResponse> {
  try {
    const freeMoneyApiKey = process.env.FREE_MONEY_API_KEY;
    const freeMoneyApiUrl = process.env.FREE_MONEY_API_URL || "https://api.freemoney.sn/v1/payments";

    if (!freeMoneyApiKey) {
      console.warn("[Free Money] API key not configured");
      if (!ENV.isProduction) {
        return {
          success: true,
          transactionId: `FM-SIM-${Date.now()}`,
          status: "processing",
          message: "Free Money simulation (local dev)",
        };
      }
      return {
        success: false,
        status: "failed",
        message: "Free Money is not configured. Please contact support.",
      };
    }

    const transactionId = `FM-${request.orderNumber}-${Date.now()}`;

    // In production, call actual Free Money API
    const response = await fetch(freeMoneyApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${freeMoneyApiKey}`,
      },
      body: JSON.stringify({
        amount: request.amount,
        currency: "XOF",
        phone: request.customerPhone,
        reference: request.orderNumber,
        description: request.description,
        webhookUrl: `${getAppUrl()}/api/webhooks/free-money`,
        successUrl: `${getAppUrl()}/suivi?order=${request.orderNumber}`,
      }),
    }).catch(() => null);

    if (!response || !response.ok) {
      return {
        success: false,
        status: "failed",
        message: "Failed to initiate Free Money payment",
      };
    }

    const data = await response.json();

    return {
      success: true,
      transactionId,
      status: "processing",
      message: "Payment initiated with Free Money",
      redirectUrl: data.redirectUrl || `${getAppUrl()}/suivi?order=${request.orderNumber}`,
    };
  } catch (error) {
    console.error("[Free Money] Error:", error);
    return {
      success: false,
      status: "failed",
      message: "Error processing Free Money payment",
    };
  }
}

// ─── Main payment dispatcher ───
export async function initiatePayment(
  method: PaymentMethod,
  request: PaymentRequest
): Promise<PaymentResponse> {
  switch (method) {
    case "orange_money":
      return initiateOrangeMoneyPayment(request);
    case "wave":
      return initiateWavePayment(request);
    case "free_money":
      return initiateFreeMoneyPayment(request);
    default:
      return {
        success: false,
        status: "failed",
        message: "Unknown payment method",
      };
  }
}

/**
 * Verify payment status with provider
 * In production, this would query the payment provider's API
 */
export async function verifyPaymentStatus(
  method: PaymentMethod,
  transactionId: string
): Promise<{
  status: "pending" | "completed" | "failed";
  verified: boolean;
}> {
  // In production, call the payment provider's API to verify status
  // For now, return a placeholder
  return {
    status: "pending",
    verified: false,
  };
}

/**
 * Handle payment webhooks from providers
 */
export async function handlePaymentWebhook(
  method: PaymentMethod,
  payload: Record<string, any>
): Promise<{
  success: boolean;
  orderNumber?: string;
  status?: string;
}> {
  try {
    switch (method) {
      case "orange_money":
        // Parse Orange Money webhook
        return {
          success: true,
          orderNumber: payload.reference,
          status: payload.status === "success" ? "completed" : "failed",
        };

      case "wave":
        // Parse Wave webhook
        return {
          success: true,
          orderNumber: payload.reference,
          status: payload.status === "completed" ? "completed" : "failed",
        };

      case "free_money":
        // Parse Free Money webhook
        return {
          success: true,
          orderNumber: payload.reference,
          status: payload.status === "success" ? "completed" : "failed",
        };

      default:
        return { success: false };
    }
  } catch (error) {
    console.error("[Payment Webhook] Error:", error);
    return { success: false };
  }
}
