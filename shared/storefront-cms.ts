import { z } from "zod";

// ─── Homepage section types ───

export const heroSectionSchema = z.object({
  type: z.literal("hero"),
  id: z.string(),
  enabled: z.boolean().default(true),
  badge: z.string().max(80).default(""),
  title: z.string().max(200).default(""),
  subtitle: z.string().max(400).default(""),
  imageUrl: z.string().max(1024).default(""),
  primaryCtaLabel: z.string().max(60).default("Voir la boutique"),
  primaryCtaHref: z.string().max(200).default("/boutique"),
  secondaryCtaLabel: z.string().max(60).default(""),
  secondaryCtaHref: z.string().max(200).default(""),
  overlayKicker: z.string().max(60).default(""),
  overlayTitle: z.string().max(120).default(""),
  overlayDescription: z.string().max(240).default(""),
  overlayCtaLabel: z.string().max(60).default(""),
  overlayCtaHref: z.string().max(200).default(""),
});

export const trustItemSchema = z.object({
  id: z.string(),
  icon: z.enum(["truck", "shield", "sparkles", "heart", "phone", "chat"]),
  title: z.string().max(80),
  subtitle: z.string().max(200),
});

export const trustSectionSchema = z.object({
  type: z.literal("trust"),
  id: z.string(),
  enabled: z.boolean().default(true),
  items: z.array(trustItemSchema).max(6).default([]),
});

export const concernTileSchema = z.object({
  id: z.string(),
  title: z.string().max(60),
  subtitle: z.string().max(200),
  href: z.string().max(200),
  gradient: z.string().max(200).default(""),
});

export const concernsSectionSchema = z.object({
  type: z.literal("concerns"),
  id: z.string(),
  enabled: z.boolean().default(true),
  kicker: z.string().max(60).default(""),
  title: z.string().max(160).default(""),
  subtitle: z.string().max(240).default(""),
  actionLabel: z.string().max(60).default(""),
  actionHref: z.string().max(200).default("/boutique"),
  items: z.array(concernTileSchema).max(6).default([]),
});

export const productRailSectionSchema = z.object({
  type: z.literal("product_rail"),
  id: z.string(),
  enabled: z.boolean().default(true),
  kicker: z.string().max(60).default(""),
  title: z.string().max(160).default(""),
  source: z
    .enum(["trending", "featured", "new", "best_sellers"])
    .default("trending"),
  limit: z.number().int().min(2).max(24).default(8),
  actionLabel: z.string().max(60).default("Voir plus"),
  actionHref: z.string().max(200).default("/boutique"),
});

export const newsletterSectionSchema = z.object({
  type: z.literal("newsletter"),
  id: z.string(),
  enabled: z.boolean().default(true),
  title: z.string().max(160).default(""),
  subtitle: z.string().max(300).default(""),
});

export const richTextSectionSchema = z.object({
  type: z.literal("rich_text"),
  id: z.string(),
  enabled: z.boolean().default(true),
  kicker: z.string().max(60).default(""),
  title: z.string().max(160).default(""),
  body: z.string().max(2000).default(""),
  ctaLabel: z.string().max(60).default(""),
  ctaHref: z.string().max(200).default(""),
});

export const homepageSectionSchema = z.discriminatedUnion("type", [
  heroSectionSchema,
  trustSectionSchema,
  concernsSectionSchema,
  productRailSectionSchema,
  newsletterSectionSchema,
  richTextSectionSchema,
]);

export const homepageLayoutSchema = z.object({
  sections: z.array(homepageSectionSchema).max(20),
  updatedAt: z.string(),
});

export type HeroSection = z.infer<typeof heroSectionSchema>;
export type TrustSection = z.infer<typeof trustSectionSchema>;
export type ConcernsSection = z.infer<typeof concernsSectionSchema>;
export type ProductRailSection = z.infer<typeof productRailSectionSchema>;
export type NewsletterSection = z.infer<typeof newsletterSectionSchema>;
export type RichTextSection = z.infer<typeof richTextSectionSchema>;
export type HomepageSection = z.infer<typeof homepageSectionSchema>;
export type HomepageSectionType = HomepageSection["type"];
export type HomepageLayout = z.infer<typeof homepageLayoutSchema>;

// ─── Navigation ───

export const navItemSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(60),
  href: z.string().min(1).max(200),
});

export const navGroupSchema = z.object({
  id: z.string(),
  title: z.string().max(60).default(""),
  items: z.array(navItemSchema).max(10),
});

export const navigationSchema = z.object({
  header: z.array(navItemSchema).max(12).default([]),
  footer: z.array(navGroupSchema).max(6).default([]),
  updatedAt: z.string(),
});

export type NavItem = z.infer<typeof navItemSchema>;
export type NavGroup = z.infer<typeof navGroupSchema>;
export type Navigation = z.infer<typeof navigationSchema>;

// ─── Theme tokens ───

