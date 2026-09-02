import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, AlertCircle, RefreshCw, ShieldCheck, ImageIcon, ChevronRight, ClipboardCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useIsAdReviewer } from '@/hooks/useIsAdReviewer';
import { adFormatMeta, listPendingAdReviews, type PendingAdReviewItem } from '@/lib/ads/api';

function fmtDateTime(d: string) {
  try {
    return new Date(d).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function AdReviewQueuePage() {
  const navigate = useNavigate();
  const { data: isReviewer, isLoading: reviewerLoading } = useIsAdReviewer();

  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<PendingAdReviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    listPendingAdReviews()
      .then(setItems)
      .catch((e) => {
        setItems([]);
        setError(e instanceof Error ? e.message : 'Failed to load the review queue.');
      });
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return navigate('/');
      setUser(user);
    });
  }, [navigate]);

  useEffect(() => {
    if (isReviewer) load();
  }, [isReviewer, load]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const loading = reviewerLoading || (isReviewer && items === null);

  return (
    <Layout user={user} onSignOut={handleSignOut} fullWidth>
      <div className="mx-auto w-full max-w-[820px] px-3 py-4 sm:px-4 sm:py-6">
        <div className="mb-4 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => navigate('/ads')}
            aria-label="Back to Advertising"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Ad review queue
          </h1>
        </div>

        {reviewerLoading && <Skeleton className="h-40 w-full rounded-lg" />}

        {!reviewerLoading && !isReviewer && (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <ShieldCheck className="mb-3 h-8 w-8 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Reviewers only</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                This queue is for Profolio ad reviewers. You don’t have reviewer access.
              </p>
              <Button className="mt-5" variant="outline" onClick={() => navigate('/ads')}>
                Back to Advertising
              </Button>
            </CardContent>
          </Card>
        )}

        {isReviewer && (
          <>
            {loading && (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-[76px] w-full rounded-lg" />
                ))}
              </div>
            )}

            {!loading && error && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-start gap-2 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={load}>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    Retry
                  </Button>
                </CardContent>
              </Card>
            )}

            {!loading && !error && items && items.length === 0 && (
              <Card className="border-2 border-dashed">
                <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
                  <ClipboardCheck className="mb-3 h-8 w-8 text-muted-foreground" />
                  <h2 className="text-base font-semibold text-foreground">Nothing to review</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ads submitted for review will show up here.
                  </p>
                </CardContent>
              </Card>
            )}

            {!loading && !error && items && items.length > 0 && (
              <>
                <p className="mb-2 text-xs text-muted-foreground">
                  {items.length} ad{items.length === 1 ? '' : 's'} waiting
                </p>
                <ul className="space-y-3">
                  {items.map(({ ad, creative, campaignName, adAccountName, companyName, submittedAt }) => (
                    <li key={ad.id}>
                      <button
                        onClick={() => navigate(`/ads/review/${ad.id}`)}
                        className="flex w-full items-center gap-4 rounded-lg border bg-card p-3 text-left shadow-card transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                          {creative?.media_url ? (
                            <img src={creative.media_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {creative?.headline || ad.name}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {companyName} · {adAccountName} · {campaignName}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {adFormatMeta(creative?.format ?? 'single_image').label} · submitted{' '}
                            {fmtDateTime(submittedAt)}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
