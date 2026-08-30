import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
} from '@/components/ui/responsive-modal';

interface ImageCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The raw file the user picked. */
  file: File | null;
  /** Called with the cropped square JPEG. */
  onCropped: (blob: Blob) => void | Promise<void>;
  /** Output edge length in px (square). Default 512. */
  outputSize?: number;
  title?: string;
  description?: string;
  /** Round mask over the crop area (profile photo). Default true. */
  circular?: boolean;
  busy?: boolean;
}

/**
 * Dependency-free "position & size" square cropper — the user pans/zooms the
 * picked image inside a fixed square (circular mask by default) and the exact
 * framed region is rendered to a canvas at `outputSize`, so what they frame is
 * what gets uploaded. Nothing is squished or auto-cropped by the browser.
 */
export default function ImageCropDialog({
  open,
  onOpenChange,
  file,
  onCropped,
  outputSize = 512,
  title = 'Position your photo',
  description = 'Drag to reposition, use the slider to zoom.',
  circular = true,
  busy = false,
}: ImageCropDialogProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragging = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const [url, setUrl] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [stage, setStage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [rendering, setRendering] = useState(false);

  // object URL for the picked file
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    setNat(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(u);
  }, [file]);

  // measure the square stage
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      if (stageRef.current) setStage(stageRef.current.clientWidth);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, url]);

  const baseScale = nat && stage ? stage / Math.min(nat.w, nat.h) : 1;
  const dispW = nat ? nat.w * baseScale * zoom : 0;
  const dispH = nat ? nat.h * baseScale * zoom : 0;

  const clamp = useCallback(
    (x: number, y: number) => {
      const maxX = Math.max(0, (dispW - stage) / 2);
      const maxY = Math.max(0, (dispH - stage) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      };
    },
    [dispW, dispH, stage],
  );

  useEffect(() => {
    setOffset((o) => clamp(o.x, o.y));
  }, [zoom, clamp]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragging.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragging.current.px;
    const dy = e.clientY - dragging.current.py;
    setOffset(clamp(dragging.current.ox + dx, dragging.current.oy + dy));
  };
  const onPointerUp = () => {
    dragging.current = null;
  };

  const handleConfirm = async () => {
    const img = imgRef.current;
    if (!img || !nat || !stage) return;
    setRendering(true);
    try {
      const scale = baseScale * zoom;
      const visSrc = stage / scale; // source px visible edge (square)
      const sx = nat.w / 2 - visSrc / 2 - offset.x / scale;
      const sy = nat.h / 2 - visSrc / 2 - offset.y / scale;

      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, visSrc, visSrc, 0, 0, outputSize, outputSize);

      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), 'image/jpeg', 0.92),
      );
      await onCropped(blob);
    } finally {
      setRendering(false);
    }
  };

  const working = busy || rendering;

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !working && onOpenChange(o)}>
      <ResponsiveModalContent className="sm:max-w-md">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>{title}</ResponsiveModalTitle>
          <ResponsiveModalDescription>{description}</ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="flex flex-col items-center gap-4 py-1">
          <div
            ref={stageRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="relative aspect-square w-full max-w-[320px] cursor-grab touch-none select-none overflow-hidden rounded-lg bg-muted active:cursor-grabbing"
          >
            {url && (
              <img
                ref={imgRef}
                src={url}
                alt=""
                draggable={false}
                onLoad={(e) => {
                  const el = e.currentTarget;
                  setNat({ w: el.naturalWidth, h: el.naturalHeight });
                }}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                style={{
                  width: dispW || undefined,
                  height: dispH || undefined,
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                }}
              />
            )}
            {/* mask */}
            <div
              className={
                circular
                  ? 'pointer-events-none absolute inset-0 rounded-lg shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.45)] [clip-path:circle(50%)] [-webkit-clip-path:circle(50%)]'
                  : 'pointer-events-none absolute inset-0'
              }
            />
            {circular && (
              <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/70" />
            )}
          </div>

          <div className="flex w-full max-w-[320px] items-center gap-3">
            <ZoomOut className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.01}
              onValueChange={([v]) => setZoom(v)}
              aria-label="Zoom"
            />
            <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
        </div>

        <ResponsiveModalFooter className="gap-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={working}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={working || !nat}>
            {working ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Apply
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
