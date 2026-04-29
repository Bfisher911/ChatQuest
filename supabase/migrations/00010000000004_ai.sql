-- ChatQuest — chatbot configs, knowledge bases, embeddings.

create table public.chatbot_configs (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null unique references public.path_nodes(id) on delete cascade,
  -- Bot-facing
  bot_name text default 'AI Tutor',
  avatar_initials text default 'AI',
  -- Learner-facing
  learner_instructions text,
  -- Bot brain
  system_prompt text not null,
  conversation_goal text,
  completion_criteria text,
  model text not null default 'claude-haiku-4-5',
  temperature numeric(3, 2) not null default 0.4,
  max_tokens int not null default 1024,
  token_budget int not null default 8000,
  -- Conversation control
  attempts_allowed int not null default 2,
  end_after_turns int,
  end_when_objective_met boolean not null default false,
  require_submit_button boolean not null default true,
  produce_completion_summary boolean not null default true,
  ask_reflection_questions boolean not null default false,
  allow_retry_after_feedback boolean not null default true,
  -- Grading
  rubric_id uuid,
  ai_grading_enabled boolean not null default true,
  -- Knowledge base attachments
  use_program_kb boolean not null default true,
  node_kb_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chatbot_configs_node_idx on public.chatbot_configs (node_id);
create trigger chatbot_configs_touch before update on public.chatbot_configs
  for each row execute function app.touch_updated_at();

-- Knowledge base = a named collection of files. Scope = program OR node.
create table public.knowledge_collections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid references public.programs(id) on delete cascade,
  node_id uuid references public.path_nodes(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Either program-level (program_id non-null, node_id null) or node-level (both non-null), never neither.
  check (program_id is not null)
);
create index knowledge_collections_program_idx on public.knowledge_collections (program_id);

create type app.kb_file_status as enum ('pending', 'processing', 'indexed', 'failed');

create table public.knowledge_files (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.knowledge_collections(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  filename text not null,
  storage_path text not null,
  mime_type text,
  bytes int,
  pages int,
  status app.kb_file_status not null default 'pending',
  status_message text,
  uploaded_by uuid references public.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  indexed_at timestamptz
);
create index knowledge_files_collection_idx on public.knowledge_files (collection_id);
create index knowledge_files_status_idx on public.knowledge_files (status);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.knowledge_files(id) on delete cascade,
  collection_id uuid not null references public.knowledge_collections(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  page_number int,
  token_count int,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index document_chunks_file_idx on public.document_chunks (file_id);
create index document_chunks_collection_idx on public.document_chunks (collection_id);

-- Embeddings: 1536-dim default (OpenAI text-embedding-3-small / Voyage-3-lite truncated).
create table public.embeddings (
  id uuid primary key default gen_random_uuid(),
  chunk_id uuid not null unique references public.document_chunks(id) on delete cascade,
  collection_id uuid not null references public.knowledge_collections(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  model text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);
create index embeddings_collection_idx on public.embeddings (collection_id);
-- HNSW index for cosine similarity. lists=100 default; tune later.
create index embeddings_vec_idx on public.embeddings using hnsw (embedding vector_cosine_ops);

-- Add chatbot_configs FK to rubrics (defined in 0006).
-- We intentionally defer until that migration runs.
