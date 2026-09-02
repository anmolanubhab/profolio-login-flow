import { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { recordAdClick, recordAdImpression, type SponsoredAd } from '@/lib/ads/delivery';

/**
 * A single sponsored card rendered inside the organic feed. Same `.post-card`
 * box as every other feed item so rhythm and edge-to-edge behaviour are
 * unchanged. Clearly labelled "Sponsored". Records one impression on mount
 * and a click when the viewer follows the ad.
 */
export function SponsoredFeedCard({ ad }: { ad: SponsoredAd }) {
  const impressed = useRef(false);
  const [pending, setPending] = useState(false);
  const showImage = ad.format !== 'text' && !!ad.media_url;

  useEffect(() => {
    if (impressed.current) return;
    impressed.current = true;
    recordAdImpression(ad.ad_id).catch(() => {
      /* non-fatal — delivery still rendered */
    });
  }, [ad.ad_id]);

  const openDestination = async () => {
    if (pending) return;
    setPending(true);
    try {
      await recordAdClick(ad.ad_id).catch(() => {});
    } finally {
      setPending(false);
    }
    window.open(ad.destination_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="post-card">
      <div className="px-4 pt-4 sm:px-5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{ad.sponsor_name}</span>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Sponsored
          </span>
        </div>
      </div>

      {ad.body && (
        <p className="whitespace-pre-wrap px-4 pt-2 text-sm text-foreground sm:px-5">{ad.body}</p>
      )}

      {showImage && (
        <button
          type="button"
          onClick={openDestination}
          className="mt-3 block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${ad.headline} — opens ${ad.sponsor_name} in a new tab`}
        >
          <img
            src={ad.media_url as string}
            alt=""
            className="aspect-[1.91/1] w-full object-cover"
          />
        </button>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug text-foreground">{ad.headline}</p>
          <p className="truncate text-xs text-muted-foreground">
            {(() => {
              try {
                return new URL(ad.destination_url).hostname.replace(/^www\./, '');
              } catch {
                return ad.destination_url;
              }
            })()}
          </p>
        </div>
        <button
          type="button"
          onClick={openDestination}
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary px-3.5 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
        >
          {ad.cta_label || 'Learn more'}
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
