import type { Database } from "@/integrations/supabase/types";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

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
