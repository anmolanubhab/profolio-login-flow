-- =============================================================================
-- Certificate Vault -- post-apply fixes for 20260910000000_certificate_vault_drive
-- =============================================================================
-- Two defects were found during production verification of PR #60:
--
--  1. cert_folders_insert RLS blocked *all* sub-folder creation.
--     The parent-ownership sub-select was
--         exists (select 1 from public.certificate_folders p
--                 where p.id = parent_id and p.user_id = auth.uid())
--     Inside that sub-select the bare `parent_id` binds to `p.parent_id`
--     (inner scope wins), so the check collapsed to `p.id = p.parent_id`
--     -- true only for a folder that is its own parent, which the
--     cert_folder_no_cycle trigger forbids. Net effect: any INSERT with a
--     non-NULL parent_id failed the WITH CHECK. Root folders were fine.
--     Fix: reference the candidate row explicitly as
--     `certificate_folders.parent_id` and alias the lookup table `par`.
--
--  2. Opening / previewing / downloading a certificate changed its
--     "Modified" time. public.cert_touch_opened() issues
--         update public.certificates set last_opened_at = now() ...
--     and the pre-existing generic BEFORE UPDATE trigger
--     `update_certificates_updated_at` (from 20250803100612, shared
--     function update_updated_at_column) then forced updated_at = now()
--     too. The 20260910000000 design note wrongly assumed no such trigger
--     existed. Fix: swap that trigger for a certificates-specific one that
--     only stamps updated_at when a column *other than* updated_at /
--     last_opened_at actually changed. Real edits still bump "Modified";
--     a pure last_opened_at bump no longer does. The shared
--     update_updated_at_column function is left untouched (other tables use it).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) certificate_folders INSERT policy -- fix the parent-ownership check
-- ---------------------------------------------------------------------------
drop policy if exists cert_folders_insert on public.certificate_folders;
create policy cert_folders_insert on public.certificate_folders
  for insert with check (
    auth.uid() = user_id
    and (
      certificate_folders.parent_id is null
      or exists (
        select 1
        from public.certificate_folders par
        where par.id = certificate_folders.parent_id
          and par.user_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 2) certificates updated_at -- ignore pure last_opened_at bumps
-- ---------------------------------------------------------------------------
create or replace function public.certificates_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Compare everything except the two "activity" timestamps. If anything
  -- else changed, this is a real modification -> stamp updated_at.
  if (to_jsonb(new) - 'updated_at' - 'last_opened_at')
     is distinct from
     (to_jsonb(old) - 'updated_at' - 'last_opened_at')
  then
    new.updated_at := now();
  end if;
  return new;
end $$;

-- Replace the generic trigger on `certificates` only.
drop trigger if exists update_certificates_updated_at on public.certificates;
drop trigger if exists trg_certificates_touch_updated_at on public.certificates;
create trigger trg_certificates_touch_updated_at
  before update on public.certificates
  for each row execute function public.certificates_touch_updated_at();

comment on column public.certificates.last_opened_at is
  'Bumped by cert_touch_opened() on preview/download; feeds the Recent view; '
  'does NOT affect updated_at (see certificates_touch_updated_at).';
