import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  normalizeNotificationPreferences,
  type NotificationCategoryKey,
  type NotificationPreferences,
} from '@/lib/notificationCategories';

// Module cache + a tiny event bus so the read surfaces (NotificationBell,
// /notifications) share one answer and pick up a change the settings panel
// just saved, in the same tab, without a reload. Mirrors useAutoplayPreference.
let cached: NotificationPreferences | null = null;
let inFlight: Promise<NotificationPreferences> | null = null;
const CHANGED_EVENT = 'profolio:notification-prefs-changed';

function publish(next: NotificationPreferences) {
  cached = next;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
  }
}

async function fetchPreferences(): Promise<NotificationPreferences> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  const { data } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('user_id', user.id)
    .maybeSingle();
  const raw = (data?.preferences as Record<string, unknown> | null) ?? null;
  return normalizeNotificationPreferences(raw?.notifications);
}

/** Read-only, session-cached view of the viewer's notification category prefs. */
export function useNotificationPreferencesValue(): NotificationPreferences {
  const [value, setValue] = useState<NotificationPreferences>(
    cached ?? DEFAULT_NOTIFICATION_PREFERENCES,
  );

  useEffect(() => {
    let cancelled = false;

    if (cached) {
      setValue(cached);
    } else {
      if (!inFlight) inFlight = fetchPreferences();
      inFlight.then((result) => {
        cached = result;
        inFlight = null;
        if (!cancelled) setValue(result);
      });
    }

    // Live-update within the tab when the settings panel saves.
    const onChanged = () => {
      if (!cancelled && cached) setValue({ ...cached });
    };
    window.addEventListener(CHANGED_EVENT, onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(CHANGED_EVENT, onChanged);
    };
  }, []);

  return value;
}

/**
 * Editable notification preferences for the settings panel. Persists to the
 * existing `profiles.preferences` JSONB column under a `notifications` key --
 * no new table/column. Optimistic + auto-save + toast + rollback, matching
 * the other settings panels.
 */
export function useNotificationPreferences() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>(
    cached ?? DEFAULT_NOTIFICATION_PREFERENCES,
  );
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = cached ?? (await fetchPreferences());
      cached = result;
      if (!cancelled) {
        setPrefs(result);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setCategory = useCallback(
    async (key: NotificationCategoryKey, enabled: boolean) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const previous = prefsRef.current;
      const optimistic = { ...previous, [key]: enabled };
      setPrefs(optimistic);
      publish(optimistic);
      setSaving(true);
      try {
        // Read-modify-write: merge onto the freshest DB value so a concurrent
        // toggle of a different category isn't clobbered, and other keys under
        // `preferences` are preserved.
        const { data: row } = await supabase
          .from('profiles')
          .select('preferences')
          .eq('user_id', user.id)
          .maybeSingle();
        const currentPrefs =
          (row?.preferences as Record<string, unknown> | null) ?? {};
        const merged: NotificationPreferences = {
          ...normalizeNotificationPreferences(currentPrefs.notifications),
          [key]: enabled,
        };
        const { error } = await supabase
          .from('profiles')
          .update({ preferences: { ...currentPrefs, notifications: merged } })
          .eq('user_id', user.id);
        if (error) throw error;

        setPrefs(merged);
        publish(merged);
        toast({
          title: enabled ? 'Notifications on' : 'Notifications off',
          description: `You’ll ${enabled ? 'now' : 'no longer'} see “${key.replace(/_/g, ' ')}” notifications.`,
        });
      } catch (err) {
        setPrefs(previous);
        publish(previous);
        toast({
          title: 'Couldn’t save',
          description: err instanceof Error ? err.message : 'Please try again.',
          variant: 'destructive',
        });
      } finally {
        setSaving(false);
      }
    },
    [toast],
  );

  return { loading, saving, prefs, setCategory };
}
