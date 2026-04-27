import crypto from "crypto";
import type { Express, Request, Response } from "express";
import express from "express";
import * as db from "./db";
import {
  type PaymentMethod,
  handlePaymentWebhook,
} from "./mobile-money";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

type WebhookProviderConfig = {
  method: PaymentMethod;
  path: string;
  secretEnvVar: string;
  signatureHeader: string;
};

const WEBHOOK_PROVIDERS: WebhookProviderConfig[] = [
  {
    method: "orange_money",
    path: "/api/webhooks/orange-money",
    secretEnvVar: "ORANGE_MONEY_WEBHOOK_SECRET",
    signatureHeader: "x-orange-signature",
  },
  {
    method: "wave",
    path: "/api/webhooks/wave",
    secretEnvVar: "WAVE_WEBHOOK_SECRET",
    signatureHeader: "x-wave-signature",
  },
  {
    method: "free_money",
    path: "/api/webhooks/free-money",
    secretEnvVar: "FREE_MONEY_WEBHOOK_SECRET",
    signatureHeader: "x-free-money-signature",
  },
];

export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader) return false;
  const buffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
  const expected = crypto
    .createHmac("sha256", secret)
    .update(buffer)
    .digest("hex");
  const provided = signatureHeader.replace(/^sha256=/i, "").trim();
  const expectedBuf = Buffer.from(expected, "hex");
  let providedBuf: Buffer;
  try {
    providedBuf = Buffer.from(provided, "hex");
  } catch {
    return false;
  }
  if (providedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

function parseJsonBody(rawBody: Buffer): Record<string, any> | null {
  if (!rawBody.length) return {};
  try {
    const parsed = JSON.parse(rawBody.toString("utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

async function processWebhook(
  provider: WebhookProviderConfig,
  req: Request,
  res: Response
) {
  const rawBody: Buffer = (req as Request & { body: Buffer }).body;
  const secret = process.env[provider.secretEnvVar] || "";

  if (!secret) {
    if (isProduction()) {
      console.error(
        `[Webhook ${provider.method}] Missing ${provider.secretEnvVar}; rejecting.`
      );
      res.status(503).json({ ok: false, error: "Webhook not configured" });
      return;
    }
    console.warn(
      `[Webhook ${provider.method}] ${provider.secretEnvVar} not set; accepting unsigned in non-production.`
    );
  } else {
    const signatureHeader = req.get(provider.signatureHeader);
    if (!verifyWebhookSignature(rawBody, signatureHeader, secret)) {
      res.status(401).json({ ok: false, error: "Invalid signature" });
      return;
    }
  }

  const payload = parseJsonBody(rawBody);
  if (!payload) {
    res.status(400).json({ ok: false, error: "Invalid JSON" });
    return;
  }

  const result = await handlePaymentWebhook(provider.method, payload);
  if (!result.success || !result.orderNumber) {
    res.status(400).json({ ok: false, error: "Webhook payload rejected" });
    return;
  }

  const order = await db.getOrderByNumber(result.orderNumber);
  if (!order) {
    // Return 200 so the provider does not retry indefinitely, but log it.
    console.warn(
      `[Webhook ${provider.method}] Unknown order ${result.orderNumber}; ignoring.`
    );
    res.status(200).json({ ok: true, ignored: true });
    return;
  }

  const paymentStatus = result.status === "completed" ? "completed" : "failed";
  const paymentReference =
    typeof payload.transactionId === "string"
      ? payload.transactionId
      : typeof payload.transaction_id === "string"
        ? payload.transaction_id
        : typeof payload.reference === "string"
          ? payload.reference
          : undefined;

  await db.updatePaymentStatus(order.id, paymentStatus, paymentReference);

  res.status(200).json({
    ok: true,
    orderNumber: result.orderNumber,
    paymentStatus,
  });
}

export function registerPaymentWebhookRoutes(app: Express) {
  const rawParser = express.raw({
    type: "application/json",
    limit: "1mb",
  });

  for (const provider of WEBHOOK_PROVIDERS) {
    app.post(provider.path, rawParser, async (req, res) => {
      try {
        await processWebhook(provider, req, res);
      } catch (error) {
        console.error(`[Webhook ${provider.method}] Handler error:`, error);
        res.status(500).json({ ok: false, error: "Webhook processing failed" });
      }
    });
  }
}
