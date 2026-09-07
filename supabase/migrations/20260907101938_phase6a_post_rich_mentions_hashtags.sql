-- Phase 6A — Advanced Post Composer: rich text + @mentions + #hashtags
--
-- Additive only. Does NOT touch Phase 1-5 job-matching or the Phase 5 email
-- infrastructure (email_outbox, email worker, email cron).
--
-- Content model:
--   posts.content       -- unchanged: HTML-escaped PLAIN-TEXT mirror. Stays the
--                          source of truth for search, notification snippets,
--                          repost previews, and backward-compatible rendering.
--   posts.content_rich  -- NEW nullable jsonb: the Tiptap document. When NULL
--                          (every pre-existing post, drafts, legacy clients)
--                          the renderer falls back to `content` verbatim.
--
-- Entities are extracted server-side (never trusted from the client) into
-- normalized join tables by ONE SECURITY DEFINER trigger:
--   hashtags(tag UNIQUE, post_count)      -- canonical, case-folded
--   post_hashtags(post_id, hashtag_id)
--   post_mentions(post_id, mentioned_profile_id)
-- and the same trigger fires 'post_mention' notifications (mirrors the existing
-- notify_comment_mentions path exactly: definer insert, skip self, skip anyone
-- already mentioned in the previous revision, honour the target's
-- preferences.mentions_from + block list).

-- =============================================================== posts.content_rich
alter table public.posts add column if not exists content_rich jsonb;

comment on column public.posts.content_rich is
  'Tiptap rich-text document (JSON). NULL => render posts.content as plain text.';

-- =============================================================== hashtags
create table if not exists public.hashtags (
  id         uuid primary key default gen_random_uuid(),
  tag        text not null unique,
  post_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint hashtags_tag_shape check (tag ~ '^[a-z0-9_]{1,100}$')
);

create index if not exists idx_hashtags_post_count on public.hashtags (post_count desc, tag);

alter table public.hashtags enable row level security;

-- Public read (posts themselves are public); all writes go through the
-- SECURITY DEFINER trigger below, never the client.
drop policy if exists hashtags_select_public on public.hashtags;
create policy hashtags_select_public on public.hashtags for select using (true);

-- =============================================================== post_hashtags
create table if not exists public.post_hashtags (
  post_id    uuid not null references public.posts(id) on delete cascade,
  hashtag_id uuid not null references public.hashtags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, hashtag_id)
);

-- Drives the /hashtag/:tag page (all posts for a tag, newest first).
create index if not exists idx_post_hashtags_tag_post on public.post_hashtags (hashtag_id, post_id);

alter table public.post_hashtags enable row level security;

drop policy if exists post_hashtags_select_public on public.post_hashtags;
create policy post_hashtags_select_public on public.post_hashtags for select using (true);

-- =============================================================== post_mentions
create table if not exists public.post_mentions (
  post_id              uuid not null references public.posts(id) on delete cascade,
  mentioned_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at           timestamptz not null default now(),
  primary key (post_id, mentioned_profile_id)
);

-- Drives "posts that mention me" lookups.
create index if not exists idx_post_mentions_profile_post
  on public.post_mentions (mentioned_profile_id, post_id);

alter table public.post_mentions enable row level security;

drop policy if exists post_mentions_select_public on public.post_mentions;
create policy post_mentions_select_public on public.post_mentions for select using (true);

-- =============================================================== normalize_hashtag
-- "#EV", "ev", "Ev" -> "ev".  Strips a leading '#', lowercases, removes every
-- non [a-z0-9_] character, caps at 100 chars, returns NULL when nothing is left.
create or replace function public.normalize_hashtag(input text)
returns text
language sql
immutable
as $$
  select nullif(
    substring(
      regexp_replace(lower(regexp_replace(coalesce(input, ''), '^#+', '')), '[^a-z0-9_]+', '', 'g')
      from 1 for 100
    ),
    ''
  );
$$;

