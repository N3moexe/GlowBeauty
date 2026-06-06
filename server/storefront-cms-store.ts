import { sanitizeCmsHtml } from "./html-sanitizer";
import {
  defaultEmailTemplate,
  defaultHomepageLayout,
  defaultIntegrations,
  defaultNavigation,
  defaultTheme,
  EMAIL_TEMPLATE_KEYS,
  emailTemplateSchema,
  homepageLayoutSchema,
  integrationsSchema,
  mediaAssetCreateSchema,
  mediaAssetSchema,
  navigationSchema,
  staticPageCreateSchema,
  staticPageSchema,
  staticPageUpdateSchema,
  themeSchema,
  type EmailTemplate,
  type EmailTemplateKey,
  type EmailTemplateUpdate,
  type HomepageLayout,
  type Integrations,
  type MediaAsset,
  type Navigation,
  type StaticPage,
  type StaticPageCreate,
  type StaticPageUpdate,
  type ThemeConfig,
} from "../shared/storefront-cms";

/**
 * In-memory storefront CMS store.
 *
 * This is the source of truth when the app runs without a database (demo mode
 * and some tests). A production deployment layers a durable store on top —
 * same shape, persisted in MySQL. The public read/write API in the routers is
 * deliberately shape-agnostic so we can swap the backend without touching the
 * storefront.
 */

type State = {
  homepageLayout: HomepageLayout;
  navigation: Navigation;
  theme: ThemeConfig;
  integrations: Integrations;
  pages: StaticPage[];
  pagesSeq: number;
  emailTemplates: Map<EmailTemplateKey, EmailTemplate>;
  mediaAssets: MediaAsset[];
  mediaSeq: number;
};

function seedState(): State {
  const now = new Date().toISOString();
  const emailTemplates = new Map<EmailTemplateKey, EmailTemplate>();
  for (const key of EMAIL_TEMPLATE_KEYS) {
    emailTemplates.set(key, defaultEmailTemplate(key));
  }

  const seedPages: StaticPage[] = [
    {
      id: 1,
      slug: "cgv",
      title: "Conditions générales de vente",
      body:
        "## Conditions générales de vente\n\n" +
        "Bienvenue sur GlowBeauty. Ces conditions encadrent toute commande passée sur notre boutique.\n\n" +
        "### 1. Produits\nNos produits sont des soins authentiques, stockés à Dakar.\n\n" +
        "### 2. Prix\nLes prix sont affichés en CFA, toutes taxes comprises.\n\n" +
        "### 3. Livraison\nLivraison à Dakar en 24h, 72h dans le reste du Sénégal.\n\n" +
        "### 4. Retours\nRetour possible sous 14 jours si le produit est non ouvert.\n\n" +
        "### 5. Contact\nPour toute question, contactez-nous via WhatsApp.",
      metaDescription: "Conditions générales de vente GlowBeauty.",
      status: "published",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 2,
      slug: "confidentialite",
      title: "Politique de confidentialité",
      body:
        "## Politique de confidentialité\n\n" +
        "GlowBeauty respecte votre vie privée. Cette politique explique comment nous collectons et utilisons vos données.\n\n" +
        "### Données collectées\nNom, téléphone, email, adresse de livraison — uniquement pour traiter vos commandes.\n\n" +
        "### Cookies\nUniquement les cookies essentiels au panier et à la session.\n\n" +
        "### Vos droits\nVous pouvez demander la suppression de vos données à tout moment.",
      metaDescription: "Politique de confidentialité GlowBeauty.",
      status: "published",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 3,
      slug: "retours",
      title: "Politique de retour",
      body:
        "## Politique de retour\n\n" +
        "Nous voulons que vous soyez entièrement satisfait de vos achats.\n\n" +
        "### Délai\n14 jours après réception pour initier un retour.\n\n" +
        "### Conditions\nProduit non ouvert, dans son emballage d'origine.\n\n" +
        "### Processus\nContactez-nous via WhatsApp, nous organisons la collecte à Dakar.",
      metaDescription: "Politique de retour GlowBeauty.",
      status: "published",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 4,
      slug: "a-propos",
      title: "À propos",
      body:
        "## Une maison skincare à Dakar\n\n" +
        "GlowBeauty, c'est une sélection de soins choisis pour le climat d'Afrique de l'Ouest — humidité, soleil intense, pollution urbaine.\n\n" +
        "### Notre promesse\nDes formules éprouvées, des conseils honnêtes, et une livraison rapide.\n\n" +
        "### Notre équipe\nDes passionnés de skincare basés à Dakar, disponibles en français et en wolof.",
      metaDescription: "À propos de GlowBeauty, maison skincare à Dakar.",
      status: "published",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 5,
      slug: "contact",
      title: "Nous contacter",
      body:
        "## Écrivez-nous\n\nNous répondons dans la journée, 7 jours sur 7.\n\n" +
        "- **WhatsApp** : +221 78 891 10 10\n" +
        "- **Email** : contact@glowbeauty.com\n" +
        "- **Adresse** : Dakar, Sénégal\n\n" +
        "Nos conseillères skincare vous répondent en français et en wolof.",
      metaDescription: "Contact GlowBeauty — WhatsApp et email.",
      status: "published",
      createdAt: now,
      updatedAt: now,
    },
  ];

  return {
    homepageLayout: defaultHomepageLayout(),
    navigation: defaultNavigation(),
    theme: defaultTheme(),
    integrations: defaultIntegrations(),
    pages: seedPages,
    pagesSeq: seedPages.length + 1,
    emailTemplates,
    mediaAssets: [],
    mediaSeq: 1,
  };
}

