import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUnreadMessageCount } from '@/hooks/use-unread-message-count';

interface NavBadges {
  /** Pending connection invitations received (Network tab). */
  network: number;
  /** Unread messages addressed to the current user (Messages tab). */
  messages: number;
}

/**
 * Small, real unread counts for the mobile bottom nav.
 *
 * `messages` comes from {@link useUnreadMessageCount} — the single app-wide
 * source of truth shared with the desktop navbar, so every "Messages" badge
 * agrees. `network` is fetched here (one call on mount + on route change, plus
 * a debounced realtime nudge on `friend_requests`). Never fabricates a count.
 */
export function useMobileNavBadges(): NavBadges {
  const [network, setNetwork] = useState(0);
  const { pathname } = useLocation();
  const runningRef = useRef(false);
  const { count: messages } = useUnreadMessageCount();

  const refresh = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setNetwork(0);
        return;
      }
      const { data: counts } = await supabase.rpc('network_counts');
      setNetwork(counts?.[0]?.pending_received ?? 0);
    } catch {
      // Non-critical: a failed badge fetch just leaves the last known count.
    } finally {
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const nudge = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 800);
    };

    const channel = supabase
      .channel('mobile-nav-badges')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, nudge)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { network, messages };
}
