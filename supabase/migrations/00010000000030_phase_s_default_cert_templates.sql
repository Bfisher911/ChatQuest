-- Phase S — auto-provision a default certificate_template per organization.
-- Backfills every existing org that lacks one + adds a trigger so new orgs
-- get one automatically. Cert PDF render falls back to this template when
-- a `certificates` row doesn't reference a custom one.

insert into public.certificate_templates (organization_id, name, slug, body_text, signer_name, signer_title, paper_size)
select
  o.id,
  'Default Template',
  'brutalist-default',
  null,
  null,
  null,
  'Letter-landscape'
from public.organizations o
where not exists (
  select 1 from public.certificate_templates t
  where t.organization_id = o.id and t.name = 'Default Template'
);

create or replace function public.handle_new_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.certificate_templates (organization_id, name, slug, paper_size)
  values (new.id, 'Default Template', 'brutalist-default', 'Letter-landscape')
  on conflict (organization_id, name) do nothing;
  return new;
end;
$$;

drop trigger if exists on_organization_created on public.organizations;
create trigger on_organization_created
  after insert on public.organizations
  for each row execute function public.handle_new_organization();
