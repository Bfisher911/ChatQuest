# Chatrail

Chatbot-native LMS for serious learning — Phase 1 MVP.

Build AI tutors. Wire them into a learning program. Grade transcripts with rubrics. Issue certificates. The brutalist way.

## Stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind**
- **Supabase**: Postgres, Auth, Storage, **pgvector** for RAG
- **Drizzle ORM** for type-safe schema + raw SQL escape hatches
- **Multi-provider LLM**: Anthropic Claude, OpenAI, Google Gemini — all behind a single adapter (`lib/llm/provider.ts`)
- **SSE** streaming for chat, **Resend** for invites (optional; falls back to console)
- **Stripe** scaffolded; full integration ships in Phase 3

## What's in Phase 1

End-to-end Workflow 1 from the product spec, against the live Supabase project at <https://qucizmsdoswunfsnqjam.supabase.co>:

1. **Auth + onboarding** — sign up as instructor / org admin / learner / TA, sign in, forgot password, accept invite. Email verification deferred behind a feature flag for local dev.
2. **Role-aware dashboards** — distinct views for super admin, org admin, instructor, TA, learner. Switch role via the header dropdown.
3. **Programs** — create, list, edit settings, manage roster + KB.
4. **Chatbot nodes** — system prompt, learner instructions, model picker (Claude Haiku/Sonnet/Opus, GPT-4o family, Gemini 2.0/1.5), temperature, token budget, max tokens, attempts, points, rubric.
5. **RAG knowledge base** — upload PDF / TXT / MD / CSV, auto-chunked, embedded into pgvector (OpenAI 1536-dim or Gemini 768→1536 padded), cited inline in answers.
6. **Streaming chat** — SSE-streamed responses from any provider, persistent history, attempts tracked, token meter.
7. **Submission + grading** — learner submits, AI summary + suggested rubric scores, instructor reviews transcript and grades. Status = pending / graded / needs revision / excused.
8. **Roster + invites** — single-email invite, CSV bulk import, accept-invite flow.
9. **Brutalist UI** — every screen ports the design prototype: Space Grotesk + VT323 + Press Start 2P, ink/paper colors, frame/hair borders, "cassette" cards with binary indices.

Phases 2-4 (visual path builder, certificates, Stripe seat licensing, full analytics) land in follow-up turns.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Live Supabase project for this build:

| Var | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://qucizmsdoswunfsnqjam.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (anon key — already filled in `.env.local`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Get from <https://supabase.com/dashboard/project/qucizmsdoswunfsnqjam/settings/api> |
| `SUPABASE_DB_URL` | Get from <https://supabase.com/dashboard/project/qucizmsdoswunfsnqjam/settings/database> (use the session pooler URL on port 5432) |

LLM keys — set at least one:

| Var | Notes |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude (default chat model is `claude-haiku-4-5`) |
| `OPENAI_API_KEY` | GPT-4o family + recommended for embeddings |
| `GEMINI_API_KEY` | Gemini 2.0/1.5 — already filled in `.env.local` |

Embedding provider:

- `EMBEDDING_PROVIDER=openai` (recommended, `text-embedding-3-small`, 1536-dim native)
- `EMBEDDING_PROVIDER=gemini` (uses `text-embedding-004`, 768-dim padded to 1536 — works without an OpenAI key)

### 3. Database

The 9 SQL migrations under `supabase/migrations/` have already been applied to the live project. To re-apply or work against your own project, use the Supabase CLI:

```bash
npx supabase link --project-ref qucizmsdoswunfsnqjam
npx supabase db push
```

To apply seed data (creates super admin + instructor + sample program — only safe in a fresh project):

