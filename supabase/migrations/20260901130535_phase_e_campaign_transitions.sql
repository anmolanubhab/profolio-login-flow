-- =====================================================================
-- Phase E — campaign builder: the minimum secure state transitions
--
-- The Phase C `ad_status_guard` trigger blocks ALL direct writes to
-- `campaigns.status`. Create + edit-draft stay as plain client writes (they
-- never touch `status`). The only lifecycle movement Phase E needs is the
-- advertiser-controlled hop between `draft` and `pending_review`, and that
-- must go through a SECURITY DEFINER RPC that:
--   * verifies the caller administers the campaign's ad account
--     (reuses the Phase C `is_campaign_admin()` helper),
--   * only ever moves draft <-> pending_review — never to approved /
--     active / completed / rejected (those stay reviewer/system-only,
--     Phase H+),
--   * flips `ad.bypass_status_guard` locally for exactly one UPDATE.
--
-- No UI/targeting/creative/delivery/analytics/billing here.
-- =====================================================================

create or replace function public.submit_campaign_for_review(_campaign_id uuid)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.campaigns;
begin
  if not public.is_campaign_admin(_campaign_id) then
    raise exception 'not authorized to submit this campaign' using errcode = '42501';
  end if;

  select * into c from public.campaigns where id = _campaign_id for update;
  if not found then
    raise exception 'campaign not found' using errcode = 'P0002';
  end if;
  if c.status <> 'draft' then
    raise exception 'only draft campaigns can be submitted for review (current: %)', c.status
      using errcode = 'P0001';
  end if;

  -- completeness gate (mirrors the client-side validation)
  if coalesce(btrim(c.name), '') = '' then
    raise exception 'campaign name is required' using errcode = 'P0001';
  end if;
  if coalesce(c.total_budget_cents, 0) <= 0 and coalesce(c.daily_budget_cents, 0) <= 0 then
    raise exception 'set a total budget or a daily budget before submitting' using errcode = 'P0001';
  end if;
  if c.start_at is null then
    raise exception 'a start date is required before submitting' using errcode = 'P0001';
  end if;
  if c.end_at is not null and c.end_at <= c.start_at then
    raise exception 'the end date must be after the start date' using errcode = 'P0001';
  end if;

  perform set_config('ad.bypass_status_guard', 'on', true);
  update public.campaigns
     set status = 'pending_review',
         submitted_at = now()
   where id = _campaign_id
  returning * into c;
  perform set_config('ad.bypass_status_guard', 'off', true);

  return c;
end;
$$;

-- Symmetric: pull a not-yet-reviewed campaign back to draft so it can be
-- edited again. Only the owner, only pending_review -> draft.
create or replace function public.withdraw_campaign_submission(_campaign_id uuid)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.campaigns;
begin
  if not public.is_campaign_admin(_campaign_id) then
    raise exception 'not authorized to withdraw this campaign' using errcode = '42501';
  end if;

  select * into c from public.campaigns where id = _campaign_id for update;
  if not found then
    raise exception 'campaign not found' using errcode = 'P0002';
  end if;
  if c.status <> 'pending_review' then
    raise exception 'only campaigns in review can be withdrawn (current: %)', c.status
      using errcode = 'P0001';
  end if;

  perform set_config('ad.bypass_status_guard', 'on', true);
  update public.campaigns
     set status = 'draft',
         submitted_at = null
   where id = _campaign_id
  returning * into c;
  perform set_config('ad.bypass_status_guard', 'off', true);

  return c;
end;
$$;

revoke all on function public.submit_campaign_for_review(uuid) from public, anon;
revoke all on function public.withdraw_campaign_submission(uuid) from public, anon;
grant execute on function public.submit_campaign_for_review(uuid) to authenticated;
grant execute on function public.withdraw_campaign_submission(uuid) to authenticated;
