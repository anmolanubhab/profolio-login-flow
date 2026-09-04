-- B6: server-side shape validation for update_my_preferences_patch(patch).
--
-- The patch RPC previously only checked "is a JSON object". This adds an
-- allow-list validator so malformed / arbitrary / mistyped preference data is
-- rejected with a clean 400 BEFORE the atomic deep-merge runs. The B3 flow is
-- unchanged: client -> RPC(patch) -> validate -> deep-merge against CURRENT row
-- -> update own row only. Still no client read-modify-write.
--
-- Supported schema (derived from the codebase):
--   top-level (all optional):
--     mentions_from                    string  in ('everyone','connections','nobody')
--     show_active_status               boolean
--     share_profile_updates            boolean
--     personalized_recommendations     boolean
--     last_profile_update_broadcast_at string  (ISO ts; normally written by the
--                                               broadcast_profile_update RPC, not this one)
--     data_use                         object  { <known key>: boolean }
--     notifications                    object  { <known key>: boolean }
--   data_use keys:
--     connections, companies_followed, groups, education_skills, job_information,
--     employer, profile_location, ads_off_profolio, measure_ad_success
--   notifications keys:
--     jobs, network, insights, mentions, messages, profile_activity, reactions_comments
--
-- Unknown top-level and unknown data_use/notifications sub-keys are REJECTED.
-- Forward compatibility: a new setting always ships with a code change, so the
-- same PR extends the arrays below in a follow-up migration. This keeps the
-- stored blob to exactly the shape the app understands and makes the B5 orphan
-- keys (and any "arbitrary sensitive structure") impossible to re-introduce
-- through the RPC. The two-level schema (only `data_use`/`notifications` may be
-- objects, and their values must be booleans) inherently bounds nesting depth.
--
-- errcode 22023 (invalid_parameter_value) -> PostgREST returns HTTP 400.

create or replace function public._assert_valid_preference_patch(patch jsonb)
returns void
language plpgsql
immutable
as $$
declare
  allowed_top text[] := array[
    'mentions_from', 'show_active_status', 'share_profile_updates',
    'personalized_recommendations', 'last_profile_update_broadcast_at',
    'data_use', 'notifications'
  ];
  allowed_data_use text[] := array[
    'connections', 'companies_followed', 'groups', 'education_skills',
    'job_information', 'employer', 'profile_location',
    'ads_off_profolio', 'measure_ad_success'
  ];
  allowed_notifications text[] := array[
    'jobs', 'network', 'insights', 'mentions', 'messages',
    'profile_activity', 'reactions_comments'
  ];
  k text;
  v jsonb;
  sk text;
  sv jsonb;
begin
  if patch is null or jsonb_typeof(patch) <> 'object' then
    raise exception 'preferences patch must be a JSON object' using errcode = '22023';
  end if;

  if pg_column_size(patch) > 8192 then
    raise exception 'preferences patch too large' using errcode = '22023';
  end if;

  for k, v in select key, value from jsonb_each(patch) loop
    if not (k = any(allowed_top)) then
      raise exception 'unknown preference key: %', k using errcode = '22023';
    end if;

    if k in ('show_active_status', 'share_profile_updates', 'personalized_recommendations') then
      if jsonb_typeof(v) <> 'boolean' then
        raise exception 'preference "%" must be a boolean', k using errcode = '22023';
      end if;

    elsif k = 'mentions_from' then
      if jsonb_typeof(v) <> 'string' or (v #>> '{}') not in ('everyone', 'connections', 'nobody') then
        raise exception 'mentions_from must be one of: everyone, connections, nobody' using errcode = '22023';
      end if;

    elsif k = 'last_profile_update_broadcast_at' then
      if jsonb_typeof(v) <> 'string' then
        raise exception 'last_profile_update_broadcast_at must be a string' using errcode = '22023';
      end if;

    elsif k = 'data_use' then
      if jsonb_typeof(v) <> 'object' then
        raise exception 'data_use must be an object' using errcode = '22023';
      end if;
      for sk, sv in select key, value from jsonb_each(v) loop
        if not (sk = any(allowed_data_use)) then
          raise exception 'unknown data_use key: %', sk using errcode = '22023';
        end if;
        if jsonb_typeof(sv) <> 'boolean' then
          raise exception 'data_use."%" must be a boolean', sk using errcode = '22023';
        end if;
      end loop;

    elsif k = 'notifications' then
      if jsonb_typeof(v) <> 'object' then
        raise exception 'notifications must be an object' using errcode = '22023';
      end if;
      for sk, sv in select key, value from jsonb_each(v) loop
        if not (sk = any(allowed_notifications)) then
          raise exception 'unknown notifications key: %', sk using errcode = '22023';
        end if;
        if jsonb_typeof(sv) <> 'boolean' then
          raise exception 'notifications."%" must be a boolean', sk using errcode = '22023';
        end if;
      end loop;
    end if;
  end loop;
end;
$$;

revoke all on function public._assert_valid_preference_patch(jsonb) from public, anon, authenticated;

-- Wire the validator into the atomic patch RPC. Everything else about the
-- function (SECURITY DEFINER, search_path, own-row-only, deep merge, RETURNING)
-- is unchanged from 20260904110000.
create or replace function public.update_my_preferences_patch(patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  merged jsonb;
begin
  perform public._assert_valid_preference_patch(patch);

  update public.profiles p
     set preferences = public._jsonb_deep_merge(coalesce(p.preferences, '{}'::jsonb), patch)
   where p.user_id = auth.uid()
  returning p.preferences into merged;

  if not found then
    raise exception 'update_my_preferences_patch: no profile row for the current user';
  end if;

  return merged;
end;
$$;

revoke all on function public.update_my_preferences_patch(jsonb) from public, anon;
grant execute on function public.update_my_preferences_patch(jsonb) to authenticated;
