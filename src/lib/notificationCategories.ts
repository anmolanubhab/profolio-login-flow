/**
 * User-facing notification categories and the raw `notifications.type` values
 * each one covers. Used by the Notifications settings panel (toggles) and by
 * the notification read surfaces (list + unread badge) to hide/uncount the
 * categories a user has turned off.
 *
 * Unknown / future types are treated as ALWAYS enabled — a preference can only
 * ever suppress a type it explicitly names, never a type it doesn't know
 * about, so adding a new notification type is safe without touching this file.
 */
export type NotificationCategoryKey =
  | 'reactions_comments'
  | 'mentions'
  | 'network'
  | 'profile_activity'
  | 'jobs'
  | 'messages'
  | 'insights';

export interface NotificationCategory {
  key: NotificationCategoryKey;
  label: string;
  description: string;
  types: readonly string[];
}

export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = [
  {
    key: 'reactions_comments',
    label: 'Reactions and comments',
    description: 'Likes, reactions, comments, replies, reposts and shares of your posts',
    types: ['like', 'post_reaction', 'comment_reaction', 'comment', 'comment_reply', 'repost', 'share'],
  },
  {
    key: 'mentions',
    label: 'Mentions',
    description: 'When someone mentions you in a post or comment',
    types: ['comment_mention', 'mention'],
  },
  {
    key: 'network',
    label: 'Network',
    description: 'Connection requests and when someone accepts your request',
    types: ['connection_request', 'connection_accepted'],
  },
  {
    key: 'profile_activity',
    label: 'Profile activity',
    description: 'Profile views, profile saves, skill endorsements and certificate activity',
    types: ['profile_view', 'profile_save', 'skill_endorsement', 'certificate'],
  },
  {
    key: 'jobs',
    label: 'Jobs',
    description: 'New job matches, application updates and applications you receive',
    types: ['new_job', 'application_stage_changed', 'job_application_received'],
  },
  {
    key: 'messages',
    label: 'Messages',
    description: 'New direct messages',
    types: ['message'],
  },
  {
    key: 'insights',
    label: 'Insights',
    description: 'When an Insight you follow publishes, and new subscribers to yours',
    types: ['insight_published', 'insight_new_subscriber'],
  },
] as const;

export const NOTIFICATION_CATEGORY_KEYS = NOTIFICATION_CATEGORIES.map((c) => c.key);

export type NotificationPreferences = Record<NotificationCategoryKey, boolean>;

/** All categories on — the default for an account that has never changed them. */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences =
  NOTIFICATION_CATEGORY_KEYS.reduce((acc, key) => {
    acc[key] = true;
    return acc;
  }, {} as NotificationPreferences);

/** type string -> category key, or undefined for an unmapped/unknown type. */
const TYPE_TO_CATEGORY: Record<string, NotificationCategoryKey> = (() => {
  const map: Record<string, NotificationCategoryKey> = {};
  for (const cat of NOTIFICATION_CATEGORIES) {
    for (const t of cat.types) map[t] = cat.key;
  }
  return map;
})();

/** Normalise whatever is stored into a full, valid preferences object. */
export function normalizeNotificationPreferences(raw: unknown): NotificationPreferences {
  const out = { ...DEFAULT_NOTIFICATION_PREFERENCES };
  if (raw && typeof raw === 'object') {
    for (const key of NOTIFICATION_CATEGORY_KEYS) {
      const v = (raw as Record<string, unknown>)[key];
      if (typeof v === 'boolean') out[key] = v;
    }
  }
  return out;
}

/** Is a given raw notification type currently allowed to show for this user? */
export function isNotificationTypeEnabled(
  type: string,
  prefs: NotificationPreferences,
): boolean {
  const cat = TYPE_TO_CATEGORY[type];
  if (!cat) return true; // unknown type -> never suppressed
  return prefs[cat] !== false;
}

/** The raw types belonging to categories the user has turned OFF. */
export function mutedNotificationTypes(prefs: NotificationPreferences): string[] {
  const muted: string[] = [];
  for (const cat of NOTIFICATION_CATEGORIES) {
    if (prefs[cat.key] === false) muted.push(...cat.types);
  }
  return muted;
}
