-- anon had a direct EXECUTE grant (separate from the PUBLIC grant already
-- revoked) on both functions -- inconsistent with every other SECURITY
-- DEFINER RPC in this project (mark_conversation_read, unread_message_count,
-- check_and_record_rate_limit all grant only to authenticated/service_role,
-- never anon). Align with that convention.
revoke execute on function public.is_conversation_participant(uuid) from anon;
revoke execute on function public.create_group_conversation(text, text, text, uuid[]) from anon;