-- =============================================================== can_receive_mention_from
-- Server-side re-check of the same privacy rules search_mentionable_people
-- applies at autocomplete time, so a hand-crafted content_rich payload cannot
-- create a mention row / notification for someone who disallows it.
create or replace function public.can_receive_mention_from(target uuid, actor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    target is not null
    and actor is not null
    and target <> actor
    and exists (
      select 1
      from public.profiles p
      where p.id = target
        and not exists (
          select 1 from public.blocked_users b
          where (b.user_id = target and b.blocked_user_id = actor)
             or (b.user_id = actor  and b.blocked_user_id = target)
        )
        and (
          coalesce(p.preferences ->> 'mentions_from', 'everyone') = 'everyone'
          or (
            coalesce(p.preferences ->> 'mentions_from', 'everyone') = 'connections'
            and exists (
              select 1 from public.friend_requests fr
              where fr.status = 'accepted'
                and ((fr.sender_id = target and fr.receiver_id = actor)
                  or (fr.receiver_id = target and fr.sender_id = actor))
            )
          )
        )
    );
$$;

revoke all on function public.can_receive_mention_from(uuid, uuid) from public;
grant execute on function public.can_receive_mention_from(uuid, uuid) to authenticated, service_role;

-- =============================================================== sync_post_entities (trigger fn)
create or replace function public.sync_post_entities()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author_pid   uuid;
  author_prof  public.profiles%rowtype;
  norm_tags    text[];
  mention_ids  uuid[];
  valid_ids    uuid[];
  already_ids  uuid[] := '{}';
  affected_tag_ids uuid[];
begin
  select id into author_pid from public.profiles where user_id = NEW.user_id;
  if author_pid is not null then
    select * into author_prof from public.profiles where id = author_pid;
  end if;

  -- ---- hashtags: from the rich doc's hashtag nodes + any "#word" typed in the
  -- plain-text mirror (covers a hashtag that never became a node).
  select array_agg(distinct t)
  into norm_tags
  from (
    select public.normalize_hashtag(node ->> 'tag') as t
    from jsonb_path_query(
      coalesce(NEW.content_rich, '{}'::jsonb),
      'strict $.**?(@.type == "hashtag")'
    ) as node
    union all
    select public.normalize_hashtag(m[1])
    from regexp_matches(coalesce(NEW.content, ''), '#([A-Za-z0-9_]{1,100})', 'g') as m
  ) s
  where t is not null;

  norm_tags := coalesce(norm_tags, '{}');
  -- Hard cap: ignore absurd tag counts (spam / pathological docs).
  if array_length(norm_tags, 1) > 30 then
    norm_tags := norm_tags[1:30];
  end if;

  -- tags affected = existing links for this post (pre-change) ∪ new set
  select array_agg(distinct hashtag_id) into affected_tag_ids
  from public.post_hashtags where post_id = NEW.id;
  affected_tag_ids := coalesce(affected_tag_ids, '{}');

  if array_length(norm_tags, 1) is not null then
    insert into public.hashtags (tag)
    select unnest(norm_tags)
    on conflict (tag) do nothing;
  end if;

  delete from public.post_hashtags where post_id = NEW.id;

  if array_length(norm_tags, 1) is not null then
    insert into public.post_hashtags (post_id, hashtag_id)
    select NEW.id, h.id
    from public.hashtags h
    where h.tag = any(norm_tags)
    on conflict do nothing;

    select array_cat(affected_tag_ids, array_agg(h.id))
    into affected_tag_ids
    from public.hashtags h
    where h.tag = any(norm_tags);
  end if;

  -- Refresh denormalized counts for every touched tag.
  if array_length(affected_tag_ids, 1) is not null then
    update public.hashtags h
    set post_count = (select count(*) from public.post_hashtags ph where ph.hashtag_id = h.id)
    where h.id = any(affected_tag_ids);
  end if;

  -- ---- mentions: identity-bearing, so ONLY from the rich doc's mention nodes.
  select array_agg(distinct (node #>> '{attrs,id}')::uuid)
  into mention_ids
  from jsonb_path_query(
    coalesce(NEW.content_rich, '{}'::jsonb),
    'strict $.**?(@.type == "mention")'
  ) as node
  where (node #>> '{attrs,id}') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

  mention_ids := coalesce(mention_ids, '{}');

  -- who was already mentioned before this write (=> already notified)
  select array_agg(mentioned_profile_id) into already_ids
  from public.post_mentions where post_id = NEW.id;
  already_ids := coalesce(already_ids, '{}');

  select array_agg(pid) into valid_ids
  from (
    select p.id as pid
    from public.profiles p
    where p.id = any(mention_ids)
      and p.id <> coalesce(author_pid, '00000000-0000-0000-0000-000000000000'::uuid)
      and public.can_receive_mention_from(p.id, author_pid)
  ) s;
  valid_ids := coalesce(valid_ids, '{}');

  delete from public.post_mentions where post_id = NEW.id;

  if array_length(valid_ids, 1) is not null then
    insert into public.post_mentions (post_id, mentioned_profile_id)
    select NEW.id, unnest(valid_ids)
    on conflict do nothing;
  end if;

  -- ---- notifications for the newly-added mentions only
  if author_pid is not null and array_length(valid_ids, 1) is not null then
    insert into public.notifications (user_id, type, payload)
    select
      mid,
      'post_mention',
      jsonb_build_object(
        'sender_id', author_pid,
        'sender_name', coalesce(author_prof.display_name, author_prof.full_name, 'Someone'),
        'sender_avatar', author_prof.avatar_url,
        'post_id', NEW.id,
        'message', left(regexp_replace(coalesce(NEW.content, ''), '\s+', ' ', 'g'), 140)
      )
    from unnest(valid_ids) as mid
    where mid <> all(already_ids);
  end if;

  return NEW;
end;
$$;

drop trigger if exists on_post_sync_entities on public.posts;
create trigger on_post_sync_entities
  after insert or update of content, content_rich on public.posts
  for each row execute function public.sync_post_entities();

-- Keep denormalized counts honest when links disappear (post deleted =>
-- post_hashtags rows cascade; recompute on the join table itself, race-free).
create or replace function public.hashtag_recount_after_unlink()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.hashtags h
  set post_count = (select count(*) from public.post_hashtags ph where ph.hashtag_id = h.id)
  where h.id = OLD.hashtag_id;
  return OLD;
end;
$$;

drop trigger if exists on_post_hashtags_unlink on public.post_hashtags;
create trigger on_post_hashtags_unlink
  after delete on public.post_hashtags
  for each row execute function public.hashtag_recount_after_unlink();

-- =============================================================== search_hashtags (autocomplete)
create or replace function public.search_hashtags(q text)
returns table (tag text, post_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select h.tag, h.post_count
  from public.hashtags h
  where h.tag like (public.normalize_hashtag(q) || '%')
  order by h.post_count desc, h.tag asc
  limit 8;
$$;

revoke all on function public.search_hashtags(text) from public;
grant execute on function public.search_hashtags(text) to authenticated, service_role;

-- =============================================================== backfill existing posts
-- Populate hashtag links for the posts already in the table (plain-text "#word"
-- only; they have no content_rich). Done inline -- no fake UPDATE, so no
-- updated_at churn on historical rows. Mentions are intentionally NOT
-- backfilled: historical "@name" plain text carries no verifiable identity.
create temporary table _bf_clean on commit drop as
select distinct p.id as post_id, public.normalize_hashtag(m[1]) as tag
from public.posts p,
     lateral regexp_matches(p.content, '#([A-Za-z0-9_]{1,100})', 'g') as m
where p.content ~ '#[A-Za-z0-9_]';

delete from _bf_clean where tag is null;

insert into public.hashtags (tag)
select distinct tag from _bf_clean
on conflict (tag) do nothing;

insert into public.post_hashtags (post_id, hashtag_id)
select c.post_id, h.id
from _bf_clean c
join public.hashtags h on h.tag = c.tag
on conflict do nothing;

update public.hashtags h
set post_count = (select count(*) from public.post_hashtags ph where ph.hashtag_id = h.id);
