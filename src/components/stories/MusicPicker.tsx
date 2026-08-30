import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Loader2, Pause, Play, RotateCcw, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  fetchMusicCatalog,
  fetchSavedMusicIds,
  toggleSavedMusic,
} from '@/lib/stories/api';
import { LYRIC_STYLES, MUSIC_CLIP_MAX_SECONDS } from '@/lib/stories/constants';
import type { LyricStyle, MusicTrack, StoryMusic } from '@/lib/stories/types';

// ---------------------------------------------------------------------------
// Waveform: decode the audio once, downsample to N bars (RMS), cache by URL.
// ---------------------------------------------------------------------------
const waveformCache = new Map<string, number[]>();
const BAR_COUNT = 56;

async function analyseWaveform(url: string): Promise<number[]> {
  const cached = waveformCache.get(url);
  if (cached) return cached;
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const audio = await ctx.decodeAudioData(buf.slice(0));
    const data = audio.getChannelData(0);
    const block = Math.floor(data.length / BAR_COUNT);
    const bars: number[] = [];
    let peak = 0;
    for (let i = 0; i < BAR_COUNT; i++) {
      let sum = 0;
      for (let j = 0; j < block; j++) {
        const v = data[i * block + j] || 0;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / block);
      bars.push(rms);
      peak = Math.max(peak, rms);
    }
    const norm = bars.map((b) => (peak > 0 ? Math.max(0.06, b / peak) : 0.2));
    waveformCache.set(url, norm);
    return norm;
  } finally {
    ctx.close();
  }
}

