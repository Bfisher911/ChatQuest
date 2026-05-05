-- Add a per-org accent color so org admins can paint the UI in their
-- brand color. The chosen color overrides the active theme's --accent
-- token at the org-shell level for everyone in that org.
--
-- Default null = use the theme's baseline accent. Stored as a hex
-- string ("#2657ff") with a CHECK to keep it well-formed and prevent
-- random text from being injected into a CSS variable.

alter table public.organizations
  add column if not exists accent_color text;

alter table public.organizations
  drop constraint if exists organizations_accent_color_format;

alter table public.organizations
  add constraint organizations_accent_color_format
  check (accent_color is null or accent_color ~* '^#[0-9a-f]{6}$');

comment on column public.organizations.accent_color is
  'Optional brand-accent hex color (e.g. ''#2657ff''). When set, overrides the active theme''s --accent at the org-shell level for members.';
