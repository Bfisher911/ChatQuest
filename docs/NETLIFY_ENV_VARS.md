# Netlify environment variables — required for the AI to work

Last updated: 2026-05-05

The Chatrail codebase is fully wired for Anthropic, OpenAI, and Google
Gemini. **The site cannot reach any AI provider in production unless
the corresponding API key is set as a Netlify environment variable
and the site is redeployed.**

This is the checklist for getting the live deploy at
<https://chattrail.netlify.app> talking to a real AI provider.

---

## Step 1 — Verify what's currently configured

Hit the diagnostics endpoint (no auth required):

<https://chattrail.netlify.app/api/diagnostics>

You'll get JSON like:

```json
{
  "ok": false,
  "summary": "No LLM provider configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY in Netlify env vars and redeploy.",
  "providers": {
    "anthropic": { "configured": false, "detail": "ANTHROPIC_API_KEY not set" },
    "openai":    { "configured": false, "detail": "OPENAI_API_KEY not set" },
    "gemini":    { "configured": false, "detail": "GEMINI_API_KEY (or GOOGLE_API_KEY) not set" },
    "supabase":  { "configured": true,  "reachable": true, "ms": 88 }
  }
}
```

If `summary` says "Operational. N LLM providers reachable.", you're done.
If not, the `providers.*.detail` field tells you exactly what's wrong.

---

## Step 2 — Set the keys on Netlify

1. Go to <https://app.netlify.com/sites/chattrail/configuration/env>
2. Click **Add a single variable** for each key below
3. Scope: All scopes (or at minimum: Functions, Builds)
4. After adding, click **Trigger deploy → Clear cache and deploy site**

### Required: at least ONE LLM provider

| Variable | Where to get it | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | <https://console.anthropic.com/settings/keys> | Recommended. Default chat model is `claude-haiku-4-5` |
| `OPENAI_API_KEY` | <https://platform.openai.com/api-keys> | Also serves as embeddings provider when `EMBEDDING_PROVIDER=openai` |
| `GEMINI_API_KEY` | <https://aistudio.google.com/app/apikey> | Free-tier friendly |

You only need one to make chat work. Two or three gives users a model
picker option without lock-in.

### Required: Supabase (likely already set)

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://qucizmsdoswunfsnqjam.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key from Supabase Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret.** Settings → API → service_role |

If `/api/diagnostics` shows `supabase.reachable: true`, these are good.

### Required: app URL (for OG image, invite links, Stripe redirects)

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | `https://chattrail.netlify.app` (or your custom domain) |

> **Currently broken:** the OG image meta tags on the deployed site point
> at `http://localhost:3000/opengraph-image` because this var was never
> set. Setting it fixes social-share previews and invite-email links.

### Optional: cost controls + observability

| Variable | Purpose |
| --- | --- |
| `EMBEDDING_PROVIDER` | `openai` (recommended) or `gemini` |
| `EMBEDDING_MODEL` | `text-embedding-3-small` (default) |
| `DEFAULT_CHAT_MODEL` | Override the default model for new bots |
| `RESEND_API_KEY` | Send real invite emails (else logs to console) |
| `EMAIL_FROM` | `Chatrail <noreply@yourdomain.com>` |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Persist rate limits across Lambda cold starts |
| `SENTRY_DSN` | Capture server errors in Sentry |

### Optional: Stripe (when you're ready to charge)

| Variable | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Test or live mode |
| `STRIPE_WEBHOOK_SECRET` | From `stripe listen` or Stripe Dashboard → Webhooks |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client-side Checkout init |
| `STRIPE_PRICE_INSTR_BASIC` (etc) | Per-plan price IDs once products exist |

---

## Step 3 — Verify after redeploy

Wait ~2 minutes for Netlify to deploy, then re-hit:

<https://chattrail.netlify.app/api/diagnostics>

Look for `"ok": true` and a summary like
`"Operational. 1 LLM provider reachable."`. The provider blocks should
each show `reachable: true` and a `detail` like `replied "OK"`.

---

## Common failure modes

### `ANTHROPIC_API_KEY not set`
The variable was never added on Netlify. Add it in step 2.

### `Anthropic: 401 ... Invalid API key`
Key is set but wrong — typo, expired, or for a different account.
Generate a fresh one and replace.

### `Anthropic: 529 overloaded`
Anthropic is having a moment. Try again in a minute. If it keeps happening,
flip `DEFAULT_CHAT_MODEL` to an OpenAI or Gemini model temporarily.

### `OpenAI: 429 Rate limit reached`
Account hit a tier limit. Either wait, switch tier, or fall back to
Anthropic by setting `DEFAULT_CHAT_MODEL=claude-haiku-4-5`.

### `Supabase reachable: false`
`SUPABASE_SERVICE_ROLE_KEY` is wrong, or the Supabase project is paused.
Check the Supabase dashboard.

### `Sign in` redirects despite a valid session
Supabase Auth → URL Configuration → Site URL must match your deploy
URL (e.g., `https://chattrail.netlify.app`). Add the URL also under
Redirect URLs as `https://chattrail.netlify.app/**`.

---

## What's actually wired in code

You're not missing any code. The following are all implemented:

- `lib/llm/provider.ts` — auto-routes by model prefix to Anthropic /
  OpenAI / Gemini SDK; one common interface (`streamChat`, `completeChat`,
  `embedBatch`)
- `app/api/chat/stream/route.ts` — SSE streaming chat for learners
- `app/api/chat/preview/route.ts` — ephemeral preview chat for creators
- `app/api/grade/suggest/route.ts` — AI-suggested rubric scoring
- `lib/llm/generate-chatrail.ts` — one-prompt Chatrail generator
- `lib/llm/errors.ts` — friendly error classification (so missing-key
  failures surface as actionable text instead of "Stream error")

The integration is complete. The remaining work is **configuration**.