let state: State = seedState();

// ─── Durable persistence (write-through to the store_settings KV table) ───
//
// Reads stay synchronous against the in-memory `state`. Admin writes persist a
// JSON snapshot of each singleton so edits survive restarts and redeploys, then
// update `state` only after the write succeeds. The DB layer (db.ts) falls back
// to an in-memory map when no database is configured (demo mode), so these are
// safe to call unconditionally. Collections (pages, email templates, media)
// remain in-memory for now.

const CMS_KEYS = {
  homepageLayout: "cms.homepageLayout",
  navigation: "cms.navigation",
  theme: "cms.theme",
  integrations: "cms.integrations",
} as const;

async function persistCmsRecord(key: string, value: unknown): Promise<void> {
  const { setStoreSetting } = await import("./db");
  await setStoreSetting(key, JSON.stringify(value));
}

/**
 * Load persisted CMS singletons from the database into the in-memory state.
 * Call once at server startup, after the DB connection is available. A missing
 * or invalid record is ignored so the seeded default stays in place.
 */
export async function hydrateStorefrontCmsFromDb(): Promise<void> {
  const { getStoreSetting } = await import("./db");

  const hydrate = async <T>(
    key: string,
    parse: (raw: unknown) => T,
    apply: (value: T) => void
  ): Promise<boolean> => {
    let raw: string | null | undefined;
    try {
      raw = await getStoreSetting(key);
    } catch (error) {
      console.error(`[CMS] Failed to read "${key}" from DB`, error);
      return false;
    }
    if (!raw) return false;
    try {
      apply(parse(JSON.parse(raw)));
      return true;
    } catch (error) {
      console.error(
        `[CMS] Ignoring invalid stored "${key}", keeping default`,
        error
      );
      return false;
    }
  };

  const results = await Promise.all([
    hydrate(
      CMS_KEYS.homepageLayout,
      v => homepageLayoutSchema.parse(v),
      v => {
        state.homepageLayout = v;
      }
    ),
    hydrate(
      CMS_KEYS.navigation,
      v => navigationSchema.parse(v),
      v => {
        state.navigation = v;
      }
    ),
    hydrate(
      CMS_KEYS.theme,
      v => themeSchema.parse(v),
      v => {
        state.theme = v;
      }
    ),
    hydrate(
      CMS_KEYS.integrations,
      v => integrationsSchema.parse(v),
      v => {
        state.integrations = v;
      }
    ),
  ]);

  const loaded = results.filter(Boolean).length;
  if (loaded > 0) {
    console.info(`[CMS] Hydrated ${loaded} storefront record(s) from DB`);
  }
}

// ─── Homepage layout ───

export function getHomepageLayout(): HomepageLayout {
  return state.homepageLayout;
}

export async function setHomepageLayout(
  next: unknown
): Promise<HomepageLayout> {
  const parsed = homepageLayoutSchema.parse({
    ...(next as any),
    updatedAt: new Date().toISOString(),
  });
  await persistCmsRecord(CMS_KEYS.homepageLayout, parsed);
  state.homepageLayout = parsed;
  return parsed;
}

// ─── Navigation ───

export function getNavigation(): Navigation {
  return state.navigation;
}

export async function setNavigation(next: unknown): Promise<Navigation> {
  const parsed = navigationSchema.parse({
    ...(next as any),
    updatedAt: new Date().toISOString(),
  });
  await persistCmsRecord(CMS_KEYS.navigation, parsed);
  state.navigation = parsed;
  return parsed;
}

// ─── Theme ───

export function getTheme(): ThemeConfig {
  return state.theme;
}

export async function setTheme(next: unknown): Promise<ThemeConfig> {
  const parsed = themeSchema.parse({
    ...(next as any),
    updatedAt: new Date().toISOString(),
  });
  await persistCmsRecord(CMS_KEYS.theme, parsed);
  state.theme = parsed;
  return parsed;
}

// ─── Integrations ───

