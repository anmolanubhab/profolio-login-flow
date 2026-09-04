import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { setCachedAutoplayPreference } from '@/hooks/useAutoplayPreference';
import { fetchMySettings, patchMyPreferences } from '@/lib/mySettings';

interface ProfileSettings {
  profile_visibility: string;
  open_to_work: boolean;
  open_to_work_visibility: string;
  email_visibility: string;
  phone_visibility: string;
  connections_visibility: string;
  last_name_visibility: string;
  profile_discovery: boolean;
  autoplay_videos: boolean;
  allow_recruiter_search: boolean;
  allow_recruiter_profile_view: boolean;
  share_pdf_resume_with_recruiters: boolean;
  share_online_resume_with_recruiters: boolean;
  share_professional_links_with_recruiters: boolean;
  /** Stored in profiles.preferences.mentions_from — everyone | connections | nobody */
  mentions_from: string;
  /** profiles.preferences.show_active_status — show an "Active now" indicator (default: true) */
  show_active_status: boolean;
  /** profiles.preferences.share_profile_updates — notify connections on profile edits (default: false) */
  share_profile_updates: boolean;
}

const MENTIONS_FROM_VALUES = ['everyone', 'connections', 'nobody'] as const;
function readMentionsFrom(preferences: unknown): string {
  const v = (preferences as Record<string, unknown> | null)?.mentions_from;
  return typeof v === 'string' && (MENTIONS_FROM_VALUES as readonly string[]).includes(v)
    ? v
    : 'everyone';
}
function readPrefBool(preferences: unknown, key: string, fallback: boolean): boolean {
  const v = (preferences as Record<string, unknown> | null)?.[key];
  return typeof v === 'boolean' ? v : fallback;
}

interface BlockedEntry {
  key: string;
  kind: 'user' | 'company';
  targetId: string;
  name: string;
}

interface SnoozedEntry extends BlockedEntry {
  snoozedUntil: string;
  isHiddenAll: boolean;
}

const HIDE_ALL_THRESHOLD_MS = 365 * 24 * 60 * 60 * 1000;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

/**
 * The real, working profile-level privacy settings: profile visibility,
 * open-to-work + its visibility, and the blocked/snoozed users & companies
 * lists. Extracted verbatim from the old flat /settings page so the new
 * Visibility settings panel (and anything else that needs it) can share one
 * source of truth instead of re-fetching/re-implementing this logic.
 */
