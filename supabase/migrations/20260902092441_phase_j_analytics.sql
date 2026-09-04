-- =====================================================================
-- Phase J — Advertising Analytics
--
-- Aggregate-only reporting on top of the Phase C ad_delivery_events feed
-- and the Phase C ad_daily_metrics rollup table. No new metric system.
--
-- What an advertiser can see: impressions, clicks, CTR, a privacy-safe
-- unique-viewer count, a daily breakdown, and per-campaign / per-ad-set /
-- per-ad performance — but ONLY for ad accounts / campaigns / ad sets /
-- ads they administer. Never a viewer id, session key, name, or any
-- audience-membership detail.
--
-- Privacy:
--   * ad_delivery_events stays RLS-on / no-policy. Every read here goes
--     through SECURITY DEFINER functions that return COUNT()s only.
--   * Unique viewers are passed through the Phase F k-anonymity floor
--     (_ad_audience_bucket): < 300 distinct viewers -> withheld.
--   * Impressions / clicks are raw aggregate counts of the advertiser's
--     own ad — standard ad-platform disclosure, not tied to identity.
--
-- No billing, no spend, no auction. spend_cents on ad_daily_metrics is
-- left untouched (0) — that is Phase K territory.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Authorization: can the current user view analytics for this scope?
-- Internal — revoked from every client role; only the SECURITY DEFINER
-- RPCs below call it (as the function owner).
-- ---------------------------------------------------------------------
create or replace function public._ad_analytics_can_view(_scope text, _scope_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if _scope_id is null then
    return false;
  end if;
  if public.has_role(auth.uid(), 'admin') then
    return true;
  end if;
  return case _scope
    when 'account'  then public.is_ad_account_admin(_scope_id)
    when 'campaign' then public.is_campaign_admin(_scope_id)
    when 'ad_set'   then public.is_ad_set_admin(_scope_id)
    when 'ad'       then public.is_ad_admin(_scope_id)
    else false
  end;
end;
$$;

-- ---------------------------------------------------------------------
-- Filtered event stream for one scope + date range.
-- Internal — revoked from every client role. Callers below have already
-- authorized the scope; this function does NOT re-check. It never
-- returns a raw viewer id: viewer_key is an opaque per-viewer token
-- used only inside COUNT(DISTINCT ...).
-- ---------------------------------------------------------------------
create or replace function public._ad_analytics_events(
  _scope text,
  _scope_id uuid,
  _from date,
  _to date
)
returns table (
  event_type  public.ad_event_type,
  campaign_id uuid,
  ad_set_id   uuid,
  ad_id       uuid,
  viewer_key  text,
  day         date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.event_type,
    e.campaign_id,
    e.ad_set_id,
    e.ad_id,
    coalesce(e.viewer_profile_id::text, 's:' || e.session_key) as viewer_key,
    (e.occurred_at at time zone 'UTC')::date                   as day
  from public.ad_delivery_events e
  where (e.occurred_at at time zone 'UTC')::date
          between coalesce(_from, current_date - 29) and coalesce(_to, current_date)
    and (
      (_scope = 'account'  and e.ad_account_id = _scope_id) or
      (_scope = 'campaign' and e.campaign_id   = _scope_id) or
      (_scope = 'ad_set'   and e.ad_set_id     = _scope_id) or
      (_scope = 'ad'       and e.ad_id         = _scope_id)
    );
$$;

-- ---------------------------------------------------------------------
-- Headline totals for a scope.
-- ---------------------------------------------------------------------
create or replace function public.ad_analytics_summary(
  _scope text,
  _scope_id uuid,
  _from date default null,
  _to date default null
)
returns table (
  impressions             bigint,
  clicks                  bigint,
  ctr                     numeric,
  unique_viewers          bigint,
  unique_viewers_withheld boolean,
  first_event             date,
  last_event              date
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _uv int;
  _bucket int;
begin
  if not public._ad_analytics_can_view(_scope, _scope_id) then
    raise exception 'not authorized to view these analytics' using errcode = '42501';
  end if;

  select
    count(*) filter (where ev.event_type = 'impression'),
    count(*) filter (where ev.event_type = 'click'),
    count(distinct ev.viewer_key) filter (where ev.event_type = 'impression'),
    min(ev.day),
    max(ev.day)
  into impressions, clicks, _uv, first_event, last_event
  from public._ad_analytics_events(_scope, _scope_id, _from, _to) ev;

  impressions := coalesce(impressions, 0);
  clicks      := coalesce(clicks, 0);
  _uv         := coalesce(_uv, 0);
  _bucket     := public._ad_audience_bucket(_uv);

  ctr := case when impressions > 0
              then round((clicks::numeric / impressions) * 100, 2)
              else 0 end;

  -- k-anonymity floor: fewer than 300 distinct viewers -> withhold the number
  unique_viewers          := case when _bucket = 0 then null else _bucket::bigint end;
  unique_viewers_withheld := (_uv > 0 and _bucket = 0);

  return next;
end;
$$;

-- ---------------------------------------------------------------------
-- Per-day breakdown for a scope (only days that have events).
-- ---------------------------------------------------------------------
create or replace function public.ad_analytics_daily(
  _scope text,
  _scope_id uuid,
  _from date default null,
  _to date default null
)
returns table (
  day         date,
  impressions bigint,
  clicks      bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public._ad_analytics_can_view(_scope, _scope_id) then
    raise exception 'not authorized to view these analytics' using errcode = '42501';
  end if;

  return query
  select
    ev.day,
    count(*) filter (where ev.event_type = 'impression'),
    count(*) filter (where ev.event_type = 'click')
  from public._ad_analytics_events(_scope, _scope_id, _from, _to) ev
  group by ev.day
  order by ev.day;
end;
$$;

-- ---------------------------------------------------------------------
-- Child-entity breakdown: campaigns within an account, ad sets within a
-- campaign, ads within an ad set (or any wider scope). Names come from
-- the advertiser's own campaigns / ad_sets / ads rows.
-- ---------------------------------------------------------------------
create or replace function public.ad_analytics_breakdown(
  _scope text,
  _scope_id uuid,
  _level text default 'campaign',
  _from date default null,
  _to date default null
)
returns table (
  entity_id   uuid,
  entity_name text,
  impressions bigint,
  clicks      bigint,
  ctr         numeric
)
language plpgsql
stable
security definer
set search_path = public
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
                            / count(*) filter (where ev.event_type = 'impression')) * 100, 2)
                else 0 end
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
                            / count(*) filter (where ev.event_type = 'impression')) * 100, 2)
                else 0 end
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
                            / count(*) filter (where ev.event_type = 'impression')) * 100, 2)
                else 0 end
    from public._ad_analytics_events(_scope, _scope_id, _from, _to) ev
    join public.ads a on a.id = ev.ad_id
    group by a.id, a.name
    order by 3 desc, a.name;

  else
    raise exception 'unknown breakdown level: %', _level using errcode = '22023';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Daily rollup: (re)builds ad_daily_metrics rows for one ad account from
