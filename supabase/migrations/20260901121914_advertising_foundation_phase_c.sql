-- =====================================================================
-- Phase C — Advertising database + RLS foundation
--
-- Schema only: tables, enums, FKs, indexes, timestamps, CHECK constraints,
-- ownership relationships, RLS (advertiser = company admin; reviewer = app
-- role 'admin'), and the SECURITY DEFINER ownership helpers RLS needs.
--
-- NO UI, NO delivery wiring, NO analytics rollup, NO billing, NO Feed
-- integration. Reuses companies / company_members / is_company_admin() /
-- has_role() / update_updated_at_column(). No duplicate identity/role/company
-- infrastructure is created.
-- =====================================================================

-- ---------- enums -----------------------------------------------------
do $$ begin
  create type public.ad_account_status as enum ('active', 'suspended', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.campaign_objective as enum (
    'brand_awareness', 'profile_visits', 'company_page_visits',
    'post_engagement', 'website_visits', 'job_promotion', 'lead_generation'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.campaign_status as enum (
    'draft', 'pending_review', 'approved', 'active', 'paused', 'completed', 'rejected'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ad_review_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ad_format as enum ('single_image', 'text', 'spotlight');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ad_placement as enum ('right_rail', 'feed_sponsored', 'company_page');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ad_bid_strategy as enum ('auto', 'max_cpc', 'max_cpm');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ad_event_type as enum ('impression', 'click');
exception when duplicate_object then null; end $$;

-- ---------- tables --------------------------------------------------------

-- Advertiser ad account. The advertiser IS an existing company; this is the
-- billing/reporting container bound to it (currency is locked after creation
-- by app logic in a later phase).
create table if not exists public.ad_accounts (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies(id) on delete cascade,
  name                  text not null,
  currency              text not null default 'USD' check (char_length(currency) = 3),
  timezone              text not null default 'UTC',
  status                public.ad_account_status not null default 'active',
  agreement_accepted_at timestamptz,
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (company_id, name)
);
create index if not exists ad_accounts_company_id_idx on public.ad_accounts (company_id);
create index if not exists ad_accounts_status_idx     on public.ad_accounts (status);

-- Saved anonymous audience segment. `spec` holds only aggregate filter
-- criteria; `estimated_reach` is a COUNT computed server-side later, never
-- user rows.
create table if not exists public.ad_audiences (
  id                 uuid primary key default gen_random_uuid(),
  ad_account_id      uuid not null references public.ad_accounts(id) on delete cascade,
  name               text not null,
  spec               jsonb not null default '{}'::jsonb,
  estimated_reach    integer check (estimated_reach is null or estimated_reach >= 0),
  estimated_reach_at timestamptz,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists ad_audiences_ad_account_id_idx on public.ad_audiences (ad_account_id);

create table if not exists public.campaigns (
  id                 uuid primary key default gen_random_uuid(),
  ad_account_id      uuid not null references public.ad_accounts(id) on delete cascade,
  name               text not null,
  objective          public.campaign_objective not null,
  status             public.campaign_status not null default 'draft',
  total_budget_cents  bigint not null default 0 check (total_budget_cents >= 0),
  daily_budget_cents  bigint check (daily_budget_cents is null or daily_budget_cents >= 0),
  start_at           timestamptz,
  end_at             timestamptz,
  submitted_at       timestamptz,
  reviewed_at        timestamptz,
  activated_at       timestamptz,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint campaigns_dates_chk check (start_at is null or end_at is null or end_at > start_at)
);
create index if not exists campaigns_ad_account_id_idx on public.campaigns (ad_account_id);
create index if not exists campaigns_status_idx        on public.campaigns (status);
create index if not exists campaigns_schedule_idx      on public.campaigns (status, start_at, end_at);

create table if not exists public.ad_sets (
  id                 uuid primary key default gen_random_uuid(),
  campaign_id        uuid not null references public.campaigns(id) on delete cascade,
  audience_id        uuid references public.ad_audiences(id) on delete set null,
  name               text not null,
  daily_budget_cents bigint check (daily_budget_cents is null or daily_budget_cents >= 0),
  bid_strategy       public.ad_bid_strategy not null default 'auto',
  bid_amount_cents   bigint check (bid_amount_cents is null or bid_amount_cents >= 0),
  placements         public.ad_placement[] not null default array['right_rail']::public.ad_placement[],
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists ad_sets_campaign_id_idx on public.ad_sets (campaign_id);
create index if not exists ad_sets_audience_id_idx on public.ad_sets (audience_id);

create table if not exists public.ads (
  id            uuid primary key default gen_random_uuid(),
  ad_set_id     uuid not null references public.ad_sets(id) on delete cascade,
  name          text not null,
  -- ad-level on/off within an approved ad; distinct from campaign lifecycle
  status        text not null default 'paused' check (status in ('active', 'paused', 'archived')),
  review_status public.ad_review_status not null default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists ads_ad_set_id_idx     on public.ads (ad_set_id);
create index if not exists ads_review_status_idx on public.ads (review_status);
create index if not exists ads_status_idx        on public.ads (status);

create table if not exists public.ad_creatives (
  id              uuid primary key default gen_random_uuid(),
  ad_id           uuid not null references public.ads(id) on delete cascade,
  format          public.ad_format not null default 'single_image',
  headline        text not null check (char_length(headline) between 1 and 200),
  body            text check (body is null or char_length(body) <= 600),
  media_url       text,
  media_type      text check (media_type is null or media_type in ('image', 'video')),
  cta_label       text check (cta_label is null or char_length(cta_label) <= 40),
  destination_url text check (destination_url is null or destination_url ~ '^https?://'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists ad_creatives_ad_id_idx on public.ad_creatives (ad_id);

-- Reviewer decisions. Insert restricted to app-role 'admin' via RLS.
create table if not exists public.ad_reviews (
  id               uuid primary key default gen_random_uuid(),
  ad_id            uuid not null references public.ads(id) on delete cascade,
  reviewer_user_id uuid not null default auth.uid() references auth.users(id) on delete set null,
  decision         public.ad_review_status not null check (decision in ('approved', 'rejected')),
  reason           text,
  created_at       timestamptz not null default now()
);
create index if not exists ad_reviews_ad_id_idx            on public.ad_reviews (ad_id);
create index if not exists ad_reviews_reviewer_user_id_idx on public.ad_reviews (reviewer_user_id);

-- Raw delivery events. NOT client-writable and NOT client-readable — RLS is
-- enabled with NO policies, so only future SECURITY DEFINER delivery/record
-- functions (which bypass RLS) can touch this table. `dedup_key` prevents
-- double counting.
create table if not exists public.ad_delivery_events (
  id                uuid primary key default gen_random_uuid(),
  ad_id             uuid not null references public.ads(id) on delete cascade,
  ad_set_id         uuid not null references public.ad_sets(id) on delete cascade,
  campaign_id       uuid not null references public.campaigns(id) on delete cascade,
  ad_account_id     uuid not null references public.ad_accounts(id) on delete cascade,
  event_type        public.ad_event_type not null,
  placement         public.ad_placement not null,
  viewer_profile_id uuid references public.profiles(id) on delete set null,
  session_key       text not null,
  dedup_key         text not null unique,
  occurred_at       timestamptz not null default now()
);
create index if not exists ad_delivery_events_ad_idx       on public.ad_delivery_events (ad_id, occurred_at);
create index if not exists ad_delivery_events_campaign_idx on public.ad_delivery_events (campaign_id, occurred_at);
create index if not exists ad_delivery_events_account_idx  on public.ad_delivery_events (ad_account_id, occurred_at);

-- Aggregated per-ad daily rollup. Read-only to the owning company + reviewers;
-- populated by a scheduled SECURITY DEFINER function in a later phase.
create table if not exists public.ad_daily_metrics (
  id            uuid primary key default gen_random_uuid(),
  ad_id         uuid not null references public.ads(id) on delete cascade,
  ad_account_id uuid not null references public.ad_accounts(id) on delete cascade,
  day           date not null,
  impressions   bigint not null default 0 check (impressions >= 0),
  clicks        bigint not null default 0 check (clicks >= 0),
  reach         bigint not null default 0 check (reach >= 0),
  spend_cents   bigint not null default 0 check (spend_cents >= 0),
  updated_at    timestamptz not null default now(),
  unique (ad_id, day)
);
create index if not exists ad_daily_metrics_account_day_idx on public.ad_daily_metrics (ad_account_id, day);

-- ---------- updated_at triggers (reuse existing helper) -----------------
do $$
declare t text;
begin
  foreach t in array array[
    'ad_accounts','ad_audiences','campaigns','ad_sets','ads','ad_creatives','ad_daily_metrics'
  ]
  loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I;
       create trigger set_updated_at before update on public.%I
       for each row execute function public.update_updated_at_column();', t, t);
  end loop;
end $$;

-- ---------- ownership helper functions (for RLS; non-recursive) ---------
create or replace function public.is_ad_account_admin(_ad_account_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_company_admin(
    auth.uid(),
    (select company_id from public.ad_accounts where id = _ad_account_id)
  );
$$;

create or replace function public.is_campaign_admin(_campaign_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_ad_account_admin(
    (select ad_account_id from public.campaigns where id = _campaign_id)
  );
$$;

create or replace function public.is_ad_set_admin(_ad_set_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_campaign_admin(
    (select campaign_id from public.ad_sets where id = _ad_set_id)
  );
$$;

create or replace function public.is_ad_admin(_ad_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_ad_set_admin(
    (select ad_set_id from public.ads where id = _ad_id)
  );
$$;

create or replace function public.ad_daily_metrics_is_owner(_ad_account_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_ad_account_admin(_ad_account_id);
$$;

grant execute on function public.is_ad_account_admin(uuid)        to authenticated;
grant execute on function public.is_campaign_admin(uuid)          to authenticated;
grant execute on function public.is_ad_set_admin(uuid)            to authenticated;
grant execute on function public.is_ad_admin(uuid)                to authenticated;
grant execute on function public.ad_daily_metrics_is_owner(uuid)  to authenticated;

-- ---------- lifecycle guard --------------------------------------------
-- Direct client changes to campaign lifecycle status and ad review status
-- are blocked from day one — those transitions will only ever happen through
-- SECURITY DEFINER RPCs (Phase H) that set `ad.bypass_status_guard`.
create or replace function public.ad_status_guard()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('ad.bypass_status_guard', true), '') = 'on' then
    return new;
  end if;
  if tg_table_name = 'campaigns' and new.status is distinct from old.status then
    raise exception 'campaign status transitions must go through a state-transition function';
  end if;
  if tg_table_name = 'ads' and new.review_status is distinct from old.review_status then
    raise exception 'ad review status is set by the review workflow, not directly';
  end if;
  return new;
end $$;

drop trigger if exists ad_status_guard_campaigns on public.campaigns;
create trigger ad_status_guard_campaigns before update on public.campaigns
  for each row execute function public.ad_status_guard();

drop trigger if exists ad_status_guard_ads on public.ads;
create trigger ad_status_guard_ads before update on public.ads
  for each row execute function public.ad_status_guard();

-- ---------- RLS -------------------------------------------------------------
alter table public.ad_accounts        enable row level security;
alter table public.ad_audiences       enable row level security;
alter table public.campaigns          enable row level security;
alter table public.ad_sets            enable row level security;
alter table public.ads                enable row level security;
alter table public.ad_creatives       enable row level security;
alter table public.ad_reviews         enable row level security;
alter table public.ad_daily_metrics   enable row level security;
alter table public.ad_delivery_events enable row level security;  -- NO policies: locked to SECURITY DEFINER only

-- ad_accounts
create policy ad_accounts_advertiser_all on public.ad_accounts
  for all to authenticated
  using (public.is_company_admin(auth.uid(), company_id))
  with check (public.is_company_admin(auth.uid(), company_id));
create policy ad_accounts_reviewer_select on public.ad_accounts
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ad_audiences
create policy ad_audiences_advertiser_all on public.ad_audiences
  for all to authenticated
  using (public.is_ad_account_admin(ad_account_id))
  with check (public.is_ad_account_admin(ad_account_id));
create policy ad_audiences_reviewer_select on public.ad_audiences
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- campaigns
create policy campaigns_advertiser_all on public.campaigns
  for all to authenticated
  using (public.is_ad_account_admin(ad_account_id))
  with check (public.is_ad_account_admin(ad_account_id));
create policy campaigns_reviewer_select on public.campaigns
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ad_sets
create policy ad_sets_advertiser_all on public.ad_sets
  for all to authenticated
  using (public.is_campaign_admin(campaign_id))
  with check (public.is_campaign_admin(campaign_id));
create policy ad_sets_reviewer_select on public.ad_sets
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ads
create policy ads_advertiser_all on public.ads
  for all to authenticated
  using (public.is_ad_set_admin(ad_set_id))
  with check (public.is_ad_set_admin(ad_set_id));
create policy ads_reviewer_select on public.ads
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ad_creatives
create policy ad_creatives_advertiser_all on public.ad_creatives
  for all to authenticated
  using (public.is_ad_admin(ad_id))
  with check (public.is_ad_admin(ad_id));
create policy ad_creatives_reviewer_select on public.ad_creatives
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ad_reviews: advertiser may READ its own ads' reviews; only reviewers write.
create policy ad_reviews_advertiser_select on public.ad_reviews
  for select to authenticated
  using (public.is_ad_admin(ad_id));
create policy ad_reviews_reviewer_select on public.ad_reviews
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy ad_reviews_reviewer_insert on public.ad_reviews
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin') and reviewer_user_id = auth.uid());

-- ad_daily_metrics: read-only to the owning company + reviewers. No client writes.
create policy ad_daily_metrics_owner_select on public.ad_daily_metrics
  for select to authenticated
  using (public.ad_daily_metrics_is_owner(ad_account_id) or public.has_role(auth.uid(), 'admin'));

-- =====================================================================
-- End Phase C.
-- =====================================================================
