import type { CSSProperties } from 'react';
import type { FontStyle, LyricStyle, StoryBackground } from './types';

// ---------------------------------------------------------------------------
// Backgrounds — first 8 show collapsed, the rest behind "More backgrounds"
// (mirrors Facebook's Gradient tray + More/Fewer toggle).
// ---------------------------------------------------------------------------
export const STORY_BACKGROUNDS: StoryBackground[] = [
  { id: 'bg-blue', label: 'Blue', css: 'linear-gradient(135deg,#1e3a8a,#3b82f6)' },
  { id: 'bg-violet', label: 'Violet', css: 'linear-gradient(135deg,#4c1d95,#a855f7)' },
  { id: 'bg-sunset', label: 'Sunset', css: 'linear-gradient(135deg,#f59e0b,#ef4444)' },
  { id: 'bg-rose', label: 'Rose', css: 'linear-gradient(135deg,#be123c,#fb7185)' },
  { id: 'bg-indigo', label: 'Indigo', css: 'linear-gradient(160deg,#312e81,#6366f1)' },
  { id: 'bg-ink', label: 'Ink', css: 'linear-gradient(135deg,#0f172a,#334155)' },
  { id: 'bg-emerald', label: 'Emerald', css: 'linear-gradient(135deg,#064e3b,#10b981)' },
  { id: 'bg-magenta', label: 'Magenta', css: 'linear-gradient(135deg,#701a75,#ec4899)' },
  // --- extended set ---
  { id: 'bg-teal', label: 'Teal', css: 'linear-gradient(135deg,#134e4a,#2dd4bf)' },
  { id: 'bg-peach', label: 'Peach', css: 'linear-gradient(135deg,#fb923c,#fda4af)' },
  { id: 'bg-lime', label: 'Lime', css: 'linear-gradient(135deg,#365314,#a3e635)' },
  { id: 'bg-slate', label: 'Slate', css: 'linear-gradient(135deg,#1e293b,#64748b)' },
  { id: 'bg-aurora', label: 'Aurora', css: 'linear-gradient(135deg,#5b21b6,#2563eb,#06b6d4)' },
  { id: 'bg-flame', label: 'Flame', css: 'linear-gradient(135deg,#7f1d1d,#f97316,#facc15)' },
  { id: 'bg-berry', label: 'Berry', css: 'linear-gradient(135deg,#831843,#9333ea)' },
  { id: 'bg-ocean', label: 'Ocean', css: 'linear-gradient(160deg,#0c4a6e,#0ea5e9,#22d3ee)' },
  { id: 'bg-solid-black', label: 'Black', css: '#0b0b0f' },
  { id: 'bg-solid-white', label: 'White', css: '#f8fafc' },
  { id: 'bg-solid-red', label: 'Red', css: '#dc2626' },
  { id: 'bg-solid-blue', label: 'Solid blue', css: '#2563eb' },
  { id: 'bg-solid-green', label: 'Solid green', css: '#16a34a' },
  { id: 'bg-solid-purple', label: 'Solid purple', css: '#7c3aed' },
  { id: 'bg-solid-amber', label: 'Amber', css: '#d97706' },
  { id: 'bg-solid-charcoal', label: 'Charcoal', css: '#27272a' },
];

export const STORY_BACKGROUNDS_COLLAPSED_COUNT = 8;

