-- Phase Z — Gemini-only deployment
--
-- Bring Postgres column defaults in line with the code-level decision to
-- run on Google Gemini only. Existing rows are not touched; this only
-- affects future inserts that omit the column. Most inserts come through
-- forms that always set the model explicitly, so this is a belt-and-
-- suspenders update — it just keeps schema + code aligned so a raw SQL
-- insert won't slip a Claude default back in.
--
-- The choice of `gemini-3-flash-preview` matches lib/llm/provider.ts
-- pickDefault() and the form pickers; instructors can still pick any
-- Gemini model from the dropdown.

alter table public.programs
  alter column default_model set default 'gemini-3-flash-preview';

alter table public.chatbot_configs
  alter column model set default 'gemini-3-flash-preview';