export function useProfileSettings() {
  const [user, setUser] = useState<User | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ProfileSettings>({
    profile_visibility: 'public',
    open_to_work: false,
    open_to_work_visibility: 'public',
    email_visibility: 'private',
    phone_visibility: 'private',
    connections_visibility: 'private',
    last_name_visibility: 'private',
    profile_discovery: true,
    autoplay_videos: false,
    allow_recruiter_search: false,
    allow_recruiter_profile_view: false,
    share_pdf_resume_with_recruiters: false,
    share_online_resume_with_recruiters: false,
    share_professional_links_with_recruiters: false,
    mentions_from: 'everyone',
    show_active_status: true,
    share_profile_updates: false,
  });
  const [blocked, setBlocked] = useState<BlockedEntry[]>([]);
  const [snoozed, setSnoozed] = useState<SnoozedEntry[]>([]);
  const [loadingPrivacyLists, setLoadingPrivacyLists] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUser(user);

      // Safe columns come straight off `profiles`; the owner-only columns
      // (`preferences`, the recruiter-sharing flags, the *_visibility values)
      // were revoked from a direct client SELECT and come via get_my_settings().
      const [{ data, error }, mySettings] = await Promise.all([
        supabase
          .from('profiles')
          .select(
            'id, profile_visibility, open_to_work, last_name_visibility, profile_discovery, autoplay_videos, email',
          )
          .eq('user_id', user.id)
          .maybeSingle(),
        fetchMySettings(),
      ]);

      if (!error && data) {
        const prefs = (mySettings?.preferences as Record<string, unknown> | null) ?? null;
        setSettings({
          profile_visibility: data.profile_visibility || 'public',
          open_to_work: data.open_to_work || false,
          open_to_work_visibility: mySettings?.open_to_work_visibility || 'public',
          email_visibility: mySettings?.email_visibility || 'private',
          phone_visibility: mySettings?.phone_visibility || 'private',
          connections_visibility: mySettings?.connections_visibility || 'private',
          last_name_visibility: data.last_name_visibility || 'private',
          // Booleans, not strings: `??` (not `||`) so an explicit `false`
          // from the DB isn't coerced back to the default.
          profile_discovery: data.profile_discovery ?? true,
          autoplay_videos: data.autoplay_videos ?? false,
          allow_recruiter_search: mySettings?.allow_recruiter_search ?? false,
          allow_recruiter_profile_view: mySettings?.allow_recruiter_profile_view ?? false,
          share_pdf_resume_with_recruiters: mySettings?.share_pdf_resume_with_recruiters ?? false,
          share_online_resume_with_recruiters: mySettings?.share_online_resume_with_recruiters ?? false,
          share_professional_links_with_recruiters:
            mySettings?.share_professional_links_with_recruiters ?? false,
          mentions_from: readMentionsFrom(prefs),
          show_active_status: readPrefBool(prefs, 'show_active_status', true),
          share_profile_updates: readPrefBool(prefs, 'share_profile_updates', false),
        });
        setProfileId(data.id);
        await fetchPrivacyLists(data.id);

        // auth.users.email is the source of truth; profiles.email is a
        // display-layer copy (what Email Visibility actually shows on the
        // public profile). Reconcile them here whenever they differ -- this
        // covers both the original never-populated case and a user
        // completing an email change (they only get a fresh session with
        // the new auth email once they've clicked the confirmation link, so
        // this naturally fires only after the change is truly confirmed,
        // never on the unconfirmed/pending address). Own row only, via
        // user_id = the caller's own auth id; a plain equality check, not a
        // blind overwrite, so a genuinely matching value is a no-op.
        if (user.email && data.email !== user.email) {
          supabase
            .from('profiles')
            .update({ email: user.email })
            .eq('user_id', user.id)
            .then(({ error: syncError }) => {
              if (syncError) console.error('Error syncing profile email:', syncError);
            });
        }
      }
      setLoading(false);
    };

    init();
  }, []);

  const fetchPrivacyLists = async (pid: string) => {
    setLoadingPrivacyLists(true);
    try {
      const [blockedUsersRes, blockedCompaniesRes, snoozedUsersRes, snoozedCompaniesRes] = await Promise.all([
        supabase.from('blocked_users').select('blocked_user_id').eq('user_id', pid),
        supabase.from('blocked_companies').select('blocked_company_id').eq('user_id', pid),
        supabase.from('snoozed_users').select('snoozed_user_id, snoozed_until').eq('user_id', pid).gt('snoozed_until', new Date().toISOString()),
        supabase.from('snoozed_companies').select('snoozed_company_id, snoozed_until').eq('user_id', pid).gt('snoozed_until', new Date().toISOString()),
      ]);

      const blockedUserIds = (blockedUsersRes.data || []).map((r) => r.blocked_user_id);
      const blockedCompanyIds = (blockedCompaniesRes.data || []).map((r) => r.blocked_company_id);
      const snoozedUserIds = (snoozedUsersRes.data || []).map((r) => r.snoozed_user_id);
      const snoozedCompanyIds = (snoozedCompaniesRes.data || []).map((r) => r.snoozed_company_id);

      const allProfileIds = [...new Set([...blockedUserIds, ...snoozedUserIds])];
      const allCompanyIds = [...new Set([...blockedCompanyIds, ...snoozedCompanyIds])];

      const [profilesRes, companiesRes] = await Promise.all([
        allProfileIds.length ? supabase.from('profiles').select('id, display_name').in('id', allProfileIds) : Promise.resolve({ data: [] }),
        allCompanyIds.length ? supabase.from('companies').select('id, name').in('id', allCompanyIds) : Promise.resolve({ data: [] }),
      ]);

      const profileNames = new Map((profilesRes.data || []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name || 'Unknown user']));
      const companyNames = new Map((companiesRes.data || []).map((c: { id: string; name: string | null }) => [c.id, c.name || 'Unknown company']));

      setBlocked([
        ...blockedUserIds.map((id) => ({ key: `u-${id}`, kind: 'user' as const, targetId: id, name: profileNames.get(id) || 'Unknown user' })),
        ...blockedCompanyIds.map((id) => ({ key: `c-${id}`, kind: 'company' as const, targetId: id, name: companyNames.get(id) || 'Unknown company' })),
      ]);

      setSnoozed([
        ...(snoozedUsersRes.data || []).map((r) => ({
          key: `u-${r.snoozed_user_id}`,
          kind: 'user' as const,
          targetId: r.snoozed_user_id,
          name: profileNames.get(r.snoozed_user_id) || 'Unknown user',
          snoozedUntil: r.snoozed_until,
          isHiddenAll: new Date(r.snoozed_until).getTime() - Date.now() > HIDE_ALL_THRESHOLD_MS,
        })),
        ...(snoozedCompaniesRes.data || []).map((r) => ({
          key: `c-${r.snoozed_company_id}`,
          kind: 'company' as const,
          targetId: r.snoozed_company_id,
          name: companyNames.get(r.snoozed_company_id) || 'Unknown company',
          snoozedUntil: r.snoozed_until,
          isHiddenAll: new Date(r.snoozed_until).getTime() - Date.now() > HIDE_ALL_THRESHOLD_MS,
        })),
      ]);
    } catch (error) {
      console.error('Error loading blocked/snoozed lists:', error);
    } finally {
      setLoadingPrivacyLists(false);
    }
  };

  const unblock = async (entry: BlockedEntry) => {
    if (!profileId) return;
    try {
      if (entry.kind === 'user') {
        await supabase.from('blocked_users').delete().eq('user_id', profileId).eq('blocked_user_id', entry.targetId);
      } else {
        await supabase.from('blocked_companies').delete().eq('user_id', profileId).eq('blocked_company_id', entry.targetId);
      }
      setBlocked((prev) => prev.filter((b) => b.key !== entry.key));
      toast({ title: `Unblocked ${entry.name}` });
    } catch (error) {
      console.error('Error unblocking:', error);
      toast({ title: 'Error', description: 'Could not unblock. Please try again.', variant: 'destructive' });
    }
  };

  const unsnooze = async (entry: SnoozedEntry) => {
    if (!profileId) return;
    try {
      if (entry.kind === 'user') {
        await supabase.from('snoozed_users').delete().eq('user_id', profileId).eq('snoozed_user_id', entry.targetId);
      } else {
        await supabase.from('snoozed_companies').delete().eq('user_id', profileId).eq('snoozed_company_id', entry.targetId);
      }
      setSnoozed((prev) => prev.filter((s) => s.key !== entry.key));
      toast({ title: `Removed snooze for ${entry.name}` });
    } catch (error) {
      console.error('Error removing snooze:', error);
      toast({ title: 'Error', description: 'Could not remove snooze. Please try again.', variant: 'destructive' });
    }
  };

  const updateVisibility = async (value: string) => {
    if (!user) return;
    setSettings((prev) => ({ ...prev, profile_visibility: value }));
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ profile_visibility: value })
        .eq('user_id', user.id);

      if (error) throw error;
      toast({ title: 'Success', description: 'Profile visibility updated.' });
    } catch (error) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateEmailVisibility = async (value: string) => {
    if (!user) return;
    setSettings((prev) => ({ ...prev, email_visibility: value }));
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ email_visibility: value })
        .eq('user_id', user.id);

      if (error) throw error;
      toast({ title: 'Success', description: 'Email visibility updated.' });
    } catch (error) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updatePhoneVisibility = async (value: string) => {
    if (!user) return;
    setSettings((prev) => ({ ...prev, phone_visibility: value }));
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ phone_visibility: value })
        .eq('user_id', user.id);

      if (error) throw error;
      toast({ title: 'Success', description: 'Phone visibility updated.' });
    } catch (error) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateConnectionsVisibility = async (value: string) => {
    if (!user) return;
    setSettings((prev) => ({ ...prev, connections_visibility: value }));
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ connections_visibility: value })
        .eq('user_id', user.id);

      if (error) throw error;
      toast({ title: 'Success', description: 'Connections visibility updated.' });
    } catch (error) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateLastNameVisibility = async (value: string) => {
    if (!user) return;
    setSettings((prev) => ({ ...prev, last_name_visibility: value }));
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ last_name_visibility: value })
        .eq('user_id', user.id);

      if (error) throw error;
      toast({ title: 'Success', description: 'Last name visibility updated.' });
    } catch (error) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleOpenToWork = async (checked: boolean) => {
    if (!user) return;
    setSettings((prev) => ({ ...prev, open_to_work: checked }));
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ open_to_work: checked })
        .eq('user_id', user.id);

      if (error) throw error;
      toast({
        title: 'Success',
        description: checked ? "You're now marked as open to work." : 'Open to work turned off.',
      });
    } catch (error) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleProfileDiscovery = async (checked: boolean) => {
    if (!user) return;
    setSettings((prev) => ({ ...prev, profile_discovery: checked }));
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ profile_discovery: checked })
        .eq('user_id', user.id);

      if (error) throw error;
      toast({
        title: 'Success',
        description: checked
          ? "You're now discoverable in search and suggestions."
          : "You're now hidden from search and suggestions.",
      });
    } catch (error) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleAutoplayVideos = async (checked: boolean) => {
    if (!user) return;
    setSettings((prev) => ({ ...prev, autoplay_videos: checked }));
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ autoplay_videos: checked })
        .eq('user_id', user.id);

      if (error) throw error;
      setCachedAutoplayPreference(checked);
      toast({
        title: 'Success',
        description: checked ? 'Videos will now autoplay as you scroll.' : 'Videos will no longer autoplay.',
      });
    } catch (error) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleAllowRecruiterSearch = async (checked: boolean) => {
    if (!user) return;
    setSettings((prev) => ({ ...prev, allow_recruiter_search: checked }));
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ allow_recruiter_search: checked })
        .eq('user_id', user.id);

      if (error) throw error;
      toast({
        title: 'Success',
        description: checked
          ? 'Authorized recruiters can now discover your profile in candidate search.'
          : "You're no longer discoverable in recruiter candidate search.",
      });
    } catch (error) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleAllowRecruiterProfileView = async (checked: boolean) => {
    if (!user) return;
    setSettings((prev) => ({ ...prev, allow_recruiter_profile_view: checked }));
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ allow_recruiter_profile_view: checked })
        .eq('user_id', user.id);

      if (error) throw error;
      toast({
        title: 'Success',
        description: checked
          ? 'Authorized recruiters can now view your professional profile details.'
          : 'Recruiters can no longer view your professional profile details.',
      });
    } catch (error) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleSharePdfResume = async (checked: boolean) => {
    if (!user) return;
    setSettings((prev) => ({ ...prev, share_pdf_resume_with_recruiters: checked }));
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ share_pdf_resume_with_recruiters: checked })
        .eq('user_id', user.id);

      if (error) throw error;
      toast({
        title: 'Success',
        description: checked
          ? 'Authorized recruiters can now view your PDF resume, where you share it on an application.'
          : 'Recruiters can no longer view your PDF resume.',
      });
    } catch (error) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleShareOnlineResume = async (checked: boolean) => {
    if (!user) return;
    setSettings((prev) => ({ ...prev, share_online_resume_with_recruiters: checked }));
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ share_online_resume_with_recruiters: checked })
        .eq('user_id', user.id);

      if (error) throw error;
      toast({
        title: 'Success',
        description: checked
          ? 'Authorized recruiters can now view your online resume link.'
          : 'Recruiters can no longer view your online resume link.',
      });
    } catch (error) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleShareProfessionalLinks = async (checked: boolean) => {
    if (!user) return;
    setSettings((prev) => ({ ...prev, share_professional_links_with_recruiters: checked }));
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ share_professional_links_with_recruiters: checked })
        .eq('user_id', user.id);

      if (error) throw error;
      toast({
        title: 'Success',
        description: checked
          ? 'Authorized recruiters can now view your professional profile links.'
          : 'Recruiters can no longer view your professional profile links.',
      });
    } catch (error) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateOpenToWorkVisibility = async (value: string) => {
    if (!user) return;
    setSettings((prev) => ({ ...prev, open_to_work_visibility: value }));
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ open_to_work_visibility: value })
        .eq('user_id', user.id);

      if (error) throw error;
      toast({ title: 'Success', description: 'Open to work visibility updated.' });
    } catch (error) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // profiles.preferences (jsonb) writer. The server deep-merges just this key
  // into the current row (update_my_preferences_patch), so a concurrent writer
  // touching a different key can't be clobbered and no read-before-write is
  // needed. One generic helper.
  const updatePrefKey = async (
    key: 'mentions_from' | 'show_active_status' | 'share_profile_updates',
    value: string | boolean,
    successMsg: string,
    rollback: () => void,
  ) => {
    if (!user) return;
    setSaving(true);
    try {
      await patchMyPreferences({ [key]: value });
      toast({ title: 'Success', description: successMsg });
    } catch (error) {
      rollback();
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateMentionsFrom = async (value: string) => {
    const previous = settings.mentions_from;
    setSettings((prev) => ({ ...prev, mentions_from: value }));
    await updatePrefKey('mentions_from', value, 'Mention & tag settings updated.', () =>
      setSettings((prev) => ({ ...prev, mentions_from: previous })),
    );
  };

  const toggleShowActiveStatus = async (checked: boolean) => {
    const previous = settings.show_active_status;
    setSettings((prev) => ({ ...prev, show_active_status: checked }));
    await updatePrefKey(
      'show_active_status',
      checked,
      checked ? 'Others can see when you’re active.' : 'Your active status is now hidden.',
      () => setSettings((prev) => ({ ...prev, show_active_status: previous })),
    );
  };

  const toggleShareProfileUpdates = async (checked: boolean) => {
    const previous = settings.share_profile_updates;
    setSettings((prev) => ({ ...prev, share_profile_updates: checked }));
    await updatePrefKey(
      'share_profile_updates',
      checked,
      checked
        ? 'Your connections will be notified when you update your profile.'
        : 'Profile updates will no longer be shared.',
      () => setSettings((prev) => ({ ...prev, share_profile_updates: previous })),
    );
  };

  // NOTE: `personalized_recommendations` is written ONLY by
  // useAdvertisingDataSettings.setPersonalizedRecommendations (Advertising data
  // → Interests and traits). This hook used to expose a second, unused writer
  // for it — removed so there is a single canonical write path.

  return {
    user,
    loading,
    saving,
    settings,
    blocked,
    snoozed,
    loadingPrivacyLists,
    updateVisibility,
    updateEmailVisibility,
    updatePhoneVisibility,
    updateConnectionsVisibility,
    updateLastNameVisibility,
    toggleOpenToWork,
    toggleProfileDiscovery,
    toggleAutoplayVideos,
    toggleAllowRecruiterSearch,
    toggleAllowRecruiterProfileView,
    toggleSharePdfResume,
    toggleShareOnlineResume,
    toggleShareProfessionalLinks,
    updateOpenToWorkVisibility,
    updateMentionsFrom,
    toggleShowActiveStatus,
    toggleShareProfileUpdates,
    unblock,
    unsnooze,
  };
}
