import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Type, Image as ImageIcon, Music2, Clock, RotateCw, ZoomIn, ZoomOut,
  Trash2, RotateCcw, Sparkles, Loader2, Plus, Minus, Smile, Scissors, Camera,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLockFullscreenOverlay } from '@/hooks/useFullscreenOverlay';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { StoryCanvas, IDENTITY_TRANSFORM, captionFontSize, type MediaTransform, type StoryRenderModel } from '@/lib/stories/render';
import {
  FONT_STYLES, OVERLAY_COLORS, OVERLAY_FONTS, TEXT_STORY_FONTS,
  TIME_STICKER_STYLES, MUSIC_CLIP_MAX_SECONDS, fontCss,
} from '@/lib/stories/constants';
import type {
  FontStyle, StoryBackground, StoryDraft, StoryMusic, StoryOverlay, StoryPrivacy, TextOverlay,
} from '@/lib/stories/types';
import { STORY_BACKGROUNDS } from '@/lib/stories/constants';
import { BackgroundPicker } from './BackgroundPicker';
import { EmojiPicker } from './EmojiPicker';
import { MusicPicker } from './MusicPicker';
import { StoryPrivacyDialog } from './StoryPrivacyDialog';
import { renderImageToStoryBlob, captureVideoFrame, autoAltText } from './storyMedia';
import { createStory } from '@/lib/stories/api';

type Mode = 'photo' | 'text';
const uid = () => Math.random().toString(36).slice(2, 10);
const PRIVACY_LABEL: Record<StoryPrivacy, string> = { public: 'Public', friends: 'Connections', custom: 'Custom' };

