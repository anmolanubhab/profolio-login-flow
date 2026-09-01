import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, AlertCircle, RefreshCw, Pencil, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AudienceReachBadge } from '@/components/ads/AudienceReachBadge';
import {
  MIN_AUDIENCE_SIZE,
  TARGETING_DIMENSIONS,
  getAudienceWithAccount,
  recomputeAudienceReach,
  type AdAccount,
  type AdAudience,
  type AudienceSpec,
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

export default function AudienceDetailPage() {
  const { audienceId } = useParams<{ audienceId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [audience, setAudience] = useState<AdAudience | null>(null);
  const [adAccount, setAdAccount] = useState<AdAccount | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recomputing, setRecomputing] = useState(false);

  const load = useCallback(async () => {
    if (!audienceId) return;
    setState('loading');
    setErrorMsg(null);
    try {
      const res = await getAudienceWithAccount(audienceId);
      if (!res) return setState('notfound');
      setAudience(res.audience);
      setAdAccount(res.adAccount);
      setState('ready');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load this audience.');
      setState('error');
    }
  }, [audienceId]);

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

  const recompute = async () => {
    if (!audience) return;
    setRecomputing(true);
    try {
      setAudience(await recomputeAudienceReach(audience.id));
      toast({ title: 'Audience size updated' });
    } catch (e) {
      toast({
        title: 'Could not update',
        description: e instanceof Error ? e.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setRecomputing(false);
    }
  };

  const spec: AudienceSpec =
    audience && typeof audience.spec === 'object' && audience.spec
      ? (audience.spec as AudienceSpec)
      : {};

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
            {state === 'ready' && audience ? audience.name : 'Audience'}
          </h1>
          {state === 'ready' && audience && <AudienceReachBadge reach={audience.estimated_reach} />}
        </div>

        {state === 'loading' && (
          <div className="space-y-4">
            <Skeleton className="h-52 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        )}

        {state === 'notfound' && (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <AlertCircle className="mb-3 h-8 w-8 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Audience not found</h2>
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

        {state === 'ready' && audience && adAccount && (
          <div className="space-y-4">
            <Card className="bg-card shadow-card border-0 overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-[15px] font-bold">Estimated size</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-foreground">
                    {audience.estimated_reach == null
                      ? '—'
                      : audience.estimated_reach.toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground">eligible members</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Server-computed from public, discoverable profiles only — you never receive the
                  underlying people. Needs at least {MIN_AUDIENCE_SIZE.toLocaleString()} to attach to
                  a campaign.
                  {audience.estimated_reach_at
                    ? ` Last updated ${fmtDateTime(audience.estimated_reach_at)}.`
                    : ''}
                </p>
                <Button variant="outline" size="sm" onClick={recompute} disabled={recomputing}>
                  {recomputing && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  <RefreshCw className={recomputing ? 'hidden' : 'mr-2 h-3.5 w-3.5'} />
                  Recalculate size
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-card shadow-card border-0 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-[15px] font-bold">Targeting</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/ads/audiences/${audience.id}/edit`)}
                >
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit
                </Button>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border/60">
                {TARGETING_DIMENSIONS.map((d) => {
                  const vals = spec[d.key];
                  if (!vals || vals.length === 0) return null;
                  return (
                    <div key={d.key} className="px-4 py-3 sm:px-5">
                      <p className="text-xs font-medium text-muted-foreground">{d.label}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {vals.map((v) => (
                          <span
                            key={v}
                            className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                          >
                            {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {typeof spec.min_years_experience === 'number' && spec.min_years_experience > 0 && (
                  <div className="px-4 py-3 sm:px-5">
                    <p className="text-xs font-medium text-muted-foreground">
                      Minimum years of experience
                    </p>
                    <p className="mt-1 text-sm text-foreground">{spec.min_years_experience}</p>
                  </div>
                )}
                {TARGETING_DIMENSIONS.every((d) => !(spec[d.key]?.length ?? 0)) &&
                  !(typeof spec.min_years_experience === 'number' && spec.min_years_experience > 0) && (
                    <div className="px-4 py-4 text-sm text-muted-foreground sm:px-5">
                      No criteria yet — this audience is everyone eligible. Edit it to narrow down.
                    </div>
                  )}
              </CardContent>
            </Card>

            <Card className="bg-card shadow-card border-0 overflow-hidden">
              <CardContent className="p-0 divide-y divide-border/60">
                <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
                  <span className="text-sm font-medium text-foreground">Ad account</span>
                  <span className="text-sm text-muted-foreground">{adAccount.name}</span>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
                  <span className="text-sm font-medium text-foreground">Created</span>
                  <span className="text-sm text-muted-foreground">
                    {fmtDateTime(audience.created_at)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
