// Sentry server init. Only runs when SENTRY_DSN is set.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.NEXT_PUBLIC_DEPLOY_CONTEXT ?? "production",
    // Tag every event with the build commit ref.
    initialScope: {
      tags: { build: process.env.COMMIT_REF ?? "unknown" },
    },
  });
}
