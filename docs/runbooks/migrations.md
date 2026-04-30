# Database migrations runbook

## Creating a new migration

1. Edit `lib/db/schema.ts` to reflect the new shape.
2. `npm run db:generate` — Drizzle writes a SQL migration into `drizzle/`.
3. Review the generated SQL. **You usually want to copy it (or write a
   handwritten version) into `supabase/migrations/000100000000NN_<name>.sql`.**
   Supabase migrations are the source of truth; Drizzle is a convenience.
4. Apply via the Supabase MCP or `supabase db push`.

## Applying migrations to the live project

```bash
# Manual (recommended for production):
psql "$SUPABASE_DB_URL" -f supabase/migrations/00010000000NN_<name>.sql

# Or via the Supabase MCP from this assistant:
mcp__supabase__apply_migration({ name, query })
```

## Verifying

```bash
psql "$SUPABASE_DB_URL" -c "select * from supabase_migrations.schema_migrations order by version desc limit 5;"
```

## Common pitfalls

- **Idempotency**: every migration must use `if not exists`,
  `on conflict do nothing`, or `do $$ if not exists ... $$;` so re-runs
  don't fail.
- **Extensions**: keep them in `extensions` schema, not `public` (Phase A
  did this for vector + pg_trgm).
- **RLS policies**: always reference helper functions (`app.is_super_admin`,
  `app.user_org_ids`, `app.has_org_role`) — never hardcode role checks.
- **Foreign key cascade**: tenant tables should `ON DELETE CASCADE` from
  `users(id)` and `organizations(id)` so account deletion cleans up.
- **RPC for vector queries**: Lambdas often can't talk to direct Postgres,
  so put hot vector queries in a `security invoker` RPC and call it
  through PostgREST (see `match_embeddings`).
