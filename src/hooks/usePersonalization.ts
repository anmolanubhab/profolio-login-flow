import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// profiles.preferences.personalized_recommendations — default ON. Read-only,
// session-cached view for the surfaces that personalise from your activity
// (currently the "For You" feed ranking). Mirrors useNotificationPreferences.
const CHANGED_EVENT = 'profolio:personalization-changed';
let cached: boolean | null = null;
let inFlight: Promise<boolean> | null = null;

async function fetchValue(): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return true;
  const { data } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('user_id', user.id)
    .maybeSingle();
  const v = (data?.preferences as Record<string, unknown> | null)?.personalized_recommendations;
  return v === false ? false : true; // default true unless explicitly disabled
}

/** Called by the settings panel after it persists a change. */
export function publishPersonalizationChange(next: boolean) {
  cached = next;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
}

export function usePersonalizationValue(): boolean {
  const [value, setValue] = useState<boolean>(cached ?? true);

  useEffect(() => {
    let cancelled = false;

    if (cached !== null) {
      setValue(cached);
    } else {
      if (!inFlight) inFlight = fetchValue();
      inFlight.then((v) => {
        cached = v;
        inFlight = null;
        if (!cancelled) setValue(v);
      });
    }

    const onChanged = () => {
      if (!cancelled && cached !== null) setValue(cached);
    };
    window.addEventListener(CHANGED_EVENT, onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(CHANGED_EVENT, onChanged);
    };
  }, []);

  return value;
}
