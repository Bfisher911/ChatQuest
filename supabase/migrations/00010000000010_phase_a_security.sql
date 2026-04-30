-- Phase A — production safety hardening migration.
-- Idempotent: safe to re-run.

-- ─────────── A.3 — move extensions out of public schema ───────────
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;

-- pg_trgm + vector live in public from the original migration. Move them.
-- Column types continue to resolve by OID, so existing data is unaffected.
do $$
begin
  if exists (select 1 from pg_extension e join pg_namespace n on e.extnamespace = n.oid
             where e.extname = 'pg_trgm' and n.nspname = 'public') then
    alter extension pg_trgm set schema extensions;
  end if;
  if exists (select 1 from pg_extension e join pg_namespace n on e.extnamespace = n.oid
             where e.extname = 'vector' and n.nspname = 'public') then
    alter extension vector set schema extensions;
  end if;
end $$;

-- Make `vector` and `gin_trgm_ops` resolvable in default search_path so future
-- migrations using bare type names keep working.
alter database postgres set search_path to "$user", public, extensions;

-- ─────────── A.1 — RAG via PostgREST RPC ───────────
-- Replaces the raw-SQL `<=>` query in lib/rag/search.ts. Reachable from any
-- environment that can reach the Supabase REST API.
create or replace function public.match_embeddings(
  query_embedding extensions.vector(1536),
  p_org uuid,
  p_collections uuid[],
  p_limit int default 5
)
returns table (
  chunk_id uuid,
  file_id uuid,
  filename text,
  content text,
  page_number int,
  score real
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    e.chunk_id,
    c.file_id,
    f.filename,
    c.content,
    c.page_number,
    (1 - (e.embedding <=> query_embedding))::real as score
  from public.embeddings e
  join public.document_chunks c on c.id = e.chunk_id
  join public.knowledge_files f on f.id = c.file_id
  where e.organization_id = p_org
    and e.collection_id = any(p_collections)
  order by e.embedding <=> query_embedding
  limit p_limit;
$$;
grant execute on function public.match_embeddings(extensions.vector, uuid, uuid[], int)
  to authenticated, service_role;

-- ─────────── A.2 — hide bot system prompts from learners ───────────
-- chatbot_configs.system_prompt + conversation_goal + completion_criteria
-- + ai_grading_enabled flags are instructor-only. Learners read a view that
-- exposes only safe display columns.
drop policy if exists chatbot_configs_read on public.chatbot_configs;
drop policy if exists chatbot_configs_staff_read on public.chatbot_configs;
create policy chatbot_configs_staff_read on public.chatbot_configs
  for select using (
    exists (
      select 1 from public.path_nodes n
      join public.programs p on n.program_id = p.id
      where n.id = chatbot_configs.node_id
        and app.has_org_role(
          p.organization_id,
          array['instructor','ta','org_admin']::app.user_role[]
        )
    ) or app.is_super_admin()
  );

create or replace view public.chatbot_learner_configs
with (security_invoker = on, security_barrier = true)
as
select
  cc.node_id,
  cc.bot_name,
  cc.avatar_initials,
  cc.learner_instructions,
  cc.model,
  cc.max_tokens,
  cc.token_budget,
  cc.attempts_allowed,
  cc.allow_retry_after_feedback,
  cc.require_submit_button,
  cc.end_after_turns,
  cc.end_when_objective_met,
  cc.produce_completion_summary,
  cc.ask_reflection_questions
from public.chatbot_configs cc
join public.path_nodes n on n.id = cc.node_id
join public.programs p on p.id = n.program_id
where exists (
  select 1 from public.program_enrollments e
  where e.program_id = p.id and e.user_id = auth.uid()
)
or app.has_org_role(p.organization_id,
                    array['instructor','ta','org_admin']::app.user_role[])
or app.is_super_admin();

grant select on public.chatbot_learner_configs to authenticated;

comment on view public.chatbot_learner_configs is
  'Safe-to-read projection of chatbot_configs for learners. Excludes system_prompt, conversation_goal, and completion_criteria. Use this view from any learner-facing UI; staff continue to read chatbot_configs directly.';
