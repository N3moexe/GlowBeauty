#!/usr/bin/env node
/**
 * QA smoke for every admin route.
 * Launches chromium headless against a running dev server, captures
 * console errors + page failures + visible heading per route, and
 * reports a severity-tagged triage log.
 *
 * Usage:  node scripts/qa-admin-smoke.mjs [baseUrl]
 * Env:    ADMIN_QA_BASE_URL overrides the default http://localhost:3001
 */
import { chromium } from "playwright";

const BASE_URL =
  process.argv[2] ||
  process.env.ADMIN_QA_BASE_URL ||
  "http://localhost:3001";

const ROUTES = [
  { path: "/admin", label: "Admin (analytics default)" },
  { path: "/admin/orders", label: "Admin Orders module" },
  { path: "/admin/products", label: "Admin Products module" },
  { path: "/admin/inventory", label: "Admin Inventory module" },
  { path: "/admin/reviews", label: "Admin Reviews module" },
  { path: "/admin/reports", label: "Admin Reports module" },
  { path: "/admin/banners", label: "Admin Banners module" },
  { path: "/admin/customers", label: "Admin Customers page" },
  { path: "/admin/categories", label: "Admin Categories page" },
  { path: "/admin/coupons", label: "Admin Coupons page" },
  { path: "/admin/cms", label: "Admin CMS page" },
  { path: "/admin/pages", label: "Admin Pages page" },
  { path: "/admin/navigation", label: "Admin Navigation page" },
  { path: "/admin/theme", label: "Admin Theme page" },
  { path: "/admin/media", label: "Admin Media page" },
  { path: "/admin/email-templates", label: "Admin Email Templates page" },
  { path: "/admin/integrations", label: "Admin Integrations page" },
  { path: "/admin/storefront", label: "Admin Storefront page" },
  { path: "/admin/chatbot", label: "Admin Chatbot page" },
  { path: "/admin/settings", label: "Admin Settings page" },
];

const IGNORE_CONSOLE_PATTERNS = [
  /React DevTools/i,
  /Download the React DevTools/i,
  /\[vite\]/i,
  /\[HMR\]/i,
  /manus-runtime/i,
];

function shouldIgnore(text) {
  return IGNORE_CONSOLE_PATTERNS.some(re => re.test(text));
}

function pad(str, n) {
  return (str + " ".repeat(n)).slice(0, n);
}

async function auditRoute(context, { path, label }) {
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on("console", msg => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (!shouldIgnore(text)) consoleErrors.push(text);
  });
  page.on("pageerror", err => {
    pageErrors.push(err.message);
  });
  page.on("requestfailed", req => {
    const failure = req.failure();
    failedRequests.push(
      `${req.method()} ${req.url()} — ${failure?.errorText || "unknown"}`
    );
  });

  let httpStatus = null;
  let heading = null;
  let loadError = null;

  try {
    const response = await page.goto(`${BASE_URL}${path}`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    httpStatus = response?.status() ?? null;
    await page.waitForTimeout(800);
    heading = await page
      .locator("h1, h2, [role='heading']")
      .first()
      .textContent({ timeout: 2500 })
      .catch(() => null);
    if (heading) heading = heading.trim().slice(0, 70);
  } catch (err) {
    loadError = err.message;
  }

  await page.close();

  const severity =
    pageErrors.length > 0 || loadError
      ? "CRITICAL"
      : failedRequests.length > 0
        ? "HIGH"
        : consoleErrors.length > 0
          ? "MEDIUM"
          : "OK";

  return {
    path,
    label,
    httpStatus,
    heading,
    loadError,
    consoleErrors,
    pageErrors,
    failedRequests,
    severity,
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const results = [];
  for (const route of ROUTES) {
    process.stdout.write(`  → ${route.path}`);
    const result = await auditRoute(context, route);
    process.stdout.write(`  [${result.severity}]\n`);
    results.push(result);
  }

  await browser.close();

  console.log("\n=== QA Triage Report ===\n");
  console.log(
    `${pad("SEV", 9)}${pad("HTTP", 6)}${pad("ROUTE", 28)}HEADING / ERROR`
  );
  console.log("─".repeat(110));

  for (const r of results) {
    const headingOrError =
      r.loadError ||
      (r.pageErrors[0] && `pageerror: ${r.pageErrors[0]}`) ||
      r.heading ||
      "(no heading detected)";
    console.log(
      `${pad(r.severity, 9)}${pad(String(r.httpStatus ?? "—"), 6)}${pad(
        r.path,
        28
      )}${headingOrError}`
    );
  }

  const bad = results.filter(r => r.severity !== "OK");
  if (bad.length > 0) {
    console.log("\n=== Details ===\n");
    for (const r of bad) {
      console.log(`\n[${r.severity}] ${r.path}  (${r.label})`);
      if (r.loadError) console.log(`  loadError: ${r.loadError}`);
      for (const e of r.pageErrors) console.log(`  pageerror: ${e}`);
      for (const e of r.consoleErrors) console.log(`  console.error: ${e}`);
      for (const e of r.failedRequests) console.log(`  requestfailed: ${e}`);
    }
  }

  const counts = results.reduce((acc, r) => {
    acc[r.severity] = (acc[r.severity] || 0) + 1;
    return acc;
  }, {});
  console.log(
    `\nSummary: ${Object.entries(counts)
      .map(([k, v]) => `${k}=${v}`)
      .join("  ")}`
  );

  const anyBad = results.some(r =>
    ["CRITICAL", "HIGH"].includes(r.severity)
  );
  process.exit(anyBad ? 1 : 0);
}

main().catch(err => {
  console.error("QA smoke failed:", err);
  process.exit(2);
});
