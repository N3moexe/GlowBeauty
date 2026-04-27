import * as Sentry from "@sentry/react";

let initialized = false;

/**
 * Initializes Sentry on the client. No-ops unless VITE_SENTRY_DSN is set at
 * build time — so developer builds never dispatch telemetry.
 */
export function initSentry(): void {
  if (initialized) return;
  const dsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim();
  if (!dsn) {
    // Silent in dev; the server-side logger already announces the decision.
    return;
  }
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || "development",
    release:
      (import.meta.env.VITE_APP_RELEASE as string | undefined) || undefined,
    tracesSampleRate: Number(
      (import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE as string | undefined) ||
        0
    ),
    // Avoid shipping URLs with PII in them; safer default for a launching store.
    sendDefaultPii: false,
  });
  initialized = true;
}

export { Sentry };
