-- ChatQuest — identity, organizations, membership, invites, audit.

create type app.user_role as enum (
  'super_admin',
  'org_admin',
  'instructor',
  'ta',
  'learner'
);

create type app.invite_status as enum ('pending', 'accepted', 'revoked', 'expired');

-- Profile row mirroring auth.users. Inserted by trigger on signup.
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  display_name text,
  avatar_url text,
  -- Platform-wide super admin flag. Org-scoped roles live in organization_members.
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index users_email_idx on public.users (email);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  -- "school" | "company" | "training" | "other" — informational
  org_type text default 'other',
  -- Phase 3 billing fields (kept here so the column shape is stable).
  stripe_customer_id text,
  plan_code text default 'free',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null
);
create index organizations_plan_idx on public.organizations (plan_code);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role app.user_role not null,
  invited_by uuid references public.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  is_active boolean not null default true,
  unique (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);
create index organization_members_role_idx on public.organization_members (organization_id, role);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Optional program scope: program-only invites (instructor invites a learner to a single program).
  program_id uuid,
  email text not null,
  role app.user_role not null,
  token text not null unique,
  status app.invite_status not null default 'pending',
  invited_by uuid references public.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index invites_email_idx on public.invites (email);
create index invites_token_idx on public.invites (token);

create table public.csv_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid,
  uploaded_by uuid references public.users(id) on delete set null,
  filename text,
  total_rows int default 0,
  successful_rows int default 0,
  failed_rows int default 0,
  errors jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid references public.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index audit_logs_org_idx on public.audit_logs (organization_id, created_at desc);

-- Auto-insert profile row on auth.users signup.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Helpers used by RLS.

create or replace function app.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, app
as $$
  select coalesce(
    (select is_super_admin from public.users where id = auth.uid()),
    false
  );
$$;

create or replace function app.user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, app
as $$
  select organization_id from public.organization_members
  where user_id = auth.uid() and is_active = true;
$$;

create or replace function app.user_role_in_org(p_org uuid)
returns app.user_role
language sql
stable
security definer
set search_path = public, app
as $$
  select role from public.organization_members
  where user_id = auth.uid() and organization_id = p_org and is_active = true
  limit 1;
$$;

create or replace function app.has_org_role(p_org uuid, p_roles app.user_role[])
returns boolean
language sql
stable
security definer
set search_path = public, app
as $$
  select app.is_super_admin() or exists (
    select 1 from public.organization_members
    where user_id = auth.uid()
      and organization_id = p_org
      and role = any(p_roles)
      and is_active = true
  );
$$;

-- updated_at touch trigger
create or replace function app.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger users_touch before update on public.users
  for each row execute function app.touch_updated_at();
create trigger organizations_touch before update on public.organizations
  for each row execute function app.touch_updated_at();
