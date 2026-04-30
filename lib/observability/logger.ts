// Structured server logger. Emits JSON lines so Netlify function logs are
// grep-able + ingestable into log providers later.
//
// Use:
//   import { logger } from "@/lib/observability/logger";
//   logger.info("kb.indexed", { fileId, chunks });
//   logger.error("chat.stream.failed", { err });

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  msg: string;
  ts: string;
  [k: string]: unknown;
}

function emit(entry: LogEntry) {
  const line = JSON.stringify(entry);
  if (entry.level === "error") {
    // eslint-disable-next-line no-console
    console.error(line);
  } else if (entry.level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

function safe(meta?: Record<string, unknown>) {
  if (!meta) return {};
  // Drop function refs / circular structures.
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (typeof v === "function") continue;
    if (v instanceof Error) {
      out[k] = { name: v.name, message: v.message, stack: v.stack };
      continue;
    }
    out[k] = v;
  }
  return out;
}

export const logger = {
  debug(msg: string, meta?: Record<string, unknown>) {
    if (process.env.NODE_ENV === "production") return;
    emit({ level: "debug", msg, ts: new Date().toISOString(), ...safe(meta) });
  },
  info(msg: string, meta?: Record<string, unknown>) {
    emit({ level: "info", msg, ts: new Date().toISOString(), ...safe(meta) });
  },
  warn(msg: string, meta?: Record<string, unknown>) {
    emit({ level: "warn", msg, ts: new Date().toISOString(), ...safe(meta) });
  },
  error(msg: string, meta?: Record<string, unknown>) {
    emit({ level: "error", msg, ts: new Date().toISOString(), ...safe(meta) });
  },
};
