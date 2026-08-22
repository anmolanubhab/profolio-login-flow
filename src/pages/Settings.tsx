import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Lock, LogOut, Eye, UserX, Clock, X } from 'lucide-react';

interface ProfileSettings {
  profile_visibility: string;
  open_to_work: boolean;
  open_to_work_visibility: string;
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

const Settings = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ProfileSettings>({
    profile_visibility: 'public',
    open_to_work: false,
    open_to_work_visibility: 'public',
  });
  const [blocked, setBlocked] = useState<BlockedEntry[]>([]);
  const [snoozed, setSnoozed] = useState<SnoozedEntry[]>([]);
  const [loadingPrivacyLists, setLoadingPrivacyLists] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }
      setUser(user);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, profile_visibility, open_to_work, open_to_work_visibility')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setSettings({
          profile_visibility: data.profile_visibility || 'public',
          open_to_work: data.open_to_work || false,
          open_to_work_visibility: data.open_to_work_visibility || 'public',
        });
        setProfileId(data.id);
        await fetchPrivacyLists(data.id);
      }
      setLoading(false);
    };

    init();
  }, [navigate]);

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

  const handleUnblock = async (entry: BlockedEntry) => {
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

  const handleUnsnooze = async (entry: SnoozedEntry) => {
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

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      navigate('/');
    }
  };

  const handleVisibilityChange = async (value: string) => {
    if (!user) return;
    setSettings((prev) => ({ ...prev, profile_visibility: value }));
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ profile_visibility: value })
        .eq('user_id', user.id);

      if (error) throw error;
      toast({
        title: "Success",
        description: "Profile visibility updated.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenToWorkToggle = async (checked: boolean) => {
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
        title: "Success",
        description: checked ? "You're now marked as open to work." : "Open to work turned off.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenToWorkVisibilityChange = async (value: string) => {
    if (!user) return;
    setSettings((prev) => ({ ...prev, open_to_work_visibility: value }));
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ open_to_work_visibility: value })
        .eq('user_id', user.id);

      if (error) throw error;
      toast({
        title: "Success",
        description: "Open to work visibility updated.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout user={user!} onSignOut={handleSignOut}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user!} onSignOut={handleSignOut}>
      <div className="container mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your privacy and account preferences</p>
        </div>

        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Privacy
            </CardTitle>
            <CardDescription>Control who can see your profile and activity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="profile_visibility">Profile Visibility</Label>
              <Select
                value={settings.profile_visibility}
                onValueChange={handleVisibilityChange}
                disabled={saving}
              >
                <SelectTrigger id="profile_visibility" className="bg-background/50 border-muted focus:border-primary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public - Everyone can view</SelectItem>
                  <SelectItem value="connections_only">Connections Only - Only connected users</SelectItem>
                  <SelectItem value="private">Private - Only you can view</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Control who can see your full profile information
              </p>
            </div>

            <Separator className="bg-muted/30" />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="open_to_work" className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Open to Work
                </Label>
                <p className="text-xs text-muted-foreground">
                  Let recruiters and your network know you're open to new opportunities
                </p>
              </div>
              <Switch
                id="open_to_work"
                checked={settings.open_to_work}
                onCheckedChange={handleOpenToWorkToggle}
                disabled={saving}
              />
            </div>

            {settings.open_to_work && (
              <div className="space-y-2">
                <Label htmlFor="open_to_work_visibility">Open to Work Visibility</Label>
                <Select
                  value={settings.open_to_work_visibility}
                  onValueChange={handleOpenToWorkVisibilityChange}
                  disabled={saving}
                >
                  <SelectTrigger id="open_to_work_visibility" className="bg-background/50 border-muted focus:border-primary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public - Everyone can see</SelectItem>
                    <SelectItem value="connections_only">Connections Only</SelectItem>
                    <SelectItem value="private">Private - Recruiters only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5" />
              Blocked &amp; Snoozed
            </CardTitle>
            <CardDescription>Manage people and companies you've blocked or snoozed from your feed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loadingPrivacyLists ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Clock className="h-4 w-4" /> Snoozed / Hidden</Label>
                  {snoozed.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nothing snoozed or hidden right now.</p>
                  ) : (
                    <div className="space-y-1">
                      {snoozed.map((entry) => (
                        <div key={entry.key} className="flex items-center justify-between rounded-md bg-background/50 px-3 py-2">
                          <div>
                            <p className="text-sm font-medium">{entry.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {entry.isHiddenAll ? 'Hidden indefinitely' : `Snoozed until ${new Date(entry.snoozedUntil).toLocaleDateString()}`}
                            </p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => handleUnsnooze(entry)}>
                            <X className="h-4 w-4 mr-1" /> Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator className="bg-muted/30" />

                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><UserX className="h-4 w-4" /> Blocked</Label>
                  {blocked.length === 0 ? (
                    <p className="text-xs text-muted-foreground">You haven't blocked anyone.</p>
                  ) : (
                    <div className="space-y-1">
                      {blocked.map((entry) => (
                        <div key={entry.key} className="flex items-center justify-between rounded-md bg-background/50 px-3 py-2">
                          <p className="text-sm font-medium">{entry.name}</p>
                          <Button variant="ghost" size="sm" onClick={() => handleUnblock(entry)}>
                            <X className="h-4 w-4 mr-1" /> Unblock
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Manage your account session</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleSignOut} className="w-full sm:w-auto">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Settings;
