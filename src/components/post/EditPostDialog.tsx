import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, BarChart3, ImagePlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { sanitizeTextContent, unescapeHtml } from '@/lib/input-sanitizer';
import PostComposerEditor from '@/components/post/PostComposerEditor';
import PostImageEditor from '@/components/post/PostImageEditor';
import { draftFromMedia, uploadDraftImages, type DraftImage } from '@/lib/posts/mediaDrafts';
import { normalizePostMedia, mediaToJson, type PostMediaItem } from '@/lib/posts/media';
import { loadPostMediaTags, reconcilePostMediaTags } from '@/lib/posts/mediaTags';
import { pruneOrphanMedia, postImagePath } from '@/lib/posts/mediaCleanup';
import {
  createEmptyDoc,
  docFromPlainText,
  docToJson,
  docToPlainText,
  isDocEmpty,
  isRichDoc,
  MAX_POST_CHARS,
  type RichDoc,
} from '@/lib/posts/richText';

interface EditPostDialogProps {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful save with the new mirror text + rich doc (and,
   *  when photos changed, the new media list) so the card updates in place. */
  onSaved?: (content: string, contentRich: RichDoc | null, media?: PostMediaItem[]) => void;
}

interface PollInfo {
  question: string;
  options: string[];
}

/**
 * Author-only "Edit post" flow. Reuses PostComposerEditor with the exact same
 * rich-text config as the composer. Loads posts.content_rich (or falls back to
 * posts.content for legacy plain-text posts), updates the SAME row on save so
 * the id and created_at are untouched, and lets the existing
 * sync_post_entities() trigger re-derive hashtags / mentions / notifications.
 *
 * Poll posts are shown in a read-only state: matching LinkedIn, a published
 * poll's question, options and duration can't be changed (votes may already
 * exist). The author can still delete the post from the menu.
 * Non-poll media (image / carousel / video / document) is preserved — only the
 * body text is editable here.
 */
