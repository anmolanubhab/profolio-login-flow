import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AD_IMAGE_MIME,
  uploadCreativeImage,
  validateCreativeImageFile,
} from '@/lib/ads/api';

/**
 * Picks an image, validates type/size client-side, uploads it to the
 * `ad-creatives` bucket under the ad account, and hands back the public URL.
 * The storage RLS policy is the real gate — this only pre-checks.
 */
export function CreativeImageUpload({
  adAccountId,
  value,
  onChange,
  error,
}: {
  adAccountId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  error?: string | null;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const invalid = validateCreativeImageFile(file);
    if (invalid) {
      toast({ title: 'Can’t use that image', description: invalid, variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadCreativeImage(adAccountId, file);
      onChange(url);
    } catch (e) {
      toast({
        title: 'Upload failed',
        description:
          e instanceof Error
            ? /row-level security|not authorized|policy/i.test(e.message)
              ? 'You’re not authorized to upload creatives for this ad account.'
              : e.message
            : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>Image</Label>
      <input
        ref={inputRef}
        type="file"
        accept={AD_IMAGE_MIME.join(',')}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {value ? (
        <div className="relative w-full max-w-sm overflow-hidden rounded-md border">
          <img src={value} alt="" className="aspect-[1.91/1] w-full object-cover" />
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute right-2 top-2 h-7 w-7"
            onClick={() => onChange(null)}
            aria-label="Remove image"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full max-w-sm flex-col items-center justify-center gap-1 rounded-md border border-dashed px-4 py-8 text-sm text-muted-foreground transition-colors hover:bg-muted/50 disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <ImageIcon className="h-6 w-6" />
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Upload className="h-3.5 w-3.5" /> Upload an image
              </span>
              <span className="text-xs">JPG, PNG or WebP · up to 5 MB · 1200×628 recommended</span>
            </>
          )}
        </button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
