-- ChatQuest — certificate templates and awards.

create table public.certificate_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  -- Template slug for picking renderer in lib/certificates/.
  slug text not null default 'brutalist-default',
  body_text text,
  signer_name text,
  signer_title text,
  signature_image_url text,
  org_logo_url text,
  -- 'A4-landscape' | 'Letter-landscape'
  paper_size text not null default 'Letter-landscape',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);
create trigger certificate_templates_touch before update on public.certificate_templates
  for each row execute function app.touch_updated_at();

-- Certificate definition attached to a node (typically a 'cert' or 'milestone' node).
create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  node_id uuid references public.path_nodes(id) on delete set null,
  template_id uuid not null references public.certificate_templates(id) on delete restrict,
  title text not null,
  -- Set of node ids that must be completed for this cert. JSON array of UUIDs.
  required_node_ids jsonb not null default '[]'::jsonb,
  min_grade_percentage numeric(5, 2) default 80.00,
  requires_instructor_approval boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.certificate_awards (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  learner_id uuid not null references public.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Public verification id printed on the cert. Short, URL-safe.
  verification_code text not null unique default encode(gen_random_bytes(8), 'hex'),
  awarded_at timestamptz not null default now(),
  awarded_by uuid references public.users(id) on delete set null,
  pdf_path text,
  unique (certificate_id, learner_id)
);
create index certificate_awards_learner_idx on public.certificate_awards (learner_id);
create index certificate_awards_program_idx on public.certificate_awards (program_id);