export function backgroundById(id: string | null | undefined): StoryBackground | null {
  if (!id) return null;
  return STORY_BACKGROUNDS.find((b) => b.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Font styles — the CSS each maps to (used by composer + viewer).
// ---------------------------------------------------------------------------
export const FONT_STYLES: { id: FontStyle; label: string; css: CSSProperties }[] = [
  { id: 'clean', label: 'Clean', css: { fontFamily: "'Inter',system-ui,sans-serif", fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase' } },
  { id: 'casual', label: 'Casual', css: { fontFamily: "'Comic Sans MS','Segoe Print',cursive", fontWeight: 700 } },
  { id: 'fancy', label: 'Fancy', css: { fontFamily: "Georgia,'Times New Roman',serif", fontWeight: 600, fontStyle: 'italic' } },
  { id: 'headline', label: 'Headline', css: { fontFamily: "Georgia,serif", fontWeight: 800, letterSpacing: '-0.01em' } },
  { id: 'simple', label: 'Simple', css: { fontFamily: "system-ui,sans-serif", fontWeight: 500 } },
];

// text stories offer Clean/Casual/Fancy/Headline; photo-overlay text offers
// Headline/Fancy/Simple/Clean — same underlying list, different presets.
export const TEXT_STORY_FONTS: FontStyle[] = ['clean', 'casual', 'fancy', 'headline'];
export const OVERLAY_FONTS: FontStyle[] = ['headline', 'fancy', 'simple', 'clean'];

export function fontCss(id: FontStyle | string | null | undefined): CSSProperties {
  return FONT_STYLES.find((f) => f.id === id)?.css ?? FONT_STYLES[0].css;
}

// ---------------------------------------------------------------------------
// Text overlay colour palette (last entry = outlined/transparent fill).
// ---------------------------------------------------------------------------
export const OVERLAY_COLORS: string[] = [
  '#ffffff', '#0b0b0f', '#ef4444', '#f97316', '#f59e0b', '#facc15', '#a3e635',
  '#22c55e', '#14b8a6', '#38bdf8', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef',
  '#ec4899', '#f43f5e', '#94a3b8', '#78716c', '#1e293b', '#7c2d12',
  'outline',
];

// ---------------------------------------------------------------------------
// Time sticker style variants (tap the sticker to cycle).
// ---------------------------------------------------------------------------
export interface TimeStickerStyle {
  id: string;
  /** container classes */
  className: string;
  textClassName: string;
  showClockIcon: boolean;
}
export const TIME_STICKER_STYLES: TimeStickerStyle[] = [
  { id: 'amber-pill', className: 'bg-amber-500 text-white rounded-2xl px-3 py-2 shadow-lg', textClassName: 'font-bold', showClockIcon: true },
  { id: 'white-card', className: 'bg-white text-neutral-900 rounded-2xl px-3 py-2 shadow-lg', textClassName: 'font-bold', showClockIcon: true },
  { id: 'glass', className: 'bg-black/40 backdrop-blur-md text-white rounded-full px-4 py-2 ring-1 ring-white/30', textClassName: 'font-semibold tracking-wide', showClockIcon: false },
  { id: 'minimal', className: 'text-white drop-shadow-lg', textClassName: 'font-extrabold text-2xl tracking-tight', showClockIcon: false },
];

// ---------------------------------------------------------------------------
// Music lyric-sticker styles.
// ---------------------------------------------------------------------------
export const LYRIC_STYLES: { id: LyricStyle; label: string }[] = [
  { id: 'large', label: 'Large' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'floating', label: 'Floating' },
];

// ---------------------------------------------------------------------------
// Viewer: quick reactions + report reasons (align with DB check constraints).
// ---------------------------------------------------------------------------
export const STORY_REACTIONS: { type: string; emoji: string; label: string }[] = [
  { type: 'like', emoji: '👍', label: 'Like' },
  { type: 'love', emoji: '❤️', label: 'Love' },
  { type: 'laugh', emoji: '😂', label: 'Haha' },
  { type: 'wow', emoji: '😮', label: 'Wow' },
  { type: 'sad', emoji: '😢', label: 'Sad' },
  { type: 'angry', emoji: '😡', label: 'Angry' },
];

export const STORY_REPORT_REASONS: { value: string; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'hate', label: 'Hate or abusive content' },
  { value: 'misinformation', label: 'False or misleading information' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'other', label: 'Something else' },
];

// image stories play for this long before auto-advancing
export const IMAGE_STORY_DURATION_MS = 5000;
// max seconds of a music track that can be attached to a story
export const MUSIC_CLIP_MAX_SECONDS = 20;

// A compact emoji set for the in-composer emoji picker, grouped for the tabs.
export const EMOJI_GROUPS: { id: string; label: string; emojis: string[] }[] = [
  { id: 'smileys', label: 'Smileys', emojis: '😀 😃 😄 😁 😆 😅 😂 🤣 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 😐 😑 😶 😏 😒 🙄 😬 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐'.split(' ') },
  { id: 'gestures', label: 'Gestures', emojis: '👍 👎 👊 ✊ 🤛 🤜 👏 🙌 👐 🤲 🙏 🤝 💪 👋 🤚 🖐 ✋ 🖖 👌 🤏 ✌ 🤞 🤟 🤘 👈 👉 👆 👇 ☝ ✍ 💅'.split(' ') },
  { id: 'hearts', label: 'Hearts', emojis: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ✨ 🌟 ⭐ 💫 🔥 🎉 🎊 🥂 🍾'.split(' ') },
  { id: 'work', label: 'Work', emojis: '💼 📈 📊 📌 📎 🗂 📅 ✅ ✔️ 💡 🚀 🎯 🏆 🥇 🧠 ⚙️ 🔧 💻 🖥 📱 ⌚ 🔗 📣 📢 ☕ 🌍'.split(' ') },
];
