import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { publishPersonalizationChange } from '@/hooks/usePersonalization';
import { fetchMyPreferences, patchMyPreferences } from '@/lib/mySettings';
import {
  DATA_USE_DEFAULTS,
  type DataUsePrefKey,
} from '@/config/advertisingDataConfig';
import {
  EMPTY_ADVERTISING_DATA_SNAPSHOT,
  type AdvertisingDataSnapshot,
} from '@/lib/advertisingDataSummary';

/**
 * Single source of truth for the Settings -> Advertising data page and its
 * detail screens.
 *
 *  - Reads the caller's own profile row (id, preferences, location, skills).
 *  - Merges profiles.preferences.data_use with DATA_USE_DEFAULTS and surfaces
 *    profiles.preferences.personalized_recommendations (default true).
 *  - Persists changes with a read-modify-write on the `preferences` jsonb so
 *    sibling keys (notifications, mentions_from, ...) survive. Optimistic UI
 *    with rollback on failure, matching useProfileSettings.
 *  - Loads a small live snapshot of the underlying data (counts + current
 *    employer + profile location) so the list rows and detail pages show the
 *    user's real state, never a hard-coded value.
 *
 * No new tables. All reads are the caller's own rows, enforced by existing RLS.
 */

export interface AdvertisingDataPrefs
  extends Record<DataUsePrefKey, boolean> {
  personalized_recommendations: boolean;
}

export type { AdvertisingDataSnapshot };

function readPrefBool(prefs: unknown, key: string, fallback: boolean): boolean {
  const v = (prefs as Record<string, unknown> | null)?.[key];
  return typeof v === 'boolean' ? v : fallback;
}

function mergePrefs(preferences: unknown): AdvertisingDataPrefs {
  const p = (preferences as Record<string, unknown> | null) ?? {};
  const dataUse = (p.data_use as Record<string, unknown> | null) ?? {};
  const out = { ...DATA_USE_DEFAULTS } as AdvertisingDataPrefs;
  (Object.keys(DATA_USE_DEFAULTS) as DataUsePrefKey[]).forEach((k) => {
    out[k] = typeof dataUse[k] === 'boolean' ? (dataUse[k] as boolean) : DATA_USE_DEFAULTS[k];
  });
  out.personalized_recommendations = readPrefBool(p, 'personalized_recommendations', true);
  return out;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
}

export function useAdvertisingDataSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<AdvertisingDataPrefs>(() => mergePrefs(null));
  const [data, setData] = useState<AdvertisingDataSnapshot>(EMPTY_ADVERTISING_DATA_SNAPSHOT);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('You need to be signed in.');
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const [{ data: profile, error: pErr }, myPrefs] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, location, skills')
          .eq('user_id', user.id)
          .maybeSingle(),
        // `preferences` is no longer directly selectable — read own copy via RPC
        fetchMyPreferences(),
      ]);
      if (pErr) throw pErr;
      if (!profile) {
        setError('We couldn’t find your profile.');
        setLoading(false);
        return;
      }
      setProfileId(profile.id);
      setPrefs(mergePrefs(myPrefs));

      const inlineSkills = Array.isArray(profile.skills) ? profile.skills.length : 0;

      const [
        connectionsRes,
        companiesRes,
        groupsRes,
        educationRes,
        skillsRes,
        languagesRes,
        experienceRes,
      ] = await Promise.all([
        supabase
          .from('connections')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'accepted')
          .or(`user_id.eq.${profile.id},connection_id.eq.${profile.id}`),
        supabase
          .from('company_followers')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id),
        supabase
          .from('group_members')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('education')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id),
        supabase
          .from('skills')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id),
        supabase
          .from('languages')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id),
        supabase
          .from('experience')
          .select('company, is_current, start_date')
          .eq('user_id', profile.id)
          .order('start_date', { ascending: false }),
      ]);

      const experienceRows = experienceRes.data ?? [];
      const current = experienceRows.find((r) => r.is_current)?.company ?? null;

      setData({
        connections: connectionsRes.count ?? 0,
        companiesFollowed: companiesRes.count ?? 0,
        groups: groupsRes.count ?? 0,
        education: educationRes.count ?? 0,
        skills: (skillsRes.count ?? 0) || inlineSkills,
        languages: languagesRes.count ?? 0,
        experience: experienceRows.length,
        currentEmployer: current,
        profileLocation:
          typeof profile.location === 'string' && profile.location.trim()
            ? profile.location.trim()
            : null,
      });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Persist profiles.preferences.data_use.<key>. The server deep-merges just
   * this sub-key into the current row (update_my_preferences_patch), so a
   * concurrent write to a different data_use key — or any other preference —
   * can't be clobbered; no read-before-write.
   */
  const setDataUsePref = useCallback(
    async (key: DataUsePrefKey, value: boolean) => {
      const uid = userId;
      if (!uid) return;
      const previous = prefs[key];
      if (previous === value) return;
      setPrefs((p) => ({ ...p, [key]: value }));
      setSaving(key);
      try {
        await patchMyPreferences({ data_use: { [key]: value } });
        toast({ title: value ? 'Preference turned on' : 'Preference turned off' });
      } catch (e) {
        setPrefs((p) => ({ ...p, [key]: previous }));
        toast({ title: 'Couldn’t save', description: errMsg(e), variant: 'destructive' });
      } finally {
        setSaving(null);
      }
    },
    [userId, prefs, toast],
  );

  /**
   * The ONE canonical write path for
   * profiles.preferences.personalized_recommendations (Advertising data →
   * Interests and traits). Feed.tsx reads it via usePersonalizationValue().
   */
  const setPersonalizedRecommendations = useCallback(
    async (value: boolean) => {
      const uid = userId;
      if (!uid) return;
      const previous = prefs.personalized_recommendations;
      if (previous === value) return;
      setPrefs((p) => ({ ...p, personalized_recommendations: value }));
      publishPersonalizationChange(value);
      setSaving('personalized_recommendations');
      try {
        await patchMyPreferences({ personalized_recommendations: value });
        toast({
          title: value
            ? 'Your feed will be personalised from your activity.'
            : 'Your “For You” feed will now be shown newest‑first.',
        });
      } catch (e) {
        setPrefs((p) => ({ ...p, personalized_recommendations: previous }));
        publishPersonalizationChange(previous);
        toast({ title: 'Couldn’t save', description: errMsg(e), variant: 'destructive' });
      } finally {
        setSaving(null);
      }
    },
    [userId, prefs.personalized_recommendations, toast],
  );

  return {
    loading,
    error,
    saving,
    profileId,
    prefs,
    data,
    reload: load,
    setDataUsePref,
    setPersonalizedRecommendations,
  };
}
