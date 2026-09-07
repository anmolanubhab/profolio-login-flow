/**
 * Phase 6C — shared model + helpers for the post photo editor.
 *
 * Storage model: `posts.media` is an ordered jsonb array of
 *   { url: string; alt: string; w?: number; h?: number }
 * Array order === display order. When present it supersedes the legacy
 * `posts.image_url` / `posts.carousel_urls` (which are still written for
 * backward-compatible rendering). Legacy posts (media === null) render from
 * the old fields unchanged.
 */
import type { Json } from '@/integrations/supabase/types';

export interface PostMediaItem {
  /** Stable per-image identifier (=== the key photo tags point at). Older rows
   *  were backfilled by migration 20260907132926; a missing id is tolerated on
   *  read (an ephemeral one is generated) but always written on save. */
  id: string;
  url: string;
  alt: string;
  w?: number;
  h?: number;
}

export const MAX_POST_IMAGES = 10;

/** 12-char stable id for a media item (matches the SQL backfill shape). */
export function newMediaKey(): string {
  return (
    Date.now().toString(36).slice(-6) +
    Math.random().toString(36).slice(2, 8)
  ).slice(0, 12);
}
export const MAX_ALT_LEN = 1000;

/** Crop aspect ratios offered in the editor. `null` = free / original. */
export const CROP_ASPECTS: { label: string; value: number | null }[] = [
  { label: 'Original', value: null },
  { label: 'Square', value: 1 },
  { label: 'Portrait', value: 4 / 5 },
  { label: 'Landscape', value: 1.91 },
  { label: 'Wide', value: 16 / 9 },
];

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function isAcceptableImage(file: File): string | null {
  if (!IMAGE_MIME.has(file.type)) return `"${file.name}" isn't a supported image (JPEG, PNG, GIF or WebP).`;
  if (file.size > MAX_IMAGE_BYTES) return `"${file.name}" is larger than 5 MB.`;
  return null;
}

// eslint-disable-next-line no-control-regex
const ALT_CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/** Trim, strip control chars (keep newlines/tabs), collapse whitespace, cap
 *  length. Rendered only as an `alt=""` attribute — never as HTML. */
export function sanitizeAlt(input: string): string {
  return (input ?? '')
    .replace(ALT_CONTROL_CHARS, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_ALT_LEN);
}

/** Parse `posts.media` (untrusted jsonb) into a safe, ordered item list. */
export function normalizePostMedia(raw: unknown): PostMediaItem[] {
  if (!Array.isArray(raw)) return [];
  const out: PostMediaItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const url = typeof e.url === 'string' ? e.url : '';
    if (!/^https?:\/\//i.test(url)) continue; // only real http(s) URLs render
    out.push({
      id: typeof e.id === 'string' && e.id.length > 0 ? e.id : newMediaKey(),
      url,
      alt: typeof e.alt === 'string' ? sanitizeAlt(e.alt) : '',
      w: typeof e.w === 'number' && e.w > 0 ? e.w : undefined,
      h: typeof e.h === 'number' && e.h > 0 ? e.h : undefined,
    });
  }
  return out;
}

export function mediaToJson(items: PostMediaItem[]): Json {
  return items.map((i) => ({
    id: i.id || newMediaKey(),
    url: i.url,
    alt: i.alt,
    ...(i.w ? { w: i.w } : {}),
    ...(i.h ? { h: i.h } : {}),
  })) as unknown as Json;
}

/** Natural pixel size of an image URL / object URL. */
export function readImageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = src;
  });
}

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Renders `croppedAreaPixels` (from react-easy-crop) of `src`, with an optional
 * 90-degree-step `rotation`, to a Blob. Non-destructive: the caller uploads
 * this as a NEW asset; the original is never overwritten.
 */
export async function getCroppedBlob(
  src: string,
  croppedAreaPixels: PixelCrop,
  rotation = 0,
  mime: 'image/jpeg' | 'image/webp' = 'image/jpeg',
  quality = 0.92,
): Promise<Blob> {
  const image = await loadImage(src);
  const rad = (rotation * Math.PI) / 180;

  // First draw the (possibly rotated) full image onto a scratch canvas.
  const swap = rotation % 180 !== 0;
  const scratch = document.createElement('canvas');
  scratch.width = swap ? image.height : image.width;
  scratch.height = swap ? image.width : image.height;
  const sctx = scratch.getContext('2d');
  if (!sctx) throw new Error('Canvas not supported');
  sctx.translate(scratch.width / 2, scratch.height / 2);
  sctx.rotate(rad);
  sctx.drawImage(image, -image.width / 2, -image.height / 2);

  // Then copy just the crop rectangle to the output canvas.
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(croppedAreaPixels.width));
  out.height = Math.max(1, Math.round(croppedAreaPixels.height));
  const octx = out.getContext('2d');
  if (!octx) throw new Error('Canvas not supported');
  octx.drawImage(
    scratch,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    out.width,
    out.height,
  );

  return new Promise((resolve, reject) => {
    out.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not export the edited image.'))),
      mime,
      quality,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load the image for editing.'));
    img.src = src;
  });
}
