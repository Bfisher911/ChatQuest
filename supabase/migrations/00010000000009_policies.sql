-- ChatQuest — RLS policies. Enable RLS on every tenant table.
--
-- Pattern:
--   - super_admin sees everything (via app.is_super_admin()).
--   - org members see rows scoped to their org via app.user_org_ids().
--   - Learners see only their own conversations / grades / submissions.
--   - Instructors see programs they own/co-instruct.
--   - Service role bypasses RLS automatically — used for server-side admin operations.

alter table public.users enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.invites enable row level security;
alter table public.csv_imports enable row level security;
alter table public.audit_logs enable row level security;
alter table public.programs enable row level security;
alter table public.program_instructors enable row level security;
alter table public.program_enrollments enable row level security;
alter table public.path_nodes enable row level security;
alter table public.path_edges enable row level security;
alter table public.node_rules enable row level security;
alter table public.chatbot_configs enable row level security;
alter table public.knowledge_collections enable row level security;
alter table public.knowledge_files enable row level security;
alter table public.document_chunks enable row level security;
alter table public.embeddings enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.submissions enable row level security;
alter table public.analytics_events enable row level security;
alter table public.rubrics enable row level security;
alter table public.rubric_criteria enable row level security;
alter table public.rubric_levels enable row level security;
alter table public.grades enable row level security;
alter table public.rubric_scores enable row level security;
alter table public.certificate_templates enable row level security;
alter table public.certificates enable row level security;
alter table public.certificate_awards enable row level security;
alter table public.subscriptions enable row level security;
alter table public.seat_pools enable row level security;
alter table public.seat_assignments enable row level security;
alter table public.billing_events enable row level security;
alter table public.usage_logs enable row level security;

-- plans is global config; readable by everyone, writable only by super admin.
alter table public.plans enable row level security;
create policy plans_read on public.plans for select using (true);
create policy plans_super_write on public.plans for all using (app.is_super_admin()) with check (app.is_super_admin());

-- ─────────── users ───────────
-- Users can read their own row + members of orgs they belong to. Super admin reads all.
create policy users_self_read on public.users
  for select using (
    auth.uid() = id
    or app.is_super_admin()
    or exists (
      select 1 from public.organization_members m1
      join public.organization_members m2 on m1.organization_id = m2.organization_id
      where m1.user_id = auth.uid() and m2.user_id = users.id
    )
  );
create policy users_self_update on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy users_super_admin_all on public.users
  for all using (app.is_super_admin()) with check (app.is_super_admin());

-- ─────────── organizations ───────────
create policy organizations_member_read on public.organizations
  for select using (id in (select app.user_org_ids()) or app.is_super_admin());
create policy organizations_admin_write on public.organizations
  for update using (app.has_org_role(id, array['org_admin']::app.user_role[])) with check (app.has_org_role(id, array['org_admin']::app.user_role[]));
create policy organizations_super_all on public.organizations
  for all using (app.is_super_admin()) with check (app.is_super_admin());

-- ─────────── organization_members ───────────
create policy org_members_self_read on public.organization_members
  for select using (
    organization_id in (select app.user_org_ids())
    or user_id = auth.uid()
    or app.is_super_admin()
  );
create policy org_members_admin_write on public.organization_members
  for all using (app.has_org_role(organization_id, array['org_admin']::app.user_role[]))
  with check (app.has_org_role(organization_id, array['org_admin']::app.user_role[]));

-- ─────────── invites ───────────
create policy invites_org_read on public.invites
  for select using (organization_id in (select app.user_org_ids()) or app.is_super_admin());
create policy invites_inviter_write on public.invites
  for all using (app.has_org_role(organization_id, array['org_admin','instructor']::app.user_role[]))
  with check (app.has_org_role(organization_id, array['org_admin','instructor']::app.user_role[]));

-- ─────────── audit_logs ───────────
create policy audit_logs_admin_read on public.audit_logs
  for select using (
    app.is_super_admin()
    or (organization_id in (select app.user_org_ids()) and app.has_org_role(organization_id, array['org_admin']::app.user_role[]))
  );

