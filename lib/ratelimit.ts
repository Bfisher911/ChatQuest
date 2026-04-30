// Per-user rate limiter. Uses Upstash Redis if UPSTASH_REDIS_REST_URL +
// UPSTASH_REDIS_REST_TOKEN are set; otherwise falls back to an in-memory
// counter that resets on cold start (better than nothing, OK for low traffic).

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let _client: Ratelimit | null = null;
const _memory = new Map<string, { count: number; reset: number }>();

function inMemoryLimit(key: string, max: number, windowSec: number) {
  const now = Date.now();
  const entry = _memory.get(key);
  if (!entry || entry.reset < now) {
    _memory.set(key, { count: 1, reset: now + windowSec * 1000 });
    return { success: true, remaining: max - 1, reset: now + windowSec * 1000 };
  }
  if (entry.count >= max) {
    return { success: false, remaining: 0, reset: entry.reset };
  }
  entry.count += 1;
  return { success: true, remaining: max - entry.count, reset: entry.reset };
}

function client(max: number, windowSec: number): Ratelimit | null {
  if (_client) return _client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const redis = new Redis({ url, token });
  _client = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
    analytics: true,
    prefix: "cq:rl",
  });
  return _client;
}

export interface LimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

export async function limit(
  key: string,
  opts: { max: number; windowSec: number },
): Promise<LimitResult> {
  const c = client(opts.max, opts.windowSec);
  if (!c) return inMemoryLimit(key, opts.max, opts.windowSec);
  const r = await c.limit(key);
  return { success: r.success, remaining: r.remaining, reset: r.reset };
}
