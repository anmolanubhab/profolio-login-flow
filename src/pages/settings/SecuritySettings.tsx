import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Monitor, Mail, ShieldCheck, LifeBuoy, Phone, Laptop } from 'lucide-react';
import { SettingsSection, SettingsConfigRows } from '@/components/settings/SettingsSection';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SECURITY_ACCESS_SECTION, SECURITY_SECTION } from '@/config/settingsConfig';
import { supabase } from '@/integrations/supabase/client';

export function SecuritySettings() {
  const navigate = useNavigate();
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [currentPhone, setCurrentPhone] = useState<string | null>(null);
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentEmail(user?.email ?? null);
      setCurrentPhone(user?.phone || null);
    });
    supabase.auth.mfa.listFactors().then(({ data }) => {
      setMfaEnabled(data ? data.totp.some((f) => f.status === 'verified') : null);
    });
  }, []);

  return (
    <>
      <SettingsSection title={SECURITY_ACCESS_SECTION.title}>
        <SettingsRow
          icon={Mail}
          title="Email addresses"
          value={currentEmail ?? undefined}
          status="active"
          onClick={() => navigate('/settings/security/change-email')}
        />
        <SettingsRow
          icon={Phone}
          title="Phone number"
          description="Add a verified phone for account recovery and two-step verification"
          value={currentPhone ?? undefined}
          status="active"
          onClick={() => navigate('/settings/security/phone')}
        />
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
        <SettingsRow
          icon={ShieldCheck}
          title="Two-step verification"
          description="Require an authenticator code when signing in"
          value={mfaEnabled === null ? undefined : mfaEnabled ? 'On' : 'Off'}
          status="active"
          onClick={() => navigate('/settings/security/two-step-verification')}
        />
        <SettingsConfigRows rows={SECURITY_ACCESS_SECTION.rows} />
      </SettingsSection>

      <SettingsSection title={SECURITY_SECTION.title}>
        <SettingsRow
          icon={LifeBuoy}
          title="Account recovery"
          description="Recovery is via your email address — keep it current and verified"
          status="active"
          onClick={() => navigate('/settings/security/change-email')}
        />
        <SettingsRow
          icon={Laptop}
          title="Remembered devices"
          description="The devices currently signed in to your account"
          status="active"
          onClick={() => navigate('/settings/security/active-sessions')}
        />
        <SettingsConfigRows rows={SECURITY_SECTION.rows} />
      </SettingsSection>
    </>
  );
}