```bash
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

> **Production note:** the seed inserts directly into `auth.users` with bcrypt password hashes. In production you should sign up the first super admin through the UI, then run a small SQL update setting `is_super_admin = true` on that row.

### 4. Run the app

```bash
npm run dev
```

Open <http://localhost:3000>.

## Manual smoke test — Workflow 1 end-to-end

1. Sign up at `/signup` as the instructor (intent = "Instructor / Trainer / SME"). The signup flow auto-creates an organization for you.
2. Open the new program → click the chatbot node and configure the system prompt + model.
3. Open the **Knowledge** tab → upload a PDF. Wait for `INDEXED` status.
4. Open a private window. Sign up a second account as a "Learner". From the instructor account, invite the learner to the program via the **Roster** tab.
5. Switch to the learner window → see the program tile → enter the chat node → exchange 2-3 messages. Token meter ticks up.
6. Click **SUBMIT**.
7. Switch back to the instructor → **Gradebook** tab → click the learner's cell.
8. Click **GET AI SUGGESTION** in the grader panel. Adjust scores, add a comment, click **SAVE GRADE**.
9. Switch back to the learner → grade is now visible.

## Project layout

```
app/
  (marketing)/        public landing + features + pricing pages
  (auth)/             sign in / up / forgot-password / accept-invite
  (app)/              authenticated app — role-aware
    dashboard/        dispatches to instructor|learner|org-admin|super-admin
    programs/         list, create, [id]/{nodes,kb,roster,gradebook,settings}
    learn/            learner programs + journey + chat node
    org/              org admin: members, billing
    admin/            super admin: orgs, users, subs, usage
  api/
    chat/stream/      SSE chat streaming (server-only LLM keys)
    grade/suggest/    AI rubric scoring suggestion
    auth/callback/    Supabase code → session
components/
  brutalist/          Cassette, Chip, Btn, Icon, Eyebrow, Frame
  shell/              Header, Footer
  chat/               ChatScreen
lib/
  db/                 Drizzle schema + client + jsonb shape types
  supabase/           server / client / middleware helpers
  auth/               RBAC + active-role with cookie override
  llm/                provider adapter (Claude + OpenAI + Gemini), cost calc, usage logger, prompt builder, grading
  rag/                chunker, extractor, indexer, vector search
  utils/              cx, binary index helpers
supabase/
  migrations/         9 SQL files: extensions → identity → curriculum → ai → conversations → grading → certificates → billing → policies
  seed.sql            one of every role + a graded submission
  config.toml         local Supabase config
styles/
  brutalist.css       ported from the design prototype's styles.css verbatim
  globals.css         Tailwind base + brutalist import
```

## Notes & known limits (Phase 1)

- **Email verification** is disabled in `supabase/config.toml` for dev. Re-enable for staging/prod.
- **Certificates** are scaffolded in the schema but not generated — Phase 2.
- **Visual path builder** (React Flow) — Phase 2. Phase 1 is a flat list of chatbot nodes per program.
- **Stripe Checkout + webhooks** — Phase 3. Plan codes are stored and gates are evaluated, but plan changes happen via super admin.
- **Analytics dashboards** — Phase 4. Phase 1 admin/usage shows the raw ledger.
- **Email sending** — set `RESEND_API_KEY` to send real invites. Without it, invite URLs print to the server console.
- **DOCX uploads** — Phase 2. PDF / TXT / MD / CSV today.

## LLM provider notes

The adapter at `lib/llm/provider.ts` auto-routes by model name prefix:

- `claude-*` → Anthropic
- `gpt-*`, `o*`, `chatgpt*` → OpenAI
- `gemini-*` → Google Gemini

Set `DEFAULT_CHAT_MODEL` in `.env.local` to control the default for new chatbot nodes. The instructor can override per-node.

If you only have a Gemini key, set:

```
DEFAULT_CHAT_MODEL=gemini-2.0-flash
EMBEDDING_PROVIDER=gemini
EMBEDDING_MODEL=text-embedding-004
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next dev server on :3000 |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript with no emit |
| `npm run lint` | ESLint via next |
| `npm run db:generate` | Drizzle: generate migration from schema diffs |

## License

Private — internal MVP build.