export const themeSchema = z.object({
  brandAccent: z.string().max(64).default("#e3744e"),
  brandAccentHover: z.string().max(64).default("#d15d34"),
  brandInk: z.string().max(64).default("#281B19"),
  brandBg: z.string().max(64).default("#FBF4EE"),
  logoUrl: z.string().max(1024).default(""),
  faviconUrl: z.string().max(1024).default(""),
  announcementEnabled: z.boolean().default(false),
  announcementText: z.string().max(200).default(""),
  announcementHref: z.string().max(200).default(""),
  updatedAt: z.string(),
});

export type ThemeConfig = z.infer<typeof themeSchema>;

// ─── Integrations ───

export const integrationsSchema = z.object({
  metaPixelId: z.string().max(64).default(""),
  ga4MeasurementId: z.string().max(64).default(""),
  brevoApiKey: z.string().max(200).default(""),
  whatsappNumber: z.string().max(40).default(""),
  tiktokPixelId: z.string().max(64).default(""),
  updatedAt: z.string(),
});

export type Integrations = z.infer<typeof integrationsSchema>;

// ─── Static pages ───

export const staticPageSchema = z.object({
  id: z.number().int(),
  slug: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  body: z.string().max(40000),
  metaDescription: z.string().max(300).default(""),
  status: z.enum(["draft", "published"]).default("draft"),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const staticPageCreateSchema = z.object({
  slug: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  body: z.string().max(40000).default(""),
  metaDescription: z.string().max(300).default(""),
  status: z.enum(["draft", "published"]).default("draft"),
});

export const staticPageUpdateSchema = staticPageCreateSchema.partial().extend({
  id: z.number().int(),
});

export type StaticPage = z.infer<typeof staticPageSchema>;
export type StaticPageCreate = z.infer<typeof staticPageCreateSchema>;
export type StaticPageUpdate = z.infer<typeof staticPageUpdateSchema>;

// ─── Email templates ───

export const emailTemplateSchema = z.object({
  key: z.enum([
    "order_confirmation",
    "order_status_update",
    "admin_notification",
  ]),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(20000),
  updatedAt: z.string(),
});

export const emailTemplateUpdateSchema = emailTemplateSchema
  .pick({ key: true, subject: true, body: true })
  .partial({ subject: true, body: true })
  .extend({ key: emailTemplateSchema.shape.key });

export type EmailTemplate = z.infer<typeof emailTemplateSchema>;
export type EmailTemplateUpdate = z.infer<typeof emailTemplateUpdateSchema>;

export type EmailTemplateKey = EmailTemplate["key"];

// ─── Default factories ───

export function defaultHomepageLayout(): HomepageLayout {
  const now = new Date().toISOString();
  return {
    updatedAt: now,
    sections: [
      {
        type: "hero",
        id: "hero-1",
        enabled: true,
        badge: "Skincare, version Sénégal",
        title: "Votre peau, la version qu'elle attendait.",
        subtitle:
          "Des formules choisies avec soin pour le climat de Dakar. Pas de promesses magiques — juste des actifs que votre peau reconnaît.",
        imageUrl: "",
        primaryCtaLabel: "Voir la boutique",
        primaryCtaHref: "/boutique",
        secondaryCtaLabel: "Trouver ma routine en 2 min",
        secondaryCtaHref: "/boutique?q=routine",
        overlayKicker: "Routine du moment",
        overlayTitle: "Des routines pensées pour des résultats visibles",
        overlayDescription: "Matin, soir, semaine. On vous guide pas à pas.",
        overlayCtaLabel: "Voir le rituel",
        overlayCtaHref: "/boutique?q=routine",
      },
      {
        type: "trust",
        id: "trust-1",
        enabled: true,
        items: [
          {
            id: "trust-delivery",
            icon: "truck",
            title: "Chez vous en 24h à Dakar",
            subtitle: "72h partout au Sénégal, suivi en temps réel.",
          },
          {
            id: "trust-payment",
            icon: "shield",
            title: "Paiement, comme vous voulez",
            subtitle: "Wave, Orange Money, Free Money ou carte.",
          },
          {
            id: "trust-support",
            icon: "sparkles",
            title: "Une conseillère skincare",
            subtitle: "On répond en français et en wolof, par WhatsApp.",
          },
        ],
      },
      {
        type: "concerns",
        id: "concerns-1",
        enabled: true,
        kicker: "Par objectif peau",
        title: "Qu'est-ce que votre peau vous demande ?",
        subtitle:
          "Hydratation, imperfections, éclat ou protection solaire — on vous oriente vers la routine qui marche pour vous.",
        actionLabel: "Voir toute la boutique",
        actionHref: "/boutique",
        items: [],
      },
      {
        type: "product_rail",
        id: "product-rail-1",
        enabled: true,
        kicker: "Best sellers",
        title: "Les essentiels les plus demandés",
        source: "trending",
        limit: 8,
        actionLabel: "Voir plus",
        actionHref: "/boutique",
      },
      {
        type: "newsletter",
        id: "newsletter-1",
        enabled: true,
        title: "−10 % sur votre première commande",
        subtitle:
          "Inscrivez-vous et recevez votre code par email. Plus nos sélections skincare du samedi. Pas de spam, promis.",
      },
    ],
  };
}

export function defaultNavigation(): Navigation {
  const now = new Date().toISOString();
  return {
    updatedAt: now,
    header: [
      { id: "nav-shop", label: "Boutique", href: "/boutique" },
      { id: "nav-routine", label: "Nos routines", href: "/boutique?q=routine" },
      { id: "nav-tracking", label: "Suivi commande", href: "/suivi" },
    ],
    footer: [
      {
        id: "group-shop",
        title: "Boutique",
        items: [
          { id: "foot-home", label: "Accueil", href: "/" },
          { id: "foot-shop", label: "Boutique", href: "/boutique" },
          { id: "foot-cart", label: "Panier", href: "/panier" },
          { id: "foot-track", label: "Suivi commande", href: "/suivi" },
        ],
      },
      {
        id: "group-brand",
        title: "Maison",
        items: [
          { id: "foot-about", label: "À propos", href: "/page/a-propos" },
          { id: "foot-contact", label: "Contact", href: "/page/contact" },
        ],
      },
      {
        id: "group-legal",
        title: "Informations",
        items: [
          { id: "foot-cgv", label: "Conditions de vente", href: "/page/cgv" },
          {
            id: "foot-privacy",
            label: "Confidentialité",
            href: "/page/confidentialite",
          },
          { id: "foot-returns", label: "Retours", href: "/page/retours" },
        ],
      },
    ],
  };
}

export function defaultTheme(): ThemeConfig {
  return {
    brandAccent: "#e3744e",
    brandAccentHover: "#d15d34",
    brandInk: "#281B19",
    brandBg: "#FBF4EE",
    logoUrl: "",
    faviconUrl: "",
    announcementEnabled: false,
    announcementText: "",
    announcementHref: "",
    updatedAt: new Date(0).toISOString(),
  };
}

export function defaultIntegrations(): Integrations {
  return {
    metaPixelId: "",
    ga4MeasurementId: "",
    brevoApiKey: "",
    whatsappNumber: "",
    tiktokPixelId: "",
    updatedAt: new Date(0).toISOString(),
  };
}

export function defaultEmailTemplate(key: EmailTemplateKey): EmailTemplate {
  const now = new Date(0).toISOString();
  switch (key) {
    case "order_confirmation":
      return {
        key,
        subject:
          "Confirmation de votre commande {{orderNumber}} — SenBonsPlans",
        body:
          "Bonjour {{customerName}},\n\n" +
          "Merci pour votre commande {{orderNumber}}. Nous l'avons bien reçue et elle est en cours de traitement.\n\n" +
          "Total : {{totalAmount}} CFA\nMode de paiement : {{paymentMethod}}\n\n" +
          "Suivez votre commande à tout moment : {{trackingUrl}}\n\nL'équipe SenBonsPlans.",
        updatedAt: now,
      };
    case "order_status_update":
      return {
        key,
        subject: "Votre commande {{orderNumber}} — {{statusLabel}}",
        body:
          "Bonjour {{customerName}},\n\nStatut de votre commande {{orderNumber}} : {{statusLabel}}.\n\n" +
          "Total : {{totalAmount}} CFA\n\nPour toute question, répondez à cet email ou écrivez-nous sur WhatsApp.\n\nL'équipe SenBonsPlans.",
        updatedAt: now,
      };
    case "admin_notification":
      return {
        key,
        subject: "[SenBonsPlans] Nouvelle commande {{orderNumber}}",
        body:
          "Nouvelle commande reçue.\n\nN° : {{orderNumber}}\nClient : {{customerName}} ({{customerPhone}})\n" +
          "Total : {{totalAmount}} CFA\nArticles : {{itemCount}}\nMode de paiement : {{paymentMethod}}\n\n" +
          "Ouvrez le dashboard pour plus de détails.",
        updatedAt: now,
      };
  }
}

export const EMAIL_TEMPLATE_KEYS: EmailTemplateKey[] = [
  "order_confirmation",
  "order_status_update",
  "admin_notification",
];

// ─── Media library ───

export const mediaAssetSchema = z.object({
  id: z.number().int(),
  url: z.string().min(1).max(1024),
  name: z.string().min(1).max(200),
  /** Size in bytes, if known. */
  size: z.number().int().optional(),
  mimeType: z.string().max(80).optional(),
  createdAt: z.string(),
});

export const mediaAssetCreateSchema = mediaAssetSchema
  .pick({ url: true, name: true, size: true, mimeType: true })
  .partial({ size: true, mimeType: true });

export type MediaAsset = z.infer<typeof mediaAssetSchema>;
export type MediaAssetCreate = z.infer<typeof mediaAssetCreateSchema>;