-- ─────────── programs ───────────
create policy programs_member_read on public.programs
  for select using (
    organization_id in (select app.user_org_ids())
    or exists (select 1 from public.program_enrollments e where e.program_id = programs.id and e.user_id = auth.uid())
    or app.is_super_admin()
  );
create policy programs_instructor_write on public.programs
  for all using (
    app.has_org_role(organization_id, array['org_admin','instructor']::app.user_role[])
    or app.is_super_admin()
  )
  with check (
    app.has_org_role(organization_id, array['org_admin','instructor']::app.user_role[])
    or app.is_super_admin()
  );

-- ─────────── program_instructors ───────────
create policy program_instructors_read on public.program_instructors
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.programs p where p.id = program_id and p.organization_id in (select app.user_org_ids()))
    or app.is_super_admin()
  );
create policy program_instructors_write on public.program_instructors
  for all using (
    exists (select 1 from public.programs p where p.id = program_id and app.has_org_role(p.organization_id, array['org_admin','instructor']::app.user_role[]))
    or app.is_super_admin()
  )
  with check (
    exists (select 1 from public.programs p where p.id = program_id and app.has_org_role(p.organization_id, array['org_admin','instructor']::app.user_role[]))
    or app.is_super_admin()
  );

-- ─────────── program_enrollments ───────────
create policy program_enrollments_self_or_staff_read on public.program_enrollments
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.programs p where p.id = program_id and p.organization_id in (select app.user_org_ids()))
    or app.is_super_admin()
  );
create policy program_enrollments_staff_write on public.program_enrollments
  for all using (
    exists (select 1 from public.programs p where p.id = program_id and app.has_org_role(p.organization_id, array['org_admin','instructor']::app.user_role[]))
    or app.is_super_admin()
  )
  with check (
    exists (select 1 from public.programs p where p.id = program_id and app.has_org_role(p.organization_id, array['org_admin','instructor']::app.user_role[]))
    or app.is_super_admin()
  );

-- ─────────── path_nodes / path_edges / node_rules ───────────
create policy path_nodes_read on public.path_nodes
  for select using (
    exists (
      select 1 from public.programs p
      where p.id = program_id
        and (
          p.organization_id in (select app.user_org_ids())
          or exists (select 1 from public.program_enrollments e where e.program_id = p.id and e.user_id = auth.uid())
        )
    ) or app.is_super_admin()
  );
create policy path_nodes_staff_write on public.path_nodes
  for all using (
    exists (select 1 from public.programs p where p.id = program_id and app.has_org_role(p.organization_id, array['org_admin','instructor']::app.user_role[]))
    or app.is_super_admin()
  )
  with check (
    exists (select 1 from public.programs p where p.id = program_id and app.has_org_role(p.organization_id, array['org_admin','instructor']::app.user_role[]))
    or app.is_super_admin()
  );

create policy path_edges_read on public.path_edges
  for select using (
    exists (
      select 1 from public.programs p
      where p.id = program_id
        and (
          p.organization_id in (select app.user_org_ids())
          or exists (select 1 from public.program_enrollments e where e.program_id = p.id and e.user_id = auth.uid())
        )
    ) or app.is_super_admin()
  );
create policy path_edges_staff_write on public.path_edges
  for all using (
    exists (select 1 from public.programs p where p.id = program_id and app.has_org_role(p.organization_id, array['org_admin','instructor']::app.user_role[]))
    or app.is_super_admin()
  )
  with check (
    exists (select 1 from public.programs p where p.id = program_id and app.has_org_role(p.organization_id, array['org_admin','instructor']::app.user_role[]))
    or app.is_super_admin()
  );

create policy node_rules_read on public.node_rules
  for select using (
    exists (select 1 from public.path_nodes n join public.programs p on n.program_id = p.id
            where n.id = node_rules.node_id
              and (p.organization_id in (select app.user_org_ids())
                or exists (select 1 from public.program_enrollments e where e.program_id = p.id and e.user_id = auth.uid())))
    or app.is_super_admin()
  );
