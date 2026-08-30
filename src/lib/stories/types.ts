// Shared types for the Story system (composer + viewer). Kept framework-free
// so both the create flow and the read-only viewer render from one model.

export type StoryKind = 'media' | 'text';
export type StoryPrivacy = 'public' | 'friends' | 'custom';
export type FontStyle = 'clean' | 'casual' | 'fancy' | 'headline' | 'simple';
export type LyricStyle = 'large' | 'light' | 'dark' | 'floating';
export type AltTextSource = 'auto' | 'custom';

export interface StoryBackground {
  /** stable id from STORY_BACKGROUNDS */
  id: string;
  /** any valid CSS `background` value (solid or gradient) */
  css: string;
  /** short a11y / label text */
  label: string;
}

interface OverlayBase {
  id: string;
  /** centre position as a fraction (0..1) of the canvas */
  xPct: number;
  yPct: number;
  /** degrees */
  rotation: number;
  /** multiplier applied to the overlay's base size */
  scale: number;
}

export interface TextOverlay extends OverlayBase {
  type: 'text';
  text: string;
  color: string;
  font: FontStyle;
}

export interface TimeOverlay extends OverlayBase {
  type: 'time';
  /** index into TIME_STICKER_STYLES */
  styleVariant: number;
  /** ISO string captured when the sticker was added */
  capturedAt: string;
}

export type StoryOverlay = TextOverlay | TimeOverlay;

export interface StoryMusic {
  trackId: string;
  title: string;
  artist: string;
  audioUrl: string;
  /** seconds */
  clipStart: number;
  clipEnd: number;
  lyricStyle: LyricStyle;
  coverColor: string;
}

/** Full row shape the app works with (superset of the DB row, camel-free). */
export interface StoryRecord {
  id: string;
  user_id: string;
  kind: StoryKind;
  privacy: StoryPrivacy;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  media_width: number | null;
  media_height: number | null;
  thumbnail_url: string | null;
  duration_ms: number | null;
  trim: { start: number; end: number } | null;
  background: StoryBackground | null;
  font_style: FontStyle | null;
  caption: string | null;
  overlays: StoryOverlay[];
  music: StoryMusic | null;
  alt_text: string | null;
  alt_text_source: AltTextSource;
  ai_label: boolean;
  is_archived: boolean;
  created_at: string;
  expires_at: string;
}

export interface StoryAuthorGroup {
  userId: string;
  profile: { display_name: string | null; avatar_url: string | null } | null;
  stories: StoryRecord[];
  isSelf: boolean;
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  audio_url: string;
  duration_ms: number;
  cover_color: string;
  genre: string | null;
}

/** The output of the composer, handed to the create-story API call. */
export interface StoryDraft {
  kind: StoryKind;
  privacy: StoryPrivacy;
  customAudienceUserIds: string[];
  background: StoryBackground | null;
  fontStyle: FontStyle | null;
  caption: string | null;
  overlays: StoryOverlay[];
  music: StoryMusic | null;
  aiLabel: boolean;
  altText: string | null;
  altTextSource: AltTextSource;
  // media (kind === 'media')
  mediaBlob: Blob | null;
  mediaType: 'image' | 'video' | null;
  mediaWidth: number | null;
  mediaHeight: number | null;
  durationMs: number | null;
  trim: { start: number; end: number } | null;
  thumbnailBlob: Blob | null;
}
