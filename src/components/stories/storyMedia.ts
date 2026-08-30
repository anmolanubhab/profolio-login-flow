import type { MediaTransform } from '@/lib/stories/render';

export const STORY_OUT_W = 1080;
export const STORY_OUT_H = 1920;

/**
 * Bakes the composer's pan / zoom / 90°-rotation transform into a 1080×1920
 * JPEG so the stored media is already a correct 9:16 frame (overlays/music/
 * text stay as metadata and are re-rendered by the viewer).
 */
export async function renderImageToStoryBlob(
  img: HTMLImageElement,
  t: MediaTransform,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = STORY_OUT_W;
  canvas.height = STORY_OUT_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, STORY_OUT_W, STORY_OUT_H);

  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const rotated = Math.abs(t.rotation % 180) === 90;
  const cover = rotated
    ? Math.max(STORY_OUT_W / ih, STORY_OUT_H / iw)
    : Math.max(STORY_OUT_W / iw, STORY_OUT_H / ih);
  const scale = cover * t.zoom;

  ctx.translate(STORY_OUT_W / 2 + t.offsetXPct * STORY_OUT_W, STORY_OUT_H / 2 + t.offsetYPct * STORY_OUT_H);
  ctx.rotate((t.rotation * Math.PI) / 180);
  ctx.scale(scale, scale);
  ctx.drawImage(img, -iw / 2, -ih / 2);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), 'image/jpeg', 0.9),
  );
}

/** Grabs a single frame from a <video> at `time` seconds as a JPEG blob. */
export async function captureVideoFrame(video: HTMLVideoElement, time: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const w = video.videoWidth || STORY_OUT_W;
  const h = video.videoHeight || STORY_OUT_H;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');

  await new Promise<void>((resolve) => {
    const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = Math.max(0, Math.min(time, (video.duration || time) - 0.05));
  });
  ctx.drawImage(video, 0, 0, w, h);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Frame capture failed'))), 'image/jpeg', 0.85),
  );
}

/** Auto image description stand-in (no vision model available client-side). */
export function autoAltText(kind: 'image' | 'video' | 'text', caption?: string | null): string {
  if (kind === 'text') return `Text story${caption ? ` that says "${caption.slice(0, 120)}"` : ''}`;
  if (kind === 'video') return 'A video shared to a story';
  return 'A photo shared to a story';
}
