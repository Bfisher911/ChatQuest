// Server-rendered banner that flags known env-var misconfigurations.
//
// The biggest "site looks broken" failure mode in production has been
// silently-misconfigured environment variables: a deprecated default chat
// model, no LLM provider keys, an embedding provider that's still pointed
// at Gemini even though the embedding model needs different handling.
//
// The diagnostics endpoint (/api/diagnostics) catches these but admins
// rarely visit it. This banner surfaces the same checks where admins
// already are — on their dashboard.

import * as React from "react";
import Link from "next/link";

const KNOWN_DEPRECATED_MODELS = new Set([
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "gemini-3-flash", // bare name briefly used; real name is gemini-3-flash-preview
  "gemini-3-pro",
  "gemini-3-flash-lite",
]);

interface Issue {
  severity: "error" | "warn";
  title: string;
  body: React.ReactNode;
}

function detectIssues(): Issue[] {
  const issues: Issue[] = [];

  // 1) DEFAULT_CHAT_MODEL pointing at a deprecated / never-existed name.
  const def = process.env.DEFAULT_CHAT_MODEL?.trim();
  if (def && KNOWN_DEPRECATED_MODELS.has(def)) {
    issues.push({
      severity: "error",
      title: "Default chat model is deprecated",
      body: (
        <>
          <code>DEFAULT_CHAT_MODEL</code> is set to <code>{def}</code> on the
          server. That model is no longer reachable on the provider&apos;s API
          and any bot relying on the runtime default will fail. Set it to a
          current model (recommended:{" "}
          <code>gemini-3-flash-preview</code>, <code>claude-haiku-4-5</code>,
          or <code>gpt-4o-mini</code>) on Netlify and redeploy.
        </>
      ),
    });
  }

  // 2) No LLM provider keys present.
  const hasAny =
    !!process.env.ANTHROPIC_API_KEY ||
    !!process.env.OPENAI_API_KEY ||
    !!process.env.GEMINI_API_KEY ||
    !!process.env.GOOGLE_API_KEY;
  if (!hasAny) {
    issues.push({
      severity: "error",
      title: "No LLM provider configured",
      body: (
        <>
          None of <code>ANTHROPIC_API_KEY</code>, <code>OPENAI_API_KEY</code>,
          or <code>GEMINI_API_KEY</code> are set. Every chatbot, the AI
          generator, and KB embeddings will fail. Add at least one in your
          hosting env vars and redeploy.
        </>
      ),
    });
  }

  // 3) Embedding provider mismatch — set to gemini but no Gemini key.
  const ep = process.env.EMBEDDING_PROVIDER?.toLowerCase().trim();
  const hasGeminiKey = !!process.env.GEMINI_API_KEY || !!process.env.GOOGLE_API_KEY;
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  if (ep === "gemini" && !hasGeminiKey) {
    issues.push({
      severity: "error",
      title: "Embedding provider misconfigured",
      body: (
        <>
          <code>EMBEDDING_PROVIDER=gemini</code> but no Gemini key is set.
          KB document upload + retrieval will fail. Set{" "}
          <code>GEMINI_API_KEY</code> or change{" "}
          <code>EMBEDDING_PROVIDER</code> to <code>openai</code>.
        </>
      ),
    });
  }
  if (ep === "openai" && !hasOpenAIKey) {
    issues.push({
      severity: "error",
      title: "Embedding provider misconfigured",
      body: (
        <>
          <code>EMBEDDING_PROVIDER=openai</code> but no OpenAI key is set.
          KB upload / retrieval will fail. Add <code>OPENAI_API_KEY</code> or
          switch to <code>EMBEDDING_PROVIDER=gemini</code>.
        </>
      ),
    });
  }

  // 4) NEXT_PUBLIC_APP_URL pointing at localhost in production.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (process.env.NODE_ENV === "production" && /localhost|127\.0\.0\.1/.test(appUrl)) {
    issues.push({
      severity: "warn",
      title: "App URL points at localhost",
      body: (
        <>
          <code>NEXT_PUBLIC_APP_URL</code> is <code>{appUrl || "(empty)"}</code>
          . Invite emails, OG previews, and Stripe redirects will all link to
          localhost. Set this to your real deploy URL.
        </>
      ),
    });
  }

  return issues;
}

/**
 * Render only when issues exist. Anchored at the top of the dashboard so
 * an admin can see the platform's health before they look at anything else.
 */
export function EnvMisconfigBanner() {
  const issues = detectIssues();
  if (issues.length === 0) return null;

  const hasError = issues.some((i) => i.severity === "error");

  return (
    <div
      role="alert"
      style={{
        marginBottom: 18,
        padding: 16,
        border: `${hasError ? "var(--frame)" : "var(--hair)"} solid var(--ink)`,
        background: hasError ? "var(--ink)" : "var(--soft)",
        color: hasError ? "var(--paper)" : "var(--ink)",
        borderRadius: "var(--radius)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 8,
          opacity: 0.75,
        }}
      >
        ■ {hasError ? "Production misconfiguration" : "Setup warnings"} · {issues.length}
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55 }}>
        {issues.map((issue, i) => (
          <li key={i} style={{ marginBottom: 8 }}>
            <strong style={{ display: "block", fontFamily: "var(--font-sans)" }}>
              {issue.title}
            </strong>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
              {issue.body}
            </span>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.7 }}>
        Live status:{" "}
        <Link
          href="/api/diagnostics"
          style={{ textDecoration: "underline", color: "inherit" }}
        >
          /api/diagnostics
        </Link>
        {" · "}
        <Link
          href="/docs/operations"
          style={{ textDecoration: "underline", color: "inherit" }}
        >
          setup docs
        </Link>
      </div>
    </div>
  );
}
