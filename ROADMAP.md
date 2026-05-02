# Chatrail — Production-Readiness Roadmap

This document describes everything that needs to happen to take Chatrail from
"Phase 1 MVP deployed at `chattrail.netlify.app`" to a production-ready,
multi-tenant SaaS platform.

It's split between **work I can do** (engineering inside this codebase, the
Supabase MCP, Netlify, GitHub) and **work only you can do** (anything that
needs your dashboard credentials, DNS access, legal counsel, or money).

The rest of this file is "what I can do, sequenced as ten phases (A–J)."
Items that need you are flagged with **"BLOCKED ON YOU"** so you can
parallelize them.

Estimates are in days of focused engineering. Total: **~30 working days**
across all phases — but every phase is independently shippable.

---

## At-a-glance table of contents

| Phase | Scope | Days | Cumulative | Risk to ship |
| --- | --- | --- | --- | --- |
| **A** | Production safety: RAG-on-Lambda fix, RLS audit, security headers, file-upload validation, schema hygiene | 2.5 | 2.5 | High — blocks any real user |
| **B** | Branded emails + first-run polish | 1.5 | 4 | Medium |
| **C** | Visual path builder + non-bot node types + certificates | 5 | 9 | High — what makes Chatrail *the product* |
| **D** | Stripe billing + seat licensing + plan-feature gating | 4 | 13 | High — required to monetize |
| **E** | Cost control + analytics dashboards | 3 | 16 | Medium |
| **F** | Engineering hygiene: tests, CI, Sentry, structured logging, /api/health | 4 | 20 | Medium — needed before team grows |
| **G** | UX quality pass: loading / empty / error states, mobile, a11y, onboarding | 3 | 23 | Medium |
| **H** | Performance: ISR, indexes, background KB indexing, bundle audit | 2 | 25 | Low |
| **I** | Marketing + SEO + docs + changelog | 2 | 27 | Low |
| **J** | Spec-completion items, legal scaffolds, ops runbooks | 3 | 30 | Low |

---

## Pre-work (BLOCKED ON YOU — do these in parallel with my Phase A)

I cannot do these from inside this environment. Please knock them out so my
work doesn't ship into a broken-config production:

- [ ] **Supabase Site URL + Redirect URLs** point at the deployed domain.
      Dashboard → Auth → URL Configuration. Add `https://chattrail.netlify.app`
      as Site URL, add `https://chattrail.netlify.app/**` and
      `https://chattrail.netlify.app/auth/callback` to Redirect URLs.
- [ ] **Decide on email confirmation**: either disable it (Auth → Email →
      "Confirm email" off) or sign up for **Resend** at <https://resend.com>,
      verify a sending domain, and paste the API key as the `RESEND_API_KEY`
      env var on Netlify. I'll wire the templates in Phase B.
- [ ] **DNS for the sending domain** — SPF (`v=spf1 include:resend.com -all`),
      DKIM (Resend gives you the records), and DMARC
      (`v=DMARC1; p=quarantine; rua=mailto:postmaster@yourdomain`).
- [ ] **Custom domain** on Netlify (e.g., `chatquest.app`). Update
      `NEXT_PUBLIC_APP_URL` env var on Netlify after.
- [ ] **Stripe**: sign up, create products + prices in test mode that match
      the rows in the `plans` table (codes: `instr_basic`, `instr_pro`,
      `instr_premium`, `org_starter`, `org_dept`, `org_school`,
      `org_enterprise`). Paste the secret + publishable + webhook secret keys
      into Netlify env vars. I'll wire all the code in Phase D.