create policy node_rules_staff_write on public.node_rules
  for all using (
    exists (select 1 from public.path_nodes n join public.programs p on n.program_id = p.id
            where n.id = node_rules.node_id and app.has_org_role(p.organization_id, array['org_admin','instructor']::app.user_role[]))
    or app.is_super_admin()
  ) with check (
    exists (select 1 from public.path_nodes n join public.programs p on n.program_id = p.id
            where n.id = node_rules.node_id and app.has_org_role(p.organization_id, array['org_admin','instructor']::app.user_role[]))
    or app.is_super_admin()
  );

-- ─────────── chatbot_configs ───────────
create policy chatbot_configs_read on public.chatbot_configs
  for select using (
    exists (
      select 1 from public.path_nodes n join public.programs p on n.program_id = p.id
      where n.id = chatbot_configs.node_id and (
        p.organization_id in (select app.user_org_ids())
        or exists (select 1 from public.program_enrollments e where e.program_id = p.id and e.user_id = auth.uid())
      )
    ) or app.is_super_admin()
  );
create policy chatbot_configs_staff_write on public.chatbot_configs
  for all using (
    exists (select 1 from public.path_nodes n join public.programs p on n.program_id = p.id
            where n.id = chatbot_configs.node_id and app.has_org_role(p.organization_id, array['org_admin','instructor']::app.user_role[]))
    or app.is_super_admin()
  ) with check (
    exists (select 1 from public.path_nodes n join public.programs p on n.program_id = p.id
            where n.id = chatbot_configs.node_id and app.has_org_role(p.organization_id, array['org_admin','instructor']::app.user_role[]))
    or app.is_super_admin()
  );

-- ─────────── knowledge_* (org-scoped, never cross-tenant) ───────────
create policy kb_collections_read on public.knowledge_collections
  for select using (organization_id in (select app.user_org_ids()) or app.is_super_admin());
create policy kb_collections_write on public.knowledge_collections
  for all using (app.has_org_role(organization_id, array['org_admin','instructor']::app.user_role[])) with check (app.has_org_role(organization_id, array['org_admin','instructor']::app.user_role[]));

create policy kb_files_read on public.knowledge_files
  for select using (organization_id in (select app.user_org_ids()) or app.is_super_admin());
create policy kb_files_write on public.knowledge_files
  for all using (app.has_org_role(organization_id, array['org_admin','instructor']::app.user_role[])) with check (app.has_org_role(organization_id, array['org_admin','instructor']::app.user_role[]));

create policy kb_chunks_read on public.document_chunks
  for select using (organization_id in (select app.user_org_ids()) or app.is_super_admin());
create policy kb_chunks_write on public.document_chunks
  for all using (app.has_org_role(organization_id, array['org_admin','instructor']::app.user_role[])) with check (app.has_org_role(organization_id, array['org_admin','instructor']::app.user_role[]));

create policy embeddings_read on public.embeddings
  for select using (organization_id in (select app.user_org_ids()) or app.is_super_admin());
create policy embeddings_write on public.embeddings
  for all using (app.has_org_role(organization_id, array['org_admin','instructor']::app.user_role[])) with check (app.has_org_role(organization_id, array['org_admin','instructor']::app.user_role[]));

-- ─────────── conversations + messages ───────────
-- Strict: only the learner, the program's instructors/TAs, the org admin (if program flag is set), and super admin.
create policy conversations_learner_or_staff_read on public.conversations
  for select using (
    learner_id = auth.uid()
    or exists (select 1 from public.programs p
               where p.id = program_id
                 and (
                   app.has_org_role(p.organization_id, array['instructor','ta']::app.user_role[])
                   or (p.share_conversations_with_org_admin and app.has_org_role(p.organization_id, array['org_admin']::app.user_role[]))
                 ))
    or app.is_super_admin()
  );
create policy conversations_learner_write on public.conversations
  for insert with check (learner_id = auth.uid());
create policy conversations_learner_update on public.conversations
  for update using (learner_id = auth.uid()) with check (learner_id = auth.uid());
create policy conversations_staff_update on public.conversations
  for update using (
    exists (select 1 from public.programs p
            where p.id = program_id
              and app.has_org_role(p.organization_id, array['instructor','ta']::app.user_role[]))
    or app.is_super_admin()
  );

