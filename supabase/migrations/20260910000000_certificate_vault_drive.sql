-- =============================================================================
-- Certificate Vault  ->  Google Drive-style professional document manager
-- =============================================================================
-- ADDITIVE + backward compatible. The existing `public.certificates` table, its
-- rows, its files, and its owner-only RLS are all preserved:
--
--   * every new column is nullable or defaulted, so existing rows are valid
--     as-is and existing INSERTs (title/description/file_url/file_name/
--     file_size/user_id) keep working unchanged;
--   * the private `certificates` Storage bucket and its owner-only object
--     policies are NOT touched -- files stay private, access stays via
--     short-lived signed URLs;
--   * `certificates` SELECT RLS stays *strictly owner-only*. The new
--     `visibility` column is stored data only; no connections/public read
--     path is added here. Sharing + a public verification endpoint are a
--     separate, later increment that will add its own reviewed policy +
--     SECURITY DEFINER accessor (mirroring `public.can_view_story`).
--
-- Connection model reused: `public.connections` (undirected projection of
-- accepted `public.friend_requests`, keyed on `profiles.id`) -- the same graph
-- `mutual_connections_count` / `can_view_story` / Story audience read. NOT used
-- in this migration (owner-only), documented here for the follow-up.
-- =============================================================================

-- pg_trgm already installed (people search). Guard anyway.
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- 1) certificate_folders  -- nested collections (self-referencing parent_id)
-- ---------------------------------------------------------------------------
create table if not exists public.certificate_folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  parent_id  uuid references public.certificate_folders(id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_cert_folders_user_active
  on public.certificate_folders (user_id) where deleted_at is null;
create index if not exists idx_cert_folders_parent
  on public.certificate_folders (user_id, parent_id) where deleted_at is null;
create index if not exists idx_cert_folders_trash
  on public.certificate_folders (user_id, deleted_at desc) where deleted_at is not null;

alter table public.certificate_folders enable row level security;

drop policy if exists cert_folders_select on public.certificate_folders;
create policy cert_folders_select on public.certificate_folders
  for select using (auth.uid() = user_id);

drop policy if exists cert_folders_insert on public.certificate_folders;
create policy cert_folders_insert on public.certificate_folders
  for insert with check (
    auth.uid() = user_id
    and (
      parent_id is null
      or exists (
        select 1 from public.certificate_folders p
        where p.id = parent_id and p.user_id = auth.uid()
      )
    )
  );

drop policy if exists cert_folders_update on public.certificate_folders;
create policy cert_folders_update on public.certificate_folders
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists cert_folders_delete on public.certificate_folders;
create policy cert_folders_delete on public.certificate_folders
  for delete using (auth.uid() = user_id);

-- keep updated_at fresh on rename / re-parent
create or replace function public.cert_folders_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_cert_folders_touch on public.certificate_folders;
create trigger trg_cert_folders_touch
  before update on public.certificate_folders
  for each row execute function public.cert_folders_touch_updated_at();

-- prevent a folder becoming its own ancestor (moving into itself / a descendant)
create or replace function public.cert_folder_no_cycle()
returns trigger language plpgsql as $$
declare cur uuid := new.parent_id;
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception 'A folder cannot be its own parent';
  end if;
  while cur is not null loop
    if cur = new.id then
      raise exception 'Cannot move a folder into one of its own descendants';
    end if;
    select parent_id into cur from public.certificate_folders where id = cur;
  end loop;
  return new;
end $$;

drop trigger if exists trg_cert_folder_no_cycle on public.certificate_folders;
create trigger trg_cert_folder_no_cycle
  before insert or update of parent_id on public.certificate_folders
  for each row execute function public.cert_folder_no_cycle();

-- ---------------------------------------------------------------------------
-- 2) certificates  -- extend with credential + organization + lifecycle fields
--    (all additive; existing rows & inserts stay valid)
-- ---------------------------------------------------------------------------
alter table public.certificates
  add column if not exists folder_id        uuid references public.certificate_folders(id) on delete set null,
  add column if not exists issuer           text,
  add column if not exists credential_name  text,
  add column if not exists credential_id    text,
  add column if not exists issue_date       date,
  add column if not exists expiry_date      date,
  add column if not exists category         text
    check (category is null or category in
      ('course','license','certification','award','education','identity','membership','other')),
  add column if not exists skills           text[] not null default '{}',
  add column if not exists tags             text[] not null default '{}',
  add column if not exists verification_url text,
  add column if not exists verified_status  text not null default 'unverified'
    check (verified_status in ('unverified','self_attested','link_provided')),
  add column if not exists visibility       text not null default 'private'
    check (visibility in ('private','connections','public')),
  add column if not exists starred          boolean not null default false,
  add column if not exists mime_type        text,
  add column if not exists thumb_path       text,
  add column if not exists last_opened_at   timestamptz,
  add column if not exists deleted_at       timestamptz;

