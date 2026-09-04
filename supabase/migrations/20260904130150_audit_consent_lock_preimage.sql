-- Follow-up to 20260904130100: lock the pre-image read in
-- update_my_preferences_patch so the consent diff is race-free.
--
-- Without the lock there is a window between "SELECT old preferences" and
-- "UPDATE preferences". A concurrent update_my_preferences_patch call for the
-- SAME user that changes a DIFFERENT audited signal can commit inside that
-- window. Our UPDATE then re-reads under Read Committed and our `merged` value
-- includes the other call's change, but our `old_p` snapshot predates it -- so
-- our diff loop sees that unrelated signal flip and writes a second, spurious
-- audit event for a key this call never patched.
--
-- SELECT ... FOR UPDATE makes the second call block on the row lock until the
-- first commits, so `old_p` is always the true immediate pre-image of this
-- call's own change. One user's concurrent preference toggles now serialise on
-- that row lock, which is harmless (a person changes settings one at a time)
-- and still satisfies the B3 guarantee that the deep-merge runs against the
-- current committed row. Nothing else about the function changes.

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

  select p.preferences into old_p
  from public.profiles p
  where p.user_id = uid
  for update;

  if not found then
    raise exception 'update_my_preferences_patch: no profile row for the current user';
  end if;

  update public.profiles p
     set preferences = public._jsonb_deep_merge(coalesce(p.preferences, '{}'::jsonb), patch)
   where p.user_id = uid
  returning p.preferences into merged;

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
    and (merged #> sig.path) is not null;

  return merged;
end;
$$;

revoke all on function public.update_my_preferences_patch(jsonb) from public, anon;
grant execute on function public.update_my_preferences_patch(jsonb) to authenticated;
