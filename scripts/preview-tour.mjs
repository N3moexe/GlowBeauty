import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const OUT = "C:/Users/nemo/Downloads/senbonsplans/.design-audit/preview";

const SHOTS = [
  { path: "/", name: "01-homepage", full: true },
  { path: "/boutique", name: "02-boutique", full: false },
  { path: "/p/serum-vitamine-c-15", name: "03-produit", full: false },
  { path: "/panier", name: "04-panier", full: false },
  { path: "/admin", name: "05-admin-dashboard", full: false },
  { path: "/admin/products", name: "06-admin-produits", full: false },
  { path: "/admin/orders", name: "07-admin-commandes", full: false },
  { path: "/admin/storefront", name: "08-admin-storefront-editor", full: false },
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

for (const s of SHOTS) {
  try {
    await page.goto(`${BASE}${s.path}`, { waitUntil: "networkidle", timeout: 25000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${s.name}.png`, fullPage: false });
    console.log(`OK ${s.name}`);
  } catch (e) {
    console.log(`FAIL ${s.name}: ${e.message.split("\n")[0]}`);
  }
}
await browser.close();