// ---------------------------------------------------------------------------
export function MusicPicker({
  userId,
  value,
  onChange,
  onClose,
}: {
  userId: string;
  value: StoryMusic | null;
  onChange: (m: StoryMusic | null) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [catalog, setCatalog] = useState<MusicTrack[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'browse' | 'saved'>('browse');
  const [q, setQ] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null); // list row preview
  const previewRef = useRef<HTMLAudioElement | null>(null);

  // editing state (a track is chosen -> clip editor)
  const [editing, setEditing] = useState<MusicTrack | null>(null);
  const [clipStart, setClipStart] = useState(0);
  const [lyricStyle, setLyricStyle] = useState<LyricStyle>('large');
  const [wave, setWave] = useState<number[] | null>(null);
  const [waveLoading, setWaveLoading] = useState(false);
  const [clipPlaying, setClipPlaying] = useState(false);
  const clipAudioRef = useRef<HTMLAudioElement | null>(null);
  const dragRef = useRef<{ x: number; start: number; width: number } | null>(null);

  useEffect(() => {
    Promise.all([fetchMusicCatalog(), fetchSavedMusicIds(userId)])
      .then(([c, s]) => { setCatalog(c); setSaved(s); })
      .catch(() => toast({ title: 'Could not load music', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [userId, toast]);

  // If we opened with an existing selection, jump straight into its editor.
  useEffect(() => {
    if (value && !editing && catalog.length) {
      const t = catalog.find((c) => c.id === value.trackId);
      if (t) {
        setEditing(t);
        setClipStart(value.clipStart);
        setLyricStyle(value.lyricStyle);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, catalog]);

  const clipLen = useMemo(
    () => (editing ? Math.min(MUSIC_CLIP_MAX_SECONDS, editing.duration_ms / 1000) : 0),
    [editing],
  );
  const trackLen = editing ? editing.duration_ms / 1000 : 0;
  const maxStart = Math.max(0, trackLen - clipLen);

  // load waveform when entering the editor
  useEffect(() => {
    if (!editing) return;
    setWave(null);
    setWaveLoading(true);
    analyseWaveform(editing.audio_url)
      .then(setWave)
      .catch(() => setWave(Array.from({ length: BAR_COUNT }, () => 0.35)))
      .finally(() => setWaveLoading(false));
  }, [editing]);

  // stop any audio on unmount
  useEffect(() => () => {
    previewRef.current?.pause();
    clipAudioRef.current?.pause();
  }, []);

  const stopListPreview = useCallback(() => {
    previewRef.current?.pause();
    previewRef.current = null;
    setPreviewId(null);
  }, []);

  const toggleListPreview = (t: MusicTrack) => {
    if (previewId === t.id) { stopListPreview(); return; }
    stopListPreview();
    const a = new Audio(t.audio_url);
    a.volume = 0.9;
    a.play().catch(() => {});
    a.onended = () => setPreviewId(null);
    previewRef.current = a;
    setPreviewId(t.id);
  };

  const onToggleSave = async (t: MusicTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    const willSave = !saved.has(t.id);
    setSaved((prev) => {
      const n = new Set(prev);
      if (willSave) n.add(t.id); else n.delete(t.id);
      return n;
    });
    try {
      await toggleSavedMusic(userId, t.id, willSave);
    } catch {
      toast({ title: 'Could not update saved music', variant: 'destructive' });
    }
  };

  const chooseTrack = (t: MusicTrack) => {
    stopListPreview();
    setEditing(t);
    setClipStart(0);
    setLyricStyle('large');
  };

  // ---- clip preview playback (loops start..end) ----
  const toggleClipPlay = () => {
    if (!editing) return;
    if (clipPlaying) {
      clipAudioRef.current?.pause();
      setClipPlaying(false);
      return;
    }
    let a = clipAudioRef.current;
    if (!a) {
      a = new Audio(editing.audio_url);
      clipAudioRef.current = a;
      a.ontimeupdate = () => {
        if (a && a.currentTime >= clipStart + clipLen) {
          a.currentTime = clipStart;
        }
      };
    }
    a.currentTime = clipStart;
    a.play().catch(() => {});
    setClipPlaying(true);
  };

  useEffect(() => {
    // keep preview inside the window when the handle moves
    const a = clipAudioRef.current;
    if (a && clipPlaying && (a.currentTime < clipStart || a.currentTime > clipStart + clipLen)) {
      a.currentTime = clipStart;
    }
  }, [clipStart, clipLen, clipPlaying]);

  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = { x: e.clientX, start: clipStart, width: rect.width };
    (e.target as Element).setPointerCapture?.(e.pointerId);
    // jump the window so it's centred on the click
    const frac = (e.clientX - rect.left) / rect.width;
    const centered = frac * trackLen - clipLen / 2;
    setClipStart(Math.min(maxStart, Math.max(0, centered)));
  };
  const onTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const deltaSec = ((e.clientX - d.x) / d.width) * trackLen;
    setClipStart(Math.min(maxStart, Math.max(0, d.start + deltaSec)));
  };
  const onTrackPointerUp = () => { dragRef.current = null; };

  const confirmClip = () => {
    if (!editing) return;
    clipAudioRef.current?.pause();
    onChange({
      trackId: editing.id,
      title: editing.title,
      artist: editing.artist,
      audioUrl: editing.audio_url,
      clipStart: Math.round(clipStart * 10) / 10,
      clipEnd: Math.round((clipStart + clipLen) * 10) / 10,
      lyricStyle,
      coverColor: editing.cover_color,
    });
    onClose();
  };

  const removeMusic = () => {
    clipAudioRef.current?.pause();
    onChange(null);
    onClose();
  };

  const visibleTracks = useMemo(() => {
    const base = tab === 'saved' ? catalog.filter((t) => saved.has(t.id)) : catalog;
    const term = q.trim().toLowerCase();
    return term ? base.filter((t) => `${t.title} ${t.artist} ${t.genre ?? ''}`.toLowerCase().includes(term)) : base;
  }, [catalog, saved, tab, q]);

  // ---------------- render ----------------
  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-sm font-semibold">{editing ? 'Edit clip' : 'Add music'}</span>
        <button onClick={onClose} aria-label="Close music picker" className="rounded-full p-1 hover:bg-accent">
          <X className="h-4 w-4" />
        </button>
      </div>

      {!editing ? (
        <>
          <div className="space-y-2 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search music" className="h-9 pl-8" />
            </div>
            <div className="flex gap-2">
              {(['browse', 'saved'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                    tab === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {loading && <p className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></p>}
            {!loading && visibleTracks.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {tab === 'saved' ? 'No saved tracks yet.' : 'No tracks found.'}
              </p>
            )}
            {visibleTracks.map((t) => (
              <div
                key={t.id}
                onClick={() => chooseTrack(t)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') chooseTrack(t); }}
                className="flex w-full cursor-pointer items-center gap-3 rounded-md p-2 text-left hover:bg-accent"
              >
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleListPreview(t); }}
                  aria-label={previewId === t.id ? 'Stop preview' : 'Play preview'}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white"
                  style={{ background: t.cover_color }}
                >
                  {previewId === t.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{t.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{t.artist}</span>
                </span>
                <button
                  type="button"
                  onClick={(e) => onToggleSave(t, e)}
                  aria-label={saved.has(t.id) ? 'Unsave' : 'Save'}
                  className="rounded-full p-1.5 hover:bg-background"
                >
                  <Bookmark className={`h-4 w-4 ${saved.has(t.id) ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-4 p-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-md" style={{ background: editing.cover_color }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{editing.title}</p>
              <p className="truncate text-xs text-muted-foreground">{editing.artist}</p>
            </div>
            <button onClick={removeMusic} className="text-xs font-medium text-destructive hover:underline">
              Remove
            </button>
          </div>

          {/* waveform + draggable clip window */}
          <div>
            <div
              className="relative h-16 w-full cursor-ew-resize touch-none select-none rounded-md bg-muted/60"
              onPointerDown={onTrackPointerDown}
              onPointerMove={onTrackPointerMove}
              onPointerUp={onTrackPointerUp}
              onPointerCancel={onTrackPointerUp}
            >
              <div className="absolute inset-0 flex items-center gap-[2px] px-1">
                {(wave ?? Array.from({ length: BAR_COUNT }, () => 0.3)).map((h, i) => {
                  const barSec = (i / BAR_COUNT) * trackLen;
                  const inWindow = barSec >= clipStart && barSec <= clipStart + clipLen;
                  return (
                    <div
                      key={i}
                      className={`flex-1 rounded-full ${inWindow ? 'bg-primary' : 'bg-muted-foreground/40'}`}
                      style={{ height: `${Math.max(8, h * 100)}%` }}
                    />
                  );
                })}
              </div>
              {waveLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {/* window outline */}
              <div
                className="pointer-events-none absolute inset-y-0 rounded-md ring-2 ring-primary"
                style={{
                  left: `${(clipStart / trackLen) * 100}%`,
                  width: `${(clipLen / trackLen) * 100}%`,
                }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{clipStart.toFixed(1)}s – {(clipStart + clipLen).toFixed(1)}s</span>
              <span>{clipLen.toFixed(0)}s clip</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={toggleClipPlay}>
              {clipPlaying ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}
              {clipPlaying ? 'Pause' : 'Preview'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setClipStart(0)}>
              <RotateCcw className="mr-1 h-4 w-4" /> Reset
            </Button>
          </div>

          {/* lyric style */}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Sticker style</p>
            <div className="grid grid-cols-4 gap-2">
              {LYRIC_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setLyricStyle(s.id)}
                  className={`rounded-md border px-2 py-1.5 text-xs ${
                    lyricStyle === s.id ? 'border-primary bg-primary/10 font-semibold' : 'border-border'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => { setEditing(null); clipAudioRef.current?.pause(); setClipPlaying(false); }}>
              Back
            </Button>
            <Button size="sm" onClick={confirmClip}>Done</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MusicPicker;
