-- =====================================================================
-- Phase C — hardening follow-up (addresses security advisor findings)
--
--  1. ad_status_guard(): pin search_path (function_search_path_mutable).
--  2. Revoke the default `anon` grants on every advertising table and on the
--     ownership helper RPCs. RLS already denies anon every row, but this also
--     removes the advertising surface from the logged-out PostgREST /
--     pg_graphql introspection schema (defense in depth).
-- =====================================================================

create or replace function public.ad_status_guard()
returns trigger language plpgsql set search_path = public as $$
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

revoke all on public.ad_accounts        from anon;
revoke all on public.ad_audiences       from anon;
revoke all on public.campaigns          from anon;
revoke all on public.ad_sets            from anon;
revoke all on public.ads                from anon;
revoke all on public.ad_creatives       from anon;
revoke all on public.ad_reviews         from anon;
revoke all on public.ad_daily_metrics   from anon;
revoke all on public.ad_delivery_events from anon;

revoke execute on function public.is_ad_account_admin(uuid)       from anon, public;
revoke execute on function public.is_campaign_admin(uuid)         from anon, public;
revoke execute on function public.is_ad_set_admin(uuid)           from anon, public;
revoke execute on function public.is_ad_admin(uuid)               from anon, public;
revoke execute on function public.ad_daily_metrics_is_owner(uuid) from anon, public;
