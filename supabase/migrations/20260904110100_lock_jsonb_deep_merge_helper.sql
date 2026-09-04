-- `_jsonb_deep_merge` is a pure internal helper only `update_my_preferences_patch`
-- needs. That RPC is SECURITY DEFINER (runs as postgres) so it can call the
-- helper regardless of the `authenticated` grant. Revoke the Supabase-default
-- EXECUTE from `authenticated` for least privilege — nothing else calls it.
revoke execute on function public._jsonb_deep_merge(jsonb, jsonb) from authenticated;
