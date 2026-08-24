import { useNavigate } from 'react-router-dom';
import { LogOut, User, MapPin, IdCard, GraduationCap, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SettingsSection, SettingsConfigRows } from '@/components/settings/SettingsSection';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { ACCOUNT_GENERAL_SECTION, ACCOUNT_MANAGEMENT_PLACEHOLDER_ROWS } from '@/config/settingsConfig';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
        <SettingsConfigRows rows={ACCOUNT_GENERAL_SECTION.rows} />
      </SettingsSection>

      <SettingsSection title="Account management">
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
