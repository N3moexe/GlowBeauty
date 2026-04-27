/**
 * Email Notification Service
 * Sends order confirmations and status updates
 */

import nodemailer from "nodemailer";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getEmailTemplate } from "./storefront-cms-store";
import {
  defaultEmailTemplate,
  type EmailTemplateKey,
} from "@shared/storefront-cms";

// Email configuration from environment
const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
const smtpSecure =
  process.env.SMTP_SECURE !== undefined
    ? process.env.SMTP_SECURE === "true"
    : smtpPort === 465;
const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(
  /\/+$/,
  ""
);

const emailConfig = {
  host: (process.env.SMTP_HOST || "").trim(),
  port: smtpPort,
  secure: smtpSecure,
  requireTLS: process.env.SMTP_REQUIRE_TLS === "true",
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASSWORD || "",
  },
  from:
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    "noreply@senbonsplans.com",
  replyTo: process.env.SMTP_REPLY_TO || undefined,
};

let transporter: nodemailer.Transporter | null = null;
let transportMode: "smtp" | "dev-outbox" | "disabled" = "disabled";
const devOutboxDir = process.env.DEV_EMAIL_OUTBOX_DIR || ".dev-emails";

/**
 * Initialize email transporter
 */
function getTransporter() {
  if (transporter) return transporter;

  const hasAuth = Boolean(emailConfig.auth.user && emailConfig.auth.pass);
  const allowUnauthenticatedSmtp =
    process.env.SMTP_ALLOW_UNAUTHENTICATED === "true";

  if (emailConfig.host && (hasAuth || allowUnauthenticatedSmtp)) {
    transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      requireTLS: emailConfig.requireTLS,
      ...(hasAuth ? { auth: emailConfig.auth } : {}),
    });
    transportMode = "smtp";
    console.log(
      `[Email] SMTP transport initialized (${emailConfig.host}:${emailConfig.port})`
    );
    return transporter;
  }

  if (process.env.NODE_ENV !== "production") {
    // Local development fallback: write raw .eml messages to disk.
    transporter = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
      newline: "unix",
    });
    transportMode = "dev-outbox";
    console.warn(
      `[Email] SMTP not configured. Using dev outbox at ${path.resolve(process.cwd(), devOutboxDir)}`
    );
    return transporter;
  }

  transportMode = "disabled";
  console.warn("[Email] SMTP not configured. Email notifications disabled.");
  return null;
}

async function persistDevOutboxEmail(
  to: string,
  subject: string,
  message: unknown
) {
  if (transportMode !== "dev-outbox") return;

  const outboxPath = path.resolve(process.cwd(), devOutboxDir);
  const safeRecipient = to.replace(/[^a-zA-Z0-9@._-]+/g, "_");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(outboxPath, `${timestamp}__${safeRecipient}.eml`);

  const rawMessage =
    typeof message === "string"
      ? message
      : Buffer.isBuffer(message)
        ? message.toString("utf8")
        : String(message ?? "");

  await mkdir(outboxPath, { recursive: true });
  await writeFile(filePath, rawMessage, "utf8");
  console.log(`[Email] Dev outbox saved "${subject}" for ${to} -> ${filePath}`);
}

/**
 * Format currency for email
 */
function formatCFA(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(amount) + " CFA";
}

/** Last 4 digits of the customer phone — used to build one-click tracking
 *  links that the public `/suivi` page can auto-unlock without asking the
 *  customer to re-type their phone. */
function phoneLast4(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "").slice(-4);
}

function buildTrackingUrl(
  orderNumber: string,
  phone: string | null | undefined
): string {
  const base = `${appUrl}/suivi?order=${encodeURIComponent(orderNumber)}`;
  const p = phoneLast4(phone);
  return p ? `${base}&p=${p}` : base;
}

/**
 * Pure string interpolation for {{variable}} placeholders.
 * Single-pass: a replacement value that itself contains `{{foo}}` is NOT
 * re-scanned — prevents user-supplied data from injecting new variable
 * lookups. Unknown placeholders are left intact (safer than silent data loss).
 */
export function renderTemplateString(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    const value = vars[key];
    if (value === undefined || value === null) return match;
    return String(value);
  });
}

/**
 * Returns the admin-edited email template rendered with the provided vars,
 * or null if the template is still the out-of-the-box default (in which case
 * callers should use their hardcoded rich-HTML fallback).
 *
 * "Pristine" check: subject AND body match the seed default. Once an operator
 * touches either field, we honor their customization end-to-end.
 */
