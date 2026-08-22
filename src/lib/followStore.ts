import { useSyncExternalStore, useEffect } from 'react';

// CRITICAL PRODUCT RULE: Follow targets the author/company, not the post.
// Following Navya from Post A must instantly flip every other rendered
// Post B/C by Navya to "Following" too -- including cards mounted later via
// infinite scroll -- without a full feed refetch. Each PostCard's follow
// control has no idea other cards for the same author exist, so state
// can't just live in that component; it has to be shared.
//
// This is a small module-level pub/sub store (no query library in this
// codebase to reuse) keyed by "person:<profiles.id>" / "company:<companies.id>"
// -- the same profiles.id/companies.id distinction already used everywhere
// else (followers vs company_followers), never mixed.
type FollowKey = string;

const cache = new Map<FollowKey, boolean>();
const listeners = new Map<FollowKey, Set<() => void>>();

const keyFor = (targetId: string, isCompany: boolean): FollowKey =>
  `${isCompany ? 'company' : 'person'}:${targetId}`;

function subscribe(key: FollowKey, onChange: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(onChange);
  return () => {
    set!.delete(onChange);
    if (set!.size === 0) listeners.delete(key);
  };
}

function emit(key: FollowKey) {
  listeners.get(key)?.forEach((fn) => fn());
}

/** Authoritative write -- call after a follow/unfollow DB call succeeds so
 * every mounted card for this author/company (current feed, saved posts,
 * post detail, wherever) re-renders with the new state in one shot. */
export function setFollowState(targetId: string, isCompany: boolean, following: boolean) {
  const key = keyFor(targetId, isCompany);
  cache.set(key, following);
  emit(key);
}

export function getFollowState(targetId: string, isCompany: boolean): boolean | undefined {
  return cache.get(keyFor(targetId, isCompany));
}

/**
 * Author/company-level follow state, shared across every card rendering
 * that same target. `initialValue` is the DB-derived truth Feed.tsx already
 * computed for this post at fetch time (from followers/company_followers) --
 * it seeds the shared cache the first time this target is ever rendered in
 * the session, but a value already in the cache (e.g. set by a follow click
 * on a sibling post, or by a post for this same author rendered earlier)
 * always wins, so newly-mounted cards (infinite scroll, pagination) pick up
 * the live state instead of their own possibly-stale per-fetch snapshot.
 */
export function useFollowState(targetId: string, isCompany: boolean, initialValue: boolean): boolean {
  const key = keyFor(targetId, isCompany);

  useEffect(() => {
    if (!cache.has(key)) cache.set(key, initialValue);
    // Deliberately no dependency on initialValue changing later -- once a
    // target has a live cached value, later re-renders of the same or other
    // cards must not stomp it back to a stale fetch-time snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return useSyncExternalStore(
    (onChange) => subscribe(key, onChange),
    () => cache.get(key) ?? initialValue,
    () => cache.get(key) ?? initialValue
  );
}
