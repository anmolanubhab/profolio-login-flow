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
    label: 'Advertising data',
    description: 'Data used to personalize ads',
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
    { id: 'phone-numbers', label: 'Phone numbers', description: 'Sign in to Profolio is by email', status: 'unavailable' },
    { id: 'passkeys', label: 'Passkeys', description: 'Use a password with two-step verification', status: 'unavailable' },
  ],
};

export const SECURITY_SECTION: SettingsSectionConfig = {
  id: 'security',
  title: 'Security',
  rows: [
    { id: 'remembered-devices', label: 'Remembered devices', description: 'Not tracked — each device signs in independently', status: 'unavailable' },
  ],
};

export const VISIBILITY_ACTIVITY_PLACEHOLDER_ROWS: SettingsRowConfig[] = [
  { id: 'active-status', label: 'Active status', description: 'Profolio doesn’t show an online / active indicator', status: 'unavailable' },
  { id: 'profile-updates', label: 'Profile update broadcasts', description: 'Profolio doesn’t post your profile edits to your network', status: 'unavailable' },
];

export const VISIBILITY_PROFILE_PLACEHOLDER_ROWS: SettingsRowConfig[] = [
];

// Data privacy rows are hand-authored in
// src/pages/settings/DataPrivacySettings.tsx so each binds to a real page /
// action (download, manage-data, connected-services, visibility, applications,
// jobs) or is explicitly marked "Not available".

export const ADVERTISING_PERSONALIZATION_SECTION: SettingsSectionConfig = {
  id: 'ad-personalization',
  title: 'Data used for personalization',
  rows: [
    { id: 'ad-profile-data', label: 'Profile data', status: 'placeholder' },
    { id: 'ad-activity-data', label: 'Activity data', status: 'placeholder' },
    { id: 'ad-interests', label: 'Interests', status: 'placeholder' },
    { id: 'ad-companies-followed', label: 'Companies followed', status: 'placeholder' },
    { id: 'ad-groups', label: 'Groups', status: 'placeholder' },
    { id: 'ad-education-skills', label: 'Education and skills', status: 'placeholder' },
    { id: 'ad-job-info', label: 'Job information', status: 'placeholder' },
    { id: 'ad-location', label: 'Location', status: 'placeholder' },
  ],
};

export const ADVERTISING_EXTERNAL_SECTION: SettingsSectionConfig = {
  id: 'ad-external',
  title: 'External data',
  rows: [
    { id: 'ad-partner-data', label: 'Partner data', status: 'placeholder' },
    { id: 'ad-device-info', label: 'Device information', status: 'placeholder' },
    { id: 'ad-off-platform', label: 'Off-platform activity', status: 'placeholder' },
  ],
};

// Notification preferences are now real toggles bound to
// profiles.preferences.notifications -- see src/lib/notificationCategories.ts
// and src/pages/settings/NotificationsSettings.tsx.
