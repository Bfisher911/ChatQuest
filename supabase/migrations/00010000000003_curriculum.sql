-- ChatQuest — programs, paths, nodes, edges, release rules.

create type app.program_status as enum ('draft', 'published', 'archived');
create type app.enrollment_type as enum ('invite_only', 'invite_code', 'open');
create type app.enrollment_status as enum ('active', 'completed', 'dropped', 'pending');

create type app.node_type as enum (
  'bot',
  'content',
  'pdf',
  'slides',
  'link',
  'milestone',
  'cert'
);

create type app.node_progress_state as enum ('locked', 'available', 'in_progress', 'completed', 'failed');

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  title text not null,
  description text,
  cover_image_url text,
  status app.program_status not null default 'draft',
  enrollment_type app.enrollment_type not null default 'invite_only',
  invite_code text,
  start_date date,
  end_date date,
  available_at timestamptz,
  due_at timestamptz,
  passing_threshold numeric(5, 2) default 70.00,
  default_model text default 'claude-haiku-4-5',
  monthly_token_budget int default 200000,
  learner_pays boolean not null default false,
  -- One-time price in cents (Stripe). Null when learner_pays = false.
  learner_price_cents int,
  -- Whether org admins can view learner conversations
  share_conversations_with_org_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index programs_org_idx on public.programs (organization_id);
create index programs_status_idx on public.programs (status);
create unique index programs_invite_code_unique on public.programs (invite_code) where invite_code is not null;

create trigger programs_touch before update on public.programs
  for each row execute function app.touch_updated_at();

create table public.program_instructors (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  -- 'owner' | 'co_instructor' | 'ta'
  capacity text not null default 'co_instructor',
  added_at timestamptz not null default now(),
  unique (program_id, user_id)
);
create index program_instructors_user_idx on public.program_instructors (user_id);

create table public.program_enrollments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status app.enrollment_status not null default 'active',
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  final_grade numeric(5, 2),
  unique (program_id, user_id)
);
create index program_enrollments_user_idx on public.program_enrollments (user_id);

create table public.path_nodes (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  type app.node_type not null,
  title text not null,
  -- Display order within the program (used as fallback when no edges exist).
  display_order int not null default 0,
  -- Layout coordinates for the visual builder.
  x numeric default 0,
  y numeric default 0,
  -- Polymorphic config — shape depends on `type`. See lib/db/types.ts.
  config jsonb not null default '{}'::jsonb,
  points int default 0,
  is_required boolean not null default true,
  available_at timestamptz,
  due_at timestamptz,
  until_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index path_nodes_program_idx on public.path_nodes (program_id);
create index path_nodes_type_idx on public.path_nodes (type);

create trigger path_nodes_touch before update on public.path_nodes
  for each row execute function app.touch_updated_at();

create table public.path_edges (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  source_node_id uuid not null references public.path_nodes(id) on delete cascade,
  target_node_id uuid not null references public.path_nodes(id) on delete cascade,
  -- Optional release condition for this edge. Null means "always release on source completion".
  -- Shape: { kind: 'after' | 'min_score' | 'date' | 'either', ... }
  condition jsonb,
  created_at timestamptz not null default now(),
  unique (source_node_id, target_node_id)
);
create index path_edges_program_idx on public.path_edges (program_id);

create table public.node_rules (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.path_nodes(id) on delete cascade,
  -- 'open_on_date' | 'after_prereq' | 'min_score' | 'either_or' | 'branching' | 'skip'
  rule_kind text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index node_rules_node_idx on public.node_rules (node_id);

-- Add the FK from invites.program_id (defined in 0002 without the FK to avoid forward ref).
alter table public.invites
  add constraint invites_program_fk foreign key (program_id) references public.programs(id) on delete cascade;
alter table public.csv_imports
  add constraint csv_imports_program_fk foreign key (program_id) references public.programs(id) on delete cascade;
