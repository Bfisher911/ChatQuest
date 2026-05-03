-- Phase T — in-app notifications hub.
-- Append-only event log, scoped per user.

create type app.notification_kind as enum (
  'grade_returned',
  'cert_awarded',
  'invite_received',
  'comment_added',
  'other'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  kind app.notification_kind not null default 'other',
  title text not null,
  body text,
  href text,
  metadata jsonb default '{}'::jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx
  on public.notifications (user_id, is_read, created_at desc);

alter table public.notifications enable row level security;

create policy notifications_self_read on public.notifications
  for select using (user_id = auth.uid() or app.is_super_admin());
create policy notifications_self_update on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_self_insert on public.notifications
  for insert with check (user_id = auth.uid() or app.is_super_admin());
