-- =====================================================================
-- Fix: ad_status_guard() references a column that only exists on one of
-- the two tables it guards.
--
-- The Phase C body put both checks in a single boolean expression:
--   if tg_table_name = 'ads' and new.review_status is distinct from old.review_status
-- Postgres does not guarantee short-circuit evaluation, so on a `campaigns`
-- UPDATE that does NOT change `status`, it still evaluates
-- `new.review_status` and fails with 42703 ("record \"new\" has no field
-- \"review_status\""). Any plain edit to a campaign row (name / objective /
-- budget / schedule) hit this.
--
-- Fix: branch on TG_TABLE_NAME with nested IF so each table's column is only
-- referenced in a statement that runs for that table. Behaviour is otherwise
-- identical — direct status / review_status writes stay blocked unless
-- `ad.bypass_status_guard` is set by a vetted SECURITY DEFINER RPC.
-- =====================================================================

create or replace function public.ad_status_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('ad.bypass_status_guard', true), '') = 'on' then
    return new;
  end if;

  if tg_table_name = 'campaigns' then
    if new.status is distinct from old.status then
      raise exception 'campaign status transitions must go through a state-transition function';
    end if;
  elsif tg_table_name = 'ads' then
    if new.review_status is distinct from old.review_status then
      raise exception 'ad review status is set by the review workflow, not directly';
    end if;
  end if;

  return new;
end;
$$;
