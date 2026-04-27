import crypto from "crypto";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  registerPaymentWebhookRoutes,
  verifyWebhookSignature,
} from "./webhook-api-routes";
import * as db from "./db";

type RawResponse = {
  statusCode: number;
  body: any;
};

function buildApp() {
  const app = express();
  registerPaymentWebhookRoutes(app);
  app.use(express.json());
  return app;
}

async function postWebhook(
  app: ReturnType<typeof express>,
  path: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
): Promise<RawResponse> {
  const rawBody = Buffer.from(JSON.stringify(body));
  const request = {
    method: "POST",
    url: path,
    headers: {
      "content-type": "application/json",
      "content-length": String(rawBody.length),
      ...headers,
    },
  };
  return new Promise((resolve) => {
    const req: any = Object.assign(
      Object.create(require("http").IncomingMessage.prototype),
      request
    );
    req.socket = { remoteAddress: "127.0.0.1" };
    // Express reads raw bytes from the request stream. We synthesize one.
    const { Readable } = require("stream");
    const stream = Readable.from([rawBody]);
    Object.assign(req, stream);
    req.headers = request.headers;
    req.method = request.method;
    req.url = request.url;

    const chunks: Buffer[] = [];
    const res: any = {
      statusCode: 200,
      _headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this._headers[name.toLowerCase()] = value;
      },
      getHeader(name: string) {
        return this._headers[name.toLowerCase()];
      },
      removeHeader(name: string) {
        delete this._headers[name.toLowerCase()];
      },
      end(chunk?: Buffer | string) {
        if (chunk) chunks.push(Buffer.from(chunk));
        const raw = Buffer.concat(chunks).toString("utf8");
        let parsed: any = raw;
        try {
          parsed = raw ? JSON.parse(raw) : {};
        } catch {
          // keep raw
        }
        resolve({ statusCode: this.statusCode, body: parsed });
      },
      write(chunk: Buffer | string) {
        chunks.push(Buffer.from(chunk));
        return true;
      },
      writeHead(code: number, headers?: Record<string, string>) {
        this.statusCode = code;
        if (headers) {
          for (const [k, v] of Object.entries(headers))
            this.setHeader(k, String(v));
        }
        return this;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        this._headers["content-type"] = "application/json";
        this.end(JSON.stringify(payload));
        return this;
      },
      get(name: string) {
        return this._headers[name.toLowerCase()];
      },
    };

    (app as any).handle(req, res, (err: unknown) => {
      if (err) {
        resolve({ statusCode: 500, body: { error: String(err) } });
      }
    });
  });
}

function signBody(body: Record<string, unknown>, secret: string): string {
  const raw = Buffer.from(JSON.stringify(body));
  return crypto.createHmac("sha256", secret).update(raw).digest("hex");
}

describe("verifyWebhookSignature", () => {
  it("returns true for a correct signature", () => {
    const body = Buffer.from('{"reference":"SBP-X"}');
    const sig = crypto
      .createHmac("sha256", "topsecret")
      .update(body)
      .digest("hex");
    expect(verifyWebhookSignature(body, sig, "topsecret")).toBe(true);
  });

  it("accepts sha256= prefix", () => {
    const body = Buffer.from('{"reference":"SBP-X"}');
    const sig = crypto
      .createHmac("sha256", "topsecret")
      .update(body)
      .digest("hex");
    expect(verifyWebhookSignature(body, `sha256=${sig}`, "topsecret")).toBe(
      true
    );
  });

  it("rejects tampered body", () => {
    const body = Buffer.from('{"reference":"SBP-X"}');
    const sig = crypto
      .createHmac("sha256", "topsecret")
      .update(body)
      .digest("hex");
    const tampered = Buffer.from('{"reference":"SBP-Y"}');
    expect(verifyWebhookSignature(tampered, sig, "topsecret")).toBe(false);
  });

  it("rejects missing signature", () => {
    expect(verifyWebhookSignature(Buffer.from("{}"), undefined, "s")).toBe(
      false
    );
  });

  it("rejects wrong secret", () => {
    const body = Buffer.from('{"reference":"SBP-X"}');
    const sig = crypto.createHmac("sha256", "a").update(body).digest("hex");
    expect(verifyWebhookSignature(body, sig, "b")).toBe(false);
  });

  it("rejects non-hex signature", () => {
    expect(
      verifyWebhookSignature(Buffer.from("{}"), "not-hex-data-zzz", "s")
    ).toBe(false);
  });
});

