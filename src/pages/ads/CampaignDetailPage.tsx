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
import { ChevronLeft, AlertCircle, RefreshCw, Loader2, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CampaignStatusBadge } from '@/components/ads/CampaignStatusBadge';
import { CampaignAudienceSummary } from '@/components/ads/CampaignAudienceSummary';
import { CampaignAdsCard } from '@/components/ads/CampaignAdsCard';
import { useIsAdReviewer } from '@/hooks/useIsAdReviewer';
import { activateCampaign, pauseCampaign } from '@/lib/ads/delivery';
import {
  campaignObjectiveLabel,
  getCampaignWithAccount,
  submitCampaignForReview,
  withdrawCampaignSubmission,
  type AdAccount,
  type Campaign,
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

function money(cents: number | null, currency: string) {
  if (!cents || cents <= 0) return '—';
  return `${currency} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default function CampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [adAccount, setAdAccount] = useState<AdAccount | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [dialog, setDialog] = useState<null | 'submit' | 'withdraw'>(null);
  const [acting, setActing] = useState(false);
  const { data: isReviewer } = useIsAdReviewer();
  const [delivering, setDelivering] = useState(false);

  const setDelivery = async (active: boolean) => {
    if (!campaign) return;
    setDelivering(true);
    try {
      const updated = active
        ? await activateCampaign(campaign.id)
        : await pauseCampaign(campaign.id);
      setCampaign(updated);
      toast({ title: active ? 'Campaign activated' : 'Campaign paused' });
    } catch (e) {
      toast({
        title: 'Could not update',
        description: e instanceof Error ? e.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setDelivering(false);
    }
  };

  const load = useCallback(async () => {
    if (!campaignId) return;
    setState('loading');
    setErrorMsg(null);
    try {
      const res = await getCampaignWithAccount(campaignId);
      if (!res) {
        setState('notfound');
        return;
      }
      setCampaign(res.campaign);
      setAdAccount(res.adAccount);
      setState('ready');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load this campaign.');
      setState('error');
    }
  }, [campaignId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        navigate('/');
        return;
      }
      setUser(user);
      load();
    });
  }, [navigate, load]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const runAction = async () => {
    if (!campaign || !dialog) return;
    setActing(true);
    try {
      const updated =
        dialog === 'submit'
          ? await submitCampaignForReview(campaign.id)
          : await withdrawCampaignSubmission(campaign.id);
      setCampaign(updated);
      toast({ title: dialog === 'submit' ? 'Submitted for review' : 'Moved back to draft' });
      setDialog(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Action failed.';
      toast({
        title: 'Action failed',
        description: /not authorized|row-level security/i.test(message)
          ? 'You’re not authorized to change this campaign.'
          : message,
        variant: 'destructive',
      });
    } finally {
      setActing(false);
    }
  };

  return (
    <Layout user={user} onSignOut={handleSignOut} fullWidth>
      <div className="mx-auto w-full max-w-[720px] px-3 py-4 sm:px-4 sm:py-6">
        <div className="mb-4 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => navigate(adAccount ? `/ads/accounts/${adAccount.id}` : '/ads')}
            aria-label="Back to ad account"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-foreground">
            {state === 'ready' && campaign ? campaign.name : 'Campaign'}
          </h1>
          {state === 'ready' && campaign && <CampaignStatusBadge status={campaign.status} />}
        </div>

        {state === 'loading' && (
          <div className="space-y-4">
            <Skeleton className="h-56 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        )}

        {state === 'notfound' && (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <AlertCircle className="mb-3 h-8 w-8 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Campaign not found</h2>
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

        {state === 'ready' && campaign && adAccount && (
          <div className="space-y-4">
            <Card className="bg-card shadow-card border-0 overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-[15px] font-bold">Campaign details</CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border/60">
                <Row label="Status" right={<CampaignStatusBadge status={campaign.status} />} />
                <Row label="Objective" value={campaignObjectiveLabel(campaign.objective)} />
                <Row label="Ad account" value={`${adAccount.name} · ${adAccount.currency}`} />
                <Row label="Daily budget" value={money(campaign.daily_budget_cents, adAccount.currency)} />
                <Row label="Total budget" value={money(campaign.total_budget_cents, adAccount.currency)} />
                <Row label="Starts" value={fmtDateTime(campaign.start_at)} />
                <Row
                  label="Ends"
                  value={campaign.end_at ? fmtDateTime(campaign.end_at) : 'Runs continuously'}
                />
                <Row label="Created" value={fmtDateTime(campaign.created_at)} />
                {campaign.submitted_at && (
                  <Row label="Submitted for review" value={fmtDateTime(campaign.submitted_at)} />
                )}
              </CardContent>
            </Card>

            {/* Audience */}
            <CampaignAudienceSummary campaignId={campaign.id} />

            {/* Ads */}
            <CampaignAdsCard campaignId={campaign.id} />

            {/* Lifecycle actions */}
            <Card className="bg-card shadow-card border-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-[15px] font-bold">Next steps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                {campaign.status === 'draft' && (
                  <>
                    <p>
                      This campaign is a draft. Edit it freely, then submit it for review when the
                      objective, budget and schedule are set.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/ads/campaigns/${campaign.id}/edit`)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit draft
                      </Button>
                      <Button onClick={() => setDialog('submit')}>Submit for review</Button>
                    </div>
                  </>
                )}
                {campaign.status === 'pending_review' && (
                  <>
                    <p>
                      This campaign is in review. You can’t edit it while it’s under review — withdraw
                      it to make changes.
                    </p>
                    <Button variant="outline" onClick={() => setDialog('withdraw')}>
                      Withdraw from review
                    </Button>
                  </>
                )}
                {campaign.status === 'active' && (
                  <>
                    <p>
                      This campaign is live. Its approved, turned-on ads are eligible for controlled
                      delivery — currently only to designated test users.
                    </p>
                    <Button
                      variant="outline"
                      disabled={delivering}
                      onClick={() => setDelivery(false)}
                    >
                      Pause campaign
                    </Button>
                  </>
                )}
                {campaign.status === 'paused' && (
                  <>
                    <p>This campaign is paused — none of its ads deliver.</p>
                    {isReviewer && (
                      <Button disabled={delivering} onClick={() => setDelivery(true)}>
                        Resume campaign
                      </Button>
                    )}
                  </>
                )}
                {(campaign.status === 'draft' || campaign.status === 'pending_review') && isReviewer && (
                  <div className="rounded-md border bg-muted/40 p-3">
                    <p className="text-xs">
                      Reviewer: activating starts controlled delivery for this campaign&apos;s
                      approved, turned-on ads (test users only).
                    </p>
                    <Button
                      className="mt-2"
                      size="sm"
                      disabled={delivering}
                      onClick={() => setDelivery(true)}
                    >
                      Activate for delivery
                    </Button>
                  </div>
                )}
                {(campaign.status === 'approved' ||
                  campaign.status === 'rejected' ||
                  campaign.status === 'completed') && (
                  <p>
                    This campaign is {campaign.status.replace('_', ' ')}. Later phases cover
                    reporting.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <AlertDialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog === 'submit' ? 'Submit this campaign for review?' : 'Withdraw from review?'}
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
    <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {right ?? <span className="text-sm text-muted-foreground break-all text-right">{value}</span>}
    </div>
  );
}
