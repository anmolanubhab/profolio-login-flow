-- Profolio Insights — Phase 2: feed integration + notifications
--
-- 1. posts gains an 'insight' post_type + a nullable FK to insight_articles.
--    Publishing an article creates ONE feed post (idempotent via a partial
--    unique index); unpublishing hides it (status='draft'); deleting the
--    article removes it via ON DELETE CASCADE.
-- 2. Two SECURITY DEFINER trigger functions matching the existing notify_*
--    convention:
--      - sync_insight_article_publish(): on draft->published, upsert the feed
--        post, flip the parent insight to published, and notify subscribers
--        (never the author). On published->draft, hide the feed post.
--      - notify_insight_subscription(): on a new follow, notify the owner
--        (never self-notify).
--    No change to the client-facing notifications INSERT policy — inserts are
--    done by these definer triggers, exactly like every other notify_* path.

-- ---------------------------------------------------------------- posts schema
alter table public.posts drop constraint if exists posts_post_type_check;
alter table public.posts add constraint posts_post_type_check
  check (post_type = any (array['text','poll','carousel','document','video','insight']));

alter table public.posts
  add column if not exists insight_article_id uuid
  references public.insight_articles(id) on delete cascade;

-- one feed post per article, and a fast lookup for the reading page
create unique index if not exists posts_insight_article_id_uidx
  on public.posts (insight_article_id)
  where insight_article_id is not null;

-- ---------------------------------------------------- publish -> feed + notify
create or replace function public.sync_insight_article_publish()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  author_uid uuid;
  ins        public.insights%rowtype;
  new_post_id uuid;
  author_name text;
  author_avatar text;
  became_published   boolean;
  became_unpublished boolean;
begin
  select * into ins from public.insights where id = NEW.insight_id;
  select user_id into author_uid from public.profiles where id = NEW.author_id;
  select coalesce(display_name, full_name, 'Someone'), avatar_url
    into author_name, author_avatar
    from public.profiles where id = NEW.author_id;

  became_published := NEW.status = 'published'
    and (TG_OP = 'INSERT' or OLD.status is distinct from 'published');
  became_unpublished := TG_OP = 'UPDATE'
    and OLD.status = 'published' and NEW.status is distinct from 'published';

  if became_published then
    -- feed representation (idempotent)
    insert into public.posts (user_id, content, image_url, post_type, status, posted_as, insight_article_id)
    values (author_uid, NEW.title, NEW.cover_url, 'insight', 'published', 'user', NEW.id)
    on conflict (insight_article_id) where insight_article_id is not null do update
      set content = excluded.content,
          image_url = excluded.image_url,
          status = 'published'
    returning id into new_post_id;

    -- keep the parent Insight in sync
    if ins.status is distinct from 'published' then
      update public.insights
        set status = 'published',
            published_at = coalesce(published_at, now())
        where id = NEW.insight_id;
    end if;

    -- notify every follower except the author; fires only on the
    -- draft->published transition, so no duplicate blasts on later edits
    insert into public.notifications (user_id, type, payload)
    select s.subscriber_id, 'insight_published',
      jsonb_build_object(
        'sender_name', author_name,
        'sender_avatar', author_avatar,
        'insight_slug', ins.slug,
        'insight_title', ins.title,
        'article_slug', NEW.slug,
        'article_title', NEW.title,
        'post_id', new_post_id
      )
    from public.insight_subscriptions s
    where s.insight_id = NEW.insight_id
      and s.subscriber_id <> NEW.author_id;

  elsif became_unpublished then
    -- hide from the feed but keep the row (and its reactions/comments) so an
    -- unpublish -> republish cycle doesn't lose engagement. Deleting the
    -- article itself still removes the post via ON DELETE CASCADE.
    update public.posts set status = 'draft' where insight_article_id = NEW.id;
  end if;

  return NEW;
end
$$;

drop trigger if exists insight_article_publish_sync on public.insight_articles;
create trigger insight_article_publish_sync
  after insert or update of status on public.insight_articles
  for each row execute function public.sync_insight_article_publish();

-- --------------------------------------------------- new subscriber -> notify
create or replace function public.notify_insight_subscription()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  ins public.insights%rowtype;
  sub public.profiles%rowtype;
begin
  select * into ins from public.insights where id = NEW.insight_id;
  if ins.owner_id is null or ins.owner_id = NEW.subscriber_id then
    return NEW;
  end if;
  select * into sub from public.profiles where id = NEW.subscriber_id;

  insert into public.notifications (user_id, type, payload)
  values (ins.owner_id, 'insight_new_subscriber',
    jsonb_build_object(
      'sender_name', coalesce(sub.display_name, sub.full_name, 'Someone'),
      'sender_avatar', sub.avatar_url,
      'insight_slug', ins.slug,
      'insight_title', ins.title
    ));
  return NEW;
end
$$;

drop trigger if exists insight_subscription_notify on public.insight_subscriptions;
create trigger insight_subscription_notify
  after insert on public.insight_subscriptions
  for each row execute function public.notify_insight_subscription();

-- Trigger functions are never invoked via PostgREST /rpc/ — drop the default
-- PUBLIC execute grant so the API surface and linter stay clean.
revoke execute on function public.sync_insight_article_publish() from public, anon, authenticated;
revoke execute on function public.notify_insight_subscription()   from public, anon, authenticated;
