// Sentry client init. Only runs when SENTRY_DSN is set on Netlify.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
    environment: process.env.NEXT_PUBLIC_DEPLOY_CONTEXT ?? "production",
    // Don't capture every analytics-style fetch.
    ignoreErrors: ["AbortError", "NetworkError"],
  });
}
