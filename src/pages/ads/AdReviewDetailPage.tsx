import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ChevronLeft,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Loader2,
  ExternalLink,
  Check,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsAdReviewer } from '@/hooks/useIsAdReviewer';
import { AdReviewStatusBadge } from '@/components/ads/AdReviewStatusBadge';
import { AdCreativePreview } from '@/components/ads/AdCreativePreview';
import { RejectAdDialog } from '@/components/ads/RejectAdDialog';
import {
  adFormatMeta,
  approveAd,
  getAdContext,
  listAdReviews,
  rejectAd,
  type AdContext,
  type AdReview,
} from '@/lib/ads/api';

function fmtDateTime(d: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function AdReviewDetailPage() {
  const { adId } = useParams<{ adId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: isReviewer, isLoading: reviewerLoading } = useIsAdReviewer();

  const [user, setUser] = useState<User | null>(null);
  const [ctx, setCtx] = useState<AdContext | null>(null);
  const [company, setCompany] = useState('—');
  const [reviews, setReviews] = useState<AdReview[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!adId) return;
    setState('loading');
    setErrorMsg(null);
    try {
      const c = await getAdContext(adId);
      if (!c) return setState('notfound');
      setCtx(c);
      const [{ data: co }, revs] = await Promise.all([
        supabase.from('companies').select('name').eq('id', c.adAccount.company_id).maybeSingle(),
        listAdReviews(adId),
      ]);
      setCompany(co?.name ?? c.adAccount.name);
      setReviews(revs);
      setState('ready');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load this ad.');
      setState('error');
    }
  }, [adId]);

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

  const doApprove = async () => {
    if (!ctx) return;
    setActing(true);
    try {
      const updated = await approveAd(ctx.ad.id);
      setCtx({ ...ctx, ad: updated });
      setReviews(await listAdReviews(ctx.ad.id));
      toast({ title: 'Ad approved' });
      setApproveOpen(false);
    } catch (e) {
      toast({
        title: 'Could not approve',
        description: e instanceof Error ? e.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setActing(false);
    }
  };

  const doReject = async (reason: string) => {
    if (!ctx) return;
    setActing(true);
    try {
      const updated = await rejectAd(ctx.ad.id, reason);
      setCtx({ ...ctx, ad: updated });
      setReviews(await listAdReviews(ctx.ad.id));
      toast({ title: 'Ad rejected', description: 'The advertiser can see your reason.' });
      setRejectOpen(false);
    } catch (e) {
      toast({
        title: 'Could not reject',
        description: e instanceof Error ? e.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setActing(false);
    }
  };

  const cr = ctx?.creative ?? null;
  const isPending = ctx?.ad.review_status === 'pending';

  return (
    <Layout user={user} onSignOut={handleSignOut} fullWidth>
      <div className="mx-auto w-full max-w-[900px] px-3 py-4 sm:px-4 sm:py-6">
        <div className="mb-4 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => navigate('/ads/review')}
            aria-label="Back to review queue"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-foreground">
            {state === 'ready' && ctx ? ctx.ad.name : 'Review ad'}
          </h1>
          {state === 'ready' && ctx && <AdReviewStatusBadge status={ctx.ad.review_status} />}
        </div>

        {reviewerLoading && <Skeleton className="h-48 w-full rounded-lg" />}

        {!reviewerLoading && !isReviewer && (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <ShieldCheck className="mb-3 h-8 w-8 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Reviewers only</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                You don’t have reviewer access.
              </p>
              <Button className="mt-5" variant="outline" onClick={() => navigate('/ads')}>
                Back to Advertising
              </Button>
            </CardContent>
          </Card>
        )}

        {isReviewer && state === 'loading' && (
          <div className="space-y-4">
            <Skeleton className="h-64 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        )}

        {isReviewer && state === 'notfound' && (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <AlertCircle className="mb-3 h-8 w-8 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Ad not found</h2>
              <Button className="mt-5" variant="outline" onClick={() => navigate('/ads/review')}>
                Back to the queue
              </Button>
            </CardContent>
          </Card>
        )}

        {isReviewer && state === 'error' && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <Button variant="outline" size="sm" onClick={load}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {isReviewer && state === 'ready' && ctx && (
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
            <div className="space-y-4">
              {!isPending && (
                <Card className="border-0 bg-muted/40 shadow-none">
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    This ad is <span className="font-medium text-foreground">{ctx.ad.review_status}</span>{' '}
                    — no action needed. It’s here for reference.
                  </CardContent>
                </Card>
              )}

              <Card className="bg-card shadow-card border-0 overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[15px] font-bold">Ad &amp; creative</CardTitle>
                </CardHeader>
                <CardContent className="p-0 divide-y divide-border/60">
                  <Row label="Ad name" value={ctx.ad.name} />
                  <Row label="Format" value={adFormatMeta(cr?.format ?? 'single_image').label} />
                  <Row label="Headline" value={cr?.headline ?? '—'} />
                  <Row label="Description" value={cr?.body ?? '—'} />
                  <Row label="Call to action" value={cr?.cta_label ?? 'No button'} />
                  <Row
                    label="Destination URL"
                    right={
                      cr?.destination_url ? (
                        <a
                          href={cr.destination_url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="inline-flex items-center gap-1 break-all text-right text-sm text-primary hover:underline"
                        >
                          {cr.destination_url}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )
                    }
                  />
                </CardContent>
              </Card>

              <Card className="bg-card shadow-card border-0 overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[15px] font-bold">Advertiser context</CardTitle>
                </CardHeader>
                <CardContent className="p-0 divide-y divide-border/60">
                  <Row label="Company" value={company} />
                  <Row label="Ad account" value={`${ctx.adAccount.name} · ${ctx.adAccount.currency}`} />
                  <Row label="Campaign" value={`${ctx.campaign.name} · ${ctx.campaign.objective.replace(/_/g, ' ')}`} />
                  <Row label="Submitted" value={fmtDateTime(ctx.ad.updated_at)} />
                </CardContent>
              </Card>

              {reviews.length > 0 && (
                <Card className="bg-card shadow-card border-0 overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[15px] font-bold">Review history</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 divide-y divide-border/60">
                    {reviews.map((r) => (
                      <div key={r.id} className="px-4 py-3 sm:px-5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium capitalize text-foreground">
                            {r.decision}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {fmtDateTime(r.created_at)}
                          </span>
                        </div>
                        {r.reason && (
                          <p className="mt-1 text-sm text-muted-foreground">{r.reason}</p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {isPending && (
                <Card className="bg-card shadow-card border-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[15px] font-bold">Decision</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Button onClick={() => setApproveOpen(true)}>
                      <Check className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setRejectOpen(true)}
                    >
                      Reject
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="lg:sticky lg:top-4">
              <AdCreativePreview
                data={{
                  format: cr?.format ?? 'single_image',
                  headline: cr?.headline ?? '',
                  body: cr?.body ?? null,
                  ctaLabel: cr?.cta_label ?? null,
                  mediaUrl: cr?.media_url ?? null,
                  companyName: company,
                }}
              />
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={approveOpen} onOpenChange={(o) => !acting && setApproveOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this ad?</AlertDialogTitle>
            <AlertDialogDescription>
              It moves to “Approved”. Delivery and reporting are handled in later phases.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                doApprove();
              }}
              disabled={acting}
            >
              {acting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RejectAdDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onConfirm={doReject}
        submitting={acting}
      />
    </Layout>
  );
}

function Row({
  label,
  value,
  right,
}: {
  label: string;
  value?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
      <span className="shrink-0 text-sm font-medium text-foreground">{label}</span>
      {right ?? (
        <span className="min-w-0 break-words text-right text-sm text-muted-foreground">{value}</span>
      )}
    </div>
  );
}
