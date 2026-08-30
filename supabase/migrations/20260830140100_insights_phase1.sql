-- Profolio Insights — Phase 1 core schema
--
-- User-facing feature name: "Insights". Internal identifiers use insight_*.
-- Greenfield: no prior newsletter/insight/article/publication tables exist.
--
-- Entities:
--   insights              -- a publication owned by one profile
--   insight_articles      -- individual issues/articles inside an insight
--   insight_subscriptions -- "Follow / Get updates" relation (NOT the Stripe
--                            `subscriptions` table, which is billing)
--
-- Identity: owner_id / author_id / subscriber_id all reference profiles(id),
-- matching followers / post_reactions / notifications conventions. RLS uses the
-- existing public.current_profile_id() helper (STABLE SECURITY DEFINER).

-- ============================================================ insights
create table if not exists public.insights (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  slug         text not null,
  description  text,
  cover_url    text,
  status       text not null default 'draft',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz,
  constraint insights_title_len       check (char_length(title) between 1 and 120),
  constraint insights_description_len check (description is null or char_length(description) <= 400),
  constraint insights_status_check    check (status in ('draft', 'published')),
  constraint insights_slug_unique     unique (slug)
);

create index if not exists insights_owner_id_idx
  on public.insights (owner_id);
create index if not exists insights_status_published_at_idx
  on public.insights (status, published_at desc);

-- ============================================================ insight_articles
create table if not exists public.insight_articles (
  id              uuid primary key default gen_random_uuid(),
  insight_id      uuid not null references public.insights(id) on delete cascade,
  author_id       uuid not null references public.profiles(id) on delete cascade,
  title           text not null,
  subtitle        text,
  slug            text not null,
  cover_url       text,
  -- Canonical content: Tiptap JSON document. body_html is a sanitized render
  -- cache only, never the source of truth.
  body            jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  body_html       text,
  reading_minutes integer,
  status          text not null default 'draft',
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint insight_articles_title_len    check (char_length(title) between 1 and 160),
  constraint insight_articles_subtitle_len check (subtitle is null or char_length(subtitle) <= 200),
  constraint insight_articles_status_check check (status in ('draft', 'published')),
  constraint insight_articles_slug_unique  unique (insight_id, slug)
);

create index if not exists insight_articles_insight_id_idx
  on public.insight_articles (insight_id);
create index if not exists insight_articles_author_id_idx
  on public.insight_articles (author_id);
create index if not exists insight_articles_status_published_at_idx
  on public.insight_articles (status, published_at desc);

-- ============================================================ insight_subscriptions
create table if not exists public.insight_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  insight_id    uuid not null references public.insights(id) on delete cascade,
  subscriber_id uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  constraint insight_subscriptions_unique unique (insight_id, subscriber_id)
);

create index if not exists insight_subscriptions_insight_id_idx
  on public.insight_subscriptions (insight_id);
create index if not exists insight_subscriptions_subscriber_id_idx
  on public.insight_subscriptions (subscriber_id);

-- ============================================================ updated_at triggers
drop trigger if exists insights_set_updated_at on public.insights;
create trigger insights_set_updated_at
  before update on public.insights
  for each row execute function public.update_updated_at_column();

drop trigger if exists insight_articles_set_updated_at on public.insight_articles;
create trigger insight_articles_set_updated_at
  before update on public.insight_articles
  for each row execute function public.update_updated_at_column();

-- ============================================================ subscriber count
-- insight_subscriptions SELECT is restricted (own rows / owner). Public pages
-- need an aggregate count without exposing who subscribed -> SECURITY DEFINER.
create or replace function public.insight_subscriber_count(_insight_id uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select count(*)::int from public.insight_subscriptions where insight_id = _insight_id;
$$;

grant execute on function public.insight_subscriber_count(uuid) to anon, authenticated;

-- ============================================================ RLS
alter table public.insights              enable row level security;
alter table public.insight_articles      enable row level security;
alter table public.insight_subscriptions enable row level security;

-- ---- insights
drop policy if exists insights_select_visible on public.insights;
create policy insights_select_visible on public.insights
  for select
  using (status = 'published' or owner_id = public.current_profile_id());

drop policy if exists insights_insert_own on public.insights;
create policy insights_insert_own on public.insights
  for insert
  with check (owner_id = public.current_profile_id());

drop policy if exists insights_update_own on public.insights;
create policy insights_update_own on public.insights
  for update
  using (owner_id = public.current_profile_id())
  with check (owner_id = public.current_profile_id());

drop policy if exists insights_delete_own on public.insights;
create policy insights_delete_own on public.insights
  for delete
  using (owner_id = public.current_profile_id());

-- ---- insight_articles
drop policy if exists insight_articles_select_visible on public.insight_articles;
create policy insight_articles_select_visible on public.insight_articles
  for select
  using (
    (status = 'published'
      and exists (select 1 from public.insights i
                  where i.id = insight_articles.insight_id and i.status = 'published'))
    or author_id = public.current_profile_id()
    or exists (select 1 from public.insights i
               where i.id = insight_articles.insight_id
                 and i.owner_id = public.current_profile_id())
  );

drop policy if exists insight_articles_insert_own on public.insight_articles;
create policy insight_articles_insert_own on public.insight_articles
  for insert
  with check (
    author_id = public.current_profile_id()
    and exists (select 1 from public.insights i
                where i.id = insight_articles.insight_id
                  and i.owner_id = public.current_profile_id())
  );

drop policy if exists insight_articles_update_own on public.insight_articles;
create policy insight_articles_update_own on public.insight_articles
  for update
  using (exists (select 1 from public.insights i
                 where i.id = insight_articles.insight_id
                   and i.owner_id = public.current_profile_id()))
  with check (exists (select 1 from public.insights i
                      where i.id = insight_articles.insight_id
                        and i.owner_id = public.current_profile_id()));

drop policy if exists insight_articles_delete_own on public.insight_articles;
create policy insight_articles_delete_own on public.insight_articles
  for delete
  using (exists (select 1 from public.insights i
                 where i.id = insight_articles.insight_id
                   and i.owner_id = public.current_profile_id()));

-- ---- insight_subscriptions
drop policy if exists insight_subscriptions_select_visible on public.insight_subscriptions;
create policy insight_subscriptions_select_visible on public.insight_subscriptions
  for select
  using (
    subscriber_id = public.current_profile_id()
    or exists (select 1 from public.insights i
               where i.id = insight_subscriptions.insight_id
                 and i.owner_id = public.current_profile_id())
  );

drop policy if exists insight_subscriptions_insert_own on public.insight_subscriptions;
create policy insight_subscriptions_insert_own on public.insight_subscriptions
  for insert
  with check (subscriber_id = public.current_profile_id());

drop policy if exists insight_subscriptions_delete_own on public.insight_subscriptions;
create policy insight_subscriptions_delete_own on public.insight_subscriptions
  for delete
  using (subscriber_id = public.current_profile_id());
