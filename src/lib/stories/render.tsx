import { useCallback, useMemo, useRef, useState } from 'react';
import { Clock, Music2 } from 'lucide-react';
import { fontCss, TIME_STICKER_STYLES } from './constants';
import type { StoryMusic, StoryOverlay, TextOverlay, TimeOverlay } from './types';

// The transform the image adjuster produces / the viewer replays.
export interface MediaTransform {
  zoom: number;          // 1..4
  rotation: number;      // degrees, multiples of 90
  offsetXPct: number;    // -0.5..0.5 of container width
  offsetYPct: number;    // -0.5..0.5 of container height
}

export const IDENTITY_TRANSFORM: MediaTransform = { zoom: 1, rotation: 0, offsetXPct: 0, offsetYPct: 0 };

export interface StoryRenderModel {
  kind: 'media' | 'text';
  background?: { css: string } | null;
  caption?: string | null;
  fontStyle?: string | null;
  mediaUrl?: string | null;
  mediaType?: 'image' | 'video' | null;
  thumbnailUrl?: string | null;
  overlays: StoryOverlay[];
  music?: StoryMusic | null;
  mediaTransform?: MediaTransform | null;
}

function formatClock(iso: string) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export function captionFontSize(text: string): number {
  const len = text.trim().length || 1;
  if (len < 12) return 13;
  if (len < 30) return 10;
  if (len < 80) return 7.5;
  if (len < 160) return 5.5;
  return 4.2;
}

