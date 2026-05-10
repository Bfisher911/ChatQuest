-- ChatQuest seed data.
-- Run with:  pnpm db:seed   (or:  psql "$SUPABASE_DB_URL" -f supabase/seed.sql)
--
-- Creates one super admin, one org admin, one instructor, one TA, three learners,
-- one organization, one program with a chatbot node + rubric + KB collection,
-- two pre-grade-able submissions for gradebook smoke testing.
--
-- Default password for ALL seeded users: chatquest!
-- (auth password hash via Supabase auth.users — generated with bcrypt of 'chatquest!')

begin;

-- 1) auth.users — Supabase manages this normally, but for seed we insert directly.
-- bcrypt hash for "chatquest!" — generated with bcrypt cost=10.
do $$
declare
  v_hash text := '$2a$10$0Pd6/cpZ0fBBOWVpeYlrQOrhlXCX1tCk/LKZEZMjORfFsIOCswH22';
  v_super uuid := '11111111-1111-1111-1111-111111111111';
  v_orgadm uuid := '22222222-2222-2222-2222-222222222222';
  v_instr uuid := '33333333-3333-3333-3333-333333333333';
  v_ta uuid := '44444444-4444-4444-4444-444444444444';
  v_l1 uuid := '55555555-5555-5555-5555-555555555555';
  v_l2 uuid := '66666666-6666-6666-6666-666666666666';
  v_l3 uuid := '77777777-7777-7777-7777-777777777777';
  v_org uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_prog uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_node uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  v_kb uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  v_rubric uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  v_crit1 uuid := 'efefefef-1111-1111-1111-111111111111';
  v_crit2 uuid := 'efefefef-2222-2222-2222-222222222222';
  v_crit3 uuid := 'efefefef-3333-3333-3333-333333333333';
  v_crit4 uuid := 'efefefef-4444-4444-4444-444444444444';
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data, raw_app_meta_data, is_sso_user, is_anonymous)
  values
    (v_super, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'super@chatquest.local', v_hash, now(), now(), now(), '{"full_name":"Super Admin"}', '{"provider":"email","providers":["email"]}', false, false),
    (v_orgadm, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@chatquest.local', v_hash, now(), now(), now(), '{"full_name":"Olivia Park"}', '{"provider":"email","providers":["email"]}', false, false),
    (v_instr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'instructor@chatquest.local', v_hash, now(), now(), now(), '{"full_name":"Dr. Kowalski"}', '{"provider":"email","providers":["email"]}', false, false),
    (v_ta, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ta@chatquest.local', v_hash, now(), now(), now(), '{"full_name":"Sam Patel"}', '{"provider":"email","providers":["email"]}', false, false),
    (v_l1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ada@chatquest.local', v_hash, now(), now(), now(), '{"full_name":"Ada Okonkwo"}', '{"provider":"email","providers":["email"]}', false, false),
    (v_l2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'marcus@chatquest.local', v_hash, now(), now(), now(), '{"full_name":"Marcus Chen"}', '{"provider":"email","providers":["email"]}', false, false),
    (v_l3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'priya@chatquest.local', v_hash, now(), now(), now(), '{"full_name":"Priya Raman"}', '{"provider":"email","providers":["email"]}', false, false)
  on conflict (id) do nothing;

  -- 2) public.users — handle_new_auth_user trigger inserts these, but be idempotent.
  insert into public.users (id, email, full_name, display_name, is_super_admin) values
    (v_super, 'super@chatquest.local', 'Super Admin', 'Super', true),
    (v_orgadm, 'admin@chatquest.local', 'Olivia Park', 'Olivia', false),
    (v_instr, 'instructor@chatquest.local', 'Dr. Kowalski', 'Kowalski', false),
    (v_ta, 'ta@chatquest.local', 'Sam Patel', 'Sam', false),
    (v_l1, 'ada@chatquest.local', 'Ada Okonkwo', 'Ada', false),
    (v_l2, 'marcus@chatquest.local', 'Marcus Chen', 'Marcus', false),
    (v_l3, 'priya@chatquest.local', 'Priya Raman', 'Priya', false)
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    display_name = excluded.display_name,
    is_super_admin = excluded.is_super_admin;

  -- 3) Organization
  insert into public.organizations (id, name, slug, org_type, created_by, plan_code) values
    (v_org, 'Brutalist University', 'brutalist-u', 'school', v_orgadm, 'org_dept')
  on conflict (id) do nothing;

  -- 4) Memberships
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_orgadm, 'org_admin'),
    (v_org, v_instr, 'instructor'),
    (v_org, v_ta, 'ta'),
    (v_org, v_l1, 'learner'),
    (v_org, v_l2, 'learner'),
    (v_org, v_l3, 'learner')
  on conflict (organization_id, user_id) do nothing;

  -- 5) Program
  insert into public.programs (id, organization_id, created_by, title, description, status, default_model, passing_threshold)
  values (v_prog, v_org, v_instr,
          'AI Ethics Simulation Path',
          'A high-stakes simulation: brief the Secretary on autonomous triage AI. Cite frameworks. Push back on talking points.',
          'published', 'gemini-3-flash-preview', 80.00)
  on conflict (id) do nothing;

  insert into public.program_instructors (program_id, user_id, capacity) values
    (v_prog, v_instr, 'owner'),
    (v_prog, v_ta, 'ta')
  on conflict (program_id, user_id) do nothing;

  insert into public.program_enrollments (program_id, user_id, status) values
    (v_prog, v_l1, 'active'),
    (v_prog, v_l2, 'active'),
    (v_prog, v_l3, 'active')
  on conflict (program_id, user_id) do nothing;

  -- 6) Knowledge collection
  insert into public.knowledge_collections (id, organization_id, program_id, name, description, created_by)
  values (v_kb, v_org, v_prog, 'Program Knowledge Base', 'Frameworks the bot should reference.', v_instr)
  on conflict (id) do nothing;

  -- 7) Rubric — "AI Ethics — 4 criteria · 25 pts"
  insert into public.rubrics (id, organization_id, program_id, name, description, total_points, created_by)
  values (v_rubric, v_org, v_prog, 'AI Ethics — 4 criteria', 'Standard rubric for the policy advisor simulation.', 25, v_instr)
  on conflict (id) do nothing;

  insert into public.rubric_criteria (id, rubric_id, display_order, name, description, max_points) values
    (v_crit1, v_rubric, 0, 'Frameworks cited', 'Cited at least 2 named frameworks (regulatory, ethical, statutory).', 8),
    (v_crit2, v_rubric, 1, 'Counter-argument quality', 'Engaged seriously with the Mayor''s pushback.', 7),
    (v_crit3, v_rubric, 2, 'Stakeholder analysis', 'Identified affected populations and their distinct interests.', 6),
    (v_crit4, v_rubric, 3, 'Public communication', 'Drafted a public statement that was honest and politically viable.', 4)
  on conflict (id) do nothing;

  -- 8) Path node + chatbot config
  insert into public.path_nodes (id, program_id, type, title, display_order, points, x, y)
  values (v_node, v_prog, 'bot', 'AI Policy Advisor', 0, 25, 360, 150)
  on conflict (id) do nothing;

  insert into public.chatbot_configs (
    node_id, bot_name, avatar_initials, learner_instructions, system_prompt,
    conversation_goal, completion_criteria, model, temperature, max_tokens, token_budget,
    attempts_allowed, rubric_id, ai_grading_enabled, use_program_kb
  ) values (
    v_node, 'AI Policy Advisor', 'AP',
    'Brief the Secretary on autonomous triage AI. Cite at least 2 frameworks. Push back on the Mayor''s talking points.',
    'You are a Socratic policy advisor running a simulation with a learner. Probe assumptions. Demand citations. Reference the program knowledge base before answering. After every learner turn, ask one sharper follow-up question. Do not give the answer; lead them to it.',
    'Surface concrete trade-offs between equity, public trust, and contractual obligation in autonomous decision systems.',
    'Learner cites at least 2 named frameworks, identifies affected stakeholder groups, drafts a public statement.',
    'gemini-3-flash-preview', 0.4, 1024, 8000, 2, v_rubric, true, true
  )
  on conflict (node_id) do update set
    system_prompt = excluded.system_prompt,
    learner_instructions = excluded.learner_instructions,
    rubric_id = excluded.rubric_id,
    model = excluded.model;

  -- 9) Pre-existing conversation + submission for Marcus so the gradebook isn't empty.
  insert into public.conversations (id, program_id, node_id, learner_id, organization_id, attempt_number, status, started_at, submitted_at, total_prompt_tokens, total_completion_tokens, ai_summary)
  values (
    'a0a0a0a0-0000-0000-0000-000000000001'::uuid,
    v_prog, v_node, v_l2, v_org, 1, 'submitted', now() - interval '2 hours', now() - interval '1 hour',
    1850, 920,
    'Marcus opened by suspending the pilot pending audit. Cited EEOC 4/5ths and HHS §1557. Did not address informed-consent gap. 6 turns.'
  )
  on conflict (id) do nothing;

  insert into public.conversation_messages (conversation_id, role, content, model)
  values
    ('a0a0a0a0-0000-0000-0000-000000000001'::uuid, 'assistant', 'Welcome to the AI Policy Advisor simulation. You are briefing the Secretary on autonomous decision systems in public hospitals. The scenario: a city pilot deploys a triage AI that prioritizes patients during a flu surge. Equity audits show a 9% lower priority score for one demographic. Mayor''s office wants to keep the pilot live. What''s your opening recommendation?', 'claude-haiku-4-5'),
    ('a0a0a0a0-0000-0000-0000-000000000001'::uuid, 'user', 'Suspend the pilot pending an external audit. Continued deployment under a known disparity creates legal and ethical exposure.', null),
    ('a0a0a0a0-0000-0000-0000-000000000001'::uuid, 'assistant', 'Strong opening. Pushback from the Mayor''s chief of staff: a 9% disparity is below the contract threshold. How do you respond, and what regulatory frameworks do you cite?', 'claude-haiku-4-5'),
    ('a0a0a0a0-0000-0000-0000-000000000001'::uuid, 'user', 'The contract threshold is a procurement minimum, not an ethical ceiling. I''d cite EEOC disparate impact analysis (4/5ths rule) and HHS Section 1557 on algorithmic discrimination in healthcare.', null);

  insert into public.submissions (id, conversation_id, program_id, node_id, learner_id, organization_id, attempt_number, delivery_status)
  values ('b0b0b0b0-0000-0000-0000-000000000001'::uuid, 'a0a0a0a0-0000-0000-0000-000000000001'::uuid, v_prog, v_node, v_l2, v_org, 1, 'on_time')
  on conflict (id) do nothing;

  insert into public.grades (submission_id, conversation_id, program_id, node_id, learner_id, organization_id, rubric_id, status, max_score, ai_summary)
  values ('b0b0b0b0-0000-0000-0000-000000000001'::uuid, 'a0a0a0a0-0000-0000-0000-000000000001'::uuid, v_prog, v_node, v_l2, v_org, v_rubric, 'pending_review', 25,
          'Marcus separated deployment from data decisions in the opening turn — strong framing. Cited EEOC 4/5ths, HHS §1557. Did not address informed-consent gap until prompted.')
  on conflict (submission_id) do nothing;

  -- 10) Subscription record so the org admin dashboard shows the right plan.
  insert into public.subscriptions (organization_id, plan_code, status, current_period_start, current_period_end)
  values (v_org, 'org_dept', 'active', now() - interval '5 days', now() + interval '25 days')
  on conflict do nothing;

end $$;

commit;
