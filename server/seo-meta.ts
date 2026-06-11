/**
 * Server-side SEO meta injection for the SPA.
 *
 * Crawlers and link-preview bots (Googlebot first wave, WhatsApp, Facebook,
 * Twitter/X, Telegram) fetch raw HTML and most never execute the client-side
 * SeoHead component. Without this module every URL returns the homepage's
 * title/description/og tags, which tanks rankings for product pages and shows
 * the wrong link preview when customers share a product.
 *
 * This module rewrites the <head> of the served index.html per-URL for the
 * public routes that matter: product detail pages and CMS pages.
 */
import { getProductBySlug } from "./db";
import { getPageBySlug } from "./storefront-cms-store";

const SITE_NAME = "GlowBeauty";

function baseUrl(): string {
  return (process.env.APP_URL || "https://glowbeauty.com").replace(/\/+$/, "");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, ch => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return ch;
    }
  });
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, max = 160): string {
  if (value.length <= max) return value;
  // Slice on code points (not UTF-16 units) so we never split an emoji /
  // surrogate pair in half and emit mojibake into the meta description.
  const cut = Array.from(value).slice(0, max - 1).join("");
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 80 ? lastSpace : max - 1).trimEnd()}…`;
}

function absoluteUrl(maybeRelative: string): string {
  if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative;
  return `${baseUrl()}${maybeRelative.startsWith("/") ? "" : "/"}${maybeRelative}`;
}

type SeoMeta = {
  title: string;
  description: string;
  canonicalPath: string;
  ogType: "website" | "product" | "article";
  image?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

function firstProductImage(product: {
  imageUrl: string | null;
  images: string | null;
}): string | undefined {
  if (product.imageUrl) return product.imageUrl;
  if (product.images) {
    try {
      const parsed = JSON.parse(product.images);
      if (Array.isArray(parsed)) {
        const first = parsed.find(
          (entry): entry is string => typeof entry === "string" && !!entry
        );
        if (first) return first;
      }
    } catch {
      // Ignore malformed optional gallery payload
    }
  }
  return undefined;
}

function productDescription(product: {
  name: string;
  description: string | null;
  descriptionBullets?: unknown;
}): string {
  const bullets = product.descriptionBullets;
  if (Array.isArray(bullets)) {
    const lines = bullets
      .filter((b): b is string => typeof b === "string" && !!b.trim())
      .slice(0, 2);
    if (lines.length) return truncate(lines.join(" "));
  }
  if (product.description) {
    const firstLines = product.description
      .split("\n")
      .map(line => line.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(" ");
    if (firstLines) return truncate(stripHtml(firstLines));
  }
  return `Découvrez ${product.name} sur ${SITE_NAME} avec livraison rapide et paiement sécurisé au Sénégal.`;
}

function breadcrumbJsonLd(
  crumbs: Array<{ name: string; path?: string }>
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      ...(crumb.path ? { item: `${baseUrl()}${crumb.path}` } : {}),
    })),
  };
}

async function resolveProductMeta(slug: string): Promise<SeoMeta | null> {
  const product = await getProductBySlug(slug);
  if (!product) return null;

  const canonicalPath = `/produit/${product.slug}`;
  const image = firstProductImage(product);
  const description = productDescription(product);
  const url = `${baseUrl()}${canonicalPath}`;

  return {
    title: `${product.name} | ${SITE_NAME}`,
    description,
    canonicalPath,
    ogType: "product",
    image: image ? absoluteUrl(image) : undefined,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description,
        sku: `${product.id}`,
        ...(image ? { image: [absoluteUrl(image)] } : {}),
        url,
        brand: { "@type": "Brand", name: SITE_NAME },
        offers: {
          "@type": "Offer",
          url,
          priceCurrency: "XOF",
          price: `${product.price}`,
          availability:
            product.inStock === false
              ? "https://schema.org/OutOfStock"
              : "https://schema.org/InStock",
        },
      },
      breadcrumbJsonLd([
        { name: "Accueil", path: "/" },
        { name: "Boutique", path: "/boutique" },
        { name: product.name },
      ]),
    ],
  };
}

function resolveCmsPageMeta(slug: string): SeoMeta | null {
  const page = getPageBySlug(slug);
  if (!page || page.status !== "published") return null;

  const description =
    page.metaDescription?.trim() ||
    truncate(stripHtml(page.body || "")) ||
    `${page.title} — ${SITE_NAME}`;

  return {
    title: `${page.title} | ${SITE_NAME}`,
    description,
    canonicalPath: `/page/${page.slug}`,
    ogType: "article",
  };
}

/**
 * Resolve per-URL SEO meta. Returns null for routes that should keep the
 * default index.html head (homepage, shop, admin, unknown slugs, ...).
 * Returns "not-found" when the URL matches a product/CMS route pattern but
 * the entity doesn't exist — callers should serve HTTP 404 (soft-404 fix).
 */
export async function resolveSeoMeta(
  url: string
): Promise<SeoMeta | "not-found" | null> {
  let pathname: string;
  try {
    pathname = new URL(url, baseUrl()).pathname;
  } catch {
    return null;
  }

  const productMatch = pathname.match(/^\/(?:p|produit)\/([^/]+)\/?$/);
  if (productMatch) {
    try {
      const meta = await resolveProductMeta(
        decodeURIComponent(productMatch[1])
      );
      return meta ?? "not-found";
    } catch (error) {
      console.error("[seo] product meta lookup failed:", error);
      return null;
    }
  }

  const pageMatch = pathname.match(/^\/page\/([^/]+)\/?$/);
  if (pageMatch) {
    try {
      const meta = resolveCmsPageMeta(decodeURIComponent(pageMatch[1]));
      return meta ?? "not-found";
    } catch (error) {
      console.error("[seo] cms page meta lookup failed:", error);
      return null;
    }
  }

  return null;
}

function replaceOrAppendHead(
  html: string,
  pattern: RegExp,
  replacement: string
): string {
  // Function replacements insert the string literally — a plain string here
  // would let `$&`, `$'` etc. inside product/CMS text act as substitution
  // patterns and corrupt the document (markup injection).
  if (pattern.test(html)) return html.replace(pattern, () => replacement);
  return html.replace(/<\/head>/i, match => `    ${replacement}\n  ${match}`);
}

