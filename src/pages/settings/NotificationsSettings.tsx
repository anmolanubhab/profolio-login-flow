import { SettingsSection, SettingsConfigRows } from '@/components/settings/SettingsSection';
import { NOTIFICATIONS_SECTIONS } from '@/config/settingsConfig';

export function NotificationsSettings() {
  return (
    <>
      <p className="text-sm text-muted-foreground px-1">
        Per-post notification toggles are already available from each post's options menu. This
        page will become the central place to manage all notification preferences.
      </p>

      {NOTIFICATIONS_SECTIONS.map((section) => (
        <SettingsSection key={section.id} title={section.title}>
          <SettingsConfigRows rows={section.rows} />
        </SettingsSection>
      ))}
    </>
  );
}
