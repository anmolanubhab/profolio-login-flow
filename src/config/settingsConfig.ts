import {
  UserCog,
  ShieldCheck,
  Eye,
  Lock,
  Megaphone,
  Bell,
  type LucideIcon,
} from 'lucide-react';

export type SettingsRowStatus = 'active' | 'placeholder' | 'unavailable';

export interface SettingsRowConfig {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  status: SettingsRowStatus;
  /** Internal route to navigate to when the row is clicked (active rows only). */
  route?: string;
}

export interface SettingsSectionConfig {
  id: string;
  title: string;
  rows: SettingsRowConfig[];
}

export type SettingsCategoryId =
  | 'account'
  | 'security'
  | 'visibility'
  | 'privacy'
  | 'advertising'
  | 'notifications';

export interface SettingsCategoryConfig {
  id: SettingsCategoryId;
  label: string;
  description: string;
  icon: LucideIcon;
  path: string;
}

export const SETTINGS_CATEGORIES: SettingsCategoryConfig[] = [
  {
    id: 'account',
    label: 'Account preferences',
    description: 'Your profile information, general preferences and account status',
    icon: UserCog,
    path: '/settings/account',
  },
  {
    id: 'security',
    label: 'Sign in & security',
    description: 'Password, account access and where you’re signed in',
    icon: ShieldCheck,
    path: '/settings/security',
  },
  {
    id: 'visibility',
    label: 'Visibility',
    description: 'Control who can see your profile and activity',
    icon: Eye,
    path: '/settings/visibility',
  },
  {
    id: 'privacy',
    label: 'Data privacy',
    description: 'How your data is used and shared',
    icon: Lock,
    path: '/settings/privacy',
  },
  {
    id: 'advertising',
    label: 'Ads & data use',
    description: 'Ads, and how your activity personalises what you see',
    icon: Megaphone,
    path: '/settings/advertising',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Choose what you’re notified about',
    icon: Bell,
    path: '/settings/notifications',
  },
];

export const DEFAULT_SETTINGS_CATEGORY: SettingsCategoryId = 'account';

// ---------------------------------------------------------------------------
// Placeholder rows only. Rows backed by real, working functionality are
// hand-authored directly in their category panel (see src/pages/settings/*)
// so they can bind to live data/handlers -- this config exists purely to
// declare the Phase 1 "coming soon" navigation architecture without any
// fake persisted state. See src/components/settings/SettingsRow.tsx.
// ---------------------------------------------------------------------------

export const ACCOUNT_GENERAL_SECTION: SettingsSectionConfig = {
  id: 'general-preferences',
  title: 'General preferences',
  rows: [
    { id: 'language', label: 'Language', description: 'Profolio is currently English only', status: 'unavailable' },
    { id: 'content-language', label: 'Content language', description: 'Profolio is currently English only', status: 'unavailable' },
  ],
};

export const ACCOUNT_MANAGEMENT_PLACEHOLDER_ROWS: SettingsRowConfig[] = [
  { id: 'close-account', label: 'Close account', description: 'Permanently closing your account isn’t self-service yet — contact support', status: 'placeholder' },
];

export const SECURITY_ACCESS_SECTION: SettingsSectionConfig = {
  id: 'account-access',
  title: 'Account access',
  rows: [
    {
      id: 'passkeys',
      label: 'Passkeys',
      description: 'Supabase Auth on this project doesn’t support passkeys yet — use a password with two-step verification',
      status: 'unavailable',
    },
  ],
};

// "Remembered devices" now points at the real Active sessions page --
// authored directly in SecuritySettings.tsx.
export const SECURITY_SECTION: SettingsSectionConfig = {
  id: 'security',
  title: 'Security',
  rows: [],
};

// "Active status" and "Profile update broadcasts" are real switches, authored
// directly in src/pages/settings/VisibilitySettings.tsx (bound to
// useProfileSettings -> profiles.preferences).
export const VISIBILITY_ACTIVITY_PLACEHOLDER_ROWS: SettingsRowConfig[] = [];

export const VISIBILITY_PROFILE_PLACEHOLDER_ROWS: SettingsRowConfig[] = [
];

// Data privacy rows are hand-authored in
// src/pages/settings/DataPrivacySettings.tsx so each binds to a real page /
// action (download, manage-data, connected-services, visibility, applications,
// jobs) or is explicitly marked "Not available".

// The "Ads & data use" panel is hand-authored in
// src/pages/settings/AdvertisingSettings.tsx: an honest note (Profolio has no
// ads / doesn't sell data), one real "Personalized recommendations" toggle,
// and links to the existing recruiter-sharing / download / manage-data
// controls. LinkedIn's 16 ad-targeting rows don't map onto an app with no ads.


// Notification preferences are now real toggles bound to
// profiles.preferences.notifications -- see src/lib/notificationCategories.ts
// and src/pages/settings/NotificationsSettings.tsx.
