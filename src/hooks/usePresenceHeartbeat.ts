import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const INTERVAL_MS = 120_000; // touch "last seen" every 2 minutes while visible

/**
 * Mounted once (in Layout). While the tab is visible, stamps
 * `profiles.last_active_at = now()` for the signed-in user so other people can
 * see an "Active now" indicator (gated by that user's `show_active_status`
 * setting on the read side). Fire-and-forget: any error (e.g. the column not
 * migrated yet) is swallowed — presence is never critical.
 */
export function usePresenceHeartbeat() {
  useEffect(() => {
    let userId: string | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const beat = async () => {
      if (cancelled || document.hidden || !userId) return;
      try {
        await supabase
          .from('profiles')
          .update({ last_active_at: new Date().toISOString() })
          .eq('user_id', userId);
      } catch {
        /* non-critical */
      }
    };

    const onVisible = () => {
      if (!document.hidden) beat();
    };

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      userId = user.id;
      beat();
      timer = setInterval(beat, INTERVAL_MS);
      document.addEventListener('visibilitychange', onVisible);
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}
