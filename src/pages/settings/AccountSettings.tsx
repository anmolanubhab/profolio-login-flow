import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { LogOut, User, MapPin, IdCard, GraduationCap, Briefcase, Monitor, Film, SlidersHorizontal, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { SettingsSection, SettingsConfigRows } from '@/components/settings/SettingsSection';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { ACCOUNT_GENERAL_SECTION, ACCOUNT_MANAGEMENT_PLACEHOLDER_ROWS } from '@/config/settingsConfig';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useProfileSettings } from '@/hooks/useProfileSettings';

// Every row here links into the existing /profile edit flow
// (src/components/profile/ProfileHeader.tsx and its siblings) -- profile
// data has one editor already, we just surface entry points to it here.
const PROFILE_INFO_ROWS = [
  { id: 'name-location-industry', label: 'Name, location and industry', icon: MapPin },
  { id: 'personal-information', label: 'Personal information', icon: IdCard },
  { id: 'profile-information', label: 'Profile information', icon: User },
  { id: 'education-skills', label: 'Education and skills', icon: GraduationCap },
  { id: 'job-information', label: 'Job information', icon: Briefcase },
];

export function AccountSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { settings, saving, toggleAutoplayVideos } = useProfileSettings();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      navigate('/');
    }
  };

  return (
    <>
      <SettingsSection title="Profile information" description="Edit the information shown on your profile">
        {PROFILE_INFO_ROWS.map((row) => (
          <SettingsRow
            key={row.id}
            icon={row.icon}
            title={row.label}
            status="active"
            onClick={() => navigate('/profile')}
          />
        ))}
      </SettingsSection>

      <SettingsSection title={ACCOUNT_GENERAL_SECTION.title}>
        <div className="px-4 py-3.5 sm:px-5 space-y-2">
          <Label htmlFor="appearance" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Appearance
          </Label>
          <Select value={theme ?? 'system'} onValueChange={setTheme}>
            <SelectTrigger id="appearance" className="bg-background/50 border-muted focus:border-primary/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System - Match your device</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Choose how Profolio looks</p>
        </div>

        <div className="px-4 py-3.5 sm:px-5 flex items-center justify-between gap-4">
          <div className="space-y-0.5 min-w-0">
            <Label htmlFor="autoplay_videos" className="flex items-center gap-2">
              <Film className="h-4 w-4" />
              Autoplay videos
            </Label>
            <p className="text-xs text-muted-foreground">
              Automatically play videos (muted) as they scroll into view
            </p>
          </div>
          <Switch
            id="autoplay_videos"
            checked={settings.autoplay_videos}
            onCheckedChange={toggleAutoplayVideos}
            disabled={saving}
          />
        </div>

        <SettingsRow
          icon={SlidersHorizontal}
          title="Feed preferences"
          description="Manage muted people, hidden posts and topics you see less of"
          status="active"
          onClick={() => navigate('/feed/preferences')}
        />

        <SettingsConfigRows rows={ACCOUNT_GENERAL_SECTION.rows} />
      </SettingsSection>

      <SettingsSection title="Account management">
        <SettingsRow
          icon={ShieldCheck}
          title="Account status"
          description="View your account standing and sign-in details"
          status="active"
          onClick={() => navigate('/settings/account/status')}
        />
        <SettingsRow
          icon={LogOut}
          title="Sign out"
          description="Sign out of your account on this device"
          status="active"
          rightElement={
            <Button variant="destructive" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          }
        />
        <SettingsConfigRows rows={ACCOUNT_MANAGEMENT_PLACEHOLDER_ROWS} />
      </SettingsSection>
    </>
  );
}
