import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { NOTIFICATION_CATEGORIES } from '@/lib/notificationCategories';

export function NotificationsSettings() {
  const { loading, saving, prefs, setCategory } = useNotificationPreferences();

  return (
    <>
      <p className="text-sm text-muted-foreground px-1">
        Choose which notifications appear in your notifications list and bell. Turning a
        category off hides those notifications and stops them counting toward your unread
        badge. Profolio doesn’t send email or push notifications yet.
      </p>

      <SettingsSection title="Notifications you receive">
        {loading ? (
          <div className="px-4 py-6 sm:px-5">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
          </div>
        ) : (
          NOTIFICATION_CATEGORIES.map((category) => (
            <div
              key={category.key}
              className="px-4 py-3.5 sm:px-5 flex items-center justify-between gap-4"
            >
              <div className="space-y-0.5 min-w-0">
                <Label htmlFor={`notif-${category.key}`}>{category.label}</Label>
                <p className="text-xs text-muted-foreground">{category.description}</p>
              </div>
              <Switch
                id={`notif-${category.key}`}
                checked={prefs[category.key]}
                onCheckedChange={(checked) => setCategory(category.key, checked)}
                disabled={saving}
              />
            </div>
          ))
        )}
      </SettingsSection>
    </>
  );
}