-- ad_delivery_events. Idempotent — safe to re-run. Events are already
-- de-duplicated at write time (ad_delivery_events.dedup_key UNIQUE), and
-- the upsert key (ad_id, day) means a repeat run overwrites rather than
-- doubles. spend_cents is never touched here (Phase K).
--
-- (reach is hardened to the Phase F k-anonymity floor in the immediately
-- following migration, 20260902092814.)
-- ---------------------------------------------------------------------
create or replace function public.ad_rebuild_daily_metrics(
  _ad_account_id uuid,
  _from date default null,
  _to date default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _rows integer := 0;
begin
  if not (public.is_ad_account_admin(_ad_account_id) or public.has_role(auth.uid(), 'admin')) then
    raise exception 'not authorized to rebuild these metrics' using errcode = '42501';
  end if;

  with agg as (
    select
      ev.ad_id,
      ev.day,
      count(*) filter (where ev.event_type = 'impression')                        as impressions,
      count(*) filter (where ev.event_type = 'click')                             as clicks,
      count(distinct ev.viewer_key) filter (where ev.event_type = 'impression')   as reach
    from public._ad_analytics_events('account', _ad_account_id, _from, _to) ev
    group by ev.ad_id, ev.day
  ),
  up as (
    insert into public.ad_daily_metrics (ad_id, ad_account_id, day, impressions, clicks, reach, spend_cents)
    select agg.ad_id, _ad_account_id, agg.day, agg.impressions, agg.clicks, agg.reach, 0
    from agg
    on conflict (ad_id, day) do update
      set impressions = excluded.impressions,
          clicks      = excluded.clicks,
          reach       = excluded.reach,
          updated_at  = now()
    returning 1
  )
  select count(*) into _rows from up;

  return _rows;
end;
$$;

-- ---------------------------------------------------------------------
-- Grants — internal helpers locked to the definer; RPCs to authenticated.
-- ---------------------------------------------------------------------
revoke all on function public._ad_analytics_can_view(text, uuid)              from public, anon, authenticated;
revoke all on function public._ad_analytics_events(text, uuid, date, date)    from public, anon, authenticated;

revoke all on function public.ad_analytics_summary(text, uuid, date, date)          from public, anon;
revoke all on function public.ad_analytics_daily(text, uuid, date, date)            from public, anon;
revoke all on function public.ad_analytics_breakdown(text, uuid, text, date, date)  from public, anon;
revoke all on function public.ad_rebuild_daily_metrics(uuid, date, date)            from public, anon;

grant execute on function public.ad_analytics_summary(text, uuid, date, date)          to authenticated;
grant execute on function public.ad_analytics_daily(text, uuid, date, date)            to authenticated;
grant execute on function public.ad_analytics_breakdown(text, uuid, text, date, date)  to authenticated;
grant execute on function public.ad_rebuild_daily_metrics(uuid, date, date)            to authenticated;