describe("payment webhook routes", () => {
  const originalEnv = { ...process.env };
  let updatePaymentSpy: ReturnType<typeof vi.spyOn>;
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    process.env.ORANGE_MONEY_WEBHOOK_SECRET = "orange-secret";
    process.env.WAVE_WEBHOOK_SECRET = "wave-secret";
    process.env.FREE_MONEY_WEBHOOK_SECRET = "free-secret";

    vi.spyOn(db, "getOrderByNumber").mockImplementation(async (orderNumber) => {
      if (orderNumber === "SBP-UNKNOWN") return undefined;
      return {
        id: 999,
        orderNumber,
        totalAmount: 12345,
        paymentStatus: "pending",
        customerPhone: "+221770000000",
        customerName: "Test",
        status: "pending",
      } as any;
    });
    updatePaymentSpy = vi
      .spyOn(db, "updatePaymentStatus")
      .mockResolvedValue(undefined as any);

    app = buildApp();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("rejects unsigned requests in production", async () => {
    const res = await postWebhook(app, "/api/webhooks/wave", {
      reference: "SBP-X",
      status: "completed",
    });
    expect(res.statusCode).toBe(401);
    expect(updatePaymentSpy).not.toHaveBeenCalled();
  });

  it("rejects tampered body signatures", async () => {
    const body = { reference: "SBP-TAMPER", status: "completed" };
    const sig = signBody(
      { reference: "SBP-DIFFERENT", status: "completed" },
      "wave-secret"
    );
    const res = await postWebhook(app, "/api/webhooks/wave", body, {
      "x-wave-signature": sig,
    });
    expect(res.statusCode).toBe(401);
    expect(updatePaymentSpy).not.toHaveBeenCalled();
  });

  it("accepts a signed Wave webhook and marks payment completed", async () => {
    const body = { reference: "SBP-W-1", status: "completed" };
    const sig = signBody(body, "wave-secret");
    const res = await postWebhook(app, "/api/webhooks/wave", body, {
      "x-wave-signature": sig,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.paymentStatus).toBe("completed");
    expect(updatePaymentSpy).toHaveBeenCalledWith(999, "completed", "SBP-W-1");
  });

  it("accepts a signed Orange Money webhook", async () => {
    const body = { reference: "SBP-O-1", status: "success" };
    const sig = signBody(body, "orange-secret");
    const res = await postWebhook(app, "/api/webhooks/orange-money", body, {
      "x-orange-signature": sig,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.paymentStatus).toBe("completed");
  });

  it("marks payment failed when provider status is not success", async () => {
    const body = { reference: "SBP-W-2", status: "failed" };
    const sig = signBody(body, "wave-secret");
    const res = await postWebhook(app, "/api/webhooks/wave", body, {
      "x-wave-signature": sig,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.paymentStatus).toBe("failed");
    expect(updatePaymentSpy).toHaveBeenCalledWith(999, "failed", "SBP-W-2");
  });

  it("ignores unknown order numbers without retrying providers forever", async () => {
    const body = { reference: "SBP-UNKNOWN", status: "completed" };
    const sig = signBody(body, "wave-secret");
    const res = await postWebhook(app, "/api/webhooks/wave", body, {
      "x-wave-signature": sig,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.ignored).toBe(true);
    expect(updatePaymentSpy).not.toHaveBeenCalled();
  });

  it("503s in production when the secret is missing", async () => {
    delete process.env.WAVE_WEBHOOK_SECRET;
    app = buildApp();
    const body = { reference: "SBP-X", status: "completed" };
    const res = await postWebhook(app, "/api/webhooks/wave", body, {
      "x-wave-signature": "irrelevant",
    });
    expect(res.statusCode).toBe(503);
    expect(updatePaymentSpy).not.toHaveBeenCalled();
  });

  it("allows unsigned webhooks in non-production when secret not set", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.WAVE_WEBHOOK_SECRET;
    app = buildApp();
    const body = { reference: "SBP-DEV-1", status: "completed" };
    const res = await postWebhook(app, "/api/webhooks/wave", body);
    expect(res.statusCode).toBe(200);
    expect(updatePaymentSpy).toHaveBeenCalledWith(
      999,
      "completed",
      "SBP-DEV-1"
    );
  });
});
