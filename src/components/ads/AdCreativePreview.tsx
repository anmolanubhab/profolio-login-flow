import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdFormat } from '@/lib/ads/api';

export interface AdPreviewData {
  format: AdFormat;
  headline: string;
  body: string | null;
  ctaLabel: string | null;
  mediaUrl: string | null;
  companyName: string;
}

/**
 * Renders the ad roughly as it will appear in a right-rail placement — the
 * only placement Phase F/G target. Text formats drop the image; spotlight and
 * single_image show it. This is what "preview" means for the advertiser.
 */
export function AdCreativePreview({
  data,
  className,
}: {
  data: AdPreviewData;
  className?: string;
}) {
  const { format, headline, body, ctaLabel, mediaUrl, companyName } = data;
  const showImage = format !== 'text';

  return (
    <div className={cn('w-full max-w-[320px]', className)}>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Preview · Right rail
      </p>
      <div className="overflow-hidden rounded-lg border bg-card shadow-card">
        <div className="flex items-center justify-between px-3 pt-2.5 text-[11px] text-muted-foreground">
          <span className="truncate font-medium text-foreground/80">{companyName || 'Your company'}</span>
          <span>Promoted</span>
        </div>

        {showImage &&
          (mediaUrl ? (
            <img
              src={mediaUrl}
              alt=""
              className="mt-2 aspect-[1.91/1] w-full object-cover"
            />
          ) : (
            <div className="mt-2 flex aspect-[1.91/1] w-full items-center justify-center bg-muted text-muted-foreground">
              <ImageIcon className="h-6 w-6" />
            </div>
          ))}

        <div className="space-y-1.5 p-3">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {headline || 'Your headline goes here'}
          </p>
          {body && <p className="line-clamp-3 text-xs text-muted-foreground">{body}</p>}
          {ctaLabel && (
            <button
              type="button"
              tabIndex={-1}
              className="pointer-events-none mt-1 rounded-full border border-primary px-3 py-1 text-xs font-semibold text-primary"
            >
              {ctaLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
