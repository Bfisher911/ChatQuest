-- ChatQuest — extensions and helper schemas.
-- Idempotent: safe to re-run.

create extension if not exists "pgcrypto";
create extension if not exists "vector";
create extension if not exists "pg_trgm";

-- A separate schema for our private helpers (kept out of public for clarity).
create schema if not exists app;
grant usage on schema app to authenticated, anon, service_role;
