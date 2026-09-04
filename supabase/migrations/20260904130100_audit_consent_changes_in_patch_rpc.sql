-- Wire consent auditing into the atomic preferences patch RPC.
--
-- Approach: record the audit event INSIDE update_my_preferences_patch(), not via
-- a trigger on public.profiles.
--
--   * Atomicity -- both approaches are equally atomic: a PostgREST RPC call and
--     any AFTER-trigger it fires run in one transaction, so "preference update
--     + audit row" already succeed or fail together either way. Atomicity is
--     therefore not the deciding factor.
--   * Precision -- update_my_preferences_patch is the SOLE writer of every
--     audited signal (data_use.* and personalized_recommendations). Auditing
--     here catches 100% of real changes and nothing else. A trigger on profiles
--     would also fire for last_active_at heartbeats, avatar/bio edits, the
--     broadcast_profile_update throttle write and direct visibility-column
--     updates, and would have to re-derive which keys changed on every one.
--   * Least surprise -- the change-detection logic sits next to the deep-merge
--     it depends on.
--
-- Change detection: capture preferences BEFORE the update, then for each of the
-- 10 audited signals compare old vs merged with IS DISTINCT FROM. Exactly the
-- rows whose audited value actually changed get one event each:
--   true  -> false : event      false -> true : event
--   true  -> true  : no event   absent -> set : event (old_value = null)
--   unrelated key changed / same value re-written / no-op patch : no event
-- For data_use.* the individual signal is recorded ('data_use.connections'),
-- never the whole data_use object and never the whole preferences blob.
--
-- Everything else about the function is unchanged from 20260904120100:
-- SECURITY DEFINER, search_path '', validate-then-merge, own row only, no
-- client read-modify-write, RETURNING the merged blob.

create or replace function public.update_my_preferences_patch(patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  uid    uuid := auth.uid();
  old_p  jsonb;
  merged jsonb;
begin
  perform public._assert_valid_preference_patch(patch);

  -- Snapshot the current stored value before mutating it, in the same
  -- transaction as the UPDATE below.
  -- (20260904130150 tightens this read to SELECT ... FOR UPDATE so a concurrent
  -- patch to a different signal cannot race in between and cause a spurious
  -- duplicate event.)
  select p.preferences into old_p
  from public.profiles p
  where p.user_id = uid;

  if not found then
    raise exception 'update_my_preferences_patch: no profile row for the current user';
  end if;

  update public.profiles p
     set preferences = public._jsonb_deep_merge(coalesce(p.preferences, '{}'::jsonb), patch)
   where p.user_id = uid
  returning p.preferences into merged;

  -- One audit row per audited signal whose value actually changed. If the
  -- INSERT fails for any reason, the whole function errors and the UPDATE above
  -- rolls back with it -- no preference change without its audit event, and no
  -- orphan audit event without its preference change.
  insert into public.consent_audit_log (user_id, signal_key, old_value, new_value, source)
  select uid, sig.key, old_p #> sig.path, merged #> sig.path, 'settings_patch'
  from (
    values
      ('data_use.connections',         array['data_use', 'connections']),
      ('data_use.companies_followed',  array['data_use', 'companies_followed']),
      ('data_use.groups',              array['data_use', 'groups']),
      ('data_use.education_skills',     array['data_use', 'education_skills']),
      ('data_use.job_information',      array['data_use', 'job_information']),
      ('data_use.employer',            array['data_use', 'employer']),
      ('data_use.profile_location',    array['data_use', 'profile_location']),
      ('data_use.ads_off_profolio',    array['data_use', 'ads_off_profolio']),
      ('data_use.measure_ad_success',  array['data_use', 'measure_ad_success']),
      ('personalized_recommendations', array['personalized_recommendations'])
  ) as sig(key, path)
  where (old_p #> sig.path) is distinct from (merged #> sig.path)
    -- Defends new_value NOT NULL. The validator only permits boolean values for
    -- these keys and the deep-merge never deletes keys, so a change to a null
    -- merged value cannot occur through this RPC; if it ever did we skip the
    -- event rather than fail the user's preference write.
    and (merged #> sig.path) is not null;

  return merged;
end;
$$;

revoke all on function public.update_my_preferences_patch(jsonb) from public, anon;
grant execute on function public.update_my_preferences_patch(jsonb) to authenticated;
