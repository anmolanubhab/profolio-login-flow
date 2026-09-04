-- =====================================================================
-- Phase J follow-up — bucket ad_daily_metrics.reach
--
-- ad_daily_metrics is directly SELECT-able by the ad-account owner
-- (policy ad_daily_metrics_owner_select), so a raw distinct-viewer count
-- must never be written into it. Route reach through the Phase F
-- k-anonymity floor: < 300 distinct viewers -> 0. Impressions / clicks
-- stay raw (event counts, not people). spend_cents still untouched.
-- =====================================================================

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
      count(*) filter (where ev.event_type = 'impression')  as impressions,
      count(*) filter (where ev.event_type = 'click')        as clicks,
      public._ad_audience_bucket(
        count(distinct ev.viewer_key) filter (where ev.event_type = 'impression')::int
      )                                                      as reach
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

revoke all on function public.ad_rebuild_daily_metrics(uuid, date, date) from public, anon;
grant execute on function public.ad_rebuild_daily_metrics(uuid, date, date) to authenticated;
