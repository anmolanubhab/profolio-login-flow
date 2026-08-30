// Shared types + helpers for the Network (connections / invitations / suggestions) feature.

import { formatDisplayNameForViewer } from '@/lib/nameVisibility';

/** Columns we need to render a person card anywhere in the Network experience. */
export const PERSON_FIELDS =
  'id, user_id, display_name, full_name, headline, profession, location, avatar_url, last_name_visibility';

export interface NetworkPerson {
  id: string;
  user_id: string;
  display_name: string | null;
  full_name: string | null;
  headline: string | null;
  profession: string | null;
  location: string | null;
  avatar_url: string | null;
  /** Populated when the source query knows it (connections list, suggestions). */
  mutual_count?: number;
  /** ISO timestamp — populated for the connections list. */
  connected_at?: string | null;
  /** ISO timestamp — populated for the following / followers lists. */
  followed_at?: string | null;
  /** Following list: does this person follow the current user back? */
  they_follow_me?: boolean;
  /** Followers list: does the current user follow this person back? */
  i_follow_them?: boolean;
}

export interface ReceivedInvitation {
  id: string;
  created_at: string;
  person: NetworkPerson;
}

export interface SentInvitation {
  id: string;
  created_at: string;
  person: NetworkPerson;
}

export type NetworkTab = 'grow' | 'invitations' | 'connections' | 'following';

export const NETWORK_TABS: NetworkTab[] = ['grow', 'invitations', 'connections', 'following'];

export function isNetworkTab(value: string | null | undefined): value is NetworkTab {
  return !!value && (NETWORK_TABS as string[]).includes(value);
}

/** Best available display name for a person. */
export function personName(p: Pick<NetworkPerson, 'display_name' | 'full_name'>): string {
  return p.display_name?.trim() || p.full_name?.trim() || 'Profolio member';
}

/** Secondary line under the name (headline, falling back to profession). */
export function personSubtitle(
  p: Pick<NetworkPerson, 'headline' | 'profession'>,
): string | null {
  return p.headline?.trim() || p.profession?.trim() || null;
}

export function personInitial(
  p: Pick<NetworkPerson, 'display_name' | 'full_name'>,
): string {
  return personName(p).charAt(0).toUpperCase();
}

export function mutualLabel(count: number | undefined): string | null {
  if (!count || count < 1) return null;
  return count === 1 ? '1 mutual connection' : `${count} mutual connections`;
}

/** Page size used across the Network lists. */
export const NETWORK_PAGE_SIZE = 20;

/**
 * Applies the shared last-name masking rule to a raw display_name for a viewer
 * who is not the profile owner. `isConnected` is whether the viewer has an
 * accepted connection with this person. Mirrors PublicProfile / SearchBar.
 */
export function maskName(
  displayName: string | null | undefined,
  lastNameVisibility: string | null | undefined,
  isConnected: boolean,
): string | null {
  const masked = formatDisplayNameForViewer(displayName, {
    isOwner: false,
    visibility: lastNameVisibility,
    isConnected,
  });
  return masked || null;
}
