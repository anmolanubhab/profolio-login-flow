/**
 * Shared presentation-only transformation for last_name_visibility. Never
 * mutates or persists a modified name -- profiles.display_name always
 * stays exactly as stored; this only changes what's rendered to a
 * particular viewer. Used identically by PublicProfile, Network, and
 * SearchBar so the setting behaves the same everywhere a stranger might
 * otherwise see a full name -- a single place to fix if the rule changes.
 *
 * profiles has no first_name/last_name split (only a single display_name),
 * so "last name" here is a heuristic: the final whitespace-separated token.
 * profiles rows are always individual people (companies live in their own
 * `companies` table with a separate `name` field, never display_name), so
 * there's no company-name case to special-case here.
 */
export interface NameVisibilityContext {
  /** True when the viewer is this profile's own owner -- always sees the full name. */
  isOwner: boolean;
  /** The profile's last_name_visibility value ('public' | 'connections_only' | 'private' | undefined). */
  visibility?: string | null;
  /** Whether the viewer has an accepted connection with this profile. */
  isConnected: boolean;
}

export function formatDisplayNameForViewer(
  displayName: string | null | undefined,
  ctx: NameVisibilityContext
): string {
  const name = (displayName || '').trim();
  if (!name) return name;
  if (ctx.isOwner) return name;

  const canSeeFull = ctx.visibility === 'public' || (ctx.visibility === 'connections_only' && ctx.isConnected);
  if (canSeeFull) return name;

  const parts = name.split(/\s+/);
  if (parts.length < 2) return name; // single-word name -- nothing to mask

  const lastInitial = parts[parts.length - 1].charAt(0);
  return `${parts.slice(0, -1).join(' ')} ${lastInitial}.`;
}
