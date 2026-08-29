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

// ---------------------------------------------------------------------------
// Profile completion
// ---------------------------------------------------------------------------
// Weighted checklist of REAL fields/sections. The percentage is
// round(sum(weight of completed items) / sum(all weights) * 100).
// Section-level items (experience/education/skills) are passed in as booleans
// by the caller because they live in separate tables/among the JSON columns.
// ---------------------------------------------------------------------------

export interface CompletionInput {
  profile: ProfileRow;
  hasExperience: boolean;
  hasEducation: boolean;
  hasSkills: boolean;
}

export interface CompletionItem {
  key: string;
  label: string;
  weight: number;
  done: boolean;
}

export function computeProfileCompletion(input: CompletionInput): {
  percent: number;
  items: CompletionItem[];
} {
  const { profile: p } = input;
  const nonEmpty = (v: unknown) =>
    typeof v === "string" ? v.trim().length > 0 : Boolean(v);

  const items: CompletionItem[] = [
    { key: "photo", label: "Profile photo", weight: 15, done: nonEmpty(p.avatar_url) },
    { key: "cover", label: "Cover image", weight: 5, done: nonEmpty(p.cover_url) },
    { key: "name", label: "Name", weight: 10, done: nonEmpty(p.display_name) || nonEmpty(p.full_name) },
    {
      key: "headline",
      label: "Headline",
      weight: 15,
      done: nonEmpty(p.headline) || nonEmpty(p.profession),
    },
    { key: "location", label: "Location", weight: 10, done: nonEmpty(p.location) },
    { key: "about", label: "About", weight: 15, done: nonEmpty(p.bio) },
    { key: "experience", label: "Experience", weight: 12, done: input.hasExperience },
    { key: "education", label: "Education", weight: 8, done: input.hasEducation },
    { key: "skills", label: "Skills", weight: 5, done: input.hasSkills },
  ];

  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  const doneWeight = items.reduce((s, i) => s + (i.done ? i.weight : 0), 0);
  const percent = totalWeight === 0 ? 0 : Math.round((doneWeight / totalWeight) * 100);

  return { percent, items };
}

/** Absolute URL to a profile, used by Share / Copy link. */
export function profileShareUrl(profileId: string): string {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";
  return `${origin}/profile/${profileId}`;
}