-- indexes for the Drive-style views + server-side search
create index if not exists idx_certificates_user_active
  on public.certificates (user_id) where deleted_at is null;
create index if not exists idx_certificates_folder
  on public.certificates (user_id, folder_id) where deleted_at is null;
create index if not exists idx_certificates_starred
  on public.certificates (user_id) where starred and deleted_at is null;
create index if not exists idx_certificates_recent
  on public.certificates (user_id, coalesce(last_opened_at, updated_at) desc) where deleted_at is null;
create index if not exists idx_certificates_trash
  on public.certificates (user_id, deleted_at desc) where deleted_at is not null;
create index if not exists idx_certificates_search_trgm
  on public.certificates using gin (
    (coalesce(title,'') || ' ' || coalesce(issuer,'') || ' ' ||
     coalesce(credential_name,'') || ' ' || coalesce(credential_id,'') || ' ' ||
     coalesce(description,'') || ' ' || coalesce(file_name,'')) gin_trgm_ops
  ) where deleted_at is null;
create index if not exists idx_certificates_skills_gin
  on public.certificates using gin (skills) where deleted_at is null;
create index if not exists idx_certificates_tags_gin
  on public.certificates using gin (tags) where deleted_at is null;

-- A certificate's folder must belong to the same owner (defense-in-depth
-- against a spoofed folder_id; RLS on certificate_folders already gates reads).
create or replace function public.cert_folder_same_owner()
returns trigger language plpgsql as $$
begin
  if new.folder_id is not null and not exists (
    select 1 from public.certificate_folders f
    where f.id = new.folder_id and f.user_id = new.user_id
  ) then
    raise exception 'folder_id must reference a folder you own';
  end if;
  return new;
end $$;

drop trigger if exists trg_cert_folder_same_owner on public.certificates;
create trigger trg_cert_folder_same_owner
  before insert or update of folder_id, user_id on public.certificates
  for each row execute function public.cert_folder_same_owner();

-- NOTE: no updated_at touch trigger on `certificates`. The client sets
-- updated_at explicitly on real edits (rename / move / metadata / star /
-- trash / restore); `last_opened_at` is bumped separately by
-- public.cert_touch_opened() below and must NOT change "Modified".

