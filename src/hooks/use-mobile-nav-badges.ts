import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface NavBadges {
  /** Pending connection invitations received (Network tab). */
  network: number;
  /** Unread messages addressed to the current user (Messages tab). */
  messages: number;
}

const EMPTY: NavBadges = { network: 0, messages: 0 };

/**
 * Small, real unread counts for the mobile bottom nav. One fetch on mount +
 * on every route change (so a count clears right after you visit that section),
 * plus a lightweight realtime nudge on the two source tables. Never fabricates
 * a count -- returns 0 when there's nothing or the user isn't signed in.
 */
export function useMobileNavBadges(): NavBadges {
  const [badges, setBadges] = useState<NavBadges>(EMPTY);
  const { pathname } = useLocation();
  const runningRef = useRef(false);

  const refresh = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setBadges(EMPTY);
        return;
      }

      const [{ data: counts }, { data: convos }] = await Promise.all([
        supabase.rpc('network_counts'),
        supabase
          .from('conversations')
          .select('id')
          .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`),
      ]);

      let messages = 0;
      const convoIds = (convos ?? []).map((c) => c.id);
      if (convoIds.length > 0) {
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .in('conversation_id', convoIds)
          .eq('is_read', false)
          .neq('sender_id', user.id);
        messages = count ?? 0;
      }

      setBadges({
        network: counts?.[0]?.pending_received ?? 0,
        messages,
      });
    } catch {
      // Non-critical: a failed badge fetch just leaves the last known counts.
    } finally {
      runningRef.current = false;
    }
  }, []);

  // Fetch on mount and whenever the route changes.
  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  // Realtime nudge: re-fetch (debounced) when the source tables change.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const nudge = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 800);
    };

    const channel = supabase
      .channel('mobile-nav-badges')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, nudge)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, nudge)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return badges;
}
