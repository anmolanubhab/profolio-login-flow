-- =====================================================================
-- Phase K2 fix — ad_analytics_summary reports the scope's account
-- currency even when there is no spend yet (was returning NULL, so the
-- UI fell back to USD for an INR campaign showing zero spend).
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
declare _uv int; _bucket int; _acct uuid;
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

  select case _scope
    when 'account'  then _scope_id
    when 'campaign' then (select c.ad_account_id from public.campaigns c where c.id = _scope_id)
    when 'ad_set'   then (select c.ad_account_id from public.ad_sets s join public.campaigns c on c.id = s.campaign_id where s.id = _scope_id)
    when 'ad'       then (select c.ad_account_id from public.ads a join public.ad_sets s on s.id = a.ad_set_id join public.campaigns c on c.id = s.campaign_id where a.id = _scope_id)
  end into _acct;
  select ac.currency into currency from public.ad_accounts ac where ac.id = _acct;
  currency := coalesce(currency, 'USD');

  select coalesce(sum(se.cost_micros), 0)::bigint
  into spend_micros
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

grant execute on function public.ad_analytics_summary(text, uuid, date, date) to authenticated;