/**
 * Rewrite the head of the index.html template with route-specific meta.
 * Leaves the template untouched when the route has no specific meta.
 * Returns the HTML plus the HTTP status the caller should respond with —
 * 404 for product/CMS URLs whose entity no longer exists, so crawlers
 * don't index dead URLs as soft-404 duplicates of the homepage.
 */
export async function injectSeoMeta(
  html: string,
  url: string
): Promise<{ html: string; status: number }> {
  const meta = await resolveSeoMeta(url);
  if (meta === "not-found") {
    // Keep default head but mark non-indexable and answer 404.
    const noindexHtml = html.replace(
      /<\/head>/i,
      match => `  <meta name="robots" content="noindex" />\n  ${match}`
    );
    return { html: noindexHtml, status: 404 };
  }
  if (!meta) return { html, status: 200 };

  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const canonicalUrl = escapeHtml(`${baseUrl()}${meta.canonicalPath}`);

  let out = html;
  out = replaceOrAppendHead(
    out,
    /<title>[\s\S]*?<\/title>/i,
    `<title>${title}</title>`
  );
  out = replaceOrAppendHead(
    out,
    /<meta\s+name="description"[^>]*\/?>/i,
    `<meta name="description" content="${description}" />`
  );
  out = replaceOrAppendHead(
    out,
    /<link\s+rel="canonical"[^>]*\/?>/i,
    `<link rel="canonical" href="${canonicalUrl}" />`
  );
  out = replaceOrAppendHead(
    out,
    /<meta\s+property="og:title"[^>]*\/?>/i,
    `<meta property="og:title" content="${title}" />`
  );
  out = replaceOrAppendHead(
    out,
    /<meta\s+property="og:description"[^>]*\/?>/i,
    `<meta property="og:description" content="${description}" />`
  );
  out = replaceOrAppendHead(
    out,
    /<meta\s+property="og:type"[^>]*\/?>/i,
    `<meta property="og:type" content="${meta.ogType}" />`
  );
  out = replaceOrAppendHead(
    out,
    /<meta\s+property="og:url"[^>]*\/?>/i,
    `<meta property="og:url" content="${canonicalUrl}" />`
  );
  out = replaceOrAppendHead(
    out,
    /<meta\s+name="twitter:title"[^>]*\/?>/i,
    `<meta name="twitter:title" content="${title}" />`
  );
  out = replaceOrAppendHead(
    out,
    /<meta\s+name="twitter:description"[^>]*\/?>/i,
    `<meta name="twitter:description" content="${description}" />`
  );

  if (meta.image) {
    const image = escapeHtml(meta.image);
    out = replaceOrAppendHead(
      out,
      /<meta\s+property="og:image"\s[^>]*\/?>/i,
      `<meta property="og:image" content="${image}" />`
    );
    out = replaceOrAppendHead(
      out,
      /<meta\s+name="twitter:image"[^>]*\/?>/i,
      `<meta name="twitter:image" content="${image}" />`
    );
    // Homepage og:image dimensions/alt no longer match the per-route image.
    out = out
      .replace(/\s*<meta\s+property="og:image:width"[^>]*\/?>/i, "")
      .replace(/\s*<meta\s+property="og:image:height"[^>]*\/?>/i, "")
      .replace(/\s*<meta\s+property="og:image:alt"[^>]*\/?>/i, "");
  }

  if (meta.jsonLd) {
    const payloads = Array.isArray(meta.jsonLd) ? meta.jsonLd : [meta.jsonLd];
    for (const payload of payloads) {
      // JSON inside a <script> must not allow `</script>` breakout.
      const json = JSON.stringify(payload).replace(/</g, "\\u003c");
      out = out.replace(
        /<\/head>/i,
        match =>
          `  <script type="application/ld+json">${json}</script>\n  ${match}`
      );
    }
  }

  return { html: out, status: 200 };
}
