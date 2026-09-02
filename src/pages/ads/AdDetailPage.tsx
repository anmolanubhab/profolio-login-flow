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
import { ChevronLeft, AlertCircle, RefreshCw, Pencil, Loader2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdReviewStatusBadge } from '@/components/ads/AdReviewStatusBadge';
import { AdCreativePreview } from '@/components/ads/AdCreativePreview';
import {
  adFormatMeta,
  getAdContext,
  listAdReviews,
  submitAdForReview,
  withdrawAdSubmission,
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

export default function AdDetailPage() {
  const { adId } = useParams<{ adId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [ctx, setCtx] = useState<AdContext | null>(null);
  const [company, setCompany] = useState('Your company');
  const [state, setState] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | 'submit' | 'withdraw'>(null);
  const [acting, setActing] = useState(false);
  const [latestRejection, setLatestRejection] = useState<AdReview | null>(null);

  const load = useCallback(async () => {
    if (!adId) return;
    setState('loading');
    setErrorMsg(null);
    try {
      const c = await getAdContext(adId);
      if (!c) return setState('notfound');
      setCtx(c);
      const [{ data }, reviews] = await Promise.all([
        supabase.from('companies').select('name').eq('id', c.adAccount.company_id).maybeSingle(),
        listAdReviews(adId),
      ]);
      setCompany(data?.name ?? c.adAccount.name);
      setLatestRejection(reviews.find((r) => r.decision === 'rejected') ?? null);
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
      load();
    });
  }, [navigate, load]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const runAction = async () => {
    if (!ctx || !dialog) return;
    setActing(true);
    try {
      const updated =
        dialog === 'submit' ? await submitAdForReview(ctx.ad.id) : await withdrawAdSubmission(ctx.ad.id);
      setCtx({ ...ctx, ad: updated });
      toast({ title: dialog === 'submit' ? 'Submitted for review' : 'Moved back to draft' });
      setDialog(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Action failed.';
      toast({
        title: 'Action failed',
        description: /not authorized|row-level security/i.test(message)
          ? 'You’re not authorized to change this ad.'
          : message,
        variant: 'destructive',
      });
    } finally {
      setActing(false);
    }
  };

  return (
    <Layout user={user} onSignOut={handleSignOut} fullWidth>
      <div className="mx-auto w-full max-w-[860px] px-3 py-4 sm:px-4 sm:py-6">
        <div className="mb-4 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => navigate(ctx ? `/ads/campaigns/${ctx.campaign.id}` : '/ads')}
            aria-label="Back to campaign"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-foreground">
            {state === 'ready' && ctx ? ctx.ad.name : 'Ad'}
          </h1>
          {state === 'ready' && ctx && <AdReviewStatusBadge status={ctx.ad.review_status} />}
        </div>

        {state === 'loading' && (
          <div className="space-y-4">
            <Skeleton className="h-64 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        )}

        {state === 'notfound' && (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <AlertCircle className="mb-3 h-8 w-8 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Ad not found</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                It may have been removed, or you don’t have access to it.
              </p>
              <Button className="mt-5" variant="outline" onClick={() => navigate('/ads')}>
                Back to Advertising
              </Button>
            </CardContent>
          </Card>
        )}

        {state === 'error' && (
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

        {state === 'ready' && ctx && (
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
            <div className="space-y-4">
              {ctx.ad.review_status === 'rejected' && latestRejection && (
                <Card className="border-destructive/30 bg-destructive/5 shadow-none">
                  <CardContent className="flex items-start gap-3 p-4">
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-destructive">
                        A reviewer rejected this ad on {fmtDateTime(latestRejection.created_at)}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-foreground">
                        {latestRejection.reason}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Fix the issue below, then submit it for review again.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-card shadow-card border-0 overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[15px] font-bold">Ad details</CardTitle>
                </CardHeader>
                <CardContent className="p-0 divide-y divide-border/60">
                  <Row label="Status" right={<AdReviewStatusBadge status={ctx.ad.review_status} />} />
                  <Row label="Format" value={adFormatMeta(ctx.creative?.format ?? 'single_image').label} />
                  <Row label="Campaign" value={ctx.campaign.name} />
                  <Row label="Headline" value={ctx.creative?.headline ?? '—'} />
                  <Row label="Description" value={ctx.creative?.body ?? '—'} />
                  <Row label="Call to action" value={ctx.creative?.cta_label ?? 'No button'} />
                  <Row label="Destination URL" value={ctx.creative?.destination_url ?? '—'} />
                  <Row label="Created" value={fmtDateTime(ctx.ad.created_at)} />
                </CardContent>
              </Card>

              <Card className="bg-card shadow-card border-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[15px] font-bold">Next steps</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  {ctx.ad.review_status === 'draft' && (
                    <>
                      <p>
                        This ad is a draft. Edit the creative freely, then submit it for review when
                        it’s ready.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => navigate(`/ads/ads/${ctx.ad.id}/edit`)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit draft
                        </Button>
                        <Button onClick={() => setDialog('submit')}>Submit for review</Button>
                      </div>
                    </>
                  )}
                  {ctx.ad.review_status === 'pending' && (
                    <>
                      <p>
                        This ad is in review. You can’t edit it while it’s under review — withdraw it
                        to make changes.
                      </p>
                      <Button variant="outline" onClick={() => setDialog('withdraw')}>
                        Withdraw from review
                      </Button>
                    </>
                  )}
                  {ctx.ad.review_status === 'rejected' && (
                    <>
                      <p>
                        This ad was rejected. Edit the creative to address the feedback above, then
                        resubmit it for review.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => navigate(`/ads/ads/${ctx.ad.id}/edit`)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Fix &amp; edit
                        </Button>
                        <Button onClick={() => setDialog('submit')}>Resubmit for review</Button>
                      </div>
                    </>
                  )}
                  {ctx.ad.review_status === 'approved' && (
                    <p>
                      This ad is approved. Delivery and reporting come in later phases.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:sticky lg:top-4">
              <AdCreativePreview
                data={{
                  format: ctx.creative?.format ?? 'single_image',
                  headline: ctx.creative?.headline ?? '',
                  body: ctx.creative?.body ?? null,
                  ctaLabel: ctx.creative?.cta_label ?? null,
                  mediaUrl: ctx.creative?.media_url ?? null,
                  companyName: company,
                }}
              />
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog === 'submit' ? 'Submit this ad for review?' : 'Withdraw from review?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog === 'submit'
                ? 'It moves to “In review”. You won’t be able to edit it until it’s reviewed or you withdraw it.'
                : 'It moves back to “Draft” so you can edit it again.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                runAction();
              }}
              disabled={acting}
            >
              {acting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialog === 'submit' ? 'Submit' : 'Withdraw'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
        <span className="min-w-0 break-all text-right text-sm text-muted-foreground">{value}</span>
      )}
    </div>
  );
}
