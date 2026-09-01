import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AudienceBuilder } from '@/components/ads/AudienceBuilder';
import {
  getAdAccount,
  getAudienceWithAccount,
  type AdAccount,
  type AdAudience,
} from '@/lib/ads/api';

/**
 * `/ads/accounts/:id/audiences/new`   — create  (mode="new")
 * `/ads/audiences/:audienceId/edit`   — edit    (mode="edit")
 *
 * `?campaign=<id>` (create only) returns the user to that campaign's audience
 * step after saving.
 */
export default function AudienceBuilderPage({ mode }: { mode: 'new' | 'edit' }) {
  const params = useParams<{ id: string; audienceId: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const campaignId = search.get('campaign');

  const [user, setUser] = useState<User | null>(null);
  const [adAccount, setAdAccount] = useState<AdAccount | null>(null);
  const [audience, setAudience] = useState<AdAudience | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    setErrorMsg(null);
    try {
      if (mode === 'new') {
        const acct = await getAdAccount(params.id!);
        if (!acct) return setState('notfound');
        setAdAccount(acct);
        setState('ready');
      } else {
        const res = await getAudienceWithAccount(params.audienceId!);
        if (!res) return setState('notfound');
        setAdAccount(res.adAccount);
        setAudience(res.audience);
        setState('ready');
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load.');
      setState('error');
    }
  }, [mode, params.id, params.audienceId]);

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

  const backTo =
    mode === 'edit' && audience
      ? `/ads/audiences/${audience.id}`
      : campaignId
        ? `/ads/campaigns/${campaignId}/audience`
        : adAccount
          ? `/ads/accounts/${adAccount.id}`
          : '/ads';

  const afterSave = (a: AdAudience) => {
    if (mode === 'new' && campaignId) {
      navigate(`/ads/campaigns/${campaignId}/audience?created=${a.id}`, { replace: true });
    } else {
      navigate(`/ads/audiences/${a.id}`, { replace: true });
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
            onClick={() => navigate(backTo)}
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">
            {mode === 'new' ? 'New audience' : 'Edit audience'}
          </h1>
        </div>

        {state === 'loading' && (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-72 w-full rounded-lg" />
          </div>
        )}

        {state === 'notfound' && (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <AlertCircle className="mb-3 h-8 w-8 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Not found</h2>
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

        {state === 'ready' && adAccount && (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              Ad account: <span className="font-medium text-foreground">{adAccount.name}</span>
            </p>
            <AudienceBuilder
              adAccount={adAccount}
              initial={audience ?? undefined}
              onCancel={() => navigate(backTo)}
              onSaved={afterSave}
            />
          </>
        )}
      </div>
    </Layout>
  );
}