export function resolveCustomEmailContent(
  key: EmailTemplateKey,
  vars: Record<string, string | number>
): { subject: string; htmlBody: string } | null {
  const current = getEmailTemplate(key);
  const seed = defaultEmailTemplate(key);
  const pristine =
    current.subject === seed.subject && current.body === seed.body;
  if (pristine) return null;

  const subject = renderTemplateString(current.subject, vars);
  const renderedBody = renderTemplateString(current.body, vars);
  // If the body already contains HTML block tags we trust it verbatim.
  // Otherwise treat it as plain text and convert newlines to <br> so the
  // email doesn't arrive as one run-on paragraph.
  const looksLikeHtml = /<(p|div|table|br|h[1-6]|section|article)\b/i.test(
    renderedBody
  );
  const bodyHtml = looksLikeHtml
    ? renderedBody
    : escapeHtml(renderedBody).replace(/\n/g, "<br>");
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8" /></head>
    <body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      ${bodyHtml}
    </body>
    </html>
  `.trim();
  return { subject, htmlBody };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sends the RGPD double-opt-in confirmation email with a one-click link.
 * FR copy, short + plain — deliverability-friendly.
 */
export async function sendNewsletterConfirmationEmail(
  recipient: string,
  confirmUrl: string
): Promise<boolean> {
  try {
    const transporter = getTransporter();
    if (!transporter) {
      console.warn(
        "[Email] Cannot send newsletter confirmation: transporter unavailable"
      );
      return false;
    }
    const subject = "Confirmez votre inscription — SenBonsPlans";
    const safeUrl = escapeHtml(confirmUrl);
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8" /></head>
      <body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h1 style="font-size: 20px; margin: 0 0 12px;">Confirmez votre inscription</h1>
        <p>Merci de vouloir recevoir nos actualités. Pour finaliser votre inscription à la newsletter SenBonsPlans, cliquez sur le bouton ci-dessous.</p>
        <p style="margin: 24px 0;">
          <a href="${safeUrl}" style="display: inline-block; background: #C2185B; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Confirmer mon inscription
          </a>
        </p>
        <p style="font-size: 12px; color: #666;">
          Ce lien expire dans 24 heures. Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email — aucune donnée ne sera conservée.
        </p>
        <p style="font-size: 12px; color: #666;">
          Lien de confirmation : <a href="${safeUrl}" style="color: #C2185B;">${safeUrl}</a>
        </p>
      </body>
      </html>
    `.trim();

    const info = await transporter.sendMail({
      from: emailConfig.from,
      to: recipient,
      replyTo: emailConfig.replyTo,
      subject,
      html,
    });
    await persistDevOutboxEmail(
      recipient,
      `Newsletter confirmation`,
      (info as any).message
    );
    console.log(
      `[Email] Newsletter confirmation sent to ${recipient} via ${transportMode}`
    );
    return true;
  } catch (error) {
    console.error("[Email] Newsletter confirmation failed:", error);
    return false;
  }
}

/** Sample values used by the test-send preview so admins can see their edits
 *  rendered end-to-end without placing a real order. */
function sampleVarsFor(key: EmailTemplateKey): Record<string, string | number> {
  const shared = {
    orderNumber: "SBP-PREVIEW-0001",
    customerName: "Aperçu Test",
    customerPhone: "+221 77 000 00 00",
    totalAmount: formatCFA(45000),
    paymentMethod: "Orange Money",
    trackingUrl: `${appUrl}/suivi?order=SBP-PREVIEW-0001`,
  };
  if (key === "order_status_update") {
    return {
      ...shared,
      status: "shipped",
      statusLabel: "Expédiée",
    };
  }
  if (key === "admin_notification") {
    return { ...shared, itemCount: 3 };
  }
  return shared;
}

/**
 * Render + send the current admin-edited template to an arbitrary recipient
 * so operators can verify their edits before a real customer sees them.
 *
 * Unlike the production send functions, this ignores the "pristine" guard —
 * when the operator hits Send Test we always send what is currently saved.
 */
