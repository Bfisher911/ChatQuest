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

async function probeAnthropic(): Promise<Probe> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, detail: "no key" };
  // We don't actually call Anthropic on /health to avoid rate-limit waste —
  // just confirm the key shape.
  return { ok: process.env.ANTHROPIC_API_KEY.startsWith("sk-ant-"), detail: "key present" };
}

async function probeOpenAI(): Promise<Probe> {
  if (!process.env.OPENAI_API_KEY) return { ok: false, detail: "no key" };
  return { ok: process.env.OPENAI_API_KEY.startsWith("sk-"), detail: "key present" };
}

async function probeGemini(): Promise<Probe> {
  if (!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY))
    return { ok: false, detail: "no key" };
  return { ok: true, detail: "key present" };
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
