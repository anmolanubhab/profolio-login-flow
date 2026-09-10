import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

/**
 * The ONE source of truth for the global unread-messages count.
 *
 * Every surface that shows a "Messages" badge (mobile bottom nav, desktop
 * navbar, …) calls this hook, so they always agree. The count comes straight
 * from the database via the `unread_message_count()` RPC — never a hardcoded,
 * cached or client-derived number — and the shared React Query cache key
 * (`QUERY_KEY`) means N mounts issue exactly one network request.
 *
 * Freshness is driven by:
 *   - a single app-wide realtime subscription on `public.messages`
 *     (INSERT when a new message lands, UPDATE when `mark_conversation_read`
 *     flips `is_read`), debounced so duplicate events can't double-count;
 *   - window focus / tab visibility, so a device that was in the background
 *     re-syncs with whatever another device/tab did (multi-device read state);
 *   - route changes, so the badge settles immediately after you leave a
 *     conversation.
 *
 * When the count is 0 the consumer must render NO badge (not "0").
 */

export const UNREAD_MESSAGES_QUERY_KEY = ['unread-message-count'] as const;

async function fetchUnreadCount(): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data, error } = await supabase.rpc('unread_message_count');
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

// --- app-wide singleton: one realtime channel + focus listeners, refcounted ---
let refCount = 0;
let channel: RealtimeChannel | null = null;
let detachDomListeners: (() => void) | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function startShared(queryClient: QueryClient) {
  refCount += 1;
  if (refCount > 1) return;

  const invalidate = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: UNREAD_MESSAGES_QUERY_KEY });
    }, 400);
  };

  channel = supabase
    .channel('unread-message-count')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, invalidate)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, invalidate)
    .subscribe();

  const onVisible = () => {
    if (document.visibilityState === 'visible') invalidate();
  };
  window.addEventListener('focus', invalidate);
  document.addEventListener('visibilitychange', onVisible);
  detachDomListeners = () => {
    window.removeEventListener('focus', invalidate);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

function stopShared() {
  refCount -= 1;
  if (refCount > 0) return;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  detachDomListeners?.();
  detachDomListeners = null;
}

export function useUnreadMessageCount(): { count: number; isLoading: boolean } {
  const queryClient = useQueryClient();
  const { pathname } = useLocation();

  const { data, isLoading } = useQuery({
    queryKey: UNREAD_MESSAGES_QUERY_KEY,
    queryFn: fetchUnreadCount,
    staleTime: 15_000,
    refetchOnWindowFocus: false, // handled by the shared listener below
  });

  useEffect(() => {
    startShared(queryClient);
    return () => stopShared();
  }, [queryClient]);

  // Settle the badge right after navigating away from a conversation.
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: UNREAD_MESSAGES_QUERY_KEY });
  }, [pathname, queryClient]);

  return { count: data ?? 0, isLoading };
}
