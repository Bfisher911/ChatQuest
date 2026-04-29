-- ChatQuest — rubrics + grades.

create type app.grade_status as enum (
  'not_submitted',
  'pending_review',
  'in_review',
  'graded',
  'needs_revision',
  'excused'
);

create table public.rubrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Optional program scope. Null = org-wide reusable rubric.
  program_id uuid references public.programs(id) on delete set null,
  name text not null,
  description text,
  total_points int not null default 0,
  is_visible_to_learners boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rubrics_org_idx on public.rubrics (organization_id);
create trigger rubrics_touch before update on public.rubrics
  for each row execute function app.touch_updated_at();

create table public.rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  rubric_id uuid not null references public.rubrics(id) on delete cascade,
  display_order int not null default 0,
  name text not null,
  description text,
  max_points int not null default 5,
  created_at timestamptz not null default now()
);
create index rubric_criteria_rubric_idx on public.rubric_criteria (rubric_id, display_order);

create table public.rubric_levels (
  id uuid primary key default gen_random_uuid(),
  criterion_id uuid not null references public.rubric_criteria(id) on delete cascade,
  display_order int not null default 0,
  label text not null,
  points int not null default 0,
  description text,
  created_at timestamptz not null default now()
);
create index rubric_levels_criterion_idx on public.rubric_levels (criterion_id, display_order);

-- Now that rubrics exist, link chatbot_configs.rubric_id.
alter table public.chatbot_configs
  add constraint chatbot_configs_rubric_fk
  foreign key (rubric_id) references public.rubrics(id) on delete set null;

-- One per submission.
create table public.grades (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.submissions(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  node_id uuid not null references public.path_nodes(id) on delete cascade,
  learner_id uuid not null references public.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rubric_id uuid references public.rubrics(id) on delete set null,
  status app.grade_status not null default 'pending_review',
  score numeric(6, 2),
  max_score numeric(6, 2),
  percentage numeric(5, 2),
  instructor_comment text,
  ai_suggested_score numeric(6, 2),
  ai_summary text,
  graded_by uuid references public.users(id) on delete set null,
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index grades_program_idx on public.grades (program_id);
create index grades_learner_idx on public.grades (learner_id);
create index grades_node_idx on public.grades (node_id);
create trigger grades_touch before update on public.grades
  for each row execute function app.touch_updated_at();

-- Per-criterion scores against a grade.
create table public.rubric_scores (
  id uuid primary key default gen_random_uuid(),
  grade_id uuid not null references public.grades(id) on delete cascade,
  criterion_id uuid not null references public.rubric_criteria(id) on delete cascade,
  level_id uuid references public.rubric_levels(id) on delete set null,
  score numeric(6, 2) not null default 0,
  comment text,
  unique (grade_id, criterion_id)
);
create index rubric_scores_grade_idx on public.rubric_scores (grade_id);
