/**
 * Phase 6C — the working image model used by the PostImageEditor and its
 * host composers, kept separate from the React component so constants/helpers
 * can be imported without pulling in the editor (and to satisfy react-refresh).
 */
import { secureUpload } from '@/lib/secure-upload';
import { sanitizeAlt, newMediaKey, type PostMediaItem } from '@/lib/posts/media';
import type { DraftTag } from '@/lib/posts/mediaTags';

export interface DraftImage {
  key: string;
  /** Stable media identifier persisted as posts.media[i].id — the key photo
   *  tags point at. Survives crop / reorder / add / delete of other images. */
  mediaKey: string;
  /** Preview + crop source: a data: URL for local files (never revoked, always
   *  loadable in <img> and canvas), or a remote https URL for existing media. */
  src: string;
  alt: string;
  /** Original picked file (new images). */
  file: File | null;
  /** Cropped output to upload instead of `file`. */
  blob: Blob | null;
  /** Already-uploaded URL (Edit Post). null for a brand-new image. */
  remoteUrl: string | null;
  /** People tagged on THIS image (normalised x/y). Separate from @mentions. */
  tags: DraftTag[];
  w?: number;
  h?: number;
}

let keySeq = 0;
const nextKey = () => `img-${Date.now()}-${keySeq++}`;

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('Could not read the image.'));
    r.readAsDataURL(blob);
  });
}

export async function draftFromFile(file: File): Promise<DraftImage> {
  return {
    key: nextKey(),
    mediaKey: newMediaKey(),
    src: await blobToDataUrl(file),
    alt: '',
    file,
    blob: null,
    remoteUrl: null,
    tags: [],
  };
}

export function draftFromMedia(m: PostMediaItem): DraftImage {
  return {
    key: nextKey(),
    mediaKey: m.id || newMediaKey(),
    src: m.url,
    alt: m.alt,
    file: null,
    blob: null,
    remoteUrl: m.url,
    tags: [],
    w: m.w,
    h: m.h,
  };
}

/**
 * Uploads whatever needs uploading (a new file or a cropped blob) and returns
 * the final ordered `posts.media` list. Items that already have a `remoteUrl`
 * and no pending edit are passed through untouched (no duplicate upload).
 */
export async function uploadDraftImages(
  items: DraftImage[],
  userId: string,
  /** Called after each item resolves, for a "Uploading 3/6" indicator. */
  onProgress?: (done: number, total: number) => void,
): Promise<PostMediaItem[]> {
  const out: PostMediaItem[] = [];
  const total = items.length;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.remoteUrl && !it.blob && !it.file) {
      out.push({ id: it.mediaKey, url: it.remoteUrl, alt: sanitizeAlt(it.alt), w: it.w, h: it.h });
      onProgress?.(i + 1, total);
      continue;
    }
    const payload: File = it.blob
      ? new File([it.blob], 'photo.jpg', { type: it.blob.type || 'image/jpeg' })
      : (it.file as File);
    const res = await secureUpload({ bucket: 'post-images', file: payload, userId });
    // Nothing is inserted until this whole loop resolves, so a failure here
    // aborts cleanly -- no partial carousel is ever published.
    if (!res.success || !res.url) {
      throw new Error(
        res.error || `Photo ${i + 1} of ${total} failed to upload. Nothing was posted -- please try again.`,
      );
    }
    out.push({ id: it.mediaKey, url: res.url, alt: sanitizeAlt(it.alt), w: it.w, h: it.h });
    onProgress?.(i + 1, total);
  }
  return out;
}
