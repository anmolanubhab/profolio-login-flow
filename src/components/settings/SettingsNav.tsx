import { NavLink } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SETTINGS_CATEGORIES, type SettingsCategoryId } from '@/config/settingsConfig';

interface SettingsNavProps {
  /** 'desktop' renders the compact always-visible sidebar list; 'mobile' renders full-width tappable rows. */
  variant: 'desktop' | 'mobile';
  /**
   * Desktop only: which category is currently shown in the content panel.
   * Passed explicitly rather than relying on NavLink's own URL-matching --
   * bare "/settings" renders the default category's content without the URL
   * changing to "/settings/account", so isActive-by-path alone would leave
   * the whole nav unhighlighted in that case.
   */
  activeId?: SettingsCategoryId;
}

export function SettingsNav({ variant, activeId }: SettingsNavProps) {
  if (variant === 'mobile') {
    return (
      <nav className="divide-y divide-border/60">
        {SETTINGS_CATEGORIES.map((category) => (
          <NavLink
            key={category.id}
            to={category.path}
            className="flex items-center justify-between gap-3 px-4 py-4 active:bg-muted/60"
          >
            <div className="flex items-center gap-3 min-w-0">
              <category.icon className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{category.label}</p>
                <p className="text-xs text-muted-foreground truncate">{category.description}</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </NavLink>
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-0.5">
      <h1 className="px-3 pb-3 text-xl font-bold text-foreground">Settings</h1>
      {SETTINGS_CATEGORIES.map((category) => (
        <NavLink
          key={category.id}
          to={category.path}
          className={cn(
            'flex items-center gap-3 border-l-2 px-3 py-2.5 text-sm transition-colors',
            category.id === activeId
              ? 'border-primary bg-primary/5 text-primary font-semibold'
              : 'border-transparent text-foreground hover:bg-muted'
          )}
        >
          <category.icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{category.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
