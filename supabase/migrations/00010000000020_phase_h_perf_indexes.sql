-- Phase H — targeted indexes for hot paths.
-- All idempotent.

create index if not exists grades_program_learner_idx
  on public.grades (program_id, learner_id);

create index if not exists conversations_program_status_idx
  on public.conversations (program_id, status);

create index if not exists usage_logs_org_time_idx2
  on public.usage_logs (organization_id, created_at desc);

create index if not exists path_nodes_program_order_idx
  on public.path_nodes (program_id, display_order);

create index if not exists submissions_program_node_idx
  on public.submissions (program_id, node_id);

analyze public.grades;
analyze public.conversations;
analyze public.usage_logs;
analyze public.path_nodes;
analyze public.submissions;
