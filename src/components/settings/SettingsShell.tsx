import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SettingsNav } from './SettingsNav';
import {
  SETTINGS_CATEGORIES,
  DEFAULT_SETTINGS_CATEGORY,
  type SettingsCategoryId,
} from '@/config/settingsConfig';
import { AccountSettings } from '@/pages/settings/AccountSettings';
import { SecuritySettings } from '@/pages/settings/SecuritySettings';
import { VisibilitySettings } from '@/pages/settings/VisibilitySettings';
import { DataPrivacySettings } from '@/pages/settings/DataPrivacySettings';
import { AdvertisingSettings } from '@/pages/settings/AdvertisingSettings';
import { NotificationsSettings } from '@/pages/settings/NotificationsSettings';

const CATEGORY_PANELS: Record<SettingsCategoryId, React.ComponentType> = {
  account: AccountSettings,
  security: SecuritySettings,
  visibility: VisibilitySettings,
  privacy: DataPrivacySettings,
  advertising: AdvertisingSettings,
  notifications: NotificationsSettings,
};

interface SettingsShellProps {
  /** The category resolved from the URL. Undefined means "/settings" with no sub-path -- only meaningful on mobile (shows the category list there); desktop always falls back to the default category's content. */
  activeCategory?: SettingsCategoryId;
}

export function SettingsShell({ activeCategory }: SettingsShellProps) {
  const navigate = useNavigate();
  const desktopCategoryId = activeCategory ?? DEFAULT_SETTINGS_CATEGORY;
  const DesktopPanel = CATEGORY_PANELS[desktopCategoryId];
  const desktopConfig = SETTINGS_CATEGORIES.find((c) => c.id === desktopCategoryId);
  const activeConfig = activeCategory
    ? SETTINGS_CATEGORIES.find((c) => c.id === activeCategory)
    : undefined;
  const MobilePanel = activeCategory ? CATEGORY_PANELS[activeCategory] : undefined;

  return (
    <div className="w-full max-w-[960px] mx-auto">
      {/* Desktop / tablet-landscape: left nav always visible + right content panel, matches the sticky-sidebar pattern used on /dashboard. */}
      <div className="hidden lg:flex flex-row gap-6 items-start">
        <aside className="w-[260px] shrink-0 sticky top-[calc(var(--nav-height)+1rem)]">
          <SettingsNav variant="desktop" activeId={desktopCategoryId} />
        </aside>
        <div className="min-w-0 flex-1 space-y-4">
          {desktopConfig && (
            <header className="space-y-1 pb-1">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {desktopConfig.label}
              </h2>
              <p className="text-sm text-muted-foreground">{desktopConfig.description}</p>
            </header>
          )}
          <DesktopPanel />
        </div>
      </div>

      {/* Mobile / tablet-portrait: drill-down. No category in the URL shows the category list; a category shows a back header + that category's content, full width. */}
      <div className="lg:hidden">
        {!activeCategory || !MobilePanel ? (
          <>
            <h1 className="px-4 pt-2 pb-1 text-xl font-bold text-foreground">Settings</h1>
            <SettingsNav variant="mobile" />
          </>
        ) : (
          <div>
            <div className="flex items-center gap-2 px-2 py-3 sticky top-[calc(var(--nav-height)+env(safe-area-inset-top))] bg-background z-10 border-b border-border">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => navigate('/settings')}
                aria-label="Back to Settings"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-base font-semibold text-foreground truncate">
                {activeConfig?.label}
              </h1>
            </div>
            <div className="p-3 space-y-4">
              <MobilePanel />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
