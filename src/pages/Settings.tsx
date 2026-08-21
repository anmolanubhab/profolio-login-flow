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
import { Lock, LogOut, Eye } from 'lucide-react';

interface ProfileSettings {
  profile_visibility: string;
  open_to_work: boolean;
  open_to_work_visibility: string;
}

const Settings = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ProfileSettings>({
    profile_visibility: 'public',
    open_to_work: false,
    open_to_work_visibility: 'public',
  });
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
        .select('profile_visibility, open_to_work, open_to_work_visibility')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setSettings({
          profile_visibility: data.profile_visibility || 'public',
          open_to_work: data.open_to_work || false,
          open_to_work_visibility: data.open_to_work_visibility || 'public',
        });
      }
      setLoading(false);
    };

    init();
  }, [navigate]);

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
