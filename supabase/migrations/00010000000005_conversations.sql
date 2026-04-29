-- ChatQuest — conversations, messages, attempts, submissions, analytics.

create type app.conversation_status as enum (
  'not_started',
  'in_progress',
  'submitted',
  'graded',
  'needs_revision',
  'completed'
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  node_id uuid not null references public.path_nodes(id) on delete cascade,
  learner_id uuid not null references public.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  attempt_number int not null default 1,
  status app.conversation_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  completed_at timestamptz,
  total_prompt_tokens int not null default 0,
  total_completion_tokens int not null default 0,
  ai_summary text,
  unique (program_id, node_id, learner_id, attempt_number)
);
create index conversations_learner_idx on public.conversations (learner_id);
create index conversations_node_idx on public.conversations (node_id, status);
create index conversations_program_idx on public.conversations (program_id);

create type app.message_role as enum ('user', 'assistant', 'system');

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role app.message_role not null,
  content text not null,
  prompt_tokens int default 0,
  completion_tokens int default 0,
  -- KB chunks cited as JSON array of { chunk_id, file_id, score }
  citations jsonb default '[]'::jsonb,
  model text,
  created_at timestamptz not null default now()
);
create index conversation_messages_conv_idx on public.conversation_messages (conversation_id, created_at);

-- One row per attempt — captures the snapshot at submission time.
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references public.conversations(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  node_id uuid not null references public.path_nodes(id) on delete cascade,
  learner_id uuid not null references public.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  attempt_number int not null,
  -- 'on_time' | 'late' | 'missing' | 'excused' — derived from due dates at submit time.
  delivery_status text not null default 'on_time',
  submitted_at timestamptz not null default now()
);
create index submissions_node_idx on public.submissions (node_id);
create index submissions_program_idx on public.submissions (program_id);

-- Generic event firehose for analytics.
create table public.analytics_events (
  id bigserial primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  program_id uuid references public.programs(id) on delete cascade,
  node_id uuid references public.path_nodes(id) on delete cascade,
  event_type text not null,
  event_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index analytics_events_org_time_idx on public.analytics_events (organization_id, created_at desc);
create index analytics_events_type_idx on public.analytics_events (event_type);