- [ ] **Rotate the keys** that were pasted into chat: Supabase service-role
      key (Settings → API → "Reset service role key") and the Gemini API key
      (delete + recreate at <https://aistudio.google.com/app/apikey>). Update
      Netlify env vars after.
- [ ] **Enable MFA** on your Supabase + Netlify + GitHub accounts.
- [ ] **Sentry**: create a project at <https://sentry.io> and paste the DSN
      as `SENTRY_DSN` on Netlify. I'll wire it in Phase F.
- [ ] **Upstash**: optional but recommended — sign up at <https://upstash.com>,
      create a Redis database for rate limiting, paste `UPSTASH_REDIS_REST_URL`
      and `UPSTASH_REDIS_REST_TOKEN` on Netlify. Without it I'll fall back to
      in-memory rate limits which work but reset per Lambda cold-start.
- [ ] **PostHog or Plausible**: optional product analytics. Paste the key.

---

## Phase A — Production safety hardening (2.5 days)

**Why first:** today's deploy has known holes — `lib/rag/search.ts` will fail
the same way `/pricing` did until I rewrite it; the bot's system prompt is
visible to learners by way of the chatbot_configs RLS policy; Supabase
flagged extensions in the public schema; there are no security headers.

### A.1 Move the RAG vector search off direct Postgres (0.5 day)

`lib/rag/search.ts` uses `db().execute(...)` against `SUPABASE_DB_URL` to run
the `<=>` cosine query. That's the same code path that 500'd `/pricing` on
Netlify Lambda before I rewrote it. I'll:

1. Create a Supabase RPC `match_embeddings(query_embedding vector, p_org uuid, p_collections uuid[], p_limit int)` via a new migration.
2. Switch `searchKnowledge()` to call that RPC via the Supabase client.
3. Add a vitest unit test that hits the RPC against a small fixture set.

**Deliverable:** RAG citations work correctly when learners chat in production.

### A.2 Hide system prompts + bot internals from learners (0.25 day)

Learners can currently `select` from `chatbot_configs` because the read
policy allows enrollees. Tighten it:

1. Migration to split `chatbot_configs` policies — learners read only
   `bot_name`, `avatar_initials`, `learner_instructions`, `attempts_allowed`,
   `token_budget`. Instructors / TAs / org admins read all columns.
2. Implement via two views or a column-level grant.

### A.3 Move pgvector + pg_trgm out of public schema (0.25 day)

Migration to `alter extension vector set schema extensions;` and same for
pg_trgm. Update `lib/db/schema.ts` import paths. Verify via Supabase advisor
re-run.

### A.4 RLS audit + tests (1 day)

Write a Vitest suite in `tests/rls/` that, for each role, attempts:
- Cross-tenant program read
- Cross-tenant conversation read
- Cross-tenant KB file read
- Learner read of another learner's conversations
- TA read of grade in unassigned program
- Org admin read of conversations when `share_conversations_with_org_admin = false`

Each test makes a Supabase JWT for the role and asserts the read returns
zero rows or 401. Run in CI and fail the build on any leak.

Document any remaining intentional asymmetries in `docs/security/rls.md`.

### A.5 Security headers via netlify.toml (0.25 day)

Add `[[headers]]` for:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Content-Security-Policy` (start in report-only mode → enforce after a week)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### A.6 File upload validation (0.25 day)

In `app/(app)/programs/actions.ts`'s `uploadKbFile`:
- MIME-sniff the buffer (don't trust `file.type`)
- Cap at 20 MiB (already enforced by Storage but double-check server-side)
- Reject filenames with NUL bytes or `..` traversal patterns
- Optional: hash + dedupe against existing files in the same collection.

---

## Phase B — Branded transactional emails + first-run polish (1.5 days)

Depends on you having `RESEND_API_KEY` set on Netlify. If you don't,
everything still works — it logs the email body to the server log instead.

### B.1 Resend integration (0.5 day)

- Add `lib/email/resend.ts` with a typed `sendEmail()` helper.
- Replace the inline `fetch("https://api.resend.com/emails", ...)` call in
  `roster/actions.ts` with the helper.
- Add a `lib/email/templates/` folder with React Email templates for: invite,
  grade returned, certificate awarded, password reset. Brutalist style —
  black borders, monospace, no images required.
- Override Supabase's auth email templates from inside the `supabase/` dir
  so signup confirmation, password reset, and magic link all use brand
  HTML. (Done via `supabase/templates/*.html` + dashboard one-time upload.)

### B.2 Branded certificate award email (0.25 day)

When a learner is awarded a certificate (Phase C), send an email with the
PDF attachment + verification link.

### B.3 First-run UX polish on existing flows (0.75 day)

- After signup, show a 5-step "first program checklist" widget on
  `/dashboard` for new instructors.
- After invite, show a copy-to-clipboard toast with the invite link (today
  it only appears in the toast text — make it explicitly copyable).
- Empty `/programs` page links to `/programs/new` with a friendly CTA.
- Add a "Welcome, $name" banner on first dashboard render (dismissable).

---

## Phase C — Visual path builder + non-bot nodes + certificates (5 days)

The biggest single Phase. After this lands, Chatrail is the product the
spec describes, not "a chatbot with auth around it."

### C.1 React Flow integration (1 day)

- Install `@xyflow/react`.
- Replace `app/(app)/programs/[id]/nodes/page.tsx` with a builder route.
- Custom node renderers per type that match the prototype's `cq-node` look:
  bot, content, pdf, slides, link, milestone (round), cert (inverted),
  locked (0.55 opacity).
- Drag from a left-rail palette to drop new nodes.
- Click an edge to open a condition editor (after / min-score / date / either-or).
- Drag node handles to draw new edges.
- Click a node to open the right-rail inspector (already exists for bot —
  generalize).
- Save layout (`x`, `y` coords) on every drag-end; save edges on connect/disconnect.

### C.2 Non-bot node types (2 days)

- **Content**: TipTap rich-text editor, reading-minutes setting, completion checkbox. Storage: `path_nodes.config = { body_html, reading_minutes, require_completion_check }`.
- **PDF/Doc**: file upload to Storage `node-files` bucket, embedded `<object>` viewer, optional acknowledgement checkbox.
- **Slides**: a small in-app slide builder (title + body + optional image, drag-reorder, preview mode). Stored as a JSON array.
- **External link**: URL + description + "open in new tab" + optional confirmation checkbox. Track click events in `analytics_events`.
- **Milestone**: prereq node IDs, min-grade threshold, "awards certificate ID" link.
- **Certificate node**: links to a `certificate_templates` row, computes
  award eligibility on the fly.

Each type gets:
- An inspector panel
- A learner-side renderer (`app/(app)/learn/[programId]/[nodeId]/page.tsx` switches on type)
- A "mark complete" server action that creates a stub `submissions` + `grades` row so progress tracking works uniformly.

### C.3 Path logic engine (0.75 day)

`lib/path/progress.ts`:
- Input: `programId`, `learnerId`, all nodes, all edges, all node_rules, all submissions.
- Output: `Map<nodeId, ProgressState>` where state = locked / available / in_progress / completed / failed.
- Implements: prereq AND/OR sets, min-score gates, date gates, branching (on_pass / on_fail).
- Pure function, fully unit-tested.

### C.4 Learner journey view (0.5 day)

Replace today's flat tile grid at `/learn/[programId]` with:
- Read-only React Flow canvas (same nodes, same layout) showing locked / done / current visually.
- Sidebar with progress bar + next-recommended-step CTA.
- Click an unlocked node to navigate to it.
- Re-runs the progress engine on every nav.

### C.5 Certificate PDF generation (0.5 day)

`lib/certificates/render.tsx`:
- Server component using `@react-pdf/renderer`.
- Brutalist template (frame border, ink type, binary index, learner name,
  program name, instructor signature image, org logo, unique verification
  code, issue date).
- Mounted at `/api/certificates/[awardId]/pdf`.
- Public verification page at `/verify-cert/[code]` showing learner name,
  program, issue date, verification status.

### C.6 Auto-issue certificates on milestone completion (0.25 day)

Server action `awardCertificateIfEligible(programId, learnerId)` runs after
every grade save:
- For every `certificates` row in the program, check if the learner has
  satisfied `required_node_ids` + `min_grade_percentage`.
- If yes and no existing `certificate_awards` row, create one.
- Trigger the email from B.2.

---

## Phase D — Stripe billing + seat licensing (4 days)

Depends on you having created Stripe products + pasted keys (see pre-work).

### D.1 Stripe wiring (1.5 days)

- `lib/stripe/server.ts` — typed Stripe client.
- `lib/stripe/plans.ts` — typed mapping from `plans.code` → Stripe price id.
- `app/api/stripe/checkout/route.ts` — create a Checkout session for plan
  upgrade. Routes for org-plan checkout (org admin) and instructor-plan
  checkout (single instructor) and learner-pays-program (learner).
- `app/api/stripe/webhook/route.ts` — handle `checkout.session.completed`,
  `customer.subscription.updated`, `customer.subscription.deleted`,
  `invoice.payment_failed`. Write to `billing_events` (audit), update
  `subscriptions` and `seat_pools` accordingly.
- Customer portal link from `/org/billing` and a future `/billing` for
  instructors.

### D.2 Seat allocation enforcement (1 day)

- Org admin grants instructor seats in `/org/members`. UI selects from a
  list of pending instructor invites or existing members and toggles a
  `has_instructor_seat` row.
- Instructor invites a learner — server action checks remaining
  `seat_pool` capacity before creating the invite. If exhausted, returns
  a friendly error.
- Failed payment marks all enrollments as `frozen` (can't enter chat) but
  keeps existing data intact. Restoring payment unfreezes.

### D.3 Plan-feature gates (0.5 day)

A `lib/billing/gate.ts` helper: `canCreateProgram(plan)`,
`canCreateChatNode(plan)`, `canIssueCertificate(plan)`,
`allowedModels(plan)`. Each gated action checks before allowing.

### D.4 Learner-paid-program flow (0.5 day)

When a learner clicks an invite for a program with `learner_pays = true`,
they hit a Checkout flow before enrollment finalizes. Webhook on success
inserts the `program_enrollment`.

### D.5 Super admin overrides (0.5 day)

`/admin/orgs/[id]` page where super admin can:
- Change plan code manually
- Bump seat counts
- Mark account as comp/active/suspended
- View billing event history

---

## Phase E — Cost control + analytics dashboards (3 days)

### E.1 Soft + hard token caps (0.5 day)

`lib/usage/check.ts` reads `usage_logs` over rolling 30 days, sums by
`organization_id`, compares to plan budget. The chat-stream endpoint refuses
new messages with a clear "monthly token limit reached" error when over
budget. At 80% of budget, instructors see a warning banner.

### E.2 Model-tier gating (0.25 day)

`lib/billing/gate.ts`'s `allowedModels(plan)` filters the model dropdown in
the bot config form.

### E.3 Rate limiting (0.5 day)

`lib/ratelimit.ts` using `@upstash/ratelimit` (with in-memory fallback when
no Upstash creds). Applied to `/api/chat/stream`, `/api/grade/suggest`,
`/api/kb/upload` (it's not even an API route today — convert to one).

### E.4 Instructor analytics (1 day)

Page `/programs/[id]/analytics`:
- Completion rate over time (Recharts line)
- Avg score per node (bar)
- Missing / late / submitted counts (cards)
- Attempt usage histogram
- Token usage chart
- "At-risk learners" table (low score + missed nodes)

### E.5 Org + super admin analytics (0.75 day)

- Org admin dashboard adds: instructor activity, learner activity,
  certificate count, AI cost trend.
- Super admin gets MRR (sum of active subs × price), token-usage growth,
  model mix, abuse flags (any user > 95th percentile token use).

### E.6 CSV export (0.25 day)

Gradebook + analytics tables get an "Export CSV" button (server-rendered
CSV stream, not client-side blob).

---

## Phase F — Engineering hygiene (4 days)

### F.1 Test suite (2 days)

- `tests/e2e/` — Playwright tests for spec workflows 1, 2, 3, 4.
  Each test creates an isolated Supabase project via a new schema or uses
  the existing project with a unique email prefix. Cleans up after itself.
- `tests/unit/` — Vitest for `lib/path/progress.ts`,
  `lib/llm/grading.ts`, `lib/rag/chunker.ts`, `lib/billing/gate.ts`.
- `tests/rls/` — already added in Phase A.4.

### F.2 GitHub Actions CI (0.5 day)

`.github/workflows/ci.yml`:
- Trigger on PR + push to main.
- Steps: install, typecheck, lint, build, unit + RLS tests.
- E2E tests run against a Supabase preview branch + Netlify deploy
  preview, gated on a label to keep CI fast.

### F.3 Sentry integration (0.25 day)

`@sentry/nextjs` configured for both server actions and client. PII
scrubbing (email + user_id are OK; never log message content).

### F.4 Structured logging (0.5 day)

Replace `console.error` calls with a `logger` that emits JSON. On Netlify
this lands in function logs as searchable JSON.

### F.5 /api/health endpoint (0.25 day)

Returns `{ supabase: ok, llm: ok, embeddings: ok, build: <sha> }` after
hitting each provider with a small probe. UptimeRobot can poll it.

### F.6 Pinning + lockfile guards (0.25 day)

- `engines` block in package.json pinning Node 20.x.
- `packageManager` field with the npm version.
- CI step: `npm ci` (not `npm install`) to catch lockfile drift.

### F.7 Storybook for brutalist primitives (0.25 day)

Stories for Cassette, Chip, Btn, Eyebrow, IconBtn, Frame. Visual regression
optional (Chromatic free tier covers it).

---

## Phase G — UX quality pass (3 days)

### G.1 Loading states (0.5 day)

`loading.tsx` per route group with skeleton cassettes / table rows /
chat-message skeletons. Today some pages just go blank during navigation.

### G.2 Empty states with clear CTAs (0.25 day)

Every list view (programs, learners, KB files, rubrics, certificates)
gets a polished empty state with icon + headline + CTA.

### G.3 Per-route error boundaries (0.25 day)

`error.tsx` files inside route groups (auth, app, marketing) so an error
in one section doesn't blank the whole shell.

### G.4 Mobile responsiveness (1 day)

- Chat: composer always visible; rail collapses to a drawer below 700px.
- Gradebook: switches to a card list (one card per learner with collapsible
  per-node grades) below 800px.
- Path builder: degrades to an outline list below 700px (read-only — no
  drag on mobile).
- Cassette grid: already responsive; verify gap + min-height work at all sizes.

### G.5 Keyboard nav + focus trap (0.5 day)

- Tab order on every form
- Esc to close grader panel + dialogs
- Arrow keys to navigate gradebook cells
- Cmd+Enter to send a chat message

### G.6 Accessibility audit (0.5 day)

- axe-core on every page in CI
- Color contrast pass (the muted gray needs verification)
- ARIA labels on all icon-only buttons
- Screen-reader pass on chat, grader panel, builder

### G.7 First-time-user onboarding (no extra work — folded into B.3)

---

## Phase H — Performance + scale (2 days)

### H.1 ISR for marketing + auth pages (0.25 day)

- `/`, `/features`, `/pricing`, `/for-education`, `/for-corporate`,
  `/login`, `/signup` — switch from `force-dynamic` to ISR with a 60s
  revalidate. Pricing pulls from `plans` table → revalidation handles edits.

### H.2 Image optimization (0.25 day)

- Replace `<img>` with `next/image` everywhere
- Org logo + slide image upload paths produce optimized variants

### H.3 Database index review (0.25 day)

After first traffic, `EXPLAIN` the slow queries (gradebook joins,
conversation list, usage_logs aggregation). Add covering indexes where
needed via a migration.

### H.4 Bundle audit (0.25 day)

`@next/bundle-analyzer` to find anything > 100 KB. Probable culprits:
React Flow on builder, Recharts on analytics. Lazy-load both.

### H.5 Background KB indexing (1 day)

Move `indexKnowledgeFile()` from synchronous-on-upload to a queue. Options:
- **Inngest** (recommended — has a Netlify integration)
- Supabase Edge Function triggered via DB trigger
- BullMQ with Upstash Redis

Whichever wins: upload returns `pending` immediately, the queue worker
processes, the UI polls for status. Avoids 30s function timeouts on big PDFs.

---

## Phase I — Marketing + SEO + docs (2 days)

### I.1 OG / Twitter cards (0.25 day)

`app/opengraph-image.tsx` per marketing page. Generated at build time. The
brutalist style does this beautifully — black frame, big sans title.

### I.2 Robots.txt + sitemap.xml (0.25 day)

`app/robots.ts` + `app/sitemap.ts` driven by static + dynamic routes.

### I.3 SEO metadata (0.5 day)

`generateMetadata` on every public page with title, description, canonical.
Open Graph + JSON-LD for the marketing pages.

### I.4 Public docs site (1 day)

`/docs/` route group serving an MDX-based docs site:
- Quickstart for instructors (how to make a program)
- Quickstart for learners (how to chat through a program)
- Knowledge base / RAG concepts page
- Rubric authoring guide
- Certificate verification page (links to `/verify-cert/[code]`)

### I.5 Public changelog (no extra work — keep `CHANGELOG.md` updated)

---

## Phase J — Spec gaps + legal scaffolds + ops runbooks (3 days)

### J.1 Remaining spec items (1.5 days)

- DOCX upload via `mammoth` in `lib/rag/extract.ts`
- "End conversation when AI determines objective met" via a tool-use call
- Per-node attempt-count enforcement on the UI
- Org-level (not just program-level) KB collections
- "Bring your own API key" placeholder — UI for orgs to paste their own
  Anthropic/OpenAI/Gemini key + a server-side "use the org's key if set"
  override in `lib/llm/provider.ts`

### J.2 Legal page scaffolds (0.5 day)

`/terms`, `/privacy`, `/aup` pages with:
- Brutalist layout
- Place-holder text in plain English with TODO markers where you (or
  counsel) need to fill in actual policy
- Last-updated date
- Footer link from every page

Plus a **data-export + account-deletion** flow under
`/account/export-data` and `/account/delete-account` — emails the user a
zip of all their data via the queue from H.5.

### J.3 Audit log viewer (0.5 day)

`/admin/audit` table with filters by actor, target type, action, time
range. Already populated by every sensitive server action — just needs UI.

### J.4 Ops runbooks (0.5 day)

Markdown docs in `docs/runbooks/`:
- DR / restore from backup
- Key rotation
- Common errors (auth misconfig, LLM provider down, Supabase outage)
- Customer-impacting incident response
- How to add a new migration

---

## How to consume this plan

I'll work top-down: A → B → C → … unless you redirect. After each phase I'll:

1. Push a single PR with the phase's changes
2. Auto-deploy on Netlify (you don't have to do anything)
3. Run smoke tests against the live deploy
4. Update `CHANGELOG.md`
5. Tell you what to verify before I move on

If a phase's pre-work isn't done (e.g., Phase D needs Stripe keys), I skip
it and continue with the next, then circle back when you unblock me.

**To start, just say "go" or "start with X" or "skip Phase Y" and I'll
begin.**