// ---------------------------------------------------------------------------
// Music sticker (lyric-style variants)
// ---------------------------------------------------------------------------
export function MusicSticker({ music, compact }: { music: StoryMusic; compact?: boolean }) {
  const base = 'pointer-events-none select-none flex items-center gap-2 max-w-[80%]';
  if (music.lyricStyle === 'large') {
    return (
      <div className={`${base} flex-col text-center`}>
        <div
          className="rounded-xl px-4 py-3 shadow-xl"
          style={{ background: music.coverColor }}
        >
          <p className={`font-extrabold text-white leading-tight ${compact ? 'text-xs' : 'text-base'}`}>
            {music.title.toUpperCase()}
          </p>
          <p className={`text-white/80 ${compact ? 'text-[9px]' : 'text-xs'} flex items-center justify-center gap-1`}>
            <Music2 className="h-3 w-3" /> {music.artist}
          </p>
        </div>
      </div>
    );
  }
  if (music.lyricStyle === 'floating') {
    return (
      <div className={`${base} bg-black/35 backdrop-blur-md rounded-full px-3 py-1.5 ring-1 ring-white/25`}>
        <Music2 className="h-3.5 w-3.5 text-white shrink-0" />
        <span className={`text-white truncate ${compact ? 'text-[10px]' : 'text-sm'}`}>
          {music.title} · {music.artist}
        </span>
      </div>
    );
  }
  const dark = music.lyricStyle === 'dark';
  return (
    <div
      className={`${base} rounded-lg px-3 py-2 shadow-lg ${dark ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-900'}`}
    >
      <div className="h-8 w-8 rounded-md shrink-0" style={{ background: music.coverColor }} />
      <div className="min-w-0">
        <p className={`font-semibold truncate ${compact ? 'text-[10px]' : 'text-sm'}`}>{music.title}</p>
        <p className={`opacity-70 truncate ${compact ? 'text-[9px]' : 'text-xs'}`}>{music.artist}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual overlay renderers
// ---------------------------------------------------------------------------
function TextOverlayView({ o, compact }: { o: TextOverlay; compact?: boolean }) {
  const outlined = o.color === 'outline';
  return (
    <span
      className="whitespace-pre-wrap text-center leading-tight"
      style={{
        ...fontCss(o.font),
        fontSize: `${(compact ? 4.5 : 6.5) * o.scale}cqmin`,
        color: outlined ? 'transparent' : o.color,
        WebkitTextStroke: outlined ? '1.5px #fff' : undefined,
        textShadow: outlined ? undefined : '0 1px 6px rgba(0,0,0,0.35)',
      }}
    >
      {o.text}
    </span>
  );
}

function TimeOverlayView({ o, compact }: { o: TimeOverlay; compact?: boolean }) {
  const style = TIME_STICKER_STYLES[o.styleVariant] ?? TIME_STICKER_STYLES[0];
  return (
    <div
      className={`inline-flex items-center gap-1.5 ${style.className}`}
      style={{ fontSize: `${(compact ? 3.4 : 4.6) * o.scale}cqmin` }}
    >
      {style.showClockIcon && <Clock style={{ width: '1.1em', height: '1.1em' }} />}
      <span className={style.textClassName} style={{ fontSize: 'inherit' }}>{formatClock(o.capturedAt)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The 9:16 surface. Presentational by default; pass editing props to make the
// overlays draggable (used by the composer).
// ---------------------------------------------------------------------------
export function StoryCanvas({
  model,
  className = '',
  compact = false,
  editable = false,
  selectedOverlayId = null,
  onSelectOverlay,
  onOverlayChange,
  onMediaPan,
  muted = true,
  videoRef,
}: {
  model: StoryRenderModel;
  className?: string;
  compact?: boolean;
  editable?: boolean;
  selectedOverlayId?: string | null;
  onSelectOverlay?: (id: string | null) => void;
  onOverlayChange?: (id: string, patch: Partial<StoryOverlay>) => void;
  /** editable media stories: drag on empty canvas pans the image */
  onMediaPan?: (offsetXPct: number, offsetYPct: number) => void;
  muted?: boolean;
  videoRef?: React.Ref<HTMLVideoElement>;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; px: number; py: number; startX: number; startY: number } | null>(null);
  const pan = useRef<{ px: number; py: number; startX: number; startY: number } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const t = model.mediaTransform ?? IDENTITY_TRANSFORM;
  const rotated = Math.abs(t.rotation % 180) === 90;

  const mediaStyle = useMemo<React.CSSProperties>(() => ({
    transform: `translate(${t.offsetXPct * 100}%, ${t.offsetYPct * 100}%) rotate(${t.rotation}deg) scale(${t.zoom})`,
    transformOrigin: 'center',
    width: rotated ? '177.78%' : '100%',
    height: rotated ? '177.78%' : '100%',
  }), [t.offsetXPct, t.offsetYPct, t.rotation, t.zoom, rotated]);

  const onPointerDown = useCallback((e: React.PointerEvent, o: StoryOverlay) => {
    if (!editable) return;
    e.stopPropagation();
    onSelectOverlay?.(o.id);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { id: o.id, px: e.clientX, py: e.clientY, startX: o.xPct, startY: o.yPct };
    setDragging(o.id);
  }, [editable, onSelectOverlay]);

  const onSurfacePointerDown = useCallback((e: React.PointerEvent) => {
    if (!editable || model.kind !== 'media' || !onMediaPan) return;
    const cur = model.mediaTransform ?? IDENTITY_TRANSFORM;
    pan.current = { px: e.clientX, py: e.clientY, startX: cur.offsetXPct, startY: cur.offsetYPct };
  }, [editable, model.kind, model.mediaTransform, onMediaPan]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const d = drag.current;
    if (d) {
      const nx = Math.min(1, Math.max(0, d.startX + (e.clientX - d.px) / rect.width));
      const ny = Math.min(1, Math.max(0, d.startY + (e.clientY - d.py) / rect.height));
      onOverlayChange?.(d.id, { xPct: nx, yPct: ny });
      return;
    }
    const p = pan.current;
    if (p && onMediaPan) {
      const nx = Math.min(0.5, Math.max(-0.5, p.startX + (e.clientX - p.px) / rect.width));
      const ny = Math.min(0.5, Math.max(-0.5, p.startY + (e.clientY - p.py) / rect.height));
      onMediaPan(nx, ny);
    }
  }, [onOverlayChange, onMediaPan]);

  const onPointerUp = useCallback(() => {
    drag.current = null;
    pan.current = null;
    setDragging(null);
  }, []);

  return (
    <div
      ref={surfaceRef}
      className={`relative overflow-hidden ${className}`}
      style={{ aspectRatio: '9 / 16', containerType: 'size', background: model.kind === 'text' ? model.background?.css : '#000' }}
      onPointerDown={editable ? onSurfacePointerDown : undefined}
      onPointerMove={editable ? onPointerMove : undefined}
      onPointerUp={editable ? onPointerUp : undefined}
      onPointerCancel={editable ? onPointerUp : undefined}
      onClick={editable ? () => onSelectOverlay?.(null) : undefined}
    >
      {/* media */}
      {model.kind === 'media' && model.mediaUrl && (
        model.mediaType === 'video' ? (
          <video
            ref={videoRef}
            src={model.mediaUrl}
            poster={model.thumbnailUrl ?? undefined}
            className="absolute inset-0 m-auto object-cover"
            style={mediaStyle}
            playsInline
            muted={muted}
          />
        ) : (
          <img
            src={model.mediaUrl}
            alt=""
            draggable={false}
            className="absolute inset-0 m-auto object-cover"
            style={mediaStyle}
          />
        )
      )}

      {/* text-story caption */}
      {model.kind === 'text' && model.caption != null && (
        <div className="absolute inset-0 flex items-center justify-center p-[8%]">
          <p
            className="text-center text-white whitespace-pre-wrap break-words leading-tight"
            style={{ ...fontCss(model.fontStyle), fontSize: `${captionFontSize(model.caption) * (compact ? 0.8 : 1)}cqmin`, textShadow: '0 2px 12px rgba(0,0,0,0.35)' }}
          >
            {model.caption || ' '}
          </p>
        </div>
      )}

      {/* overlays */}
      {model.overlays.map((o) => {
        const isSelected = editable && selectedOverlayId === o.id;
        return (
          <div
            key={o.id}
            onPointerDown={(e) => onPointerDown(e, o)}
            className={`absolute ${editable ? 'cursor-move touch-none' : 'pointer-events-none'} ${dragging === o.id ? 'z-30' : 'z-20'}`}
            style={{
              left: `${o.xPct * 100}%`,
              top: `${o.yPct * 100}%`,
              transform: `translate(-50%,-50%) rotate(${o.rotation}deg)`,
            }}
          >
            <div className={isSelected ? 'ring-2 ring-white/90 rounded-md p-1' : ''}>
              {o.type === 'text'
                ? <TextOverlayView o={o} compact={compact} />
                : <TimeOverlayView o={o} compact={compact} />}
            </div>
          </div>
        );
      })}

      {/* music sticker (bottom-centre, non-interactive) */}
      {model.music && (
        <div className="absolute inset-x-0 bottom-[7%] flex justify-center px-2">
          <MusicSticker music={model.music} compact={compact} />
        </div>
      )}
    </div>
  );
}

export { formatClock };
