// Liveness + readiness probe. Returns JSON describing each external dep's
// reachability. Suitable for UptimeRobot / status-page polling.

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Probe {
  ok: boolean;
  ms?: number;
  detail?: string;
}

async function probeSupabase(): Promise<Probe> {
  const t0 = Date.now();
  try {
    const admin = createServiceRoleClient();
    const { error } = await admin.from("plans").select("code").limit(1);
    if (error) return { ok: false, ms: Date.now() - t0, detail: error.message };
    return { ok: true, ms: Date.now() - t0 };
  } catch (err) {
    return { ok: false, ms: Date.now() - t0, detail: err instanceof Error ? err.message : "supabase fail" };
  }
}

// Liveness probes only check whether a key is configured — they do NOT
// validate format, since provider key formats change over time and false
// negatives based on a hardcoded prefix are worse than the upside.
// /api/diagnostics does the real round-trip ping when you actually
// want to know the key works.

function keyPresent(name: string): Probe {
  const v = process.env[name];
  return v && v.length > 0
    ? { ok: true, detail: "key present" }
    : { ok: false, detail: "no key" };
}

async function probeAnthropic(): Promise<Probe> {
  return keyPresent("ANTHROPIC_API_KEY");
}

async function probeOpenAI(): Promise<Probe> {
  return keyPresent("OPENAI_API_KEY");
}

async function probeGemini(): Promise<Probe> {
  // Either env var is acceptable.
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    return { ok: true, detail: "key present" };
  }
  return { ok: false, detail: "no key" };
}

async function probeStripe(): Promise<Probe> {
  return { ok: !!process.env.STRIPE_SECRET_KEY, detail: process.env.STRIPE_SECRET_KEY ? "configured" : "no key" };
}

export async function GET() {
  const [supabase, anthropic, openai, gemini, stripe] = await Promise.all([
    probeSupabase(),
    probeAnthropic(),
    probeOpenAI(),
    probeGemini(),
    probeStripe(),
  ]);

  const overall = supabase.ok && (anthropic.ok || openai.ok || gemini.ok);
  return NextResponse.json(
    {
      ok: overall,
      build: process.env.COMMIT_REF ?? "unknown",
      time: new Date().toISOString(),
      checks: { supabase, anthropic, openai, gemini, stripe },
    },
    { status: overall ? 200 : 503 },
  );
}
