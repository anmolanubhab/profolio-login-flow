import { supabase } from '@/integrations/supabase/client';

/**
 * Resolve a short-lived (300 s) signed URL for a message's attachment.
 *
 * The `message-attachments` bucket is private with no `storage.objects` SELECT
 * policy -- every read goes through the JWT-verified `get-message-attachment-url`
 * edge function, which calls the `get_message_attachment` RPC to authorise the
 * caller (must be a participant of that message's conversation, and the message
 * must not be deleted-for-everyone) before the service role signs a URL.
 *
 * Returns `null` on any failure (not authorised, deleted, network, expired
 * session) -- callers render a fallback rather than a broken link.
 */
export async function getMessageAttachmentUrl(messageId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('get-message-attachment-url', {
      body: { message_id: messageId },
    });
    if (error || !data?.ok || !data?.url) return null;
    return data.url as string;
  } catch {
    return null;
  }
}
