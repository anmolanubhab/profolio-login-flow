import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RotateCcw, RotateCw, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CROP_ASPECTS, getCroppedBlob, type PixelCrop } from '@/lib/posts/media';

interface PostCropDialogProps {
  open: boolean;
  /** Object URL / remote URL of the image being edited. */
  src: string;
  onCancel: () => void;
  onApply: (blob: Blob) => void;
}

/**
 * Single-image crop / zoom / pan / 90-degree-rotate editor, built on
 * react-easy-crop. Non-destructive: "Apply" hands back a freshly rendered
 * Blob; the caller uploads it as a new asset and keeps the original intact.
 * Matches the useful subset of LinkedIn's photo "Edit → Crop" panel
 * (pan + zoom + aspect ratios + 90-degree rotation). Filters / brightness /
 * straighten slider / flip are deferred.
 */
const PostCropDialog = ({ open, src, onCancel, onApply }: PostCropDialogProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspectIdx, setAspectIdx] = useState(0);
  const [pixels, setPixels] = useState<PixelCrop | null>(null);
  const [busy, setBusy] = useState(false);

  const aspect = CROP_ASPECTS[aspectIdx]?.value ?? undefined;

  const onCropComplete = useCallback((_area: unknown, areaPixels: PixelCrop) => {
    setPixels(areaPixels);
  }, []);

  const reset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setAspectIdx(0);
  };

  const apply = async () => {
    if (!pixels || busy) return;
    setBusy(true);
    try {
      const norm = ((rotation % 360) + 360) % 360;
      const blob = await getCroppedBlob(src, pixels, norm);
      onApply(blob);
    } catch (err) {
      console.error('Crop failed:', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit photo</DialogTitle>
        </DialogHeader>

        <div className="relative h-[46vh] w-full overflow-hidden rounded-lg bg-black/90">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            restrictPosition={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Aspect ratio">
            {CROP_ASPECTS.map((a, i) => (
              <button
                key={a.label}
                type="button"
                role="radio"
                aria-checked={i === aspectIdx}
                onClick={() => setAspectIdx(i)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  i === aspectIdx ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-secondary',
                )}
              >
                {a.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <label htmlFor="crop-zoom" className="w-14 shrink-0 text-xs text-muted-foreground">Zoom</label>
            <input
              id="crop-zoom"
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer accent-[hsl(var(--primary))]"
              aria-label="Zoom"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-xs text-muted-foreground">Rotate</span>
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="Rotate left 90 degrees" onClick={() => setRotation((r) => r - 90)}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="Rotate right 90 degrees" onClick={() => setRotation((r) => r + 90)}>
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={reset}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Reset
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button onClick={apply} disabled={busy || !pixels}>
            {busy ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Applying…</> : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PostCropDialog;
