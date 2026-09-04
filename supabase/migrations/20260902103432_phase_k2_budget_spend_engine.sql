-- =====================================================================
-- Phase K2 — Campaign Budget + Spend Engine
--
-- Adds an INTERNAL advertising-spend ledger and budget pacing on top of
-- the Phase I delivery engine and Phase J analytics. NO real money moves:
-- no payment provider, no charges, no payment intents, no balance
-- deduction, no invoices from spend. That is K3.
--
-- Chain wired up here:
--   delivery event  ->  billable event  ->  cost (micros)  ->  campaign
--   daily spend  ->  remaining budget  ->  delivery eligibility  ->  Phase J
--
-- Budget fields already exist and are REUSED:
--   campaigns.daily_budget_cents   (daily budget)
--   campaigns.total_budget_cents   (lifetime / total budget)
--   campaigns.start_at / end_at    (schedule)
--   ad_sets.bid_strategy           (ad_bid_strategy: auto | max_cpc | max_cpm)
--   ad_sets.bid_amount_cents       (manual bid / cost cap amount)
-- Currency is inherited from ad_accounts.currency (never stored per campaign).
--
-- Money precision: the ledger stores cost in CURRENCY MICROS
--   1 major unit = 100 cents = 1,000,000 micros  =>  1 cent = 10,000 micros
-- Rollup to ad_daily_metrics.spend_cents = round(micros / 10000).
--
-- Pricing model (PROFOLIO K2 IMPLEMENTATION CHOICE — not LinkedIn's real
-- auction pricing, which is auction-determined and was not live-auditable):
--   * bid_strategy 'max_cpc' + bid_amount_cents  -> charge per CLICK
--   * bid_strategy 'max_cpm' + bid_amount_cents  -> charge per 1000 IMPRESSIONS
--   * bid_strategy 'auto' (or no bid amount)     -> flat default CPM from the
--                                                   server-side rate card
-- Deterministic and flat. No auction, no competitive bidding (later phase).
-- =====================================================================

-- ---------- rate card (single row; the only place a "price" is defined) ----
create table public.ad_spend_rate_card (
  id                 smallint primary key default 1 check (id = 1),
  default_cpm_cents  bigint not null default 600  check (default_cpm_cents >= 0),
  min_bid_cpc_cents  bigint not null default 100  check (min_bid_cpc_cents >= 0),
  min_bid_cpm_cents  bigint not null default 200  check (min_bid_cpm_cents >= 0),
  notes              text,
  updated_at         timestamptz not null default now()
);
insert into public.ad_spend_rate_card (id, notes)
values (1, 'Profolio K2 internal spend rate card. Flat pricing, not an auction. default_cpm_cents applies to bid_strategy=auto.');

alter table public.ad_spend_rate_card enable row level security;
create policy ad_spend_rate_card_read on public.ad_spend_rate_card
  for select to authenticated using (true);
revoke all on public.ad_spend_rate_card from anon;

-- ---------- spend ledger: one row per BILLABLE delivery event -----------
create table public.ad_spend_events (
  id                 uuid primary key default gen_random_uuid(),
  delivery_event_id  uuid not null unique references public.ad_delivery_events(id) on delete cascade,
  ad_account_id      uuid not null references public.ad_accounts(id) on delete cascade,
  campaign_id        uuid not null references public.campaigns(id) on delete cascade,
  ad_set_id          uuid not null references public.ad_sets(id) on delete cascade,
  ad_id              uuid not null references public.ads(id) on delete cascade,
  event_type         public.ad_event_type not null,
  chargeable         boolean not null,
  rate_model         text not null,            -- 'cpc' | 'cpm' | 'cpm_default'
  unit_cost_micros   bigint not null check (unit_cost_micros >= 0),
  cost_micros        bigint not null check (cost_micros >= 0),
  currency           text not null,
  occurred_at        timestamptz not null,
  created_at         timestamptz not null default now()
);
create index ad_spend_events_campaign_idx on public.ad_spend_events (campaign_id, occurred_at);
create index ad_spend_events_account_idx  on public.ad_spend_events (ad_account_id, occurred_at);
create index ad_spend_events_ad_idx       on public.ad_spend_events (ad_id, occurred_at);
alter table public.ad_spend_events enable row level security;

