import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { NOTIFICATION_CATEGORIES } from '@/lib/notificationCategories';
import {
  useEmailNotificationPreferences,
  type EmailPreferenceKey,
} from '@/hooks/useEmailNotificationPreferences';

const EMAIL_CATEGORIES: { key: EmailPreferenceKey; label: string; description: string }[] = [
  {
    key: 'job_alert_emails',
    label: 'Job alerts',
    description: 'Email me when a new job posting is a strong match for my profile',
  },
  {
    key: 'application_emails',
    label: 'Applications',
    description: 'Updates on applications you sent or received',
  },
  {
    key: 'message_emails',
    label: 'Messages',
    description: 'When you get a new direct message',
  },
  {
    key: 'network_emails',
    label: 'Network',
    description: 'Connection requests and acceptances',
  },
  {
    key: 'marketing_emails',
    label: 'Product updates',
    description: 'Occasional news and tips about Profolio',
  },
];

export function NotificationsSettings() {
  const { loading, saving, prefs, setCategory } = useNotificationPreferences();
  const {
    loading: emailLoading,
    saving: emailSaving,
    prefs: emailPrefs,
    setCategory: setEmailCategory,
  } = useEmailNotificationPreferences();

  return (
    <>
      <p className="text-sm text-muted-foreground px-1">
        Choose which notifications appear in your notifications list and bell. Turning a
        category off hides those notifications and stops them counting toward your unread
        badge.
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

      <SettingsSection title="Email notifications">
        {emailLoading ? (
          <div className="px-4 py-6 sm:px-5">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            <div className="px-4 py-3.5 sm:px-5 flex items-center justify-between gap-4">
              <div className="space-y-0.5 min-w-0">
                <Label htmlFor="email-master">Email notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Turn this on to receive any email from Profolio. Individual categories below
                  are also opt-in.
                </p>
              </div>
              <Switch
                id="email-master"
                checked={emailPrefs.email_notifications_enabled}
                onCheckedChange={(checked) => setEmailCategory('email_notifications_enabled', checked)}
                disabled={emailSaving}
              />
            </div>
            {EMAIL_CATEGORIES.map((category) => (
              <div
                key={category.key}
                className="px-4 py-3.5 sm:px-5 flex items-center justify-between gap-4"
              >
                <div className="space-y-0.5 min-w-0">
                  <Label htmlFor={`email-${category.key}`}>{category.label}</Label>
                  <p className="text-xs text-muted-foreground">{category.description}</p>
                </div>
                <Switch
                  id={`email-${category.key}`}
                  checked={emailPrefs[category.key]}
                  onCheckedChange={(checked) => setEmailCategory(category.key, checked)}
                  disabled={emailSaving || !emailPrefs.email_notifications_enabled}
                />
              </div>
            ))}
          </>
        )}
      </SettingsSection>
    </>
  );
}
