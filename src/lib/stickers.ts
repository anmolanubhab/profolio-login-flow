import thumbsUp from '@/assets/stickers/thumbs-up.svg';
import heart from '@/assets/stickers/heart.svg';
import star from '@/assets/stickers/star.svg';
import fire from '@/assets/stickers/fire.svg';
import clap from '@/assets/stickers/clap.svg';
import smile from '@/assets/stickers/smile.svg';
import wave from '@/assets/stickers/wave.svg';
import check from '@/assets/stickers/check.svg';

export interface Sticker {
  id: string;
  label: string;
  src: string;
}

export const DEFAULT_STICKER_PACK = {
  id: 'profolio-default',
  name: 'Profolio Stickers',
};

// Bundled first-party static assets -- not Storage objects. There is
// nothing sensitive here, so no upload/signing/authorization is involved;
// the sticker "id" stored on a message is just a stable key into this list.
export const STICKERS: Sticker[] = [
  { id: 'thumbs-up', label: 'Thumbs up', src: thumbsUp },
  { id: 'heart', label: 'Heart', src: heart },
  { id: 'star', label: 'Star', src: star },
  { id: 'fire', label: 'Fire', src: fire },
  { id: 'clap', label: 'Clap', src: clap },
  { id: 'smile', label: 'Smile', src: smile },
  { id: 'wave', label: 'Wave', src: wave },
  { id: 'check', label: 'Check', src: check },
];

export function getSticker(id: string): Sticker | undefined {
  return STICKERS.find((s) => s.id === id);
}

const RECENT_LIMIT = 20;

function recentKey(userId: string): string {
  return `profolio:recent-stickers:${userId}`;
}

// Per-viewer, non-sensitive convenience data (which stickers this browser
// used recently) -- localStorage is the right tool here per this app's own
// documented preference for lightweight per-viewer state, not backend
// persistence.
export function getRecentStickers(userId: string): Sticker[] {
  try {
    const raw = localStorage.getItem(recentKey(userId));
    if (!raw) return [];
    const ids: string[] = JSON.parse(raw);
    return ids.map((id) => getSticker(id)).filter((s): s is Sticker => !!s);
  } catch {
    return [];
  }
}

export function recordRecentSticker(userId: string, stickerId: string): void {
  try {
    const raw = localStorage.getItem(recentKey(userId));
    const ids: string[] = raw ? JSON.parse(raw) : [];
    const next = [stickerId, ...ids.filter((id) => id !== stickerId)].slice(0, RECENT_LIMIT);
    localStorage.setItem(recentKey(userId), JSON.stringify(next));
  } catch {
    // localStorage unavailable (private browsing etc.) -- non-critical, skip silently.
  }
}
