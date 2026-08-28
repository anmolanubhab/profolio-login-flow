import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Smile, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { CommentAuthor } from '@/hooks/use-comments';
import { useMentionSearch } from '@/hooks/use-mention-search';
import {
  MENTION_TYPING_RE,
  normalizeMentionName,
  serializeEditedContent,
  type EditableMention,
} from '@/lib/commentMentions';

const MAX_LEN = 3000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE = 'image/png,image/jpeg,image/gif,image/webp';

// Small dependency-free emoji set (no emoji-picker lib is used in the app).
const QUICK_EMOJIS = [
  '😀', '😂', '🙂', '😍', '🤩', '😎', '🤔', '👀',
  '👍', '👏', '🙌', '🔥', '💯', '🎉', '❤️', '💡',
  '🚀', '✅', '🙏', '💪', '😅', '😢', '😮', '🤝',
];

export interface CommentComposerHandle {
  focus: () => void;
}

export interface CommentSubmitPayload {
  text: string;
  imageUrl: string | null;
}

interface CommentComposerProps {
  author: CommentAuthor | null;
  /** auth user id (not profile id) -- needed for the storage upload path */
  currentUserId?: string | null;
  onSubmit: (payload: CommentSubmitPayload) => Promise<boolean>;
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  compact?: boolean;
  /** editor-facing text (mentions already collapsed to `@Name`) */
  initialValue?: string;
  /** identities for the `@Name` spans already present in `initialValue` */
  initialMentions?: EditableMention[];
  /** hide the image button (edit mode) */
  allowImage?: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
}

