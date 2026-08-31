// Shared deep-link into a profile section. ProfileTabs listens for hashchange,
// switches to the Profile tab and scrolls the section anchor into view; the
// user then uses that section's own "Add" button. This is the app's existing
// "Add section" convention (see AddSectionMenu) — recommendations reuse it so
// there is only ever one path into each editor.
export type ProfileSectionKey =
  | 'experience'
  | 'education'
  | 'skills'
  | 'certifications'
  | 'projects'
  | 'languages'
  | 'social';

export function jumpToProfileSection(key: ProfileSectionKey) {
  if (typeof window === 'undefined') return;
  window.location.hash = key;
  // ProfileTabs also scrolls on hashchange; this covers the "hash already
  // equals key" case where hashchange does not fire.
  setTimeout(() => {
    document.getElementById(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 40);
}

/** Scroll the profile header (where the photo / cover camera buttons live). */
export function scrollToProfileHeader() {
  if (typeof window === 'undefined') return;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- profile-changed bus ------------------------------------------------
// Any editor that mutates a profile field or section row fires this; the
// Profile Strength query listens and recomputes. Avoids threading a callback
// through every section component.
export const PROFILE_CHANGED_EVENT = 'profolio:profile-changed';

export function notifyProfileChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PROFILE_CHANGED_EVENT));
}
