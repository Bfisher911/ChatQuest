// Operational diagnostics endpoint.
//
// Unlike /api/health (which only checks key SHAPE — does the string look
// right) this endpoint does a real round-trip to each configured LLM
// provider with a 5-token completion. If a key is set but invalid /
// rate-limited / typo'd, you'll see it here.
//
// Public: yes (allowed in middleware) — but the LLM calls only fire
// for the providers whose keys are present, so an attacker can't burn
// tokens with a key that's not even there. Each call is capped at 8
// output tokens to keep the cost negligible (<$0.0001 per probe).

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProviderResult {
  configured: boolean;
  reachable?: boolean;
  ms?: number;
  detail?: string;
  model?: string;
}

const PING_PROMPT = "Reply with the single word: OK";

async function probeAnthropic(): Promise<ProviderResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { configured: false, detail: "ANTHROPIC_API_KEY not set" };
  }
  const t0 = Date.now();
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8,
      messages: [{ role: "user", content: PING_PROMPT }],
    });
    const text = res.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("")
      .trim();
    return {
      configured: true,
      reachable: true,
      ms: Date.now() - t0,
      detail: `replied "${text.slice(0, 32)}"`,
      model: "claude-haiku-4-5",
    };
  } catch (err) {
    return {
      configured: true,
      reachable: false,
      ms: Date.now() - t0,
      detail: err instanceof Error ? err.message : "unknown error",
    };
  }
}

async function probeOpenAI(): Promise<ProviderResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { configured: false, detail: "OPENAI_API_KEY not set" };
  }
  const t0 = Date.now();
  try {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 8,
      messages: [{ role: "user", content: PING_PROMPT }],
    });
    const text = res.choices[0]?.message?.content?.trim() ?? "";
    return {
      configured: true,
      reachable: true,
      ms: Date.now() - t0,
      detail: `replied "${text.slice(0, 32)}"`,
      model: "gpt-4o-mini",
    };
  } catch (err) {
    return {
      configured: true,
      reachable: false,
      ms: Date.now() - t0,
      detail: err instanceof Error ? err.message : "unknown error",
    };
  }
}

async function probeGemini(): Promise<ProviderResult> {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!key) {
    return { configured: false, detail: "GEMINI_API_KEY (or GOOGLE_API_KEY) not set" };
  }
  const t0 = Date.now();
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const client = new GoogleGenerativeAI(key);
    const modelName = "gemini-3-flash-preview";
    const model = client.getGenerativeModel({ model: modelName });
    const res = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: PING_PROMPT }] }],
      generationConfig: { maxOutputTokens: 8 },
    });
    const text = res.response.text().trim();
    return {
      configured: true,
      reachable: true,
      ms: Date.now() - t0,
      detail: `replied "${text.slice(0, 32)}"`,
      model: modelName,
    };
  } catch (err) {
    return {
      configured: true,
      reachable: false,
      ms: Date.now() - t0,
      detail: err instanceof Error ? err.message : "unknown error",
    };
  }
}

async function probeSupabase(): Promise<ProviderResult> {
  const t0 = Date.now();
  try {
    const admin = createServiceRoleClient();
    const { error } = await admin.from("plans").select("code").limit(1);
    if (error) {
      return {
        configured: true,
        reachable: false,
        ms: Date.now() - t0,
        detail: error.message,
      };
    }
    return { configured: true, reachable: true, ms: Date.now() - t0, detail: "ok" };
  } catch (err) {
    return {
      configured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      reachable: false,
      ms: Date.now() - t0,
      detail: err instanceof Error ? err.message : "supabase failure",
    };
  }
}

/**
 * Debug-only branch: hit /api/diagnostics?gemini=list to enumerate the
 * Gemini models the configured key can actually call. Returns the raw
 * ListModels response so we can verify the canonical model name when
 * Google rolls a new generation. Public via middleware allowlist; the
 * Gemini key never leaves the server, only model names come back.
 */
async function listGeminiModels(): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!key) return { error: "no key" };
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
    );
    if (!res.ok) return { error: `status ${res.status}`, body: await res.text() };
    const data = (await res.json()) as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
    return {
      models: (data.models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m) => m.name)
        .sort(),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET(req: Request) {
  // Optional debug branch: ?gemini=list returns the list of Gemini models
  // the key can call. Used to verify canonical names when a generation
  // gets rolled out.
  const url = new URL(req.url);
  if (url.searchParams.get("gemini") === "list") {
    return NextResponse.json(await listGeminiModels(), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const [anthropic, openai, gemini, supabase] = await Promise.all([
    probeAnthropic(),
    probeOpenAI(),
    probeGemini(),
    probeSupabase(),
  ]);

  // The deployment is Gemini-only. Anthropic + OpenAI may show configured if
  // the user has those keys set, but the site never calls them — only Gemini
  // reachability gates the "ok" flag.
  const overall = supabase.reachable === true && gemini.reachable === true;

  return NextResponse.json(
    {
      ok: overall,
      build: process.env.COMMIT_REF ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
      time: new Date().toISOString(),
      env: {
        nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
        defaultChatModel: process.env.DEFAULT_CHAT_MODEL ?? null,
        embeddingProvider: process.env.EMBEDDING_PROVIDER ?? null,
        nodeEnv: process.env.NODE_ENV ?? null,
      },
      providers: { anthropic, openai, gemini, supabase },
      summary: summarize({ anthropic, openai, gemini, supabase, overall }),
    },
    {
      status: overall ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

const KNOWN_DEPRECATED_DEFAULT_MODELS = new Set([
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "gemini-3-flash",
  "gemini-3-pro",
  "gemini-3-flash-lite",
]);

function summarize({
  anthropic,
  openai,
  gemini,
  supabase,
  overall,
}: {
  anthropic: ProviderResult;
  openai: ProviderResult;
  gemini: ProviderResult;
  supabase: ProviderResult;
  overall: boolean;
}): string {
  if (overall) {
    const def = process.env.DEFAULT_CHAT_MODEL?.trim() ?? "";
    const extras: string[] = [];
    if (anthropic.configured) extras.push("Anthropic");
    if (openai.configured) extras.push("OpenAI");
    const extraNote = extras.length
      ? ` ${extras.join(" + ")} key${extras.length === 1 ? " is" : "s are"} also set but unused (safe to remove).`
      : "";
    if (def && KNOWN_DEPRECATED_DEFAULT_MODELS.has(def)) {
      return `Reachable but DEFAULT_CHAT_MODEL="${def}" is deprecated. Set it to "gemini-3-flash-preview" on Netlify and redeploy.${extraNote}`;
    }
    return `Operational. Gemini-only deployment.${extraNote}`;
  }
  if (!supabase.reachable) {
    return `Supabase unreachable: ${supabase.detail}. Check SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL.`;
  }
  if (!gemini.configured) {
    return "Gemini key not configured. Set GEMINI_API_KEY in Netlify env vars and redeploy. Get a key at https://aistudio.google.com/app/apikey.";
  }
  if (gemini.configured && !gemini.reachable) {
    return `Gemini configured but unreachable: ${gemini.detail}.`;
  }
  const failures: string[] = [];
  if (anthropic.configured && !anthropic.reachable) failures.push(`Anthropic: ${anthropic.detail}`);
  if (openai.configured && !openai.reachable) failures.push(`OpenAI: ${openai.detail}`);
  return `Unexpected state. ${failures.join(" | ")}`;
}
