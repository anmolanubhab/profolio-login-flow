import { SettingsSection, SettingsConfigRows } from '@/components/settings/SettingsSection';
import { ADVERTISING_PERSONALIZATION_SECTION, ADVERTISING_EXTERNAL_SECTION } from '@/config/settingsConfig';

export function AdvertisingSettings() {
  return (
    <>
      <p className="text-sm text-muted-foreground px-1">
        Advertising isn't part of the app yet. These controls are shown here so the layout is ready
        when they are.
      </p>

      <SettingsSection title={ADVERTISING_PERSONALIZATION_SECTION.title}>
        <SettingsConfigRows rows={ADVERTISING_PERSONALIZATION_SECTION.rows} />
      </SettingsSection>

      <SettingsSection title={ADVERTISING_EXTERNAL_SECTION.title}>
        <SettingsConfigRows rows={ADVERTISING_EXTERNAL_SECTION.rows} />
      </SettingsSection>
    </>
  );
}
