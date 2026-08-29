-- Lock the Phase 1 SECURITY DEFINER functions + new table down to signed-in users.
-- (Supabase grants EXECUTE/SELECT to `anon` by default; RLS already returns nothing
--  for anon, but the advisor flags the reachability — remove it explicitly.)

revoke execute on function public.network_counts()                    from anon, public;
revoke execute on function public.mutual_connections_count(uuid)      from anon, public;
revoke execute on function public.remove_connection(uuid)             from anon, public;
revoke execute on function public.search_connections(text, int, int)  from anon, public;
revoke execute on function public.search_people(text, int, int)       from anon, public;

grant execute on function public.network_counts()                    to authenticated;
grant execute on function public.mutual_connections_count(uuid)      to authenticated;
grant execute on function public.remove_connection(uuid)             to authenticated;
grant execute on function public.search_connections(text, int, int)  to authenticated;
grant execute on function public.search_people(text, int, int)       to authenticated;

revoke all on table public.dismissed_suggestions from anon;
grant select, insert, update, delete on table public.dismissed_suggestions to authenticated;
