import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Module-level cache: PostCard can mount many times per feed (Feed,
// PostDetail, SavedPosts, CompanyProfile all render it), but every instance
// needs the same answer to "does this viewer want autoplay". Caching here
// avoids a duplicate profiles fetch per video post while keeping each of
// those four call sites untouched -- they don't need to know this setting
// exists at all.
let cachedValue: boolean | null = null;
let inFlight: Promise<boolean> | null = null;

async function fetchAutoplayPreference(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from('profiles')
    .select('autoplay_videos')
    .eq('user_id', user.id)
    .maybeSingle();
  return data?.autoplay_videos ?? false;
}

/** Read-only, session-cached view of the viewer's autoplay_videos preference. */
export function useAutoplayPreference(): boolean {
  const [value, setValue] = useState<boolean>(cachedValue ?? false);

  useEffect(() => {
    let cancelled = false;

    if (cachedValue !== null) {
      setValue(cachedValue);
      return;
    }
    if (!inFlight) {
      inFlight = fetchAutoplayPreference();
    }
    inFlight.then((result) => {
      cachedValue = result;
      inFlight = null;
      if (!cancelled) setValue(result);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return value;
}

/** Called by useProfileSettings after a successful save so any already-mounted PostCard picks up the change without a reload. */
export function setCachedAutoplayPreference(value: boolean) {
  cachedValue = value;
}
