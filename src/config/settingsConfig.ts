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
  { id: 'active-status', label: 'Active status', description: 'Show others when you’re active', status: 'placeholder' },
  { id: 'profile-updates', label: 'Profile updates', description: 'Share when you update your profile', status: 'placeholder' },
  { id: 'mentions', label: 'Mentions & tags', description: 'Choose who can mention you', status: 'placeholder' },
];

export const VISIBILITY_PROFILE_PLACEHOLDER_ROWS: SettingsRowConfig[] = [
];

export const DATA_USAGE_SECTION: SettingsSectionConfig = {
  id: 'data-usage',
  title: 'How the application uses your data',
  rows: [
    { id: 'manage-data', label: 'Manage your data', status: 'placeholder' },
    { id: 'search-history', label: 'Search history', status: 'placeholder' },
    { id: 'personalization-data', label: 'Personalization data', status: 'placeholder' },
  ],
};

export const JOB_SEEKING_PRIVACY_SECTION: SettingsSectionConfig = {
  id: 'job-seeking-privacy',
  title: 'Job seeking privacy',
  rows: [
    { id: 'job-application-settings', label: 'Job application settings', status: 'placeholder' },
    { id: 'job-seeking-preferences', label: 'Job seeking preferences', status: 'placeholder' },
    { id: 'stored-applicant-info', label: 'Stored applicant information', status: 'placeholder' },
    { id: 'share-profile-recruiters', label: 'Sharing profile with recruiters', status: 'placeholder' },
  ],
};

export const OTHER_PRIVACY_SECTION: SettingsSectionConfig = {
  id: 'other-privacy',
  title: 'Other privacy controls',
  rows: [
    { id: 'calendar-sync', label: 'Calendar & contact sync', status: 'placeholder' },
    { id: 'connected-services', label: 'Connected services', status: 'placeholder' },
    { id: 'data-sharing', label: 'Data sharing preferences', status: 'placeholder' },
  ],
};

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
