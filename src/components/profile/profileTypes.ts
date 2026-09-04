import type { Database } from "@/integrations/supabase/types";

/**
 * A loaded profile row. The public route no longer selects `profiles.*` — it
 * calls the `get_public_profile()` accessor, which omits owner-only columns
 * (`preferences`, `expected_salary`, …) and instead returns two derived
 * booleans. `ProfilePage` sets these on the self-branch too, so every
 * consumer can read `show_active_status` / `has_verified_email` regardless of
 * which branch loaded the profile.
 */
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"] & {
  /** Effective "show active status" (default true; false only if opted out). */
  show_active_status?: boolean | null;
  /** Whether an email is on file — without exposing the address. */
  has_verified_email?: boolean | null;
};

/**
 * Columns the `authenticated` role can still `SELECT` directly on
 * `public.profiles` (owner-only columns like `preferences` / `expected_salary`
 * were revoked). Used for the signed-in user's OWN profile fetch; the
 * owner-only bits it also needs (visibility flags) come from `get_my_settings()`.
 * A bare `select('*')` on profiles now errors for authenticated clients.
 */
export const SELF_PROFILE_COLUMNS =
  "id, user_id, display_name, avatar_url, bio, created_at, updated_at, profession, location, phone, website, linkedin_url, github_url, twitter_url, skills, experience, education, projects, achievements, full_name, email, photo_url, address, profile_visibility, cover_url, open_to_work, last_name_visibility, profile_discovery, autoplay_videos, cover_position, headline, pronouns, photo_visibility, last_active_at";

export type ProfileVisibility = "public" | "connections_only" | "private";
// Matches the DB check constraints on profiles.*_visibility columns.
export type PhotoVisibility = "public" | "connections_only" | "private";
export type ContactFieldVisibility = "public" | "connections_only" | "private";

export type ConnectionRelationship =
  | "self"
  | "none"
  | "pending_outgoing" // I sent a request
  | "pending_incoming" // they sent me a request
  | "connected"
  | "blocked";

export interface ProfileCounts {
  followers: number;
  following: number;
  /** null when the viewer isn't allowed to see this member's connection count */
  connections: number | null;
}

export interface ProfileContextValue {
  /** profiles.id (primary key) of the profile being viewed */
  profileId: string;
  /** profiles.user_id (auth user id) of the profile being viewed */
  targetUserId: string;
  profile: ProfileRow;
  isOwner: boolean;
  /** profiles.id of the signed-in viewer, or null */
  viewerProfileId: string | null;
  relationship: ConnectionRelationship;
  isFollowing: boolean;
  counts: ProfileCounts;
  /** re-fetch the profile row + counts */
  refresh: () => Promise<void>;
  /** locally patch the cached profile row (optimistic UI) */
  patchProfile: (patch: Partial<ProfileRow>) => void;
}

/** Best display name, matching the fallbacks used elsewhere in the app. */
export function profileDisplayName(p: Pick<ProfileRow, "display_name" | "full_name">): string {
  return p.display_name?.trim() || p.full_name?.trim() || "Profolio member";
}

/** Headline shown under the name — new `headline` column, falling back to the
 *  legacy `profession` column so no existing data is lost. */
export function profileHeadline(
  p: Pick<ProfileRow, "headline" | "profession">
): string | null {
  return p.headline?.trim() || p.profession?.trim() || null;
}

// Profile completion / strength now lives in the centralized engine:
//   src/lib/profileStrength.ts   (calculateProfileStrength)
//   src/hooks/useProfileStrength.ts

/** Absolute URL to a profile, used by Share / Copy link. */
export function profileShareUrl(profileId: string): string {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";
  return `${origin}/profile/${profileId}`;
}
