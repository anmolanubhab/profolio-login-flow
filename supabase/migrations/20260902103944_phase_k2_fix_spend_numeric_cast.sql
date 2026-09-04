-- =====================================================================
-- Phase K2 fix — numeric -> bigint cast on spend aggregates
--
-- sum(bigint) returns numeric in Postgres, but ad_analytics_summary /
-- ad_analytics_daily / ad_analytics_breakdown declare spend_micros as
-- bigint. The engine migration (20260902103432) already carries the
-- casts inline for fresh installs; this re-applies the corrected
-- function bodies to environments that ran the pre-fix version.
-- =====================================================================

create or replace function public.ad_analytics_summary(
  _scope text, _scope_id uuid, _from date default null, _to date default null
)
returns table (
  impressions bigint, clicks bigint, ctr numeric,
  unique_viewers bigint, unique_viewers_withheld boolean,
  spend_micros bigint, currency text, first_event date, last_event date
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
  impressions := coalesce(impressions, 0); clicks := coalesce(clicks, 0); _uv := coalesce(_uv, 0);
  _bucket := public._ad_audience_bucket(_uv);
  ctr := case when impressions > 0 then round((clicks::numeric / impressions) * 100, 2) else 0 end;
  unique_viewers := case when _bucket = 0 then null else _bucket::bigint end;
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
    group by c.id, c.name order by 3 desc, c.name;
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
    group by s.id, s.name order by 3 desc, s.name;
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
    group by a.id, a.name order by 3 desc, a.name;
  else
    raise exception 'unknown breakdown level: %', _level using errcode = '22023';
  end if;
end;
$$;

grant execute on function public.ad_analytics_summary(text, uuid, date, date)          to authenticated;
grant execute on function public.ad_analytics_daily(text, uuid, date, date)            to authenticated;
grant execute on function public.ad_analytics_breakdown(text, uuid, text, date, date)  to authenticated;
