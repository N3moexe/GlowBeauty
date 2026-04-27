import type { Express, Request, Response } from "express";
import { getProducts } from "./db";
import { listPages } from "./storefront-cms-store";

const STATIC_ROUTES: ReadonlyArray<{
  path: string;
  changefreq: string;
  priority: string;
}> = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/shop", changefreq: "daily", priority: "0.9" },
];

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, ch => {
    switch (ch) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return ch;
    }
  });
}

function isoDate(value: string | Date | null | undefined): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function urlEntry(
  loc: string,
  lastmod: string,
  changefreq: string,
  priority: string
): string {
  return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

export function registerSitemapRoutes(app: Express) {
  app.get("/sitemap.xml", async (_req: Request, res: Response) => {
    const baseUrl = (process.env.APP_URL || "https://senbonsplans.com").replace(
      /\/+$/,
      ""
    );
    const today = new Date().toISOString().slice(0, 10);

    const entries: string[] = STATIC_ROUTES.map(r =>
      urlEntry(`${baseUrl}${r.path}`, today, r.changefreq, r.priority)
    );

    try {
      const { products } = await getProducts({ limit: 5000 });
      for (const p of products) {
        if (!p.slug) continue;
        entries.push(
          urlEntry(
            `${baseUrl}/p/${p.slug}`,
            isoDate(p.updatedAt),
            "weekly",
            "0.8"
          )
        );
      }
    } catch (error) {
      console.error("[sitemap] product query failed:", error);
    }

    try {
      const pages = listPages(false).filter(p => p.status === "published");
      for (const page of pages) {
        entries.push(
          urlEntry(
            `${baseUrl}/page/${page.slug}`,
            isoDate(page.updatedAt),
            "monthly",
            "0.5"
          )
        );
      }
    } catch (error) {
      console.error("[sitemap] page query failed:", error);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.status(200).send(xml);
  });
}
