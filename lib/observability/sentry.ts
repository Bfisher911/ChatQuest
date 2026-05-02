// Tiny wrapper around Sentry for server actions + route handlers.
// Safe to call without SENTRY_DSN — it just falls through to console.

import * as Sentry from "@sentry/nextjs";
import { logger } from "./logger";

interface CaptureOpts {
  /** A short identifier for the action that threw, e.g. "grade.save". */
  action?: string;
  /** Free-form context. Avoid PII (no message bodies, no learner names). */
  extra?: Record<string, unknown>;
  /** Tags surface as filters in Sentry. */
  tags?: Record<string, string>;
}

export function captureException(err: unknown, opts: CaptureOpts = {}) {
  const meta = {
    action: opts.action,
    extra: opts.extra,
    tags: opts.tags,
    err: err instanceof Error ? err : new Error(String(err)),
  };
  logger.error("server.exception", meta);

  if (!process.env.SENTRY_DSN) return;
  Sentry.captureException(err, {
    tags: { action: opts.action ?? "unknown", ...(opts.tags ?? {}) },
    extra: opts.extra,
  });
}

/**
 * Wraps an async server-action body so unexpected errors are captured + a
 * friendly result is returned. Use:
 *
 *   export async function saveGrade(formData: FormData) {
 *     return guardAction("grade.save", async () => {
 *       // ...real work
 *       return { ok: true as const };
 *     });
 *   }
 */
export async function guardAction<T>(
  action: string,
  fn: () => Promise<T>,
): Promise<T | { ok: false; error: string }> {
  try {
    return await fn();
  } catch (err) {
    captureException(err, { action });
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unexpected server error",
    };
  }
}