create policy conversation_messages_read on public.conversation_messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_messages.conversation_id
        and (c.learner_id = auth.uid()
          or exists (select 1 from public.programs p
                     where p.id = c.program_id
                       and (
                         app.has_org_role(p.organization_id, array['instructor','ta']::app.user_role[])
                         or (p.share_conversations_with_org_admin and app.has_org_role(p.organization_id, array['org_admin']::app.user_role[]))
                       ))
        )
    ) or app.is_super_admin()
  );
create policy conversation_messages_learner_write on public.conversation_messages
  for insert with check (
    exists (select 1 from public.conversations c where c.id = conversation_id and c.learner_id = auth.uid())
  );

-- ─────────── submissions ───────────
create policy submissions_read on public.submissions
  for select using (
    learner_id = auth.uid()
    or exists (select 1 from public.programs p
               where p.id = program_id
                 and app.has_org_role(p.organization_id, array['instructor','ta','org_admin']::app.user_role[]))
    or app.is_super_admin()
  );
create policy submissions_learner_write on public.submissions
  for insert with check (learner_id = auth.uid());

-- ─────────── analytics_events ───────────
create policy analytics_events_read on public.analytics_events
  for select using (
    organization_id in (select app.user_org_ids()) or app.is_super_admin()
  );
create policy analytics_events_user_write on public.analytics_events
  for insert with check (auth.uid() is not null);

-- ─────────── rubrics ───────────
create policy rubrics_read on public.rubrics
  for select using (
    organization_id in (select app.user_org_ids())
    or exists (select 1 from public.programs p where p.id = program_id
               and exists (select 1 from public.program_enrollments e where e.program_id = p.id and e.user_id = auth.uid()))
    or app.is_super_admin()
  );
create policy rubrics_write on public.rubrics
  for all using (app.has_org_role(organization_id, array['org_admin','instructor']::app.user_role[])) with check (app.has_org_role(organization_id, array['org_admin','instructor']::app.user_role[]));

create policy rubric_criteria_read on public.rubric_criteria
  for select using (
    exists (select 1 from public.rubrics r where r.id = rubric_id and (r.organization_id in (select app.user_org_ids()) or app.is_super_admin()))
  );
create policy rubric_criteria_write on public.rubric_criteria
  for all using (
    exists (select 1 from public.rubrics r where r.id = rubric_id and app.has_org_role(r.organization_id, array['org_admin','instructor']::app.user_role[]))
  ) with check (
    exists (select 1 from public.rubrics r where r.id = rubric_id and app.has_org_role(r.organization_id, array['org_admin','instructor']::app.user_role[]))
  );

create policy rubric_levels_read on public.rubric_levels
  for select using (
    exists (select 1 from public.rubric_criteria c join public.rubrics r on c.rubric_id = r.id
            where c.id = criterion_id and (r.organization_id in (select app.user_org_ids()) or app.is_super_admin()))
  );
create policy rubric_levels_write on public.rubric_levels
  for all using (
    exists (select 1 from public.rubric_criteria c join public.rubrics r on c.rubric_id = r.id
            where c.id = criterion_id and app.has_org_role(r.organization_id, array['org_admin','instructor']::app.user_role[]))
  ) with check (
    exists (select 1 from public.rubric_criteria c join public.rubrics r on c.rubric_id = r.id
            where c.id = criterion_id and app.has_org_role(r.organization_id, array['org_admin','instructor']::app.user_role[]))
  );

-- ─────────── grades / rubric_scores ───────────
create policy grades_read on public.grades
  for select using (
    learner_id = auth.uid()
    or exists (select 1 from public.programs p where p.id = program_id and app.has_org_role(p.organization_id, array['instructor','ta','org_admin']::app.user_role[]))
    or app.is_super_admin()
  );
create policy grades_staff_write on public.grades
  for all using (
    exists (select 1 from public.programs p where p.id = program_id and app.has_org_role(p.organization_id, array['instructor','ta']::app.user_role[]))
    or app.is_super_admin()
  ) with check (
    exists (select 1 from public.programs p where p.id = program_id and app.has_org_role(p.organization_id, array['instructor','ta']::app.user_role[]))
    or app.is_super_admin()
  );