export function getIntegrations(): Integrations {
  return state.integrations;
}

export async function setIntegrations(next: unknown): Promise<Integrations> {
  const parsed = integrationsSchema.parse({
    ...(next as any),
    updatedAt: new Date().toISOString(),
  });
  await persistCmsRecord(CMS_KEYS.integrations, parsed);
  state.integrations = parsed;
  return parsed;
}

// ─── Static pages ───

export function listPages(includeAll = false): StaticPage[] {
  if (includeAll) return [...state.pages].sort((a, b) => a.id - b.id);
  return state.pages.filter(page => page.status === "published");
}

export function getPageBySlug(slug: string): StaticPage | undefined {
  return state.pages.find(page => page.slug === slug);
}

export function getPageById(id: number): StaticPage | undefined {
  return state.pages.find(page => page.id === id);
}

export function createPage(input: unknown): StaticPage {
  const parsed = staticPageCreateSchema.parse(input) as StaticPageCreate;
  if (state.pages.some(page => page.slug === parsed.slug)) {
    throw new Error(`A page with slug "${parsed.slug}" already exists.`);
  }
  const now = new Date().toISOString();
  const page: StaticPage = {
    id: state.pagesSeq++,
    slug: parsed.slug,
    title: parsed.title,
    body: sanitizeCmsHtml(parsed.body ?? ""),
    metaDescription: parsed.metaDescription ?? "",
    status: parsed.status ?? "draft",
    createdAt: now,
    updatedAt: now,
  };
  state.pages.push(page);
  return staticPageSchema.parse(page);
}

export function updatePage(input: unknown): StaticPage {
  const parsed = staticPageUpdateSchema.parse(input) as StaticPageUpdate;
  const index = state.pages.findIndex(page => page.id === parsed.id);
  if (index === -1) throw new Error("Page not found");
  const current = state.pages[index];
  if (parsed.slug && parsed.slug !== current.slug) {
    if (
      state.pages.some(
        page => page.slug === parsed.slug && page.id !== current.id
      )
    ) {
      throw new Error(`A page with slug "${parsed.slug}" already exists.`);
    }
  }
  const next: StaticPage = {
    ...current,
    slug: parsed.slug ?? current.slug,
    title: parsed.title ?? current.title,
    body:
      typeof parsed.body === "string"
        ? sanitizeCmsHtml(parsed.body)
        : current.body,
    metaDescription: parsed.metaDescription ?? current.metaDescription,
    status: parsed.status ?? current.status,
    updatedAt: new Date().toISOString(),
  };
  state.pages[index] = next;
  return staticPageSchema.parse(next);
}

export function deletePage(id: number): boolean {
  const before = state.pages.length;
  state.pages = state.pages.filter(page => page.id !== id);
  return state.pages.length !== before;
}

// ─── Email templates ───

export function listEmailTemplates(): EmailTemplate[] {
  return EMAIL_TEMPLATE_KEYS.map(
    key => state.emailTemplates.get(key) ?? defaultEmailTemplate(key)
  );
}

export function getEmailTemplate(key: EmailTemplateKey): EmailTemplate {
  return state.emailTemplates.get(key) ?? defaultEmailTemplate(key);
}

export function setEmailTemplate(update: EmailTemplateUpdate): EmailTemplate {
  const current = getEmailTemplate(update.key);
  const next: EmailTemplate = {
    ...current,
    subject: update.subject ?? current.subject,
    body: update.body ?? current.body,
    updatedAt: new Date().toISOString(),
  };
  emailTemplateSchema.parse(next);
  state.emailTemplates.set(update.key, next);
  return next;
}

// ─── Media library ───

export function listMediaAssets(): MediaAsset[] {
  // Newest first so the most recent upload is always visible.
  return [...state.mediaAssets].sort((a, b) => b.id - a.id);
}

export function createMediaAsset(input: unknown): MediaAsset {
  const parsed = mediaAssetCreateSchema.parse(input);
  // Dedupe by URL to avoid cluttering the library after repeated edits.
  const existing = state.mediaAssets.find(asset => asset.url === parsed.url);
  if (existing) return existing;
  const asset: MediaAsset = {
    id: state.mediaSeq++,
    url: parsed.url,
    name: parsed.name,
    size: parsed.size,
    mimeType: parsed.mimeType,
    createdAt: new Date().toISOString(),
  };
  state.mediaAssets.push(asset);
  return mediaAssetSchema.parse(asset);
}

export function deleteMediaAsset(id: number): boolean {
  const before = state.mediaAssets.length;
  state.mediaAssets = state.mediaAssets.filter(asset => asset.id !== id);
  return state.mediaAssets.length !== before;
}

// ─── Test helper ───

export function __resetStorefrontCmsForTests() {
  state = seedState();
}
