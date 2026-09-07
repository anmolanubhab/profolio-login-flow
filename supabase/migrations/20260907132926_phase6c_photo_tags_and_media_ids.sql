-- ============================================================================
-- Phase 6C finalization: Photo Tagging + stable media identifiers
--   * Adds a stable `id` to every posts.media item (backfills existing rows)
--   * New public.post_media_tags (person attached to a specific image)
--   * Privacy-aware search_taggable_people()
--   * photo_tag in-app notification (no email; separate from @mention)
--   * storage_path_referenced() helper for the media-cleanup edge function
-- Additive only. Does not touch Phase 5 email or Phase 6A/6B objects.
-- ============================================================================

-- 1. Stable id on each posts.media element -------------------------------------
update public.posts p
set media = (
  select jsonb_agg(
    case
      when (elem ? 'id') and length(coalesce(elem->>'id','')) > 0 then elem
      else elem || jsonb_build_object(
        'id', substr(md5(random()::text || clock_timestamp()::text || ord::text), 1, 12)
      )
    end
    order by ord
  )
  from jsonb_array_elements(p.media) with ordinality as t(elem, ord)
)
where p.media is not null
  and jsonb_typeof(p.media) = 'array'
  and jsonb_array_length(p.media) > 0
  and exists (
    select 1 from jsonb_array_elements(p.media) e
    where not (e ? 'id') or length(coalesce(e->>'id','')) = 0
  );

-- 2. post_media_tags ----------------------------------------------------------
create table if not exists public.post_media_tags (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  media_key   text not null,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  x           numeric(7,6) not null,
  y           numeric(7,6) not null,
  created_by  uuid not null default auth.uid(),
  created_at  timestamptz not null default now(),
  constraint post_media_tags_x_range   check (x >= 0 and x <= 1),
  constraint post_media_tags_y_range   check (y >= 0 and y <= 1),
  constraint post_media_tags_key_len   check (char_length(media_key) between 1 and 64),
  constraint post_media_tags_uniq      unique (post_id, media_key, profile_id)
);

comment on table public.post_media_tags is
  'A person attached to one image of a post (LinkedIn "tag people in photo"). '
  'media_key === posts.media[i].id (stable across reorder/delete). x/y are '
  'normalised [0,1] marker coordinates. Separate system from post_mentions '
  '(caption @mentions).';

create index if not exists idx_post_media_tags_post    on public.post_media_tags(post_id);
create index if not exists idx_post_media_tags_profile on public.post_media_tags(profile_id);

alter table public.post_media_tags enable row level security;

-- 3. Helpers ----------------------------------------------------------------
create or replace function public.owns_post(p_post_id uuid)
returns boolean
language sql stable security definer set search_path to ''
as $$
  select exists (
    select 1 from public.posts
    where id = p_post_id
      and (
        user_id = auth.uid()
        or (company_id is not null and public.is_company_admin(auth.uid(), company_id))
      )
  );
$$;
revoke all on function public.owns_post(uuid) from public, anon;
grant execute on function public.owns_post(uuid) to authenticated;

create or replace function public.can_tag_profile(target uuid)
returns boolean
language sql stable security definer set search_path to ''
as $$
  select
    target is not null
    and exists (
      select 1 from public.profiles p
      where p.id = target
        and coalesce(p.profile_discovery, true) = true
        and not exists (
          select 1 from public.blocked_users b
          where (b.user_id = target and b.blocked_user_id = public.current_profile_id())
             or (b.user_id = public.current_profile_id() and b.blocked_user_id = target)
        )
    );
$$;
revoke all on function public.can_tag_profile(uuid) from public, anon;
grant execute on function public.can_tag_profile(uuid) to authenticated;

-- 4. RLS --------------------------------------------------------------------
-- SELECT: posts are world-readable in this app; only hide a tag from someone
-- on either side of a block with the tagged person.
create policy "post_media_tags_select"
  on public.post_media_tags for select
  using (
    not exists (
      select 1 from public.blocked_users b
      where (b.user_id = profile_id and b.blocked_user_id = public.current_profile_id())
         or (b.user_id = public.current_profile_id() and b.blocked_user_id = profile_id)
    )
  );

