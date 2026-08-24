import { SettingsSection, SettingsConfigRows } from '@/components/settings/SettingsSection';
import {
  DATA_USAGE_SECTION,
  JOB_SEEKING_PRIVACY_SECTION,
  OTHER_PRIVACY_SECTION,
} from '@/config/settingsConfig';

export function DataPrivacySettings() {
  return (
    <>
      <SettingsSection title={DATA_USAGE_SECTION.title}>
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
