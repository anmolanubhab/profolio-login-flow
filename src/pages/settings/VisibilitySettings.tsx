import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Eye, UserX, Clock, X, Mail } from 'lucide-react';
import { SettingsSection, SettingsConfigRows } from '@/components/settings/SettingsSection';
import {
  VISIBILITY_PROFILE_PLACEHOLDER_ROWS,
  VISIBILITY_ACTIVITY_PLACEHOLDER_ROWS,
} from '@/config/settingsConfig';
import { useProfileSettings } from '@/hooks/useProfileSettings';

export function VisibilitySettings() {
  const {
    loading,
    saving,
    settings,
    blocked,
    snoozed,
    loadingPrivacyLists,
    updateVisibility,
    updateEmailVisibility,
    toggleOpenToWork,
    updateOpenToWorkVisibility,
    unblock,
    unsnooze,
  } = useProfileSettings();

  if (loading) {
    return <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mt-8" />;
  }

  return (
    <>
      <SettingsSection title="Profile viewing options" description="Control who can see your profile and activity">
        <div className="px-4 py-3.5 sm:px-5 space-y-2">
          <Label htmlFor="profile_visibility">Profile visibility</Label>
          <Select value={settings.profile_visibility} onValueChange={updateVisibility} disabled={saving}>
            <SelectTrigger id="profile_visibility" className="bg-background/50 border-muted focus:border-primary/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public - Everyone can view</SelectItem>
              <SelectItem value="connections_only">Connections Only - Only connected users</SelectItem>
              <SelectItem value="private">Private - Only you can view</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Control who can see your full profile information</p>
        </div>

        <div className="px-4 py-3.5 sm:px-5 space-y-2">
          <Label htmlFor="email_visibility" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email visibility
          </Label>
          <Select value={settings.email_visibility} onValueChange={updateEmailVisibility} disabled={saving}>
            <SelectTrigger id="email_visibility" className="bg-background/50 border-muted focus:border-primary/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public - Everyone can see</SelectItem>
              <SelectItem value="connections_only">Connections Only - Only connected users</SelectItem>
              <SelectItem value="private">Private - Nobody can see it</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Control who can see your email on your profile</p>
        </div>

        <div className="px-4 py-3.5 sm:px-5 flex items-center justify-between gap-4">
          <div className="space-y-0.5 min-w-0">
            <Label htmlFor="open_to_work" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Open to work
            </Label>
            <p className="text-xs text-muted-foreground">
              Let recruiters and your network know you're open to new opportunities
            </p>
          </div>
          <Switch id="open_to_work" checked={settings.open_to_work} onCheckedChange={toggleOpenToWork} disabled={saving} />
        </div>

        {settings.open_to_work && (
          <div className="px-4 py-3.5 sm:px-5 space-y-2">
            <Label htmlFor="open_to_work_visibility">Open to work visibility</Label>
            <Select value={settings.open_to_work_visibility} onValueChange={updateOpenToWorkVisibility} disabled={saving}>
              <SelectTrigger id="open_to_work_visibility" className="bg-background/50 border-muted focus:border-primary/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public - Everyone can see</SelectItem>
                <SelectItem value="connections_only">Connections Only</SelectItem>
                <SelectItem value="private">Private - Recruiters only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <SettingsConfigRows rows={VISIBILITY_PROFILE_PLACEHOLDER_ROWS} />
      </SettingsSection>

      <SettingsSection title="Visibility of activity" description="Control who sees your activity and blocking">
        <SettingsConfigRows rows={VISIBILITY_ACTIVITY_PLACEHOLDER_ROWS} />

        <div className="px-4 py-3.5 sm:px-5 space-y-2">
          <Label className="flex items-center gap-2">
            <Clock className="h-4 w-4" /> Snoozed / hidden
          </Label>
          {loadingPrivacyLists ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : snoozed.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing snoozed or hidden right now.</p>
          ) : (
            <div className="space-y-1">
              {snoozed.map((entry) => (
                <div key={entry.key} className="flex items-center justify-between rounded-md bg-background/50 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{entry.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.isHiddenAll ? 'Hidden indefinitely' : `Snoozed until ${new Date(entry.snoozedUntil).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => unsnooze(entry)}>
                    <X className="h-4 w-4 mr-1" /> Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator className="bg-muted/30" />

        <div className="px-4 py-3.5 sm:px-5 space-y-2">
          <Label className="flex items-center gap-2">
            <UserX className="h-4 w-4" /> Blocking
          </Label>
          {loadingPrivacyLists ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : blocked.length === 0 ? (
            <p className="text-xs text-muted-foreground">You haven't blocked anyone.</p>
          ) : (
            <div className="space-y-1">
              {blocked.map((entry) => (
                <div key={entry.key} className="flex items-center justify-between rounded-md bg-background/50 px-3 py-2">
                  <p className="text-sm font-medium">{entry.name}</p>
                  <Button variant="ghost" size="sm" onClick={() => unblock(entry)}>
                    <X className="h-4 w-4 mr-1" /> Unblock
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SettingsSection>
    </>
  );
}
