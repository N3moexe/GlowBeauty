const baseUrl = (process.env.SECURITY_SMOKE_URL || "http://localhost:3000").replace(/\/+$/, "");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  return response;
}

async function run() {
  console.log(`[security-smoke] base URL: ${baseUrl}`);

  const home = await request("/");
  assert(home.ok, `Homepage should be reachable (status: ${home.status})`);

  const xFrame = home.headers.get("x-frame-options");
  const xContentType = home.headers.get("x-content-type-options");
  const csp =
    home.headers.get("content-security-policy") ||
    home.headers.get("content-security-policy-report-only");
  assert(xFrame === "DENY", "Missing/invalid X-Frame-Options header");
  assert(xContentType === "nosniff", "Missing/invalid X-Content-Type-Options header");
  assert(Boolean(csp), "Missing CSP header (enforced or report-only)");
  console.log("[security-smoke] headers check: ok");

  const adminNoAuth = await request("/api/admin/settings");
  assert(
    adminNoAuth.status === 401 || adminNoAuth.status === 403,
    `Admin route should require auth (got ${adminNoAuth.status})`
  );
  console.log("[security-smoke] admin auth check: ok");

  let rateLimited = false;
  const prefix = `security-smoke-${Date.now()}`;
  for (let i = 0; i < 14; i += 1) {
    const response = await request("/api/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `${prefix}-${i}@example.com`,
        source: "security-smoke",
      }),
    });
    if (response.status === 429) {
      rateLimited = true;
      break;
    }
  }
  assert(rateLimited, "Rate limiter did not trigger on newsletter endpoint");
  console.log("[security-smoke] rate limit check: ok");

  console.log("[security-smoke] PASS");
}

run().catch((error) => {
  console.error("[security-smoke] FAIL:", error?.message || error);
  process.exitCode = 1;
});