export async function sendTemplatePreviewEmail(
  key: EmailTemplateKey,
  recipient: string
): Promise<{ success: boolean; mode: typeof transportMode; error?: string }> {
  try {
    const transporter = getTransporter();
    if (!transporter) {
      return {
        success: false,
        mode: transportMode,
        error:
          "SMTP non configuré. Définissez SMTP_HOST/USER/PASSWORD ou lancez en mode dev pour écrire dans .dev-emails.",
      };
    }
    const template = getEmailTemplate(key);
    const vars = sampleVarsFor(key);
    const subject = `[TEST] ${renderTemplateString(template.subject, vars)}`;
    const renderedBody = renderTemplateString(template.body, vars);
    const looksLikeHtml = /<(p|div|table|br|h[1-6]|section|article)\b/i.test(
      renderedBody
    );
    const bodyHtml = looksLikeHtml
      ? renderedBody
      : escapeHtml(renderedBody).replace(/\n/g, "<br>");
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8" /></head>
      <body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="margin-bottom: 16px; padding: 8px 12px; border-radius: 4px; background: #fff3cd; color: #7a5c00; font-size: 12px;">
          Aperçu du modèle "${key}" — valeurs de test.
        </div>
        ${bodyHtml}
      </body>
      </html>
    `.trim();

    const info = await transporter.sendMail({
      from: emailConfig.from,
      to: recipient,
      replyTo: emailConfig.replyTo,
      subject,
      html,
    });
    await persistDevOutboxEmail(
      recipient,
      `Template preview - ${key}`,
      (info as any).message
    );
    console.log(
      `[Email] Template preview (${key}) sent to ${recipient} via ${transportMode}`
    );
    return { success: true, mode: transportMode };
  } catch (error) {
    console.error("[Email] Template preview failed:", error);
    return {
      success: false,
      mode: transportMode,
      error: error instanceof Error ? error.message : "Envoi impossible",
    };
  }
}

/**
 * Send order confirmation email
 */
export async function sendOrderConfirmationEmail(orderData: {
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  customerAddress: string;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  totalAmount: number;
  paymentMethod: string;
}): Promise<boolean> {
  try {
    const transporter = getTransporter();
    if (!transporter || !orderData.customerEmail) {
      console.warn(
        "[Email] Cannot send confirmation: transporter unavailable or no email"
      );
      return false;
    }

    const paymentMethodLabel: Record<string, string> = {
      orange_money: "Orange Money",
      wave: "Wave",
      free_money: "Free Money",
    };

    // If the admin has customized this template, honor it.
    const trackingUrl = buildTrackingUrl(
      orderData.orderNumber,
      orderData.customerPhone
    );
    const custom = resolveCustomEmailContent("order_confirmation", {
      orderNumber: orderData.orderNumber,
      customerName: orderData.customerName,
      customerPhone: orderData.customerPhone,
      totalAmount: formatCFA(orderData.totalAmount),
      paymentMethod:
        paymentMethodLabel[orderData.paymentMethod] || orderData.paymentMethod,
      trackingUrl,
    });
    if (custom) {
      const info = await transporter.sendMail({
        from: emailConfig.from,
        to: orderData.customerEmail,
        replyTo: emailConfig.replyTo,
        subject: custom.subject,
        html: custom.htmlBody,
      });
      await persistDevOutboxEmail(
        orderData.customerEmail,
        `Order confirmation - ${orderData.orderNumber}`,
        (info as any).message
      );
      console.log(
        `[Email] Order confirmation (custom template) sent to ${orderData.customerEmail}`
      );
      return true;
    }

    const itemsHtml = orderData.items
      .map(
        item =>
          `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.productName}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${formatCFA(item.unitPrice)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${formatCFA(item.totalPrice)}</td>
      </tr>
    `
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #C2185B; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .section { margin-bottom: 20px; }
          .section-title { font-size: 16px; font-weight: bold; color: #C2185B; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; }
          .total-row { background-color: #f0f0f0; font-weight: bold; }
          .footer { background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666; }
          .button { display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Commande Confirmée</h1>
            <p>Merci d'avoir choisi SenBonsPlans!</p>
          </div>
          
          <div class="content">
            <div class="section">
              <div class="section-title">Numéro de commande</div>
              <p style="font-size: 18px; color: #C2185B; font-weight: bold;">${orderData.orderNumber}</p>
            </div>

            <div class="section">
              <div class="section-title">Informations de livraison</div>
              <p>
                <strong>${orderData.customerName}</strong><br>
                ${orderData.customerAddress}<br>
                ${orderData.customerPhone}
              </p>
            </div>

            <div class="section">
              <div class="section-title">Produits commandés</div>
              <table>
                <thead>
                  <tr style="background-color: #f0f0f0;">
                    <th style="padding: 10px; text-align: left;">Produit</th>
                    <th style="padding: 10px; text-align: center;">Quantité</th>
                    <th style="padding: 10px; text-align: right;">Prix unitaire</th>
                    <th style="padding: 10px; text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                  <tr class="total-row">
                    <td colspan="3" style="padding: 10px; text-align: right;">Montant total:</td>
                    <td style="padding: 10px; text-align: right;">${formatCFA(orderData.totalAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="section">
              <div class="section-title">Méthode de paiement</div>
              <p>${paymentMethodLabel[orderData.paymentMethod] || orderData.paymentMethod}</p>
            </div>

            <div class="section">
              <p>Vous pouvez suivre votre commande en utilisant le lien ci-dessous:</p>
              <a href="${trackingUrl}" class="button">Suivre ma commande</a>
            </div>

            <div class="section">
              <p style="font-size: 12px; color: #666;">
                Si vous avez des questions, veuillez nous contacter au +221 78 891 10 10 ou répondre à cet email.
              </p>
            </div>
          </div>

          <div class="footer">
            <p>© 2026 SenBonsPlans. Tous droits réservés.</p>
            <p>Livraison rapide à Dakar et partout au Sénégal</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: emailConfig.from,
      to: orderData.customerEmail,
      replyTo: emailConfig.replyTo,
      subject: `Commande confirmée - ${orderData.orderNumber}`,
      html,
    });

    await persistDevOutboxEmail(
      orderData.customerEmail,
      `Order confirmation - ${orderData.orderNumber}`,
      (info as any).message
    );
    console.log(
      `[Email] Order confirmation sent to ${orderData.customerEmail}`
    );
    return true;
  } catch (error) {
    console.error("[Email] Error sending order confirmation:", error);
    return false;
  }
}

/**
 * Send order status update email
 */
export async function sendOrderStatusUpdateEmail(orderData: {
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string | null;
  status: string;
  statusLabel: string;
  totalAmount: number;
}): Promise<boolean> {
  try {
    const transporter = getTransporter();
    if (!transporter || !orderData.customerEmail) {
      console.warn(
        "[Email] Cannot send status update: transporter unavailable or no email"
      );
      return false;
    }

    const statusMessages: Record<string, string> = {
      confirmed: "Votre commande a été confirmée et sera traitée sous peu.",
      processing: "Votre commande est en cours de préparation.",
      shipped:
        "Votre commande a été expédiée! Vous recevrez bientôt votre colis.",
      delivered: "Votre commande a été livrée. Merci de votre achat!",
      cancelled: "Votre commande a été annulée.",
    };

    // If the admin has customized this template, honor it.
    const custom = resolveCustomEmailContent("order_status_update", {
      orderNumber: orderData.orderNumber,
      customerName: orderData.customerName,
      status: orderData.status,
      statusLabel: orderData.statusLabel,
      totalAmount: formatCFA(orderData.totalAmount),
    });
    if (custom) {
      const info = await transporter.sendMail({
        from: emailConfig.from,
        to: orderData.customerEmail,
        replyTo: emailConfig.replyTo,
        subject: custom.subject,
        html: custom.htmlBody,
      });
      await persistDevOutboxEmail(
        orderData.customerEmail,
        `Order status update - ${orderData.orderNumber}`,
        (info as any).message
      );
      console.log(
        `[Email] Status update (custom template) sent to ${orderData.customerEmail}`
      );
      return true;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #C2185B; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .status-badge { display: inline-block; background-color: #4CAF50; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; }
          .footer { background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Mise à jour de votre commande</h1>
          </div>
          
          <div class="content">
            <p>Bonjour ${orderData.customerName},</p>
            
            <p>Voici l'état actuel de votre commande:</p>
            
            <div style="text-align: center; margin: 20px 0;">
              <span class="status-badge">${orderData.statusLabel}</span>
            </div>

            <p>${statusMessages[orderData.status] || "Votre commande a été mise à jour."}</p>

            <div style="background-color: white; padding: 15px; border-left: 4px solid #C2185B; margin: 20px 0;">
              <p style="margin: 0;">
                <strong>Numéro de commande:</strong> ${orderData.orderNumber}<br>
                <strong>Montant:</strong> ${formatCFA(orderData.totalAmount)}
              </p>
            </div>

            <p>
              <a href="${buildTrackingUrl(orderData.orderNumber, orderData.customerPhone)}" style="color: #C2185B; text-decoration: none; font-weight: bold;">
                Voir les détails de ma commande →
              </a>
            </p>

            <p style="font-size: 12px; color: #666; margin-top: 30px;">
              Si vous avez des questions, veuillez nous contacter au +221 78 891 10 10.
            </p>
          </div>

          <div class="footer">
            <p>© 2026 SenBonsPlans. Tous droits réservés.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: emailConfig.from,
      to: orderData.customerEmail,
      replyTo: emailConfig.replyTo,
      subject: `Mise à jour: ${orderData.orderNumber} - ${orderData.statusLabel}`,
      html,
    });

    await persistDevOutboxEmail(
      orderData.customerEmail,
      `Order status update - ${orderData.orderNumber}`,
      (info as any).message
    );
    console.log(`[Email] Status update sent to ${orderData.customerEmail}`);
    return true;
  } catch (error) {
    console.error("[Email] Error sending status update:", error);
    return false;
  }
}

/**
 * Send admin notification about new order
 */
export async function sendAdminOrderNotification(orderData: {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  itemCount: number;
  paymentMethod: string;
}): Promise<boolean> {
  try {
    const transporter = getTransporter();
    if (!transporter) {
      console.warn(
        "[Email] Cannot send admin notification: transporter unavailable"
      );
      return false;
    }

    const adminEmail = process.env.ADMIN_EMAIL || "admin@senbonsplans.com";

    // If the admin has customized this template, honor it.
    const customAdmin = resolveCustomEmailContent("admin_notification", {
      orderNumber: orderData.orderNumber,
      customerName: orderData.customerName,
      customerPhone: orderData.customerPhone,
      totalAmount: formatCFA(orderData.totalAmount),
      itemCount: orderData.itemCount,
      paymentMethod: orderData.paymentMethod,
    });
    if (customAdmin) {
      const info = await transporter.sendMail({
        from: emailConfig.from,
        to: adminEmail,
        replyTo: emailConfig.replyTo,
        subject: customAdmin.subject,
        html: customAdmin.htmlBody,
      });
      await persistDevOutboxEmail(
        adminEmail,
        `Admin notification - ${orderData.orderNumber}`,
        (info as any).message
      );
      console.log(
        `[Email] Admin notification (custom template) sent for order ${orderData.orderNumber}`
      );
      return true;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #C2185B; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .order-box { background-color: white; padding: 15px; border-left: 4px solid #4CAF50; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Nouvelle commande reçue!</h1>
          </div>
          
          <div class="content">
            <div class="order-box">
              <p style="margin: 0;">
                <strong>Numéro de commande:</strong> ${orderData.orderNumber}<br>
                <strong>Client:</strong> ${orderData.customerName}<br>
                <strong>Téléphone:</strong> ${orderData.customerPhone}<br>
                <strong>Montant:</strong> ${formatCFA(orderData.totalAmount)}<br>
                <strong>Articles:</strong> ${orderData.itemCount}<br>
                <strong>Paiement:</strong> ${orderData.paymentMethod}
              </p>
            </div>

            <p>
              <a href="${appUrl}/admin" style="display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                Voir dans le tableau de bord
              </a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: emailConfig.from,
      to: adminEmail,
      replyTo: emailConfig.replyTo,
      subject: `[NOUVELLE COMMANDE] ${orderData.orderNumber} - ${formatCFA(orderData.totalAmount)}`,
      html,
    });

    await persistDevOutboxEmail(
      adminEmail,
      `Admin notification - ${orderData.orderNumber}`,
      (info as any).message
    );
    console.log(
      `[Email] Admin notification sent for order ${orderData.orderNumber}`
    );
    return true;
  } catch (error) {
    console.error("[Email] Error sending admin notification:", error);
    return false;
  }
}

/**
 * Test email configuration
 */
export async function testEmailConfiguration(): Promise<boolean> {
  try {
    const transporter = getTransporter();
    if (!transporter) {
      console.error("[Email] Email service not configured");
      return false;
    }

    await transporter.verify();
    console.log("[Email] SMTP connection verified successfully");
    return true;
  } catch (error) {
    console.error("[Email] SMTP verification failed:", error);
    return false;
  }
}