const CommentComposer = forwardRef<CommentComposerHandle, CommentComposerProps>(
  (
    {
      author,
      currentUserId,
      onSubmit,
      placeholder = 'Add a comment…',
      submitLabel = 'Post',
      autoFocus = false,
      compact = false,
      initialValue = '',
      initialMentions,
      allowImage = true,
      onCancel,
      cancelLabel = 'Cancel',
    },
    ref,
  ) => {
    const { toast } = useToast();
    const [value, setValue] = useState(initialValue);
    const [submitting, setSubmitting] = useState(false);
    const [emojiOpen, setEmojiOpen] = useState(false);

    // Identities for `@Name` spans in the editor -- seeded from the parsed
    // comment (edit mode) and appended to as the user picks from autocomplete.
    // The uuid is never shown; it is re-attached on submit by
    // serializeEditedContent().
    const [mentions, setMentions] = useState<EditableMention[]>(initialMentions ?? []);

    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    // Mention autocomplete state. `anchor` is the index of the '@'.
    const [mention, setMention] = useState<{ anchor: number } | null>(null);
    const [activeIdx, setActiveIdx] = useState(0);
    const { setQuery: setMentionQuery, results: mentionResults, loading: mentionLoading } =
      useMentionSearch();

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [menuPos, setMenuPos] = useState<{ left: number; top: number; width: number } | null>(null);

    useImperativeHandle(ref, () => ({ focus: () => textareaRef.current?.focus() }));

    const resize = () => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    };

    useLayoutEffect(() => {
      resize();
      if (autoFocus) {
        const el = textareaRef.current;
        el?.focus();
        if (el && initialValue) el.setSelectionRange(initialValue.length, initialValue.length);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const closeMention = () => {
      setMention(null);
      setMentionQuery(null);
      setActiveIdx(0);
      setMenuPos(null);
    };

    const syncMenuPos = () => {
      const el = textareaRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setMenuPos({ left: r.left, top: r.bottom + 4, width: r.width });
    };

    const detectMention = (text: string, caret: number) => {
      const before = text.slice(0, caret);
      const m = before.match(MENTION_TYPING_RE);
      if (m) {
        const q = m[2] ?? '';
        setMention({ anchor: caret - q.length - 1 });
        setMentionQuery(q);
        setActiveIdx(0);
        syncMenuPos();
      } else if (mention) {
        closeMention();
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value.slice(0, MAX_LEN);
      setValue(next);
      resize();
      detectMention(next, e.target.selectionStart ?? next.length);
    };

    const applyMention = (r: { id: string; name: string }) => {
      if (!mention) return;
      const el = textareaRef.current;
      const caret = el?.selectionStart ?? value.length;
      // Insert the user-facing form "@Name " -- never the uuid. The identity is
      // recorded separately and re-attached on submit.
      const name = normalizeMentionName(r.name);
      const display = `@${name}`;
      const next = `${value.slice(0, mention.anchor)}${display} ${value.slice(caret)}`.slice(0, MAX_LEN);
      setValue(next);
      setMentions((prev) => [...prev, { name, profileId: r.id }]);
      closeMention();
      requestAnimationFrame(() => {
        el?.focus();
        const pos = mention.anchor + display.length + 1;
        el?.setSelectionRange(pos, pos);
        resize();
      });
    };

    const trimmed = value.trim();
    const canSubmit =
      (trimmed.length > 0 || !!imageFile) && trimmed.length <= MAX_LEN && !submitting && !uploading;

    const handleSubmit = async () => {
      if (!canSubmit) return;
      let imageUrl: string | null = null;

      if (imageFile) {
        if (!currentUserId) {
          toast({ title: 'Sign in required', description: 'Please sign in to attach an image.', variant: 'destructive' });
          return;
        }
        setUploading(true);
        try {
          const { secureUpload } = await import('@/lib/secure-upload');
          const res = await secureUpload({ bucket: 'post-images', file: imageFile, userId: currentUserId });
          if (!res.success || !res.url) throw new Error(res.error || 'Upload failed');
          imageUrl = res.url;
        } catch (err) {
          setUploading(false);
          toast({
            title: 'Image upload failed',
            description: err instanceof Error ? err.message : 'Please try again.',
            variant: 'destructive',
          });
          return;
        }
        setUploading(false);
      }

      // Re-attach mention identities: editor "@Anmol Anubhav" -> canonical
      // "@[Anmol Anubhav](uuid)". Deleted mentions fall away automatically.
      const serialized = serializeEditedContent(trimmed, mentions);
      if (serialized.length > MAX_LEN) {
        toast({
          title: 'Comment is too long',
          description: 'Please shorten it and try again.',
          variant: 'destructive',
        });
        return;
      }

      setSubmitting(true);
      const ok = await onSubmit({ text: serialized, imageUrl });
      setSubmitting(false);
      if (ok) {
        setValue('');
        setMentions([]);
        clearImage();
        closeMention();
        requestAnimationFrame(resize);
      }
    };

    const clearImage = () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImageFile(null);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFile = (file: File | undefined) => {
      if (!file) return;
      if (!ACCEPTED_IMAGE.split(',').includes(file.type)) {
        toast({ title: 'Unsupported file', description: 'Choose a PNG, JPEG, GIF or WebP image.', variant: 'destructive' });
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast({ title: 'Image too large', description: 'Maximum image size is 5 MB.', variant: 'destructive' });
        return;
      }
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    };

    const insertEmoji = (emoji: string) => {
      const el = textareaRef.current;
      const start = el?.selectionStart ?? value.length;
      const end = el?.selectionEnd ?? value.length;
      const next = (value.slice(0, start) + emoji + value.slice(end)).slice(0, MAX_LEN);
      setValue(next);
      setEmojiOpen(false);
      requestAnimationFrame(() => {
        el?.focus();
        const caret = start + emoji.length;
        el?.setSelectionRange(caret, caret);
        resize();
      });
    };

    const mentionOpen = !!mention && (mentionResults.length > 0 || mentionLoading);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (mentionOpen && mentionResults.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveIdx((i) => (i + 1) % mentionResults.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveIdx((i) => (i - 1 + mentionResults.length) % mentionResults.length);
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          applyMention(mentionResults[activeIdx]);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          closeMention();
          return;
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === 'Escape' && onCancel && !mentionOpen) {
        e.preventDefault();
        onCancel();
      }
    };

    return (
      <div className="flex items-start gap-2 w-full">
        <Avatar className={compact ? 'h-7 w-7 shrink-0' : 'h-8 w-8 shrink-0'}>
          <AvatarImage src={author?.avatar || undefined} className="object-cover" />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {(author?.name?.[0] || 'U').toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0 rounded-2xl border border-border bg-background focus-within:border-primary/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onScroll={syncMenuPos}
            onBlur={() => setTimeout(closeMention, 120)}
            rows={1}
            aria-label={placeholder}
            placeholder={placeholder}
            disabled={submitting}
            className={cn(
              'w-full resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground min-h-[38px]',
            )}
          />

          {imagePreview && (
            <div className="px-3 pb-2">
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="Attachment preview"
                  className="max-h-40 max-w-full rounded-lg border border-border object-contain"
                />
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60">
                    <Loader2 className="h-5 w-5 animate-spin text-foreground" />
                  </div>
                )}
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={clearImage}
                  disabled={uploading}
                  className="absolute -right-2 -top-2 rounded-full bg-foreground text-background p-1 shadow disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-2 pb-2 pt-0.5">
            <div className="flex items-center">
              <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Add emoji"
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[248px] p-2">
                  <div className="grid grid-cols-8 gap-1">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="rounded p-1 text-lg hover:bg-secondary transition-colors"
                        onClick={() => insertEmoji(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {allowImage && (
                <>
                  <button
                    type="button"
                    aria-label="Add a photo or GIF"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_IMAGE}
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                  />
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {onCancel && (
                <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={submitting || uploading}>
                  {cancelLabel}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                className="rounded-full"
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
                {submitting || uploading ? (
                  <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                ) : (
                  submitLabel
                )}
              </Button>
            </div>
          </div>
        </div>

        {mentionOpen && menuPos &&
          createPortal(
            <>
              <div className="fixed inset-0 z-[59]" onMouseDown={closeMention} />
              <div
                role="listbox"
                className="fixed z-[60] max-h-56 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg py-1"
                style={{ left: menuPos.left, top: menuPos.top, width: Math.max(menuPos.width, 220) }}
              >
                {mentionLoading && mentionResults.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>
                ) : mentionResults.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No people found</div>
                ) : (
                  mentionResults.map((r, i) => (
                    <button
                      key={r.id}
                      type="button"
                      role="option"
                      aria-selected={i === activeIdx}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyMention(r);
                      }}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-left',
                        i === activeIdx ? 'bg-secondary' : 'hover:bg-secondary/60',
                      )}
                    >
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarImage src={r.avatar || undefined} className="object-cover" />
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                          {(r.name[0] || 'U').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.name}</span>
                        {r.subtitle && (
                          <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>
                        )}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </>,
            document.body,
          )}
      </div>
    );
  },
);

CommentComposer.displayName = 'CommentComposer';

export default CommentComposer;
