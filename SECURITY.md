# Security Policy

## Reporting a vulnerability

Email **security@chatquest.app** (or the project owner directly if that
mailbox isn't yet active).

If the vulnerability is high-impact (auth bypass, RLS leak, RCE, billing
manipulation, learner-data exposure), please **do not file a public GitHub
issue** — email first.

We aim to acknowledge new reports within **3 business days**. We don't yet
run a paid bug-bounty program, but we will publicly credit reporters who
follow responsible disclosure.

## Scope

In scope:

- The deployed production site at <https://chattrail.netlify.app>
  (and any future custom-domain alias).
- The Supabase project at `qucizmsdoswunfsnqjam`.
- The `Bfisher911/ChatQuest` repository.

Out of scope:

- Stripe-side issues (report to Stripe).
- Supabase platform vulnerabilities (report to Supabase).
- Anthropic / OpenAI / Gemini provider issues.
- Brute-force testing of seeded test accounts (we have rate limits — please
  don't trigger them).

## Security model summary

- **Auth**: Supabase Auth + JWT cookies. SSR validation on every protected
  route via Next.js middleware.
- **Authz**: Row-Level Security on every tenant table. Cross-tenant reads
  must be impossible without the `service_role` key. Helper SQL functions
  (`app.is_super_admin`, `app.user_org_ids`, `app.has_org_role`) gate every
  policy.
- **Service role**: only used in server-side code paths that have already
  verified the caller (Stripe webhook, KB indexing on owner action).
- **Bot system prompts**: are NEVER exposed to learners. Learners read a
  view (`chatbot_learner_configs`) that strips `system_prompt`,
  `conversation_goal`, `completion_criteria`, and grading internals.
- **AI key custody**: Anthropic / OpenAI / Gemini keys live in Netlify
  environment variables (encrypted at rest, never sent to the browser).
  The chat-stream API runs server-side and proxies the LLM call.
- **File uploads**: extension-allowlisted, magic-byte sniffed, 20 MiB
  capped, and stored in a private Supabase Storage bucket.
- **Rate limits**: per-user QPS via Upstash on `/api/chat/stream`,
  `/api/grade/suggest`, and `/api/kb/upload` (Phase E).

## Hardening status

| Area | Status |
| --- | --- |
| HSTS | ✅ enabled (max-age 2y, preload) |
| X-Frame-Options DENY | ✅ |
| Content-Security-Policy | 🟡 report-only — flips to enforced after a week of clean reports |
| Strict referrer policy | ✅ |
| Permissions-Policy (camera/mic/geo) | ✅ all denied |
| RLS on every tenant table | ✅ |
| RLS test suite | 🟡 Phase F |
| Encrypted secrets at rest | ✅ Netlify env-var encryption |
| Service role audit | ✅ every call documented (Phase A) |
| MFA on admin accounts | 👤 owner action |
| SOC 2 prep | ❌ Phase J+ |
| Penetration test | ❌ recommended after Phase D |

## Known limitations

These are documented because they are intentional Phase 1 trade-offs, not
unknowns:

- Email confirmation can be disabled per project — the platform supports
  both flows but the operator chooses.
- The `.env.example` file documents key placeholders and is committed; real
  `.env.local` is gitignored.
- Audit logging is captured in the `audit_logs` table but doesn't yet have
  a UI (Phase J).
- `seed.sql` is for development bootstrapping only — running it against
  production would create test users with a known password. Don't.
