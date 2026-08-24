import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProfileSettings {
  profile_visibility: string;
  open_to_work: boolean;
  open_to_work_visibility: string;
  email_visibility: string;
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

      const { data, error } = await supabase
        .from('profiles')
        .select('id, profile_visibility, open_to_work, open_to_work_visibility, email_visibility, email')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setSettings({
          profile_visibility: data.profile_visibility || 'public',
          open_to_work: data.open_to_work || false,
          open_to_work_visibility: data.open_to_work_visibility || 'public',
          email_visibility: data.email_visibility || 'private',
        });
        setProfileId(data.id);
        await fetchPrivacyLists(data.id);

        // profiles.email has historically never been populated (no signup
        // flow ever wrote it). Email visibility has nothing to show without
        // it, so backfill it here from the authenticated user's own auth
        // email -- own row only, and only when it's currently empty, so an
        // existing value (or another user's row) is never touched/overwritten.
        if (!data.email && user.email) {
          supabase
            .from('profiles')
            .update({ email: user.email })
            .eq('user_id', user.id)
            .is('email', null)
            .then(({ error: backfillError }) => {
              if (backfillError) console.error('Error backfilling profile email:', backfillError);
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
    toggleOpenToWork,
    updateOpenToWorkVisibility,
    unblock,
    unsnooze,
  };
}