const EditPostDialog = ({ postId, open, onOpenChange, onSaved }: EditPostDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doc, setDoc] = useState<RichDoc>(createEmptyDoc);
  const [plainText, setPlainText] = useState('');
  const [hasOtherMedia, setHasOtherMedia] = useState(false); // video / document
  const [poll, setPoll] = useState<PollInfo | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Photos (image / carousel posts).
  const [photoDrafts, setPhotoDrafts] = useState<DraftImage[]>([]);
  const [photoEditorOpen, setPhotoEditorOpen] = useState(false);
  const [photosDirty, setPhotosDirty] = useState(false);
  const origPhotoUrls = useRef<string[]>([]);
  const isImagePost = photoDrafts.length > 0 || origPhotoUrls.current.length > 0;
  const hasMedia = hasOtherMedia || isImagePost;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    setPoll(null);
    setPhotoDrafts([]);
    setPhotosDirty(false);
    origPhotoUrls.current = [];
    (async () => {
      const { data, error } = await supabase
        .from('posts')
        .select(
          `content, content_rich, image_url, video_url, document_url, carousel_urls, media, post_type,
           polls ( question, poll_options ( option_text, position ) )`,
        )
        .eq('id', postId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setLoadError(true);
        setLoading(false);
        return;
      }

      if (data.post_type === 'poll') {
        const p = Array.isArray(data.polls) ? data.polls[0] : data.polls;
        setPoll({
          question: p?.question ?? unescapeHtml(data.content ?? ''),
          options: [...(p?.poll_options ?? [])]
            .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
            .map((o: { option_text: string }) => o.option_text),
        });
        setLoading(false);
        return;
      }

      const initial: RichDoc = isRichDoc(data.content_rich)
        ? (data.content_rich as RichDoc)
        : docFromPlainText(unescapeHtml(data.content ?? ''));
      setDoc(initial);
      setPlainText(docToPlainText(initial));
      setHasOtherMedia(!!data.video_url || !!data.document_url);

      // Seed photos from posts.media, falling back to the legacy fields.
      let items: PostMediaItem[] = normalizePostMedia(data.media);
      if (items.length === 0) {
        const legacy = Array.isArray(data.carousel_urls) && data.carousel_urls.length > 0
          ? (data.carousel_urls as string[])
          : data.image_url
            ? [data.image_url as string]
            : [];
        items = legacy.map((url) => ({ url, alt: '' }));
      }
      origPhotoUrls.current = items.map((i) => i.url);
      const drafts = items.map(draftFromMedia);

      // Merge in existing photo tags, keyed by the stable media id.
      const tagsByKey = await loadPostMediaTags(postId);
      if (cancelled) return;
      for (const d of drafts) {
        d.tags = tagsByKey[d.mediaKey] ? [...tagsByKey[d.mediaKey]] : [];
      }
      setPhotoDrafts(drafts);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, postId]);

  const overLimit = plainText.length > MAX_POST_CHARS;
  const empty = isDocEmpty(doc) && !hasMedia;

  const handleSave = async () => {
    if (saving || overLimit || empty || poll) return;
    if (isImagePost && photoDrafts.length === 0) {
      toast({ title: 'Keep at least one photo', description: 'A photo post needs at least one image, or delete the post instead.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const sanitized = sanitizeTextContent(plainText);
      const rich = isDocEmpty(doc) ? null : doc;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch: Record<string, any> = { content: sanitized, content_rich: docToJson(rich) };
      let savedMedia: PostMediaItem[] | undefined;

      if (photosDirty && isImagePost) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('You must be signed in.');
        const media = await uploadDraftImages(photoDrafts, user.id);
        savedMedia = media;
        patch.media = mediaToJson(media);
        patch.image_url = media[0]?.url ?? null;
        patch.carousel_urls = media.length > 1 ? media.map((m) => m.url) : null;
        patch.post_type = media.length > 1 ? 'carousel' : 'text';
      }

      // .select() so RLS filtering is observable: a non-author gets 0 rows
      // back (and no error), which we surface rather than silently "succeed".
      const { data, error } = await supabase
        .from('posts')
        .update(patch)
        .eq('id', postId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('You are not authorized to edit this post.');
      }

      // Reconcile photo tags (add new / move / remove) against the saved
      // images. media_key === posts.media[i].id, so tags stay attached to the
      // right image across crop / reorder / delete. New tags fire one
      // photo_tag notification via the DB trigger; unchanged tags never
      // re-notify (unique constraint).
      if (isImagePost) {
        const res = await reconcilePostMediaTags(
          postId,
          photoDrafts.map((d) => ({ mediaKey: d.mediaKey, tags: d.tags })),
        );
        if (res.failed > 0) {
          toast({
            title: `${res.failed} tag${res.failed > 1 ? 's' : ''} couldn't be added`,
            description: "That person isn't discoverable or has blocked you.",
          });
        }
      }

      // Server-side cleanup of images that are no longer referenced by any post
      // (the post row was already updated above). Best-effort: never blocks the
      // save; the periodic sweep retries anything missed.
      if (savedMedia) {
        const kept = new Set(savedMedia.map((m) => m.url));
        const orphanPaths = origPhotoUrls.current
          .filter((u) => !kept.has(u))
          .map(postImagePath)
          .filter((p): p is string => !!p);
        if (orphanPaths.length) void pruneOrphanMedia(orphanPaths);
      }

      toast({ title: 'Post updated' });
      onSaved?.(sanitized, rich, savedMedia);
      onOpenChange(false);
    } catch (err) {
      console.error('Error updating post:', err);
      toast({
        title: 'Failed to update post',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{poll ? 'Poll post' : 'Edit post'}</DialogTitle>
          <DialogDescription>
            {poll
              ? "A poll's question and options can't be changed after it's published. To make changes, delete this post and create a new poll."
              : hasOtherMedia
                ? 'Editing the text of your post. The attached video / document stays as it is.'
                : isImagePost
                  ? 'Edit the caption, or open the photo editor to crop, reorder, add ALT text, or add / remove photos.'
                  : 'Update the text and formatting of your post.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : loadError ? (
          <p className="py-6 text-sm text-muted-foreground">
            Couldn’t load this post. Please close and try again.
          </p>
        ) : poll ? (
          <div className="space-y-3 py-1">
            <div className="flex items-start gap-2">
              <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-sm font-medium break-words">{poll.question}</p>
            </div>
            <ul className="space-y-1.5">
              {poll.options.map((opt, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground break-words"
                >
                  {opt}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div className="rounded-md border border-input bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-ring">
              <PostComposerEditor
                value={doc}
                onChange={(nextDoc, text) => {
                  setDoc(nextDoc);
                  setPlainText(text);
                }}
                placeholder="What do you want to talk about?"
                disabled={saving}
                minHeight="8rem"
              />
            </div>
            {overLimit && (
              <p className="text-xs text-destructive">
                {plainText.length.toLocaleString()} / {MAX_POST_CHARS.toLocaleString()} characters — please shorten your post.
              </p>
            )}

            {isImagePost && (
              <div className="flex items-center gap-2 overflow-x-auto rounded-lg border border-border p-2">
                {photoDrafts.map((d) => (
                  <img
                    key={d.key}
                    src={d.src}
                    alt={d.alt || 'Photo'}
                    className="h-16 w-16 shrink-0 rounded object-cover"
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ml-1 shrink-0"
                  disabled={saving}
                  onClick={() => setPhotoEditorOpen(true)}
                >
                  <ImagePlus className="mr-1.5 h-4 w-4" /> Edit photos
                </Button>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          {poll ? (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || loading || loadError || overLimit || empty}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

      <PostImageEditor
        open={photoEditorOpen}
        initial={photoDrafts}
        onCancel={() => setPhotoEditorOpen(false)}
        onDone={(items) => {
          setPhotoDrafts(items);
          setPhotosDirty(true);
          setPhotoEditorOpen(false);
        }}
      />
    </Dialog>
  );
};

export default EditPostDialog;
