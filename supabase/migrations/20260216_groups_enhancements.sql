-- Groups enhancements: visibility, metadata and permissions
-- Safe, idempotent migration

-- Ensure columns exist
alter table public.groups 
  add column if not exists is_public boolean default true,
  add column if not exists industry text[],
  add column if not exists location text,
  add column if not exists rules text,
  add column if not exists allow_member_invites boolean default true,
  add column if not exists require_post_approval boolean default false;

-- Backfill NULLs with defaults where needed
update public.groups set is_public = coalesce(is_public, true) where is_public is null;
update public.groups set allow_member_invites = coalesce(allow_member_invites, true) where allow_member_invites is null;
update public.groups set require_post_approval = coalesce(require_post_approval, false) where require_post_approval is null;

-- Create a public storage bucket for group logos (idempotent)
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'group-logos') then
    perform storage.create_bucket('group-logos', true);
  end if;
exception
  when others then
    -- ignore errors if storage extension not available in local dev
    null;
end $$;
