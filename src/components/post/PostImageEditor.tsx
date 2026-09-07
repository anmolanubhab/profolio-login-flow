import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Type, Trash2, Plus, X, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import PostCropDialog from '@/components/post/PostCropDialog';
import PhotoTagOverlay from '@/components/post/PhotoTagOverlay';
import PostTagSearchDialog from '@/components/post/PostTagSearchDialog';
import { isAcceptableImage, readImageSize, MAX_ALT_LEN, MAX_POST_IMAGES } from '@/lib/posts/media';
import { blobToDataUrl, draftFromFile, type DraftImage } from '@/lib/posts/mediaDrafts';
import { clamp01, type DraftTag } from '@/lib/posts/mediaTags';

interface PostImageEditorProps {
  open: boolean;
  /** [] to start empty; a seeded list for Edit Post. */
  initial: DraftImage[];
  onCancel: () => void;
  onDone: (items: DraftImage[]) => void;
}

/**
 * The "Editor" — a LinkedIn-style multi-photo workspace: a large preview, a
 * thumbnail rail, per-image Edit (crop) and ALT text, Add / Delete, and
 * Back / Next. Edits are attached to the correct image via a stable `key`, so
 * deleting or adding never corrupts another image's crop or alt text.
 */
const PostImageEditor = ({ open, initial, onCancel, onDone }: PostImageEditorProps) => {
  const { toast } = useToast();
  const [items, setItems] = useState<DraftImage[]>(initial);
  const [active, setActive] = useState(0);
  const [showAlt, setShowAlt] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [tagSearchOpen, setTagSearchOpen] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  // Re-seed when the dialog (re)opens. Previews use data: URLs, so there is no
  // object-URL lifecycle to manage (avoids StrictMode double-invoke pitfalls).
  useEffect(() => {
    if (open) {
      setItems(initial);
      setActive(0);
      setShowAlt(false);
      setTagSearchOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const current = items[active];

  const patchCurrent = useCallback(
    (patch: Partial<DraftImage>) => {
      setItems((prev) => prev.map((it, i) => (i === active ? { ...it, ...patch } : it)));
    },
    [active],
  );

  const handleAdd = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_POST_IMAGES - items.length;
    if (room <= 0) {
      toast({ title: `You can add up to ${MAX_POST_IMAGES} photos.`, variant: 'destructive' });
      return;
    }
    const picked = Array.from(files).slice(0, room);
    const accepted: DraftImage[] = [];
    for (const f of picked) {
      const err = isAcceptableImage(f);
      if (err) {
        toast({ title: 'Photo skipped', description: err, variant: 'destructive' });
        continue;
      }
      const d = await draftFromFile(f);
      const size = await readImageSize(d.src);
      d.w = size.w || undefined;
      d.h = size.h || undefined;
      accepted.push(d);
    }
    if (accepted.length) {
      setItems((prev) => [...prev, ...accepted]);
      setActive(items.length); // jump to the first newly added
    }
    if (addInputRef.current) addInputRef.current.value = '';
  };

  const handleDelete = () => {
    setItems((prev) => prev.filter((_, i) => i !== active));
    setActive((a) => Math.max(0, a - (active === items.length - 1 ? 1 : 0)));
  };

  // Deleting the last photo exits the editor with no photos (LinkedIn-style).
  useEffect(() => {
    if (open && items.length === 0) onCancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const handleCropApply = async (blob: Blob) => {
    setCropOpen(false);
    if (!current) return;
    const url = await blobToDataUrl(blob);
    const size = await readImageSize(url);
    patchCurrent({ src: url, blob, remoteUrl: null, w: size.w || undefined, h: size.h || undefined });
  };

  const altLen = current?.alt.length ?? 0;

  // --- photo tags (people attached to THIS image) ---------------------------
  const setTags = useCallback(
    (updater: (prev: DraftTag[]) => DraftTag[]) =>
      setItems((prev) => prev.map((it, i) => (i === active ? { ...it, tags: updater(it.tags) } : it))),
    [active],
  );
  const addTag = (t: Pick<DraftTag, 'profileId' | 'name' | 'avatarUrl'>) =>
    setTags((prev) =>
      prev.some((p) => p.profileId === t.profileId)
        ? prev
        : [...prev, { ...t, x: 0.5, y: 0.5 }],
    );
  const moveTag = (idx: number, x: number, y: number) =>
    setTags((prev) => prev.map((p, i) => (i === idx ? { ...p, x: clamp01(x), y: clamp01(y) } : p)));
  const removeTag = (idx: number) => setTags((prev) => prev.filter((_, i) => i !== idx));

  const railScrollRef = useRef<HTMLDivElement>(null);

  const done = useMemo(() => items.length > 0, [items.length]);

  return (
    <>
      <Dialog open={open && !cropOpen} onOpenChange={(o) => !o && onCancel()}>
        <DialogContent className="sm:max-w-3xl" aria-describedby={undefined}>
          <DialogHeader className="flex-row items-center justify-between space-y-0">
            <DialogTitle>Editor</DialogTitle>
            {items.length > 0 && (
              <span className="pr-6 text-sm text-muted-foreground" aria-live="polite">
                {active + 1} of {items.length}
              </span>
            )}
          </DialogHeader>

          <div className="flex flex-col gap-3 sm:flex-row">
            {/* preview + tools */}
            <div className="min-w-0 flex-1">
              <div className="flex h-[42vh] items-center justify-center overflow-hidden rounded-lg bg-black/90">
                {current ? (
                  <div className="relative inline-block max-h-full max-w-full">
                    <img
                      src={current.src}
                      alt={current.alt || 'Selected photo preview'}
                      className="block max-h-[42vh] max-w-full object-contain"
                    />
                    <PhotoTagOverlay
                      tags={current.tags}
                      editable
                      onMove={moveTag}
                      onRemove={removeTag}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-white/70">No photos</p>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={!current} onClick={() => setCropOpen(true)}>
                  <Pencil className="mr-1.5 h-4 w-4" /> Edit
                </Button>
                <Button
                  type="button"
                  variant={showAlt ? 'default' : 'outline'}
                  size="sm"
                  disabled={!current}
                  onClick={() => setShowAlt((s) => !s)}
                  aria-pressed={showAlt}
                >
                  <Type className="mr-1.5 h-4 w-4" /> ALT
                  {current?.alt.trim() ? <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden /> : null}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!current}
                  onClick={() => setTagSearchOpen(true)}
                >
                  <Users className="mr-1.5 h-4 w-4" /> Tag
                  {current && current.tags.length > 0 ? (
                    <span className="ml-1.5 rounded bg-muted px-1 text-[11px] tabular-nums">
                      {current.tags.length}
                    </span>
                  ) : null}
                </Button>
              </div>

              {current && current.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {current.tags.map((t, i) => (
                    <span
                      key={`${t.profileId}-${i}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 py-0.5 pl-2 pr-1 text-xs"
                    >
                      {t.name}
                      <button
                        type="button"
                        aria-label={`Remove tag for ${t.name}`}
                        className="rounded-full p-0.5 hover:bg-muted"
                        onClick={() => removeTag(i)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {showAlt && current && (
                <div className="mt-2 rounded-lg border border-border p-3">
                  <label htmlFor="alt-text" className="text-xs font-medium">
                    Alternative text
                  </label>
                  <p className="mb-1.5 text-xs text-muted-foreground">
                    Describe this photo for people who use screen readers.
                  </p>
                  <Textarea
                    id="alt-text"
                    value={current.alt}
                    maxLength={MAX_ALT_LEN}
                    onChange={(e) => patchCurrent({ alt: e.target.value })}
                    placeholder="How would you describe this image?"
                    className="min-h-[64px] text-sm"
                  />
                  <p className="mt-1 text-right text-[11px] text-muted-foreground">
                    {altLen}/{MAX_ALT_LEN}
                  </p>
                </div>
              )}
            </div>

            {/* thumbnail rail */}
            <div className="sm:w-28 sm:shrink-0">
              <div
                ref={railScrollRef}
                className="flex gap-2 overflow-x-auto pb-1 sm:max-h-[42vh] sm:flex-col sm:overflow-y-auto sm:overflow-x-visible"
              >
                {items.map((it, i) => (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => setActive(i)}
                    aria-label={`Photo ${i + 1}${it.alt ? `: ${it.alt}` : ''}`}
                    aria-current={i === active}
                    className={cn(
                      'relative aspect-square w-20 shrink-0 overflow-hidden rounded-md border-2 transition-colors sm:w-full',
                      i === active ? 'border-primary' : 'border-transparent hover:border-border',
                    )}
                  >
                    <img src={it.src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>

              <div className="mt-2 flex items-center gap-1.5 sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Delete this photo"
                  disabled={!current}
                  onClick={handleDelete}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Add photos"
                  disabled={items.length >= MAX_POST_IMAGES}
                  onClick={() => addInputRef.current?.click()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <input
                ref={addInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                className="hidden"
                onChange={(e) => handleAdd(e.target.files)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="mr-1.5 h-4 w-4" /> Back
            </Button>
            <Button type="button" disabled={!done} onClick={() => onDone(items)}>
              Next
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {current && (
        <PostCropDialog
          open={cropOpen}
          src={current.src}
          onCancel={() => setCropOpen(false)}
          onApply={handleCropApply}
        />
      )}

      {current && (
        <PostTagSearchDialog
          open={tagSearchOpen}
          onOpenChange={setTagSearchOpen}
          excludeIds={current.tags.map((t) => t.profileId)}
          onPick={addTag}
        />
      )}
    </>
  );
};

export default PostImageEditor;
