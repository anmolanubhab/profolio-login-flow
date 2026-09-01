import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, AlertCircle, RefreshCw, Plus, Users, Check, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AudienceReachBadge } from '@/components/ads/AudienceReachBadge';
import {
  MIN_AUDIENCE_SIZE,
  attachAudienceToCampaign,
  audienceCriteriaCount,
  detachAudienceFromCampaign,
  getCampaignAdSet,
  getCampaignWithAccount,
  listAudiences,
  type AdAccount,
  type AdAudience,
  type AdSet,
  type AudienceSpec,
  type Campaign,
} from '@/lib/ads/api';

export default function CampaignAudiencePage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [adAccount, setAdAccount] = useState<AdAccount | null>(null);
  const [adSet, setAdSet] = useState<AdSet | null>(null);
  const [audiences, setAudiences] = useState<AdAudience[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!campaignId) return;
    setState('loading');
    setErrorMsg(null);
    try {
      const res = await getCampaignWithAccount(campaignId);
      if (!res) return setState('notfound');
      const [set, auds] = await Promise.all([
        getCampaignAdSet(campaignId),
        listAudiences(res.adAccount.id),
      ]);
      setCampaign(res.campaign);
      setAdAccount(res.adAccount);
      setAdSet(set);
      setAudiences(auds);
      setState('ready');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load.');
      setState('error');
    }
  }, [campaignId]);

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

  const attachedId = adSet?.audience_id ?? null;
  const attachedAudience = audiences.find((a) => a.id === attachedId) ?? null;
  const createdId = search.get('created');

  const attach = async (audienceId: string) => {
    if (!campaignId) return;
    setBusyId(audienceId);
    try {
      const set = await attachAudienceToCampaign(campaignId, audienceId);
      setAdSet(set);
      await load();
      toast({ title: 'Audience attached to this campaign' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not attach.';
      toast({
        title: 'Could not attach',
        description: /too small/i.test(msg)
          ? `That audience has fewer than ${MIN_AUDIENCE_SIZE.toLocaleString()} eligible members.`
          : /different ad account|not authorized/i.test(msg)
            ? 'That audience isn’t available for this campaign.'
            : msg,
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  const detach = async () => {
    if (!campaignId) return;
    setBusyId('__detach');
    try {
      const set = await detachAudienceFromCampaign(campaignId);
      setAdSet(set);
      toast({ title: 'Audience removed from this campaign' });
    } catch (e) {
      toast({
        title: 'Could not remove',
        description: e instanceof Error ? e.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  const specSummary = (a: AdAudience): string => {
    const n = audienceCriteriaCount(
      typeof a.spec === 'object' && a.spec ? (a.spec as AudienceSpec) : {},
    );
    return n === 0 ? 'No criteria (everyone eligible)' : `${n} ${n === 1 ? 'criterion' : 'criteria'}`;
  };

  return (
    <Layout user={user} onSignOut={handleSignOut} fullWidth>
      <div className="mx-auto w-full max-w-[720px] px-3 py-4 sm:px-4 sm:py-6">
        <div className="mb-4 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => navigate(campaignId ? `/ads/campaigns/${campaignId}` : '/ads')}
            aria-label="Back to campaign"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-foreground">
            Audience{campaign ? ` · ${campaign.name}` : ''}
          </h1>
        </div>

        {state === 'loading' && (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-56 w-full rounded-lg" />
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

        {state === 'ready' && adAccount && campaign && (
          <div className="space-y-4">
            {/* Attached audience */}
            <Card className="bg-card shadow-card border-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-[15px] font-bold">Attached audience</CardTitle>
              </CardHeader>
              <CardContent>
                {attachedAudience ? (
                  <div className="flex items-center gap-3 rounded-md border p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {attachedAudience.name}
                        </span>
                        <AudienceReachBadge reach={attachedAudience.estimated_reach} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {specSummary(attachedAudience)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={detach}
                      disabled={busyId === '__detach'}
                    >
                      {busyId === '__detach' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <X className="mr-1.5 h-3.5 w-3.5" />
                          Remove
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No audience attached yet. Pick one below, or create a new one.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Saved audiences */}
            <Card className="bg-card shadow-card border-0">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-[15px] font-bold">Audiences in this ad account</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    navigate(`/ads/accounts/${adAccount.id}/audiences/new?campaign=${campaign.id}`)
                  }
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New
                </Button>
              </CardHeader>
              <CardContent>
                {audiences.length === 0 ? (
                  <div className="rounded-md border border-dashed px-4 py-8 text-center">
                    <Users className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">No audiences yet</p>
                    <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
                      Build one with professional targeting criteria. You’ll see the estimated size
                      as you go.
                    </p>
                    <Button
                      className="mt-4"
                      size="sm"
                      onClick={() =>
                        navigate(
                          `/ads/accounts/${adAccount.id}/audiences/new?campaign=${campaign.id}`,
                        )
                      }
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Create audience
                    </Button>
                  </div>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {audiences.map((a) => {
                      const isAttached = a.id === attachedId;
                      const tooSmall =
                        a.estimated_reach != null && a.estimated_reach < MIN_AUDIENCE_SIZE;
                      return (
                        <li
                          key={a.id}
                          className={cnRow(a.id === createdId)}
                        >
                          <button
                            onClick={() => navigate(`/ads/audiences/${a.id}`)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-foreground">
                                {a.name}
                              </span>
                              <AudienceReachBadge reach={a.estimated_reach} />
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {specSummary(a)}
                            </p>
                          </button>
                          {isAttached ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                              <Check className="h-3.5 w-3.5" />
                              Attached
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyId === a.id || tooSmall}
                              title={
                                tooSmall
                                  ? `Needs at least ${MIN_AUDIENCE_SIZE} eligible members`
                                  : undefined
                              }
                              onClick={() => attach(a.id)}
                            >
                              {busyId === a.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                'Attach'
                              )}
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground">
              An audience must have at least {MIN_AUDIENCE_SIZE.toLocaleString()} eligible members
              before it can be attached. The size is always computed on the server from public,
              discoverable profiles — never shared as individual people.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}

function cnRow(highlight: boolean) {
  return [
    'flex items-center gap-3 py-3',
    highlight ? 'bg-primary/5 -mx-2 rounded px-2' : '',
  ]
    .filter(Boolean)
    .join(' ');
}
