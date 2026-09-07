import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { X, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { clamp01, type DraftTag } from '@/lib/posts/mediaTags';

/** Small bottom-left pill that shows/hides the read-only tag markers on a post image. */
export const PhotoTagToggle = ({
  on,
  count,
  onClick,
}: {
  on: boolean;
  count: number;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    aria-label={on ? 'Hide tagged people' : `Show ${count} tagged ${count === 1 ? 'person' : 'people'}`}
    className={cn(
      'absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium shadow',
      on ? 'bg-primary text-primary-foreground' : 'bg-black/65 text-white',
    )}
  >
    <Users className="h-3.5 w-3.5" />
    <span className="tabular-nums">{count}</span>
  </button>
);

interface PhotoTagOverlayProps {
  tags: DraftTag[];
  /** Editable: markers can be dragged and removed. Read-only otherwise. */
  editable?: boolean;
  onMove?: (index: number, x: number, y: number) => void;
  onRemove?: (index: number) => void;
  className?: string;
}

/**
 * Absolutely-positioned marker layer for photo tags. Drop it inside a
 * `position: relative` image wrapper (`absolute inset-0`). Coordinates are
 * normalised (0..1) so markers stay put across any rendered image size.
 */
const PhotoTagOverlay = ({ tags, editable = false, onMove, onRemove, className }: PhotoTagOverlayProps) => {
  const layerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);

  const pointFromEvent = (e: { clientX: number; clientY: number }) => {
    const box = layerRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return null;
    return {
      x: clamp01((e.clientX - box.left) / box.width),
      y: clamp01((e.clientY - box.top) / box.height),
    };
  };

  const handlePointerDown = (index: number) => (e: ReactPointerEvent) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    dragging.current = index;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent) => {
    if (dragging.current === null) return;
    const p = pointFromEvent(e);
    if (p) onMove?.(dragging.current, p.x, p.y);
  };

  const endDrag = (e: ReactPointerEvent) => {
    if (dragging.current === null) return;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    dragging.current = null;
  };

  return (
    <div
      ref={layerRef}
      className={cn('pointer-events-none absolute inset-0', className)}
      onPointerMove={editable ? handlePointerMove : undefined}
      onPointerUp={editable ? endDrag : undefined}
      onPointerCancel={editable ? endDrag : undefined}
    >
      {tags.map((tag, i) => (
        <div
          key={`${tag.profileId}-${i}`}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${tag.x * 100}%`, top: `${tag.y * 100}%` }}
        >
          <div
            className={cn(
              'flex items-center gap-1 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white shadow',
              editable && 'pointer-events-auto cursor-grab touch-none active:cursor-grabbing',
            )}
            onPointerDown={handlePointerDown(i)}
            role={editable ? 'button' : undefined}
            aria-label={editable ? `Move tag for ${tag.name}` : `Tagged: ${tag.name}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
            <span className="max-w-[9rem] truncate">{tag.name}</span>
            {editable && (
              <button
                type="button"
                className="pointer-events-auto -mr-0.5 ml-0.5 rounded-full p-0.5 hover:bg-white/20"
                aria-label={`Remove tag for ${tag.name}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove?.(i);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PhotoTagOverlay;
