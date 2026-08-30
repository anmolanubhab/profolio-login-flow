import { supabase } from '@/integrations/supabase/client';

/**
 * All connection-lifecycle writes go through these three SECURITY DEFINER
 * RPCs so every path (My Network, profile page, notifications page) shares
 * one atomic, guard-checked implementation that also keeps the denormalised
 * `connections` table + notifications in sync.
 *
 * DB guards enforced server-side: not-self, not-already-connected, blocked
 * either direction, sender-only withdraw, receiver-only accept/ignore,
 * duplicate suppression, and auto-accept when a reverse request already
 * exists.
 */

export type SendResult = 'pending' | 'connected';
export type RespondResult = 'connected' | 'ignored';

export async function sendConnectionRequest(
  targetProfileId: string,
  note?: string | null,
): Promise<SendResult> {
  const { data, error } = await supabase.rpc('send_connection_request', {
    target_profile_id: targetProfileId,
    note: note && note.trim() ? note.trim().slice(0, 300) : null,
  });
  if (error) throw error;
  return (data as SendResult) ?? 'pending';
}

export async function respondToConnectionRequest(
  requestId: string,
  accept: boolean,
): Promise<RespondResult> {
  const { data, error } = await supabase.rpc('respond_to_connection_request', {
    request_id: requestId,
    accept,
  });
  if (error) throw error;
  return (data as RespondResult) ?? (accept ? 'connected' : 'ignored');
}

export async function withdrawConnectionRequest(requestId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('withdraw_connection_request', {
    request_id: requestId,
  });
  if (error) throw error;
  return !!data;
}

/** Human-readable message for the errors the RPCs raise. */
export function connectionErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (/blocked/i.test(msg)) return "You can't connect with this member.";
  if (/invalid target/i.test(msg)) return 'That request is no longer valid.';
  if (/not authorized/i.test(msg)) return "You don't have permission to do that.";
  if (/not authenticated/i.test(msg)) return 'Please sign in and try again.';
  if (/request not found/i.test(msg)) return 'This invitation is no longer available.';
  return msg || 'Please try again.';
}
