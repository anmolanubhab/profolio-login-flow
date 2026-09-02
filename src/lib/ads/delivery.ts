import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { Campaign } from '@/lib/ads/api';

/**
 * Phase I — controlled ad delivery (test mode).
 *
 * The client never queries ads. `feed_pick_sponsored_ad` (SECURITY DEFINER)
 * returns at most one ad's render-minimal payload — no ad_set / campaign /
 * account ids, no targeting spec, no audience membership — and only when the
 * viewer is on the server-side test-user allowlist. Impression / click go
 * through RPCs that re-check eligibility and dedup; the `ad_delivery_events`
 * table is RLS-on / no-policy, so nothing else can write it.
 */

export type SponsoredAd = {
  ad_id: string;
  format: Database['public']['Enums']['ad_format'];
  headline: string;
  body: string | null;
  cta_label: string | null;
  destination_url: string;
  media_url: string | null;
  sponsor_name: string;
};

const SESSION_KEY_STORAGE = 'profolio:ad-session';

/** A per-tab-session id — used only to dedup delivery events; not identifying. */
export function getAdSessionKey(): string {
  try {
    let k = sessionStorage.getItem(SESSION_KEY_STORAGE);
    if (!k) {
      k = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY_STORAGE, k);
    }
    return k;
  } catch {
    return 'nosession';
  }
}

/** Ask the server for one sponsored ad for the current viewer. `null` = show nothing. */
export async function pickSponsoredAd(): Promise<SponsoredAd | null> {
  const { data, error } = await supabase.rpc('feed_pick_sponsored_ad', {
    _session_key: getAdSessionKey(),
  });
  if (error || !data || data.length === 0) return null;
  const row = data[0] as SponsoredAd;
  if (!row?.ad_id || !row.destination_url) return null;
  return row;
}

export async function recordAdImpression(adId: string): Promise<void> {
  const { error } = await supabase.rpc('ad_record_impression', {
    _ad_id: adId,
    _session_key: getAdSessionKey(),
  });
  if (error) throw new Error(error.message);
}

export async function recordAdClick(adId: string): Promise<void> {
  const { error } = await supabase.rpc('ad_record_click', {
    _ad_id: adId,
    _session_key: getAdSessionKey(),
  });
  if (error) throw new Error(error.message);
}

// ---- campaign delivery state (activate = admin only; pause = admin or owner) ----

export async function activateCampaign(campaignId: string): Promise<Campaign> {
  const { data, error } = await supabase.rpc('activate_campaign', { _campaign_id: campaignId });
  if (error) throw new Error(error.message);
  return data as unknown as Campaign;
}

export async function pauseCampaign(campaignId: string): Promise<Campaign> {
  const { data, error } = await supabase.rpc('pause_campaign', { _campaign_id: campaignId });
  if (error) throw new Error(error.message);
  return data as unknown as Campaign;
}

// ---- test-user allowlist (admin) ----

export interface DeliveryTestUser {
  profile_id: string;
  name: string;
  added_at: string;
}

export async function listDeliveryTestUsers(): Promise<DeliveryTestUser[]> {
  const { data, error } = await supabase
    .from('ad_delivery_test_users')
    .select('profile_id, added_at')
    .order('added_at', { ascending: false });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, full_name')
    .in(
      'id',
      rows.map((r) => r.profile_id),
    );
  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id, p.display_name || p.full_name || 'Member']),
  );
  return rows.map((r) => ({
    profile_id: r.profile_id,
    name: nameById.get(r.profile_id) ?? 'Member',
    added_at: r.added_at,
  }));
}

export async function setDeliveryTestUser(profileId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_ad_delivery_test_user', {
    _profile_id: profileId,
    _enabled: enabled,
  });
  if (error) throw new Error(error.message);
}

/** The signed-in user's own profile id (profiles.id), for adding yourself as a test user. */
export async function currentProfileId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('id').eq('user_id', user.id).maybeSingle();
  return data?.id ?? null;
}
