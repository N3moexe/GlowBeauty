import * as Sentry from "@sentry/node";

let initialized = false;

/**
 * Initializes the Sentry SDK for the backend. Safe to call multiple times —
 * the second call is a no-op. Becomes a no-op entirely when SENTRY_DSN is
 * unset, which means dev boxes never ship telemetry.
 */
export function initSentry(): void {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) {
    console.info("[Sentry] SENTRY_DSN not set — error monitoring disabled.");
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    release: process.env.APP_RELEASE || undefined,
    // Conservative sampling on launch — revisit once volume is known.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    // We already tag PII in app logs explicitly; don't let the SDK scrape
    // request bodies by default.
    sendDefaultPii: false,
  });
  initialized = true;
  console.info(
    `[Sentry] Initialized (env=${process.env.NODE_ENV}, release=${process.env.APP_RELEASE || "—"})`
  );
}

export function isSentryEnabled(): boolean {
  return initialized;
}

export { Sentry };
