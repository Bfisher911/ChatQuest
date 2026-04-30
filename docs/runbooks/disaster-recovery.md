# Disaster recovery runbook

## Scenarios + first response

### A. Supabase project unreachable

**Symptoms:** /api/health returns 503 with supabase.ok = false. Sign-in
fails. /pricing 500s.

**First response:**
1. Check <https://status.supabase.com> for a regional incident.
2. If Supabase is healthy on their side: check Netlify env vars
   `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` haven't been
   rotated without updating Netlify.
3. Roll back the most recent Netlify deploy if the issue started after a
   deploy.

**Recovery:** wait for Supabase, OR fail over to a different project
(see "swap projects" below).

### B. LLM provider down

**Symptoms:** chats fail with 500 or 5xx upstream errors, /api/health shows
the failing provider as unreachable.

**First response:**
1. Check provider status pages (Anthropic / OpenAI / Google AI).
2. Update DEFAULT_CHAT_MODEL on Netlify to one of the other providers.
3. Tell instructors to set their bot's model to a working provider.

### C. Stripe webhook failure

**Symptoms:** plan upgrades complete in Stripe but org `plan_code` doesn't
update.

**First response:**
1. Check `/admin/audit` and the `billing_events` table for the missed
   event.
2. From the Stripe dashboard, manually replay the event.
3. If still failing, check the `STRIPE_WEBHOOK_SECRET` env var matches the
   endpoint's signing secret.

### D. Token cap exceeded by abuse

**Symptoms:** monthly token budget hits 100% suddenly; usage_logs shows
spike from a single user.

**First response:**
1. /admin/usage filtered by user_id to identify the offender.
2. Block the org/user via super admin override (set plan_code = 'free' or
   suspend membership).
3. Open a billing review.

## Swap to a backup Supabase project

```bash
# 1. Prepare a fresh Supabase project (already migrated, no seed).
# 2. Restore latest backup into it.
# 3. Update Netlify env vars:
#    NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#    SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL.
# 4. Trigger a deploy (any commit, or `netlify deploy --prod`).
# 5. Update Supabase Auth Site URL on the new project to match the deployed
#    domain.
```

## Backup strategy

- Supabase auto-backups: enabled on Pro+ tiers. Verify via Dashboard →
  Project Settings → Database → Backups.
- Optional: weekly `pg_dump` to S3 via a GitHub Actions cron. Template at
  `.github/workflows/db-backup.yml.example` (TODO).

## Key rotation runbook

1. Rotate Supabase service role key: Dashboard → Settings → API → Reset.
2. Update Netlify env var; trigger a redeploy.
3. Old key continues working for 30 minutes — monitor /api/health.
4. Same procedure for Anthropic / OpenAI / Gemini / Stripe / Resend keys.