-- ---------------------------------------------------------------------------
-- 3) certificate_activity  -- append-only audit trail (owner-readable)
-- ---------------------------------------------------------------------------
create table if not exists public.certificate_activity (
  id             uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  action         text not null check (action in
    ('uploaded','renamed','moved','starred','unstarred',
     'metadata_updated','downloaded','trashed','restored')),
  detail         jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists idx_cert_activity_cert
  on public.certificate_activity (certificate_id, created_at desc);

alter table public.certificate_activity enable row level security;

drop policy if exists cert_activity_select on public.certificate_activity;
create policy cert_activity_select on public.certificate_activity
  for select using (
    exists (
      select 1 from public.certificates c
      where c.id = certificate_activity.certificate_id and c.user_id = auth.uid()
    )
  );

-- INSERT allowed only for the owner's own certificate, and only for the
-- 'downloaded' action from the client (all DB-observable events are written by
-- the trigger below with the table owner's rights). No UPDATE / DELETE policy
-- -> the trail is immutable.
drop policy if exists cert_activity_insert on public.certificate_activity;
create policy cert_activity_insert on public.certificate_activity
  for insert with check (
    user_id = auth.uid()
    and action = 'downloaded'
    and exists (
      select 1 from public.certificates c
      where c.id = certificate_activity.certificate_id and c.user_id = auth.uid()
    )
  );

-- Transactional, tamper-proof activity for every DB-observable event.
create or replace function public.cert_log_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.certificate_activity (certificate_id, user_id, action)
      values (new.id, new.user_id, 'uploaded');
    return new;
  end if;

  -- UPDATE
  if old.deleted_at is null and new.deleted_at is not null then
    insert into public.certificate_activity (certificate_id, user_id, action)
      values (new.id, new.user_id, 'trashed');
  elsif old.deleted_at is not null and new.deleted_at is null then
    insert into public.certificate_activity (certificate_id, user_id, action)
      values (new.id, new.user_id, 'restored');
  end if;

  if old.starred is distinct from new.starred then
    insert into public.certificate_activity (certificate_id, user_id, action)
      values (new.id, new.user_id, case when new.starred then 'starred' else 'unstarred' end);
  end if;

  if old.title is distinct from new.title then
    insert into public.certificate_activity (certificate_id, user_id, action, detail)
      values (new.id, new.user_id, 'renamed',
              jsonb_build_object('from', old.title, 'to', new.title));
  end if;

  if old.folder_id is distinct from new.folder_id then
    insert into public.certificate_activity (certificate_id, user_id, action)
      values (new.id, new.user_id, 'moved');
  end if;

  if (old.issuer, old.credential_name, old.credential_id, old.issue_date,
      old.expiry_date, old.category, old.skills, old.tags,
      old.verification_url, old.description, old.visibility)
     is distinct from
     (new.issuer, new.credential_name, new.credential_id, new.issue_date,
      new.expiry_date, new.category, new.skills, new.tags,
      new.verification_url, new.description, new.visibility)
  then
    insert into public.certificate_activity (certificate_id, user_id, action)
      values (new.id, new.user_id, 'metadata_updated');
  end if;

  return new;
end $$;

drop trigger if exists trg_cert_log_activity on public.certificates;
create trigger trg_cert_log_activity
  after insert or update on public.certificates
  for each row execute function public.cert_log_activity();

-- ---------------------------------------------------------------------------
-- 4) RPCs
-- ---------------------------------------------------------------------------

-- Bump last_opened_at (Recent view) + record a 'downloaded' activity, owner
-- only. Does NOT change updated_at / "Modified".
create or replace function public.cert_touch_opened(_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.certificates
     set last_opened_at = now()
   where id = _id and user_id = auth.uid() and deleted_at is null;

  if found then
    insert into public.certificate_activity (certificate_id, user_id, action)
      values (_id, auth.uid(), 'downloaded');
  end if;
end $$;

revoke all on function public.cert_touch_opened(uuid) from public, anon;
grant execute on function public.cert_touch_opened(uuid) to authenticated;

-- Trash / restore a folder and everything inside it (recursive), atomically.
-- On restore, if the folder's parent is itself trashed, the folder is lifted
-- to the vault root (parent_id := null) -- same behaviour as Google Drive.
create or replace function public.cert_folder_set_deleted(_folder uuid, _deleted boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _ts timestamptz := case when _deleted then now() else null end;
  _parent uuid;
  _parent_deleted timestamptz;
begin
  if not exists (
    select 1 from public.certificate_folders
    where id = _folder and user_id = auth.uid()
  ) then
    raise exception 'Folder not found';
  end if;

  -- recursive set of this folder + all descendant folders (owner-scoped)
  with recursive sub as (
    select id, parent_id
      from public.certificate_folders
     where id = _folder and user_id = auth.uid()
    union all
    select f.id, f.parent_id
      from public.certificate_folders f
      join sub on f.parent_id = sub.id
     where f.user_id = auth.uid()
  )
  update public.certificate_folders
     set deleted_at = _ts
   where id in (select id from sub);

  with recursive sub as (
    select id
      from public.certificate_folders
     where id = _folder and user_id = auth.uid()
    union all
    select f.id
      from public.certificate_folders f
      join sub on f.parent_id = sub.id
     where f.user_id = auth.uid()
  )
  update public.certificates
     set deleted_at = _ts
   where user_id = auth.uid()
     and folder_id in (select id from sub);

  -- restore: reattach to root if the parent is still in the trash
  if not _deleted then
    select parent_id into _parent
      from public.certificate_folders
     where id = _folder and user_id = auth.uid();
    if _parent is not null then
      select deleted_at into _parent_deleted
        from public.certificate_folders
       where id = _parent and user_id = auth.uid();
      if _parent_deleted is not null then
        update public.certificate_folders
           set parent_id = null
         where id = _folder and user_id = auth.uid();
      end if;
    end if;
  end if;
end $$;

revoke all on function public.cert_folder_set_deleted(uuid, boolean) from public, anon;
grant execute on function public.cert_folder_set_deleted(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) column docs
-- ---------------------------------------------------------------------------
comment on column public.certificates.folder_id        is 'Owning certificate_folders row; NULL = vault root.';
comment on column public.certificates.visibility       is 'private | connections | public. Increment 1: stored only, SELECT RLS stays owner-only.';
comment on column public.certificates.deleted_at       is 'Soft delete (Trash). NULL = active. Permanent delete removes the row + Storage object.';
comment on column public.certificates.last_opened_at   is 'Bumped by cert_touch_opened() on preview/download; feeds the Recent view; does NOT affect updated_at.';
comment on column public.certificates.thumb_path       is 'Reserved for generated thumbnails (later increment). NULL -> file-type icon fallback.';