create policy "post_media_tags_insert"
  on public.post_media_tags for insert
  with check (
    created_by = auth.uid()
    and public.owns_post(post_id)
    and public.can_tag_profile(profile_id)
  );

create policy "post_media_tags_update"
  on public.post_media_tags for update
  using (public.owns_post(post_id))
  with check (public.owns_post(post_id));

create policy "post_media_tags_delete"
  on public.post_media_tags for delete
  using (public.owns_post(post_id));

-- 5. Notification (in-app only; self-tag => no notification) ---------------
create or replace function public.notify_photo_tag()
returns trigger
language plpgsql security definer set search_path to ''
as $$
declare
  author_pid  uuid;
  author_prof public.profiles%rowtype;
  post_row    public.posts%rowtype;
begin
  select * into post_row from public.posts where id = NEW.post_id;
  if post_row.id is null then
    return NEW;
  end if;

  select id into author_pid from public.profiles where user_id = post_row.user_id;
  if author_pid is null or author_pid = NEW.profile_id then
    return NEW;  -- unknown author or self-tag: no notification
  end if;

  select * into author_prof from public.profiles where id = author_pid;

  insert into public.notifications (user_id, type, payload)
  values (
    NEW.profile_id,
    'photo_tag',
    jsonb_build_object(
      'sender_id', author_pid,
      'sender_name', coalesce(author_prof.display_name, author_prof.full_name, 'Someone'),
      'sender_avatar', author_prof.avatar_url,
      'post_id', NEW.post_id,
      'message', left(regexp_replace(coalesce(post_row.content, ''), '\s+', ' ', 'g'), 140)
    )
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notify_photo_tag on public.post_media_tags;
create trigger trg_notify_photo_tag
  after insert on public.post_media_tags
  for each row execute function public.notify_photo_tag();

-- 6. Privacy-aware people search for tagging ------------------------------
create or replace function public.search_taggable_people(q text)
returns table(id uuid, display_name text, avatar_url text, headline text, profession text)
language sql stable security definer set search_path to ''
as $$
  with me as (select public.current_profile_id() as pid)
  select p.id, p.display_name, p.avatar_url, p.headline, p.profession
  from public.profiles p
  where coalesce(p.profile_discovery, true) = true
    and p.id <> coalesce((select pid from me), '00000000-0000-0000-0000-000000000000'::uuid)
    and p.display_name ilike ('%' || replace(replace(coalesce(q, ''), '%', '\%'), '_', '\_') || '%')
    and not public.is_blocked_by(p.id)
    and not exists (
      select 1 from public.blocked_users b
      where b.user_id = (select pid from me) and b.blocked_user_id = p.id
    )
    and (
      p.profile_visibility = 'public'
      or p.profile_visibility is null
      or (
        p.profile_visibility = 'connections_only'
        and exists (
          select 1 from public.friend_requests fr
          where fr.status = 'accepted'
            and ((fr.sender_id = p.id and fr.receiver_id = (select pid from me))
              or (fr.receiver_id = p.id and fr.sender_id = (select pid from me)))
        )
      )
    )
  order by p.display_name asc
  limit 8;
$$;
revoke all on function public.search_taggable_people(text) from public, anon;
grant execute on function public.search_taggable_people(text) to authenticated;

-- 7. Reference check for the media-cleanup edge function ----------------
create or replace function public.storage_path_referenced(p_path text)
returns boolean
language sql stable security definer set search_path to ''
as $$
  select
    coalesce(p_path, '') <> ''
    and exists (
      select 1 from public.posts
      where position(p_path in coalesce(image_url, '')) > 0
         or position(p_path in coalesce(media::text, '')) > 0
         or exists (
           select 1 from unnest(coalesce(carousel_urls, array[]::text[])) u
           where position(p_path in u) > 0
         )
    );
$$;
revoke all on function public.storage_path_referenced(text) from public, anon, authenticated;
grant execute on function public.storage_path_referenced(text) to service_role;
