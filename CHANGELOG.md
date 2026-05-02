# Chatrail — Changelog

This changelog tracks shipped phases. Newest first.

## 2026-04-29 — Phases A through I shipped

### Phase A — Production safety hardening
- RAG vector search moved to a `match_embeddings` Postgres RPC so it runs
  inside any deploy target (no direct port-5432 dependency).
- `chatbot_configs` SELECT policy tightened to staff only; learners read a
  new `chatbot_learner_configs` view that excludes `system_prompt`,
  `conversation_goal`, and `completion_criteria`.
- pgvector + pg_trgm moved out of `public` into a dedicated `extensions`
  schema (resolves the Supabase advisor `extension_in_public` warning).
- Security headers via `next.config.mjs` — HSTS, X-Frame-Options, CSP
  (report-only), Referrer-Policy, Permissions-Policy.
- File upload validation: 20 MiB cap, magic-byte sniff (PDF + DOCX),
  filename traversal/NUL-byte refusal, extension allowlist.
- `SECURITY.md` with reporting policy + hardening status table.

### Phase B — Branded transactional emails + first-run polish
- Reusable `lib/email/client.ts` (Resend integration, console fallback).
- React-Email-equivalent brutalist HTML templates: invite, grade returned,
  certificate awarded.
- Onboarding checklist (5 steps) on instructor dashboard, hides itself
  once everything is checked.

### Phase C — Visual path builder + non-bot nodes + certificates
- React Flow path builder: drag-drop palette, custom brutalist node
  renderers, click-to-edit inspector, edge drawing + deletion.
- Server actions for all 7 node types (bot, content, pdf, slides, link,
  milestone, cert) — all storing config as jsonb on `path_nodes`.
- Pure path-logic engine `lib/path/progress.ts` resolving locked /
  available / in_progress / completed / failed.
- Learner renderers for content / pdf / link / milestone / cert.
- Mark-complete server action so non-graded nodes feed the progress engine.
- `@react-pdf/renderer`-rendered certificate PDFs at
  `/api/certificates/[awardId]/pdf` with public verification at
  `/verify-cert/[code]`.
- `maybeAwardCertificates` runs after every grade save + mark-complete.
- New storage buckets: `node-files`, `certificates`, `org-logos`.

### Phase D — Stripe billing + seat licensing
- `lib/stripe/server.ts` typed client, `lib/stripe/plans.ts` env-driven
  price-id mapping.
- `/api/stripe/checkout` (org plan / instructor plan / learner-paid program),
  `/api/stripe/webhook` (subscription sync + plan-code mirror on org +
  past_due on payment failure), `/api/stripe/portal` (Customer Portal).
- `lib/billing/gate.ts`: `canCreateProgram`, `canCreateChatbotNode`,
  `canIssueCertificate`, `canSeatLearner`, `canSeatInstructor`,
  `allowedModelsForPlan`. Wired into program-create + roster-invite flows.
- `/org/billing` page rebuilt with Checkout buttons + portal link.

### Phase E — Cost control + analytics + CSV export
- `lib/usage/check.ts::getMonthlyTokenUsage` — rolling 30-day token sum,
  ok / warn / exceeded states. `/api/chat/stream` returns 402 when over.
- `lib/ratelimit.ts` — per-user 30 chat msgs / minute via Upstash Redis
  (with in-memory fallback).
- Per-program analytics page with Recharts (tokens/day line, avg score
  per node bar). Subnav now has Analytics tab.
- `/api/programs/[id]/gradebook/csv` streams flat CSV exports.
- Bot model picker now lists Claude / OpenAI / Gemini in optgroups.

### Phase F — Engineering hygiene
- Vitest set up with 9 unit tests (path-progress, chunker) — all passing.
- GitHub Actions CI (typecheck → lint → vitest → next build).
- Sentry wiring (server / client / edge configs + `instrumentation.ts`),
  no-op without `SENTRY_DSN`.
- Structured JSON logger at `lib/observability/logger.ts`.
- `/api/health` endpoint probing Supabase + LLM + Stripe.
- Engines pinned to Node ≥ 20.

### Phase G — UX quality pass
- Brutalist `<Skeleton />` + `<CassetteSkeleton />` primitives.
- `loading.tsx` skeletons for /dashboard, /programs, /learn.
- Per-route `error.tsx` boundaries on the app + auth route groups.
- Mobile responsive CSS for header, path builder, chat, grader panel,
  cassette grid.

### Phase H — Performance
- Marketing pages now use ISR (`revalidate = 3600`); pricing
  (`revalidate = 300`).
- 5 new targeted indexes (gradebook joins, analytics aggregates).
- `@next/bundle-analyzer` opt-in via `npm run analyze`.

### Phase I — Marketing + SEO + docs
- `app/opengraph-image.tsx` — brutalist 1200×630 OG card.
- `app/robots.ts` + `app/sitemap.ts`.
- `/docs` site (instructor quickstart, learner quickstart) with more
  sections to fill in over time.
- This `CHANGELOG.md`.

## 2026-04-28 — Phase 1 MVP shipped

Initial production deploy on Netlify. Covered: scaffold, brutalist design
system port, 9 SQL migrations + RLS policies, Supabase auth, role-aware
shell + dashboards, program creation, chatbot node editor, KB upload + RAG,
SSE chat streaming, gradebook + AI grading suggestion, roster + invites,
marketing landing.