export function StoryComposer({
  userId,
  authorName,
  authorAvatar,
  defaultPrivacy = 'public',
  onClose,
  onPublished,
}: {
  userId: string;
  authorName: string;
  authorAvatar: string | null;
  defaultPrivacy?: StoryPrivacy;
  onClose: () => void;
  onPublished: (storyId: string) => void;
}) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  useLockFullscreenOverlay(true);

  const [mode, setMode] = useState<Mode | null>(null);

  // ---- media (photo/video) ----
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [transform, setTransform] = useState<MediaTransform>(IDENTITY_TRANSFORM);
  const [videoDuration, setVideoDuration] = useState(0);
  const [trim, setTrim] = useState<{ start: number; end: number } | null>(null);
  const [coverTime, setCoverTime] = useState(0);

  // ---- text ----
  const [caption, setCaption] = useState('');
  const [fontStyle, setFontStyle] = useState<FontStyle>('clean');
  const [background, setBackground] = useState<StoryBackground>(STORY_BACKGROUNDS[0]);

  // ---- shared ----
  const [overlays, setOverlays] = useState<StoryOverlay[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [music, setMusic] = useState<StoryMusic | null>(null);
  const [privacy, setPrivacy] = useState<StoryPrivacy>(defaultPrivacy);
  const [customUserIds, setCustomUserIds] = useState<string[]>([]);
  const [aiLabel, setAiLabel] = useState(false);
  const [altText, setAltText] = useState('');
  const [altSource, setAltSource] = useState<'auto' | 'custom'>('auto');

  const [showMusic, setShowMusic] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const hiddenImgRef = useRef<HTMLImageElement | null>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);

  const dirty = mode !== null && (
    !!mediaFile || caption.trim().length > 0 || overlays.length > 0 || !!music
  );

  // ---- unsaved-changes protection ----
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty && !publishing) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, publishing]);

  useEffect(() => () => { if (mediaUrl) URL.revokeObjectURL(mediaUrl); }, [mediaUrl]);

  const requestClose = useCallback(() => {
    if (dirty && !publishing) setShowDiscard(true);
    else onClose();
  }, [dirty, publishing, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestClose]);

  // ---- media selection ----
  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      toast({ title: 'Unsupported file', description: 'Pick an image or a video.', variant: 'destructive' });
      return;
    }
    if (file.size > 60 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum size is 60 MB.', variant: 'destructive' });
      return;
    }
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    const url = URL.createObjectURL(file);
    setMediaFile(file);
    setMediaType(isVideo ? 'video' : 'image');
    setMediaUrl(url);
    setTransform(IDENTITY_TRANSFORM);
    setTrim(null);
    setCoverTime(0);
    setMode('photo');
  };

  const onMediaMeta = (w: number, h: number) => setNaturalSize({ w, h });

  // ---- overlay helpers ----
  const patchOverlay = useCallback((id: string, patch: Partial<StoryOverlay>) => {
    setOverlays((prev) => prev.map((o) => (o.id === id ? ({ ...o, ...patch } as StoryOverlay) : o)));
  }, []);
  const removeOverlay = (id: string) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    setSelectedId((s) => (s === id ? null : s));
  };
  const addTextOverlay = () => {
    const o: TextOverlay = {
      id: uid(), type: 'text', xPct: 0.5, yPct: 0.4, rotation: 0, scale: 1,
      text: 'Tap to edit', color: '#ffffff', font: 'headline',
    };
    setOverlays((prev) => [...prev, o]);
    setSelectedId(o.id);
  };
  const addTimeOverlay = () => {
    if (overlays.some((o) => o.type === 'time')) return;
    const o: StoryOverlay = {
      id: uid(), type: 'time', xPct: 0.5, yPct: 0.55, rotation: 0, scale: 1,
      styleVariant: 0, capturedAt: new Date().toISOString(),
    };
    setOverlays((prev) => [...prev, o]);
    setSelectedId(o.id);
  };

  const selected = overlays.find((o) => o.id === selectedId) ?? null;

  // ---- render model for the live preview ----
  const model: StoryRenderModel = useMemo(() => ({
    kind: mode === 'text' ? 'text' : 'media',
    background: mode === 'text' ? background : null,
    caption: mode === 'text' ? caption : null,
    fontStyle,
    mediaUrl: mode === 'photo' ? mediaUrl : null,
    mediaType,
    overlays,
    music,
    mediaTransform: transform,
  }), [mode, background, caption, fontStyle, mediaUrl, mediaType, overlays, music, transform]);

  // ---- publish ----
  const canPublish = mode === 'text' ? caption.trim().length > 0 : !!mediaFile;

  const handlePublish = async () => {
    if (!canPublish || publishing) return;
    setPublishing(true);
    try {
      let mediaBlob: Blob | null = null;
      let thumbnailBlob: Blob | null = null;
      let durationMs: number | null = null;

      if (mode === 'photo' && mediaFile) {
        if (mediaType === 'image' && hiddenImgRef.current) {
          mediaBlob = await renderImageToStoryBlob(hiddenImgRef.current, transform);
        } else if (mediaType === 'video') {
          mediaBlob = mediaFile; // stored as-is; trim replayed by the viewer
          durationMs = Math.round(((trim ? trim.end - trim.start : videoDuration) || 0) * 1000);
          if (hiddenVideoRef.current) {
            try { thumbnailBlob = await captureVideoFrame(hiddenVideoRef.current, coverTime); } catch { /* optional */ }
          }
        }
      }

      const resolvedAlt =
        altSource === 'custom'
          ? altText.trim() || null
          : autoAltText(mode === 'text' ? 'text' : (mediaType ?? 'image'), caption);

      const draft: StoryDraft = {
        kind: mode === 'text' ? 'text' : 'media',
        privacy,
        customAudienceUserIds: customUserIds,
        background: mode === 'text' ? background : null,
        fontStyle: mode === 'text' ? fontStyle : (overlays.some((o) => o.type === 'text') ? fontStyle : null),
        caption: mode === 'text' ? caption.trim() : null,
        overlays,
        music,
        aiLabel,
        altText: resolvedAlt,
        altTextSource: altSource,
        mediaBlob,
        mediaType: mode === 'photo' ? mediaType : null,
        mediaWidth: naturalSize?.w ?? null,
        mediaHeight: naturalSize?.h ?? null,
        durationMs,
        trim: mode === 'photo' && mediaType === 'video' ? trim : null,
        thumbnailBlob,
      };

      const story = await createStory(draft, userId);
      toast({ title: 'Story shared' });
      onPublished(story.id);
    } catch (err) {
      console.error('publish story failed', err);
      toast({
        title: 'Could not share story',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
      setPublishing(false);
    }
  };

  // -----------------------------------------------------------------------
  // Entry screen
  // -----------------------------------------------------------------------
  if (mode === null) {
    return (
      <ComposerShell onClose={requestClose} authorName={authorName} authorAvatar={authorAvatar}
        onOpenSettings={undefined}>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="grid w-full max-w-lg grid-cols-2 gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex aspect-[3/4] flex-col items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg transition-transform hover:scale-[1.02]"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-sky-700">
                <ImageIcon className="h-6 w-6" />
              </span>
              <span className="font-semibold">Create a photo or video story</span>
            </button>
            <button
              onClick={() => { setMode('text'); setBackground(STORY_BACKGROUNDS[0]); }}
              className="flex aspect-[3/4] flex-col items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-rose-500 text-white shadow-lg transition-transform hover:scale-[1.02]"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-fuchsia-700 text-xl font-black">
                Aa
              </span>
              <span className="font-semibold">Create a text story</span>
            </button>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={onPickFile} />
      </ComposerShell>
    );
  }

  // -----------------------------------------------------------------------
  // Editor
  // -----------------------------------------------------------------------
  const rail = (
    <div className="flex flex-col gap-4">
      {/* privacy */}
      <button
        onClick={() => setShowPrivacy(true)}
        className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
      >
        <span className="text-muted-foreground">Privacy</span>
        <span className="font-medium">{PRIVACY_LABEL[privacy]}{privacy === 'custom' ? ` (${customUserIds.length})` : ''}</span>
      </button>

      {mode === 'text' && (
        <>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Font</label>
            <Select value={fontStyle} onValueChange={(v) => setFontStyle(v as FontStyle)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEXT_STORY_FONTS.map((f) => (
                  <SelectItem key={f} value={f}>{FONT_STYLES.find((x) => x.id === f)?.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <BackgroundPicker value={background} onChange={setBackground} />
          <EmojiPicker onPick={(e) => setCaption((c) => c + e)} align="start" side="bottom">
            <button className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <Smile className="h-4 w-4" /> Emoji
            </button>
          </EmojiPicker>
        </>
      )}

      {mode === 'photo' && mediaType === 'image' && (
        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Adjust photo</p>
          <div className="flex items-center gap-2">
            <ZoomOut className="h-4 w-4 text-muted-foreground" />
            <Slider min={1} max={4} step={0.01} value={[transform.zoom]}
              onValueChange={([v]) => setTransform((t) => ({ ...t, zoom: v }))} />
            <ZoomIn className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="secondary"
              onClick={() => setTransform((t) => ({ ...t, rotation: (t.rotation + 90) % 360 }))}>
              <RotateCw className="mr-1 h-4 w-4" /> Rotate
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setTransform(IDENTITY_TRANSFORM)}>
              <RotateCcw className="mr-1 h-4 w-4" /> Reset
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Drag the photo to reposition.</p>
        </div>
      )}

      {mode === 'photo' && mediaType === 'video' && (
        <div className="rounded-lg border border-border p-3 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <Scissors className="h-3.5 w-3.5" /> Trim ({MUSIC_CLIP_MAX_SECONDS}s max)
          </p>
          <VideoTrimControl
            duration={videoDuration}
            trim={trim}
            onChange={setTrim}
          />
          <div>
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1">
              <Camera className="h-3.5 w-3.5" /> Cover frame
            </p>
            <Slider
              min={0} max={Math.max(0.1, videoDuration)} step={0.1} value={[coverTime]}
              onValueChange={([v]) => {
                setCoverTime(v);
                if (hiddenVideoRef.current) hiddenVideoRef.current.currentTime = v;
              }}
            />
          </div>
        </div>
      )}

      {mode === 'photo' && (
        <div className="flex flex-col gap-2">
          <button onClick={addTextOverlay} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <Type className="h-4 w-4" /> Add text
          </button>
          <button onClick={addTimeOverlay} disabled={overlays.some((o) => o.type === 'time')}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">
            <Clock className="h-4 w-4" /> Add time
          </button>
        </div>
      )}

      <button onClick={() => setShowMusic(true)}
        className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
        <Music2 className="h-4 w-4" /> {music ? `${music.title} — ${music.artist}` : 'Add music'}
      </button>

      {/* contextual: selected overlay */}
      {selected && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">
              {selected.type === 'text' ? 'Text' : 'Time'} selected
            </span>
            <button onClick={() => removeOverlay(selected.id)} className="text-destructive" aria-label="Delete overlay">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          {selected.type === 'text' && (
            <>
              <Textarea
                value={(selected as TextOverlay).text}
                onChange={(e) => patchOverlay(selected.id, { text: e.target.value })}
                rows={2}
                className="text-sm"
              />
              <Select
                value={(selected as TextOverlay).font}
                onValueChange={(v) => patchOverlay(selected.id, { font: v as FontStyle })}
              >
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OVERLAY_FONTS.map((f) => (
                    <SelectItem key={f} value={f}>{FONT_STYLES.find((x) => x.id === f)?.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-1.5">
                {OVERLAY_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => patchOverlay(selected.id, { color: c })}
                    aria-label={c === 'outline' ? 'Outlined' : c}
                    className={`h-6 w-6 rounded-full border ${
                      (selected as TextOverlay).color === c ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : 'border-border'
                    }`}
                    style={c === 'outline'
                      ? { background: 'transparent', borderStyle: 'dashed' }
                      : { background: c }}
                  />
                ))}
              </div>
            </>
          )}
          {selected.type === 'time' && (
            <button
              onClick={() => patchOverlay(selected.id, {
                styleVariant: ((selected as { styleVariant: number }).styleVariant + 1) % TIME_STICKER_STYLES.length,
              })}
              className="w-full rounded-md border border-border px-2 py-1.5 text-xs"
            >
              Cycle style ({(selected as { styleVariant: number }).styleVariant + 1}/{TIME_STICKER_STYLES.length})
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Size</span>
            <button onClick={() => patchOverlay(selected.id, { scale: Math.max(0.5, selected.scale - 0.1) })}
              className="rounded border border-border p-1"><Minus className="h-3 w-3" /></button>
            <button onClick={() => patchOverlay(selected.id, { scale: Math.min(3, selected.scale + 0.1) })}
              className="rounded border border-border p-1"><Plus className="h-3 w-3" /></button>
            <span className="text-xs text-muted-foreground ml-2">Rotate</span>
            <button onClick={() => patchOverlay(selected.id, { rotation: selected.rotation - 15 })}
              className="rounded border border-border p-1"><RotateCcw className="h-3 w-3" /></button>
            <button onClick={() => patchOverlay(selected.id, { rotation: selected.rotation + 15 })}
              className="rounded border border-border p-1"><RotateCw className="h-3 w-3" /></button>
          </div>
        </div>
      )}

      {/* alt text (photo/video) */}
      {mode === 'photo' && (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Alternative text</p>
          <RadioGroup value={altSource} onValueChange={(v) => setAltSource(v as 'auto' | 'custom')}>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="auto" id="alt-auto" className="mt-0.5" />
              <Label htmlFor="alt-auto" className="text-xs font-normal">
                {autoAltText(mediaType ?? 'image', caption)}
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="custom" id="alt-custom" className="mt-0.5" />
              <Label htmlFor="alt-custom" className="text-xs font-normal">Write your own</Label>
            </div>
          </RadioGroup>
          {altSource === 'custom' && (
            <Textarea value={altText} onChange={(e) => setAltText(e.target.value)}
              placeholder="Describe this photo…" rows={2} className="text-sm" />
          )}
        </div>
      )}

      {/* AI label */}
      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Add AI label</p>
            <p className="text-[11px] text-muted-foreground">Label realistic AI-made content.</p>
          </div>
        </div>
        <Switch checked={aiLabel} onCheckedChange={setAiLabel} />
      </div>
    </div>
  );

  return (
    <ComposerShell onClose={requestClose} authorName={authorName} authorAvatar={authorAvatar}>
      <div className={`flex min-h-0 flex-1 ${isMobile ? 'flex-col' : 'flex-row'}`}>
        {/* rail */}
        <div className={`${isMobile ? 'order-2 flex-1 border-t' : 'w-[340px] shrink-0 border-r'} border-border overflow-y-auto p-4`}>
          {rail}
        </div>

        {/* preview */}
        <div className={`order-1 flex flex-col items-center justify-center gap-2 bg-neutral-900 p-3 ${isMobile ? 'h-[46vh] shrink-0' : 'min-h-0 flex-1'}`}>
          <p className="self-start text-xs font-semibold text-white/60">Preview</p>
          <div className="relative flex-1 min-h-0 w-full flex items-center justify-center">
            <div className="h-full aspect-[9/16] max-h-full">
              {mode === 'text' ? (
                <div className="relative h-full w-full" style={{ containerType: 'size' }}>
                  <StoryCanvas
                    model={model}
                    className="h-full w-full rounded-xl"
                    editable
                    selectedOverlayId={selectedId}
                    onSelectOverlay={setSelectedId}
                    onOverlayChange={patchOverlay}
                  />
                  {/* transparent editing surface over the canvas-rendered caption
                      so what you type is exactly what the viewer will show */}
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder={caption ? '' : 'Start typing'}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    className="absolute inset-0 h-full w-full resize-none bg-transparent px-[8%] text-center outline-none"
                    style={{
                      ...fontCss(fontStyle),
                      fontSize: `${captionFontSize(caption || 'x')}cqmin`,
                      color: 'transparent',
                      WebkitTextFillColor: 'transparent',
                      caretColor: 'white',
                      paddingTop: '42%',
                    }}
                  />
                </div>
              ) : (
                <StoryCanvas
                  model={model}
                  className="h-full w-full rounded-xl"
                  editable
                  selectedOverlayId={selectedId}
                  onSelectOverlay={setSelectedId}
                  onOverlayChange={patchOverlay}
                  onMediaPan={(x, y) => setTransform((t) => ({ ...t, offsetXPct: x, offsetYPct: y }))}
                  videoRef={hiddenVideoRef}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* footer */}
      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <Button variant="ghost" onClick={requestClose} disabled={publishing}>Discard</Button>
        <Button onClick={handlePublish} disabled={!canPublish || publishing}>
          {publishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Share to Story
        </Button>
      </div>

      {/* hidden refs for baking media */}
      {mode === 'photo' && mediaUrl && mediaType === 'image' && (
        <img
          ref={hiddenImgRef}
          src={mediaUrl}
          alt=""
          className="hidden"
          crossOrigin="anonymous"
          onLoad={(e) => onMediaMeta(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
        />
      )}
      {mode === 'photo' && mediaUrl && mediaType === 'video' && (
        <video
          src={mediaUrl}
          className="hidden"
          muted
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            onMediaMeta(v.videoWidth, v.videoHeight);
            setVideoDuration(v.duration);
            setTrim({ start: 0, end: Math.min(MUSIC_CLIP_MAX_SECONDS, v.duration) });
          }}
        />
      )}

      {/* dialogs */}
      <StoryPrivacyDialog
        open={showPrivacy}
        onOpenChange={setShowPrivacy}
        userId={userId}
        value={privacy}
        customUserIds={customUserIds}
        onSave={({ privacy: p, customUserIds: ids }) => { setPrivacy(p); setCustomUserIds(ids); }}
      />

      {showMusic && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowMusic(false)}>
          <div className="h-[80vh] w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <MusicPicker userId={userId} value={music} onChange={setMusic} onClose={() => setShowMusic(false)} />
          </div>
        </div>
      )}

      <AlertDialog open={showDiscard} onOpenChange={setShowDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard story?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to discard this story? Your story won't be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue editing</AlertDialogCancel>
            <AlertDialogAction onClick={onClose} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ComposerShell>
  );
}

// ---------------------------------------------------------------------------
function ComposerShell({
  children, onClose, authorName, authorAvatar,
}: {
  children: React.ReactNode;
  onClose: () => void;
  authorName: string;
  authorAvatar: string | null;
  onOpenSettings?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
          <span className="font-semibold">Create story</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {authorAvatar
            ? <img src={authorAvatar} alt="" className="h-7 w-7 rounded-full object-cover" />
            : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs">{authorName.charAt(0)}</span>}
          <span className="hidden sm:inline">{authorName}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
function VideoTrimControl({
  duration, trim, onChange,
}: {
  duration: number;
  trim: { start: number; end: number } | null;
  onChange: (t: { start: number; end: number }) => void;
}) {
  const s = trim?.start ?? 0;
  const e = trim?.end ?? Math.min(MUSIC_CLIP_MAX_SECONDS, duration || MUSIC_CLIP_MAX_SECONDS);
  if (!duration) return <p className="text-[11px] text-muted-foreground">Loading video…</p>;
  return (
    <div className="space-y-1">
      <Slider
        min={0}
        max={duration}
        step={0.1}
        value={[s, e]}
        onValueChange={([ns, ne]) => {
          let start = ns; let end = ne;
          if (end - start > MUSIC_CLIP_MAX_SECONDS) {
            if (ns !== s) end = start + MUSIC_CLIP_MAX_SECONDS;
            else start = end - MUSIC_CLIP_MAX_SECONDS;
          }
          onChange({ start: Math.max(0, start), end: Math.min(duration, end) });
        }}
      />
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{s.toFixed(1)}s</span>
        <span>{(e - s).toFixed(1)}s clip</span>
        <span>{e.toFixed(1)}s</span>
      </div>
    </div>
  );
}

export default StoryComposer;
