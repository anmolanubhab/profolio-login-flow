-- =====================================================================
-- Phase F: pin search_path on the pure `_ad_like_terms` helper.
-- Advisor finding function_search_path_mutable. It touches no tables, so
-- an empty search_path is safe; re-revoke EXECUTE after the replace.
-- =====================================================================

create or replace function public._ad_like_terms(_arr jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case
    when _arr is null or jsonb_typeof(_arr) <> 'array' or jsonb_array_length(_arr) = 0 then null
    else (
      select nullif(array_agg('%' || lower(btrim(x)) || '%'), '{}')
      from jsonb_array_elements_text(_arr) x
      where btrim(x) <> ''
    )
  end;
$$;

revoke execute on function public._ad_like_terms(jsonb) from authenticated, anon, service_role, public;
