import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageOff, Loader2, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMessageAttachmentUrl } from '@/lib/message-attachment-url';

interface MessageImageProps {
  messageId: string;
  alt: string;
  isOwn: boolean;
  /** Opens the full-screen viewer with the resolved signed URL. */
  onZoom: (url: string) => void;
}

// The signed URL lasts 300 s; re-resolve a little before that if the bubble is
// still mounted (long-lived conversation, image scrolled off then back).
const REFRESH_AFTER_MS = 4.5 * 60 * 1000;

/**
 * Inline image bubble. Resolves the private attachment to a signed URL on mount
 * (and again once it is about to expire), renders a skeleton while pending and
 * a compact retry state on failure. Purely presentational -- no Supabase writes.
 */
export function MessageImage({ messageId, alt, isOwn, onZoom }: MessageImageProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const fetchedAt = useRef(0);
  const reqId = useRef(0);

  const resolve = useCallback(async () => {
    const mine = ++reqId.current;
    setState((s) => (s === 'ready' ? s : 'loading'));
    const signed = await getMessageAttachmentUrl(messageId);
    if (mine !== reqId.current) return; // superseded
    if (signed) {
      fetchedAt.current = Date.now();
      setUrl(signed);
      setState('ready');
    } else {
      setState('error');
    }
  }, [messageId]);

  useEffect(() => {
    resolve();
  }, [resolve]);

  const ensureFresh = useCallback(() => {
    if (Date.now() - fetchedAt.current > REFRESH_AFTER_MS) resolve();
  }, [resolve]);

  if (state === 'error') {
    return (
      <button
        type="button"
        onClick={resolve}
        className={cn(
          'flex h-40 w-56 max-w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed text-xs',
          isOwn ? 'border-primary-foreground/40 text-primary-foreground/80' : 'border-border text-muted-foreground',
        )}
      >
        <ImageOff className="h-5 w-5" />
        Couldn&apos;t load image
        <span className="flex items-center gap-1 font-medium">
          <RotateCw className="h-3 w-3" /> Retry
        </span>
      </button>
    );
  }

  if (state === 'loading' || !url) {
    return (
      <div className="flex h-56 w-56 max-w-full items-center justify-center rounded-2xl bg-muted">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onMouseEnter={ensureFresh}
      onClick={() => {
        ensureFresh();
        onZoom(url);
      }}
      onError={() => setState('error')}
      className="max-h-80 max-w-full cursor-zoom-in rounded-2xl object-cover"
    />
  );
}
