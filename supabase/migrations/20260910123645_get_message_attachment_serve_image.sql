-- Phase 3a: image messaging. The attachment-URL RPC previously served only
-- message_type = 'file' (documents). Widen it to also mint signed URLs for
-- message_type = 'image'. The participant check and the deleted_for_everyone
-- guard (PR #71) are unchanged; no schema or RLS change.

create or replace function public.get_message_attachment(p_message_id uuid)
returns table(status text, storage_path text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_msg record;
begin
  if auth.uid() is null then
    return query select 'not_authorized'::text, null::text;
    return;
  end if;

  select m.id, m.conversation_id, m.message_type, m.file_url, m.deleted_for_everyone
  into v_msg
  from public.messages m
  where m.id = p_message_id;

  if v_msg.id is null then
    return query select 'not_authorized'::text, null::text;
    return;
  end if;

  if not exists (
    select 1 from public.conversations c
    where c.id = v_msg.conversation_id
      and (c.participant_1 = auth.uid() or c.participant_2 = auth.uid())
  ) then
    return query select 'not_authorized'::text, null::text;
    return;
  end if;

  if v_msg.deleted_for_everyone then
    return query select 'not_authorized'::text, null::text;
    return;
  end if;

  if v_msg.message_type not in ('file', 'image') or v_msg.file_url is null then
    return query select 'not_a_document'::text, null::text;
    return;
  end if;

  return query select 'ok'::text, v_msg.file_url;
end;
$function$;
