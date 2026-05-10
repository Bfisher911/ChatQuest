# Netlify environment variables — Gemini-only deployment

Last updated: 2026-05-09

This deployment runs on **Google Gemini only**. The codebase's LLM provider
abstraction supports Anthropic Claude and OpenAI, but the UI pickers,
default models, and AI generator are restricted to Gemini so you don't
accidentally rack up bills on services you haven't signed up for.

---

## Step 1 — Verify what's currently configured

Hit the diagnostics endpoint (no auth required):

<https://chattrail.netlify.app/api/diagnostics>

For a healthy deployment you want to see:

```json
{
  "ok": true,
  "summary": "Operational. 1 LLM provider reachable.",
  "env": {
    "defaultChatModel": "gemini-3-flash-preview",
    "embeddingProvider": "gemini"
  },
  "providers": {
    "gemini":   { "configured": true, "reachable": true, "ms": 800 },
    "supabase": { "configured": true, "reachable": true, "ms": 100 }
  }
}
```

The `anthropic` and `openai` blocks may show `"configured": false` —
that's fine. The site is Gemini-only.

If `summary` mentions misconfiguration, the `providers.*.detail` field
tells you exactly what's wrong.

---

## Step 2 — Set the keys on Netlify

1. Go to <https://app.netlify.com/sites/chattrail/configuration/env>
2. Click **Add a single variable** for each row below
3. Scope: **All scopes** (or at minimum: Functions, Builds)
4. After adding, you MUST click **Trigger deploy → Clear cache and deploy
   site** — saving an env var on Netlify does NOT auto-deploy

### Required: Gemini

| Variable | Where to get it |
| --- | --- |
| `GEMINI_API_KEY` | <https://aistudio.google.com/app/apikey> |

### Required: Supabase (likely already set)

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://qucizmsdoswunfsnqjam.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key from Supabase Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret.** Settings → API → service_role |

### Required: Gemini default + embedding settings

| Variable | Value |
| --- | --- |
| `DEFAULT_CHAT_MODEL` | `gemini-3-flash-preview` (recommended) or `gemini-flash-latest` |
| `EMBEDDING_PROVIDER` | `gemini` |
| `EMBEDDING_MODEL` | `text-embedding-004` |

### Required: app URL (for OG images, invite links)

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | `https://chattrail.netlify.app` (or your custom domain) |

### Optional

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Send real invite emails (else logs to console) |
| `EMAIL_FROM` | `Chatrail <noreply@yourdomain.com>` |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Persist rate limits across Lambda cold starts |
| `SENTRY_DSN` | Capture server errors in Sentry |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | When you wire Stripe |

### NOT required (intentionally)

| Variable | Why blank is fine |
| --- | --- |
| `ANTHROPIC_API_KEY` | UI pickers + generator don't expose Claude |
| `OPENAI_API_KEY` | UI pickers + generator don't expose GPT |

If you DO have keys for these, leaving them set is harmless — the code
won't reach those providers because no node config or default ever
resolves to a Claude / GPT model. But if you don't want to maintain
Anthropic / OpenAI accounts, just leave them blank or remove them.

---

## Step 3 — Verify after redeploy

Wait ~2 minutes for Netlify to deploy, then re-hit:

<https://chattrail.netlify.app/api/diagnostics>

Look for `"ok": true` and `env.defaultChatModel = "gemini-3-flash-preview"`.
The `providers.gemini.reachable` should be `true` with a 5-token reply.

---

## Common failure modes

### Banner shows "Default chat model is deprecated"
`DEFAULT_CHAT_MODEL` is set to a name Google's API doesn't recognize
(e.g. `gemini-2.0-flash`, `gemini-1.5-pro`). Change to
`gemini-3-flash-preview`. Save → **Trigger deploy → Clear cache and
deploy site** (just saving doesn't redeploy).

### `Gemini key not configured`
`GEMINI_API_KEY` (or `GOOGLE_API_KEY`) is missing. Generate one at
<https://aistudio.google.com/app/apikey>.

### `Gemini: 429 Too Many Requests`
You're on the free tier and hit the daily quota. Either wait until the
quota resets (24h) or upgrade to a paid Gemini tier in Google AI Studio.

### `Gemini: 404 model not found for v1beta`
Google deprecated the model name you're pointing at. The canonical
current names (verified live via `/api/diagnostics?gemini=list`) are:

- `gemini-3-flash-preview` (Gemini 3 Flash, in preview)
- `gemini-3-pro-preview` (Gemini 3 Pro, in preview)
- `gemini-3.1-pro-preview` (Gemini 3.1 Pro, in preview)
- `gemini-3.1-flash-lite` (GA)
- `gemini-flash-latest` / `gemini-pro-latest` / `gemini-flash-lite-latest` (auto-tracking aliases — safest defaults)
- `gemini-2.5-pro` / `gemini-2.5-flash` / `gemini-2.5-flash-lite` (legacy, still supported)

### Banner shows but env var was edited
You saved the env var on Netlify but didn't trigger a deploy. Saving
does NOT redeploy. Go to Deploys → **Trigger deploy → Clear cache and
deploy site**.

### Stuck on "Sign in" loop
Supabase Auth → URL Configuration → Site URL must match the deploy URL.
Add `https://chattrail.netlify.app/**` under Redirect URLs.

---

## What's actually wired in code (Gemini-only)

- `lib/llm/provider.ts` — auto-routes by model prefix, with `pickDefault()`
  falling back to `gemini-3-flash-preview`
- `app/(app)/programs/[id]/bot-node-form.tsx` — bot picker shows only the
  Gemini lineup (no Anthropic / OpenAI optgroups)
- `app/(app)/programs/generate/generate-form.tsx` — designer-model picker
  is Gemini-only; Zod enum on the action matches
- `lib/llm/generate-chatrail.ts` — generator's system prompt steers the
  AI toward Gemini models for `defaultModel`
- `lib/billing/gate.ts::allowedModelsForPlan` — every plan tier returns
  Gemini-only model lists
- `components/dashboard/env-misconfig-banner.tsx` — admin dashboard
  banner flags missing `GEMINI_API_KEY`, deprecated `DEFAULT_CHAT_MODEL`,
  or `EMBEDDING_PROVIDER` set to anything other than `gemini`

The integration is complete. The remaining work is **configuration**.
