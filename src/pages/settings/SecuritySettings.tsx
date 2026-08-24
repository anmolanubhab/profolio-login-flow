import { useNavigate } from 'react-router-dom';
import { KeyRound, Monitor } from 'lucide-react';
import { SettingsSection, SettingsConfigRows } from '@/components/settings/SettingsSection';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SECURITY_ACCESS_SECTION, SECURITY_SECTION } from '@/config/settingsConfig';

export function SecuritySettings() {
  const navigate = useNavigate();

  return (
    <>
      <SettingsSection title={SECURITY_ACCESS_SECTION.title}>
        <SettingsRow
          icon={KeyRound}
          title="Change password"
          description="Update the password for your account"
          status="active"
          onClick={() => navigate('/settings/security/change-password')}
        />
        <SettingsRow
          icon={Monitor}
          title="Devices / active sessions"
          description="See your current session and sign out elsewhere"
          status="active"
          onClick={() => navigate('/settings/security/active-sessions')}
        />
        <SettingsConfigRows rows={SECURITY_ACCESS_SECTION.rows} />
      </SettingsSection>

      <SettingsSection title={SECURITY_SECTION.title}>
        <SettingsConfigRows rows={SECURITY_SECTION.rows} />
      </SettingsSection>
    </>
  );
}
