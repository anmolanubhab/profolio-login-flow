-- QA hardening (Increment 2 audit): a message that has been "deleted for
-- everyone" has no content to serve. get_message_attachment now refuses to
-- return a storage path for it, so no signed URL can be minted even by a
-- participant crafting a direct edge-function call. The UI already withholds
-- every attachment action on a deleted message; this closes the backend gap.

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

  if v_msg.message_type <> 'file' or v_msg.file_url is null then
    return query select 'not_a_document'::text, null::text;
    return;
  end if;

  return query select 'ok'::text, v_msg.file_url;
end;
$function$;
