import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, AlertCircle, RefreshCw, Megaphone, ChevronRight, ImageIcon } from 'lucide-react';
import { AdReviewStatusBadge } from '@/components/ads/AdReviewStatusBadge';
import {
  adFormatMeta,
  listAdsForCampaign,
  listCreativesForAds,
  type Ad,
  type AdCreative,
} from '@/lib/ads/api';

export function CampaignAdsCard({
  campaignId,
  disabled,
}: {
  campaignId: string;
  disabled?: boolean;
}) {
  const navigate = useNavigate();
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [creatives, setCreatives] = useState<Record<string, AdCreative>>({});
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    listAdsForCampaign(campaignId)
      .then(async (rows) => {
        setAds(rows);
        setCreatives(await listCreativesForAds(rows.map((a) => a.id)));
      })
      .catch((e) => {
        setAds([]);
        setError(e instanceof Error ? e.message : 'Failed to load ads.');
      });
  };

  useEffect(load, [campaignId]);

  const loading = ads === null;

  return (
    <Card className="bg-card shadow-card border-0">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-[15px] font-bold">Ads</CardTitle>
        {!loading && !error && ads.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => navigate(`/ads/campaigns/${campaignId}/ads/new`)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <span className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </span>
            <Button size="sm" variant="outline" onClick={load}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && ads.length === 0 && (
          <div className="rounded-md border border-dashed px-4 py-8 text-center">
            <Megaphone className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No ads yet</p>
            <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
              An ad carries the creative people see — image, headline, text and a link. It starts as
              a draft.
            </p>
            <Button
              className="mt-4"
              size="sm"
              disabled={disabled}
              onClick={() => navigate(`/ads/campaigns/${campaignId}/ads/new`)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create ad
            </Button>
          </div>
        )}

        {!loading && !error && ads.length > 0 && (
          <ul className="divide-y divide-border/60">
            {ads.map((a) => {
              const c = creatives[a.id];
              return (
                <li key={a.id}>
                  <button
                    onClick={() => navigate(`/ads/ads/${a.id}`)}
                    className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/40"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                      {c?.media_url ? (
                        <img src={c.media_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{a.name}</span>
                        <AdReviewStatusBadge status={a.review_status} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {adFormatMeta(c?.format ?? 'single_image').label}
                        {c?.headline ? ` · ${c.headline}` : ''}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