-- advertiser sees spend for their own campaigns; platform admin sees all
create policy ad_spend_events_owner_select on public.ad_spend_events
  for select to authenticated
  using (public.is_campaign_admin(campaign_id) or public.has_role(auth.uid(), 'admin'));
revoke all on public.ad_spend_events from anon;

-- ---------- per-campaign per-day spend rollup (pacing + analytics) ------
create table public.ad_campaign_spend_daily (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.campaigns(id) on delete cascade,
  ad_account_id  uuid not null references public.ad_accounts(id) on delete cascade,
  day            date not null,
  spend_micros   bigint not null default 0 check (spend_micros >= 0),
  impressions    bigint not null default 0 check (impressions >= 0),   -- billable impressions
  clicks         bigint not null default 0 check (clicks >= 0),        -- billable clicks
  currency       text not null,
  updated_at     timestamptz not null default now(),
  unique (campaign_id, day)
);
create index ad_campaign_spend_daily_account_idx on public.ad_campaign_spend_daily (ad_account_id, day);
alter table public.ad_campaign_spend_daily enable row level security;

create policy ad_campaign_spend_daily_owner_select on public.ad_campaign_spend_daily
  for select to authenticated
  using (public.is_campaign_admin(campaign_id) or public.has_role(auth.uid(), 'admin'));
revoke all on public.ad_campaign_spend_daily from anon;

-- ---------- ad_sets bid sanity constraint -----------------------------
alter table public.ad_sets
  add constraint ad_sets_bid_amount_positive_chk
  check (bid_amount_cents is null or bid_amount_cents > 0);

