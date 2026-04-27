#!/usr/bin/env node
/**
 * Storefront UX audit — captures screenshots of the critical buy-flow
 * routes at mobile and desktop viewports so a reviewer can see the
 * actual rendered pages.
 *
 * Usage: node scripts/storefront-audit.mjs [baseUrl]
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL =
  process.argv[2] ||
  process.env.STOREFRONT_AUDIT_BASE_URL ||
  "http://localhost:3002";

const OUT_DIR = path.join(__dirname, "storefront-screens");

const ROUTES = [
  { path: "/", slug: "home", label: "Home" },
  { path: "/boutique", slug: "shop", label: "Shop" },
  { path: "/cart", slug: "cart", label: "Cart" },
  { path: "/checkout", slug: "checkout", label: "Checkout" },
  { path: "/suivi", slug: "order-tracking", label: "Order Tracking" },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

async function capture(browser, route, viewport) {
  const ctx = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  let firstProductSlug = null;
  try {
    await page.goto(`${BASE_URL}${route.path}`, {
      waitUntil: "networkidle",
      timeout: 20000,
    });
    await page.waitForTimeout(1000);
    const file = path.join(OUT_DIR, `${route.slug}-${viewport.name}.png`);
    await page.screenshot({ path: file, fullPage: true });

    if (route.slug === "shop") {
      firstProductSlug = await page
        .locator('a[href^="/p/"], a[href^="/produit/"]')
        .first()
        .getAttribute("href")
        .catch(() => null);
    }
    console.log(`  ✓ ${route.slug}-${viewport.name}.png`);
  } catch (err) {
    console.log(`  ✗ ${route.slug}-${viewport.name}: ${err.message}`);
  } finally {
    await ctx.close();
  }
  return firstProductSlug;
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  let pdpSlug = null;
  for (const route of ROUTES) {
    for (const vp of VIEWPORTS) {
      const slug = await capture(browser, route, vp);
      if (slug && !pdpSlug) pdpSlug = slug;
    }
  }

  if (pdpSlug) {
    for (const vp of VIEWPORTS) {
      await capture(
        browser,
        { path: pdpSlug, slug: "product-detail", label: "PDP" },
        vp
      );
    }
  } else {
    console.log("  (no product slug extracted — skipping PDP capture)");
  }

  await browser.close();
  console.log(`\nScreenshots written to: ${OUT_DIR}`);
}

main().catch(err => {
  console.error("Storefront audit failed:", err);
  process.exit(2);
});