create policy rubric_scores_read on public.rubric_scores
  for select using (
    exists (select 1 from public.grades g where g.id = grade_id and (
      g.learner_id = auth.uid()
      or exists (select 1 from public.programs p where p.id = g.program_id and app.has_org_role(p.organization_id, array['instructor','ta','org_admin']::app.user_role[]))
      or app.is_super_admin()
    ))
  );
create policy rubric_scores_staff_write on public.rubric_scores
  for all using (
    exists (select 1 from public.grades g where g.id = grade_id
            and exists (select 1 from public.programs p where p.id = g.program_id and app.has_org_role(p.organization_id, array['instructor','ta']::app.user_role[])))
    or app.is_super_admin()
  ) with check (
    exists (select 1 from public.grades g where g.id = grade_id
            and exists (select 1 from public.programs p where p.id = g.program_id and app.has_org_role(p.organization_id, array['instructor','ta']::app.user_role[])))
    or app.is_super_admin()
  );

-- ─────────── certificate_* ───────────
create policy cert_templates_read on public.certificate_templates
  for select using (organization_id in (select app.user_org_ids()) or app.is_super_admin());
create policy cert_templates_write on public.certificate_templates
  for all using (app.has_org_role(organization_id, array['org_admin','instructor']::app.user_role[])) with check (app.has_org_role(organization_id, array['org_admin','instructor']::app.user_role[]));

create policy certificates_read on public.certificates
  for select using (
    exists (select 1 from public.programs p where p.id = program_id and (p.organization_id in (select app.user_org_ids()) or exists (select 1 from public.program_enrollments e where e.program_id = p.id and e.user_id = auth.uid())))
    or app.is_super_admin()
  );
create policy certificates_write on public.certificates
  for all using (
    exists (select 1 from public.programs p where p.id = program_id and app.has_org_role(p.organization_id, array['org_admin','instructor']::app.user_role[]))
    or app.is_super_admin()
  ) with check (
    exists (select 1 from public.programs p where p.id = program_id and app.has_org_role(p.organization_id, array['org_admin','instructor']::app.user_role[]))
    or app.is_super_admin()
  );

create policy cert_awards_read on public.certificate_awards
  for select using (
    learner_id = auth.uid()
    or organization_id in (select app.user_org_ids())
    or app.is_super_admin()
  );
create policy cert_awards_write on public.certificate_awards
  for all using (
    app.has_org_role(organization_id, array['org_admin','instructor']::app.user_role[])
    or app.is_super_admin()
  ) with check (
    app.has_org_role(organization_id, array['org_admin','instructor']::app.user_role[])
    or app.is_super_admin()
  );

-- ─────────── billing ───────────
create policy subscriptions_read on public.subscriptions
  for select using (
    user_id = auth.uid()
    or (organization_id is not null and app.has_org_role(organization_id, array['org_admin']::app.user_role[]))
    or app.is_super_admin()
  );

create policy seat_pools_read on public.seat_pools
  for select using (
    user_id = auth.uid()
    or (organization_id is not null and organization_id in (select app.user_org_ids()))
    or app.is_super_admin()
  );

create policy seat_assignments_read on public.seat_assignments
  for select using (
    user_id = auth.uid()
    or app.is_super_admin()
    or exists (select 1 from public.seat_pools sp where sp.id = seat_pool_id
               and ((sp.organization_id is not null and sp.organization_id in (select app.user_org_ids()))
                    or sp.user_id = auth.uid()))
  );

create policy billing_events_admin_read on public.billing_events
  for select using (
    app.is_super_admin()
    or (organization_id is not null and app.has_org_role(organization_id, array['org_admin']::app.user_role[]))
    or user_id = auth.uid()
  );

create policy usage_logs_read on public.usage_logs
  for select using (
    user_id = auth.uid()
    or (organization_id is not null and app.has_org_role(organization_id, array['org_admin','instructor']::app.user_role[]))
    or app.is_super_admin()
  );

-- Service role bypasses RLS automatically. No special policies needed for it.

-- Grant CRUD privileges to authenticated; RLS does the actual gating.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant select on public.plans to anon;
