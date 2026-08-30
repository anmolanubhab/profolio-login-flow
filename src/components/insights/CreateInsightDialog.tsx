import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
} from '@/components/ui/responsive-modal';
import { createInsight, updateInsightMeta, uploadInsightImage } from '@/lib/insights/api';
import type { Insight } from '@/lib/insights/types';

const TITLE_MAX = 120;
const DESC_MAX = 400;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** present => edit mode */
  insight?: Insight | null;
  onCreated?: (insight: Insight) => void;
  onUpdated?: (patch: { title: string; description: string | null; cover_url: string | null }) => void;
}

export default function CreateInsightDialog({
  open,
  onOpenChange,
  insight,
  onCreated,
  onUpdated,
}: Props) {
  const editing = !!insight;
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(insight?.title ?? '');
      setDescription(insight?.description ?? '');
      setCoverUrl(insight?.cover_url ?? null);
      setError(null);
      setSaving(false);
      setUploading(false);
    }
  }, [open, insight]);

  const trimmedTitle = title.trim();
  const titleInvalid = trimmedTitle.length === 0 || trimmedTitle.length > TITLE_MAX;
  const descInvalid = description.length > DESC_MAX;
  const canSubmit = !titleInvalid && !descInvalid && !saving && !uploading;

  const pickCover = () => fileRef.current?.click();

  const onCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadInsightImage(file, 'cover');
      setCoverUrl(url);
    } catch (err: any) {
      setError(err?.message ?? 'Could not upload the cover image.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      if (editing && insight) {
        await updateInsightMeta(insight.id, {
          title: trimmedTitle,
          description: description.trim() || null,
          cover_url: coverUrl,
        });
        onUpdated?.({ title: trimmedTitle, description: description.trim() || null, cover_url: coverUrl });
        toast({ title: 'Insight updated' });
      } else {
        const created = await createInsight({
          title: trimmedTitle,
          description: description.trim() || null,
          cover_url: coverUrl,
        });
        onCreated?.(created);
        toast({ title: 'Insight created', description: 'Now write your first article.' });
      }
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message ?? 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <ResponsiveModalContent className="sm:max-w-lg">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>{editing ? 'Edit Insight' : 'Create an Insight'}</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            An Insight is your publication. Give it a name and a short description, then publish
            articles your followers get notified about.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="space-y-4 py-1">
          {/* cover */}
          <div>
            <Label className="mb-1.5 block text-sm">Cover image</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={onCoverChange}
            />
            {coverUrl ? (
              <div className="relative overflow-hidden rounded-lg border border-border">
                <img src={coverUrl} alt="Cover preview" className="aspect-[16/9] w-full object-cover" />
                <div className="absolute right-2 top-2 flex gap-1.5">
                  <Button type="button" size="sm" variant="secondary" onClick={pickCover} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Replace'}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8"
                    aria-label="Remove cover image"
                    onClick={() => setCoverUrl(null)}
                    disabled={uploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={pickCover}
                disabled={uploading}
                className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/40 text-sm text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-60"
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="h-6 w-6" />
                    Add a cover image
                  </>
                )}
              </button>
            )}
          </div>

          {/* title */}
          <div>
            <Label htmlFor="insight-title" className="mb-1.5 block text-sm">
              Insight name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="insight-title"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX + 20))}
              placeholder="e.g. The Weekly Build"
              maxLength={TITLE_MAX + 20}
              aria-invalid={titleInvalid && title.length > 0}
              autoFocus
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span className={titleInvalid && title.length > 0 ? 'text-destructive' : ''}>
                {trimmedTitle.length === 0
                  ? 'Required'
                  : trimmedTitle.length > TITLE_MAX
                    ? `Too long by ${trimmedTitle.length - TITLE_MAX}`
                    : ' '}
              </span>
              <span>{trimmedTitle.length}/{TITLE_MAX}</span>
            </div>
          </div>

          {/* description */}
          <div>
            <Label htmlFor="insight-desc" className="mb-1.5 block text-sm">
              Description
            </Label>
            <Textarea
              id="insight-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX + 40))}
              placeholder="What is this Insight about? Who is it for?"
              rows={3}
              aria-invalid={descInvalid}
            />
            <div className="mt-1 flex justify-end text-[11px] text-muted-foreground">
              <span className={descInvalid ? 'text-destructive' : ''}>
                {description.length}/{DESC_MAX}
              </span>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <ResponsiveModalFooter className="gap-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {editing ? 'Save changes' : 'Create Insight'}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