-- ---------- cost model ------------------------------------------------
-- Returns how a single event of the given kind is priced under the ad
-- set's bid strategy. Internal — only the spend recorder calls it.
create or replace function public._ad_event_cost(
  _bid_strategy public.ad_bid_strategy,
  _bid_amount_cents bigint,
  _kind public.ad_event_type
)
returns table (rate_model text, unit_cost_micros bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _default_cpm bigint;
begin
  select default_cpm_cents into _default_cpm from public.ad_spend_rate_card where id = 1;
  _default_cpm := coalesce(_default_cpm, 600);

  if _bid_strategy = 'max_cpc' then
    if _kind = 'click' and coalesce(_bid_amount_cents, 0) > 0 then
      return query select 'cpc', _bid_amount_cents * 10000;      -- cents -> micros
    else
      return query select 'cpc', 0::bigint;
    end if;
  elsif _bid_strategy = 'max_cpm' then
    if _kind = 'impression' and coalesce(_bid_amount_cents, 0) > 0 then
      return query select 'cpm', _bid_amount_cents * 10;         -- cents/1000 -> micros/1
    else
      return query select 'cpm', 0::bigint;
    end if;
  else  -- 'auto' : flat default CPM
    if _kind = 'impression' then
      return query select 'cpm_default', _default_cpm * 10;
    else
      return query select 'cpm_default', 0::bigint;
    end if;
  end if;
end;
$$;

-- ---------- spend recorder -----------------------------------------
-- Bills exactly one delivery event, idempotently. Called only by
-- _ad_record_event after a NEW ad_delivery_events row is inserted.
create or replace function public._ad_spend_record(_delivery_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _e public.ad_delivery_events;
  _s public.ad_sets;
  _cur text;
  _model text;
  _unit bigint;
  _day date;
begin
  select * into _e from public.ad_delivery_events where id = _delivery_event_id;
  if not found then return; end if;

  -- idempotency: this delivery event is billed at most once
  if exists (select 1 from public.ad_spend_events se where se.delivery_event_id = _delivery_event_id) then
    return;
  end if;

  select s.* into _s from public.ad_sets s where s.id = _e.ad_set_id;
  select ac.currency into _cur from public.ad_accounts ac where ac.id = _e.ad_account_id;

  select rate_model, unit_cost_micros into _model, _unit
  from public._ad_event_cost(_s.bid_strategy, _s.bid_amount_cents, _e.event_type);
  _unit := coalesce(_unit, 0);

  -- serialize spend accrual for this campaign (no lost updates / double count)
  perform 1 from public.campaigns where id = _e.campaign_id for update;

  insert into public.ad_spend_events
    (delivery_event_id, ad_account_id, campaign_id, ad_set_id, ad_id, event_type,
     chargeable, rate_model, unit_cost_micros, cost_micros, currency, occurred_at)
  values
    (_delivery_event_id, _e.ad_account_id, _e.campaign_id, _e.ad_set_id, _e.ad_id, _e.event_type,
     (_unit > 0), _model, _unit, _unit, coalesce(_cur, 'USD'), _e.occurred_at)
  on conflict (delivery_event_id) do nothing;

  if not found then return; end if;   -- lost the idempotency race — nothing to accrue

  _day := (_e.occurred_at at time zone 'UTC')::date;
  insert into public.ad_campaign_spend_daily
    (campaign_id, ad_account_id, day, spend_micros, impressions, clicks, currency)
  values
    (_e.campaign_id, _e.ad_account_id, _day, _unit,
     case when _e.event_type = 'impression' and _unit > 0 then 1 else 0 end,
     case when _e.event_type = 'click' and _unit > 0 then 1 else 0 end,
     coalesce(_cur, 'USD'))
  on conflict (campaign_id, day) do update
    set spend_micros = public.ad_campaign_spend_daily.spend_micros + excluded.spend_micros,
        impressions  = public.ad_campaign_spend_daily.impressions + excluded.impressions,
        clicks       = public.ad_campaign_spend_daily.clicks + excluded.clicks,
        updated_at   = now();
end;
$$;

-- ---------- budget / pacing gate ---------------------------------
-- True when the campaign still has daily + total budget headroom and its
-- billing is not restricted. Used by feed_pick_sponsored_ad.
create or replace function public._ad_campaign_deliverable(_campaign_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _c public.campaigns;
  _bs public.ad_billing_profile_status;
  _today date := (now() at time zone 'UTC')::date;
  _today_spend bigint;
  _total_spend bigint;
begin
  select * into _c from public.campaigns where id = _campaign_id;
  if not found then return false; end if;

  select status into _bs from public.ad_billing_profiles where ad_account_id = _c.ad_account_id;
  if _bs = 'restricted' then return false; end if;

  if _c.daily_budget_cents is not null then
    select coalesce(spend_micros, 0) into _today_spend
    from public.ad_campaign_spend_daily where campaign_id = _campaign_id and day = _today;
    if coalesce(_today_spend, 0) >= _c.daily_budget_cents::bigint * 10000 then
      return false;
    end if;
  end if;

  if coalesce(_c.total_budget_cents, 0) > 0 then
    select coalesce(sum(spend_micros), 0) into _total_spend
    from public.ad_campaign_spend_daily where campaign_id = _campaign_id;
    if coalesce(_total_spend, 0) >= _c.total_budget_cents::bigint * 10000 then
      return false;
    end if;
  end if;

  return true;
end;
$$;

-- ---------- campaign budget status (advertiser-facing) -----------
create or replace function public.ad_campaign_budget_status(_campaign_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _c public.campaigns;
  _cur text;
  _today date := (now() at time zone 'UTC')::date;
  _spend_today bigint;
  _spend_total bigint;
  _daily_cap bigint;
  _total_cap bigint;
  _daily_remaining bigint;
  _total_remaining bigint;
  _state text;
begin
  select * into _c from public.campaigns where id = _campaign_id;
  if not found then raise exception 'campaign not found' using errcode = 'P0002'; end if;
  if not (public.is_campaign_admin(_campaign_id) or public.has_role(auth.uid(), 'admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select ac.currency into _cur from public.ad_accounts ac where ac.id = _c.ad_account_id;

  select coalesce(spend_micros, 0) into _spend_today
    from public.ad_campaign_spend_daily where campaign_id = _campaign_id and day = _today;
  select coalesce(sum(spend_micros), 0) into _spend_total
    from public.ad_campaign_spend_daily where campaign_id = _campaign_id;
  _spend_today := coalesce(_spend_today, 0);
  _spend_total := coalesce(_spend_total, 0);

  _daily_cap := case when _c.daily_budget_cents is null then null else _c.daily_budget_cents::bigint * 10000 end;
  _total_cap := case when coalesce(_c.total_budget_cents, 0) > 0 then _c.total_budget_cents::bigint * 10000 else null end;
  _daily_remaining := case when _daily_cap is null then null else greatest(_daily_cap - _spend_today, 0) end;
  _total_remaining := case when _total_cap is null then null else greatest(_total_cap - _spend_total, 0) end;

  _state := case
    when _daily_cap is null and _total_cap is null then 'no_budget'
    when _c.status = 'paused' then 'paused'
    when _c.end_at is not null and _c.end_at <= now() then 'ended'
    when _total_cap is not null and _spend_total >= _total_cap then 'budget_exhausted'
    when _daily_cap is not null and _spend_today >= _daily_cap then 'daily_exhausted'
    when _c.start_at is not null and _c.start_at > now() then 'scheduled'
    when _c.status <> 'active' then 'inactive'
    when _spend_total > 0 then 'spending'
    else 'active_no_spend'
  end;

  return jsonb_build_object(
    'currency', coalesce(_cur, 'USD'),
    'daily_budget_micros', _daily_cap,
    'total_budget_micros', _total_cap,
    'spend_today_micros', _spend_today,
    'spend_total_micros', _spend_total,
    'daily_remaining_micros', _daily_remaining,
    'total_remaining_micros', _total_remaining,
    'pacing_state', _state
  );
end;
$$;

-- ---------- advisory budget validation (UI) ---------------------
create or replace function public.validate_campaign_budget(_campaign_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _c public.campaigns;
  _s public.ad_sets;
  _issues text[] := array[]::text[];
  _rc public.ad_spend_rate_card;
begin
  select * into _c from public.campaigns where id = _campaign_id;
  if not found then raise exception 'campaign not found' using errcode = 'P0002'; end if;
  if not (public.is_campaign_admin(_campaign_id) or public.has_role(auth.uid(), 'admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select * into _rc from public.ad_spend_rate_card where id = 1;
  select s.* into _s from public.ad_sets s where s.campaign_id = _campaign_id order by s.created_at limit 1;

  if _c.daily_budget_cents is null and coalesce(_c.total_budget_cents, 0) <= 0 then
    _issues := _issues || 'Set a daily budget, a total budget, or both.';
  end if;
  if _c.daily_budget_cents is not null and _c.daily_budget_cents <= 0 then
    _issues := _issues || 'Daily budget must be greater than 0.';
  end if;
  if _c.total_budget_cents is not null and _c.total_budget_cents < 0 then
    _issues := _issues || 'Total budget cannot be negative.';
  end if;
  if _c.daily_budget_cents is not null and coalesce(_c.total_budget_cents, 0) > 0
     and _c.total_budget_cents < _c.daily_budget_cents then
    _issues := _issues || 'Total budget should be at least one day of the daily budget.';
  end if;
  if _c.end_at is not null and _c.end_at <= now() then
    _issues := _issues || 'The end date is in the past.';
  end if;
  if _s.id is not null and _s.bid_strategy in ('max_cpc', 'max_cpm') then
    if coalesce(_s.bid_amount_cents, 0) <= 0 then
      _issues := _issues || 'Manual bidding needs a bid amount.';
    elsif _s.bid_strategy = 'max_cpc' and _s.bid_amount_cents < _rc.min_bid_cpc_cents then
      _issues := _issues || 'Bid is below the minimum allowed for cost-per-click.';
    elsif _s.bid_strategy = 'max_cpm' and _s.bid_amount_cents < _rc.min_bid_cpm_cents then
      _issues := _issues || 'Bid is below the minimum allowed for cost-per-1000-impressions.';
    end if;
  end if;

  return jsonb_build_object('ok', array_length(_issues, 1) is null, 'issues', to_jsonb(_issues));
end;
$$;

-- ---------- rewire Phase I: budget-aware event recording -----------
create or replace function public._ad_record_event(_ad_id uuid, _session_key text, _kind public.ad_event_type)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _me uuid := public.current_profile_id();
  _s public.ad_sets;
  _c public.campaigns;
  _sk text := left(coalesce(_session_key, ''), 64);
  _bucket text;
  _ev_id uuid;
begin
  if not public._ad_delivery_eligible_for(_ad_id, _me) then
    raise exception 'ad is not deliverable to you' using errcode = '42501';
  end if;
  select s.* into _s from public.ad_sets s join public.ads a on a.ad_set_id = s.id where a.id = _ad_id;
  select c.* into _c from public.campaigns c where c.id = _s.campaign_id;
  _bucket := case when _kind = 'impression'
                  then to_char(date_trunc('hour', now()), 'YYYYMMDDHH24')
                  else to_char(date_trunc('minute', now()), 'YYYYMMDDHH24MI') end;

  insert into public.ad_delivery_events
    (ad_id, ad_set_id, campaign_id, ad_account_id, event_type, placement, viewer_profile_id, session_key, dedup_key)
  values
    (_ad_id, _s.id, _c.id, _c.ad_account_id, _kind, 'feed_sponsored', _me, _sk,
     _kind::text || ':' || _ad_id || ':' || _me || ':' || nullif(_sk, '') || ':' || _bucket)
  on conflict (dedup_key) do nothing
  returning id into _ev_id;

  -- only a genuinely new (non-deduped) event is billed
  if _ev_id is not null then
    perform public._ad_spend_record(_ev_id);
  end if;
end;
$$;

-- ---------- rewire Phase I: budget-aware ad selection --------------
create or replace function public.feed_pick_sponsored_ad(_session_key text)
returns table(ad_id uuid, format public.ad_format, headline text, body text, cta_label text,
              destination_url text, media_url text, sponsor_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _me uuid := public.current_profile_id();
  _min_reach constant integer := 300;
  _sk text := left(coalesce(_session_key, ''), 64);
begin
  if _me is null then return; end if;
  if not exists (select 1 from public.ad_delivery_test_users t where t.profile_id = _me) then return; end if;
  return query
  select a.id, cr.format, cr.headline, cr.body, cr.cta_label, cr.destination_url, cr.media_url, co.name
  from public.ads a
  join public.ad_sets s on s.id = a.ad_set_id
  join public.campaigns c on c.id = s.campaign_id
  join public.ad_accounts ac on ac.id = c.ad_account_id
  join public.companies co on co.id = ac.company_id
  join public.ad_creatives cr on cr.ad_id = a.id
  where a.review_status = 'approved' and a.status = 'active'
    and c.status = 'active' and ac.status = 'active'
    and (c.start_at is null or c.start_at <= now()) and (c.end_at is null or c.end_at > now())
    and coalesce(btrim(cr.headline), '') <> '' and cr.destination_url ~ '^https?://'
    and (cr.format = 'text' or coalesce(btrim(cr.media_url), '') <> '')
    and public._ad_campaign_deliverable(c.id)                          -- K2: budget + billing gate
    and (s.audience_id is null or exists (
      select 1 from public.ad_audiences aud where aud.id = s.audience_id
        and public._ad_audience_count(coalesce(aud.spec, '{}'::jsonb)) >= _min_reach
        and public._ad_profile_matches_audience(_me, coalesce(aud.spec, '{}'::jsonb))))
    and not exists (
      select 1 from public.ad_delivery_events e
      where e.ad_id = a.id and e.viewer_profile_id = _me and e.session_key = _sk
        and e.event_type = 'impression' and e.occurred_at > now() - interval '30 minutes')
  order by
    (select count(*) from public.ad_delivery_events e where e.ad_id = a.id and e.viewer_profile_id = _me and e.event_type = 'impression') asc,
    c.activated_at asc nulls last, a.created_at asc, a.id asc
  limit 1;
end;
$$;

-- ---------- rewire Phase I: require a budget to activate ----------
create or replace function public.activate_campaign(_campaign_id uuid)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare c public.campaigns;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'reviewer access required' using errcode = '42501'; end if;
  select * into c from public.campaigns where id = _campaign_id;
  if not found then raise exception 'campaign not found' using errcode = 'P0002'; end if;
  if c.status in ('completed', 'rejected') then raise exception 'a % campaign cannot be activated', c.status using errcode = 'P0001'; end if;
  if c.start_at is null then raise exception 'set a start date before activating' using errcode = 'P0001'; end if;
  if c.daily_budget_cents is null and coalesce(c.total_budget_cents, 0) <= 0 then
    raise exception 'set a daily or total budget before activating' using errcode = 'P0001';
  end if;
  perform set_config('ad.bypass_status_guard', 'on', true);
  update public.campaigns set status = 'active', activated_at = coalesce(activated_at, now()) where id = _campaign_id returning * into c;
  perform set_config('ad.bypass_status_guard', 'off', true);
  return c;
end;
$$;

-- ---------- Phase J: fold spend into analytics -------------------
-- return-type changes require a drop first
drop function if exists public.ad_analytics_summary(text, uuid, date, date);
drop function if exists public.ad_analytics_daily(text, uuid, date, date);
drop function if exists public.ad_analytics_breakdown(text, uuid, text, date, date);

create or replace function public.ad_analytics_summary(
  _scope text, _scope_id uuid, _from date default null, _to date default null
)
returns table (
  impressions bigint, clicks bigint, ctr numeric,
  unique_viewers bigint, unique_viewers_withheld boolean,
  spend_micros bigint, currency text,
  first_event date, last_event date
)
language plpgsql stable security definer set search_path = public
as $$
declare _uv int; _bucket int;
begin
  if not public._ad_analytics_can_view(_scope, _scope_id) then
    raise exception 'not authorized to view these analytics' using errcode = '42501';
  end if;

  select
    count(*) filter (where ev.event_type = 'impression'),
    count(*) filter (where ev.event_type = 'click'),
    count(distinct ev.viewer_key) filter (where ev.event_type = 'impression'),
    min(ev.day), max(ev.day)
  into impressions, clicks, _uv, first_event, last_event
  from public._ad_analytics_events(_scope, _scope_id, _from, _to) ev;

  impressions := coalesce(impressions, 0);
  clicks      := coalesce(clicks, 0);
  _uv         := coalesce(_uv, 0);
  _bucket     := public._ad_audience_bucket(_uv);

  ctr := case when impressions > 0 then round((clicks::numeric / impressions) * 100, 2) else 0 end;
  unique_viewers          := case when _bucket = 0 then null else _bucket::bigint end;
  unique_viewers_withheld := (_uv > 0 and _bucket = 0);

  select coalesce(sum(se.cost_micros), 0)::bigint, max(se.currency)
  into spend_micros, currency
  from public.ad_spend_events se
  where (se.occurred_at at time zone 'UTC')::date
          between coalesce(_from, current_date - 29) and coalesce(_to, current_date)
    and (
      (_scope = 'account'  and se.ad_account_id = _scope_id) or
      (_scope = 'campaign' and se.campaign_id   = _scope_id) or
      (_scope = 'ad_set'   and se.ad_set_id     = _scope_id) or
      (_scope = 'ad'       and se.ad_id         = _scope_id)
    );
  spend_micros := coalesce(spend_micros, 0);

  return next;
end;
$$;

create or replace function public.ad_analytics_daily(
  _scope text, _scope_id uuid, _from date default null, _to date default null
)
returns table (day date, impressions bigint, clicks bigint, spend_micros bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public._ad_analytics_can_view(_scope, _scope_id) then
    raise exception 'not authorized to view these analytics' using errcode = '42501';
  end if;

  return query
  with evd as (
    select e.day,
           count(*) filter (where e.event_type = 'impression') as impressions,
           count(*) filter (where e.event_type = 'click')      as clicks
    from public._ad_analytics_events(_scope, _scope_id, _from, _to) e
    group by e.day
  ),
  sp as (
    select (se.occurred_at at time zone 'UTC')::date as day, sum(se.cost_micros)::bigint as spend_micros
    from public.ad_spend_events se
    where (se.occurred_at at time zone 'UTC')::date
            between coalesce(_from, current_date - 29) and coalesce(_to, current_date)
      and (
        (_scope = 'account'  and se.ad_account_id = _scope_id) or
        (_scope = 'campaign' and se.campaign_id   = _scope_id) or
        (_scope = 'ad_set'   and se.ad_set_id     = _scope_id) or
        (_scope = 'ad'       and se.ad_id         = _scope_id)
      )
    group by 1
  )
  select coalesce(evd.day, sp.day),
         coalesce(evd.impressions, 0), coalesce(evd.clicks, 0), coalesce(sp.spend_micros, 0)::bigint
  from evd full outer join sp on sp.day = evd.day
  order by 1;
end;
$$;

create or replace function public.ad_analytics_breakdown(
  _scope text, _scope_id uuid, _level text default 'campaign',
  _from date default null, _to date default null
)
returns table (entity_id uuid, entity_name text, impressions bigint, clicks bigint, ctr numeric, spend_micros bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public._ad_analytics_can_view(_scope, _scope_id) then
    raise exception 'not authorized to view these analytics' using errcode = '42501';
  end if;

  if _level = 'campaign' then
    return query
    select c.id, c.name,
           count(*) filter (where ev.event_type = 'impression'),
           count(*) filter (where ev.event_type = 'click'),
           case when count(*) filter (where ev.event_type = 'impression') > 0
                then round((count(*) filter (where ev.event_type = 'click')::numeric
                            / count(*) filter (where ev.event_type = 'impression')) * 100, 2) else 0 end,
           coalesce((select sum(se.cost_micros) from public.ad_spend_events se
                     where se.campaign_id = c.id
                       and (se.occurred_at at time zone 'UTC')::date
                             between coalesce(_from, current_date - 29) and coalesce(_to, current_date)), 0)::bigint
    from public._ad_analytics_events(_scope, _scope_id, _from, _to) ev
    join public.campaigns c on c.id = ev.campaign_id
    group by c.id, c.name
    order by 3 desc, c.name;
  elsif _level = 'ad_set' then
    return query
    select s.id, s.name,
           count(*) filter (where ev.event_type = 'impression'),
           count(*) filter (where ev.event_type = 'click'),
           case when count(*) filter (where ev.event_type = 'impression') > 0
                then round((count(*) filter (where ev.event_type = 'click')::numeric
                            / count(*) filter (where ev.event_type = 'impression')) * 100, 2) else 0 end,
           coalesce((select sum(se.cost_micros) from public.ad_spend_events se
                     where se.ad_set_id = s.id
                       and (se.occurred_at at time zone 'UTC')::date
                             between coalesce(_from, current_date - 29) and coalesce(_to, current_date)), 0)::bigint
    from public._ad_analytics_events(_scope, _scope_id, _from, _to) ev
    join public.ad_sets s on s.id = ev.ad_set_id
    group by s.id, s.name
    order by 3 desc, s.name;
  elsif _level = 'ad' then
    return query
    select a.id, a.name,
           count(*) filter (where ev.event_type = 'impression'),
           count(*) filter (where ev.event_type = 'click'),
           case when count(*) filter (where ev.event_type = 'impression') > 0
                then round((count(*) filter (where ev.event_type = 'click')::numeric
                            / count(*) filter (where ev.event_type = 'impression')) * 100, 2) else 0 end,
           coalesce((select sum(se.cost_micros) from public.ad_spend_events se
                     where se.ad_id = a.id
                       and (se.occurred_at at time zone 'UTC')::date
                             between coalesce(_from, current_date - 29) and coalesce(_to, current_date)), 0)::bigint
    from public._ad_analytics_events(_scope, _scope_id, _from, _to) ev
    join public.ads a on a.id = ev.ad_id
    group by a.id, a.name
    order by 3 desc, a.name;
  else
    raise exception 'unknown breakdown level: %', _level using errcode = '22023';
  end if;
end;
$$;

-- Phase J rollup: populate ad_daily_metrics.spend_cents from the ledger.
create or replace function public.ad_rebuild_daily_metrics(
  _ad_account_id uuid, _from date default null, _to date default null
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare _rows integer := 0;
begin
  if not (public.is_ad_account_admin(_ad_account_id) or public.has_role(auth.uid(), 'admin')) then
    raise exception 'not authorized to rebuild these metrics' using errcode = '42501';
  end if;

  with agg as (
    select ev.ad_id, ev.day,
      count(*) filter (where ev.event_type = 'impression') as impressions,
      count(*) filter (where ev.event_type = 'click')      as clicks,
      public._ad_audience_bucket(
        count(distinct ev.viewer_key) filter (where ev.event_type = 'impression')::int
      ) as reach
    from public._ad_analytics_events('account', _ad_account_id, _from, _to) ev
    group by ev.ad_id, ev.day
  ),
  spend as (
    select se.ad_id, (se.occurred_at at time zone 'UTC')::date as day,
           round(sum(se.cost_micros) / 10000.0)::bigint as spend_cents
    from public.ad_spend_events se
    where se.ad_account_id = _ad_account_id
      and (se.occurred_at at time zone 'UTC')::date
            between coalesce(_from, '2000-01-01'::date) and coalesce(_to, current_date)
    group by se.ad_id, 2
  ),
  merged as (
    select coalesce(agg.ad_id, spend.ad_id) as ad_id,
           coalesce(agg.day, spend.day) as day,
           coalesce(agg.impressions, 0) as impressions,
           coalesce(agg.clicks, 0) as clicks,
           coalesce(agg.reach, 0) as reach,
           coalesce(spend.spend_cents, 0) as spend_cents
    from agg full outer join spend on spend.ad_id = agg.ad_id and spend.day = agg.day
  ),
  up as (
    insert into public.ad_daily_metrics (ad_id, ad_account_id, day, impressions, clicks, reach, spend_cents)
    select m.ad_id, _ad_account_id, m.day, m.impressions, m.clicks, m.reach, m.spend_cents
    from merged m
    on conflict (ad_id, day) do update
      set impressions = excluded.impressions,
          clicks      = excluded.clicks,
          reach       = excluded.reach,
          spend_cents = excluded.spend_cents,
          updated_at  = now()
    returning 1
  )
  select count(*) into _rows from up;
  return _rows;
end;
$$;

-- ---------- grants -------------------------------------------------
revoke all on function public._ad_event_cost(public.ad_bid_strategy, bigint, public.ad_event_type) from public, anon, authenticated;
revoke all on function public._ad_spend_record(uuid)         from public, anon, authenticated;
revoke all on function public._ad_campaign_deliverable(uuid) from public, anon, authenticated;

revoke all on function public.ad_campaign_budget_status(uuid) from public, anon;
grant execute on function public.ad_campaign_budget_status(uuid) to authenticated;
revoke all on function public.validate_campaign_budget(uuid) from public, anon;
grant execute on function public.validate_campaign_budget(uuid) to authenticated;

grant execute on function public.ad_analytics_summary(text, uuid, date, date)          to authenticated;
grant execute on function public.ad_analytics_daily(text, uuid, date, date)            to authenticated;
grant execute on function public.ad_analytics_breakdown(text, uuid, text, date, date)  to authenticated;
grant execute on function public.ad_rebuild_daily_metrics(uuid, date, date)            to authenticated;
