-- ChatQuest — plans, subscriptions, seat pools, usage logs.

create table public.plans (
  code text primary key,
  name text not null,
  -- 'instructor' | 'organization' | 'learner_per_program'
  scope text not null,
  monthly_price_cents int default 0,
  annual_price_cents int default 0,
  instructor_seats int default 1,
  learner_seats int default 0,
  monthly_token_budget int default 200000,
  features jsonb default '{}'::jsonb,
  is_active boolean not null default true,
  display_order int default 0
);

insert into public.plans (code, name, scope, monthly_price_cents, instructor_seats, learner_seats, monthly_token_budget, features, display_order)
values
  ('free',           'Free',                       'instructor',    0,      1,    5,    50000,
    '{"max_active_programs":1,"max_chat_nodes":3,"certificates":false}'::jsonb, 1),
  ('instr_basic',    'Instructor Basic',           'instructor',    1900,   1,    30,   200000,
    '{"max_active_programs":3,"max_chat_nodes":15,"certificates":true}'::jsonb, 2),
  ('instr_pro',      'Instructor Pro',             'instructor',    4900,   1,    100,  600000,
    '{"max_active_programs":10,"max_chat_nodes":50,"certificates":true}'::jsonb, 3),
  ('instr_premium',  'Instructor Premium',         'instructor',    9900,   1,    300,  1800000,
    '{"max_active_programs":50,"max_chat_nodes":200,"certificates":true}'::jsonb, 4),
  ('org_starter',    'Organization Starter',       'organization',  29900,  3,    150,  900000,
    '{"max_active_programs":20,"certificates":true,"sso":false}'::jsonb, 5),
  ('org_dept',       'Department Plan',            'organization',  79900,  10,   500,  3000000,
    '{"max_active_programs":100,"certificates":true,"sso":false}'::jsonb, 6),
  ('org_school',     'School Plan',                'organization',  199900, 30,   2000, 9000000,
    '{"max_active_programs":500,"certificates":true,"sso":true}'::jsonb, 7),
  ('org_enterprise', 'Enterprise',                 'organization',  0,      0,    0,    0,
    '{"contact_sales":true,"sso":true,"custom_seats":true}'::jsonb, 8)
on conflict (code) do update set
  name = excluded.name,
  scope = excluded.scope,
  monthly_price_cents = excluded.monthly_price_cents,
  instructor_seats = excluded.instructor_seats,
  learner_seats = excluded.learner_seats,
  monthly_token_budget = excluded.monthly_token_budget,
  features = excluded.features,
  display_order = excluded.display_order;

create type app.subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused'
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  -- Instructor-owned subscription (no org).
  user_id uuid references public.users(id) on delete cascade,
  plan_code text not null references public.plans(code),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status app.subscription_status not null default 'trialing',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((organization_id is not null and user_id is null) or (organization_id is null and user_id is not null))
);
create index subscriptions_org_idx on public.subscriptions (organization_id);
create index subscriptions_user_idx on public.subscriptions (user_id);
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function app.touch_updated_at();

create type app.seat_pool_kind as enum ('instructor', 'learner');

create table public.seat_pools (
  id uuid primary key default gen_random_uuid(),
  -- An org pool, or an instructor pool (then user_id is set).
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  kind app.seat_pool_kind not null,
  total_seats int not null default 0,
  -- Tracked separately so we can show "used / total" without an aggregate scan.
  used_seats int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((organization_id is not null) or (user_id is not null))
);
create index seat_pools_org_idx on public.seat_pools (organization_id);
create index seat_pools_user_idx on public.seat_pools (user_id);
create trigger seat_pools_touch before update on public.seat_pools
  for each row execute function app.touch_updated_at();

create table public.seat_assignments (
  id uuid primary key default gen_random_uuid(),
  seat_pool_id uuid not null references public.seat_pools(id) on delete cascade,
  -- Who's occupying the seat.
  user_id uuid not null references public.users(id) on delete cascade,
  program_id uuid references public.programs(id) on delete cascade,
  -- 'invited' | 'active' | 'released'
  status text not null default 'active',
  assigned_at timestamptz not null default now(),
  released_at timestamptz,
  unique (seat_pool_id, user_id, program_id)
);
create index seat_assignments_user_idx on public.seat_assignments (user_id);

create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  stripe_event_id text unique,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index billing_events_type_idx on public.billing_events (event_type);

-- Token + AI cost ledger (per LLM call). Aggregated for analytics + caps.
create table public.usage_logs (
  id bigserial primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  program_id uuid references public.programs(id) on delete cascade,
  node_id uuid references public.path_nodes(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  -- 'chat' | 'embedding' | 'grade_suggest'
  kind text not null,
  model text,
  prompt_tokens int default 0,
  completion_tokens int default 0,
  est_cost_usd numeric(10, 6) default 0,
  created_at timestamptz not null default now()
);
create index usage_logs_org_time_idx on public.usage_logs (organization_id, created_at desc);
create index usage_logs_program_idx on public.usage_logs (program_id);
