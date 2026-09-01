import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { SettingsSection, SettingsConfigRows } from '@/components/settings/SettingsSection';
import { SettingsRow } from '@/components/settings/SettingsRow';
import {
  DATA_USAGE_SECTION,
  JOB_SEEKING_PRIVACY_SECTION,
  OTHER_PRIVACY_SECTION,
} from '@/config/settingsConfig';

export function DataPrivacySettings() {
  const navigate = useNavigate();

  return (
    <>
      <SettingsSection title={DATA_USAGE_SECTION.title}>
        <SettingsRow
          icon={Download}
          title="Download your data"
          description="Get a copy of your account, profile and posts as a file"
          status="active"
          onClick={() => navigate('/settings/privacy/download-data')}
        />
        <SettingsConfigRows rows={DATA_USAGE_SECTION.rows} />
      </SettingsSection>

      <SettingsSection title={JOB_SEEKING_PRIVACY_SECTION.title}>
        <SettingsConfigRows rows={JOB_SEEKING_PRIVACY_SECTION.rows} />
      </SettingsSection>

      <SettingsSection title={OTHER_PRIVACY_SECTION.title}>
        <SettingsConfigRows rows={OTHER_PRIVACY_SECTION.rows} />
      </SettingsSection>
    </>
  );
}
