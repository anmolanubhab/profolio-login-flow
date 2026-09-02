import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdBuilder } from '@/components/ads/AdBuilder';
import {
  getAdContext,
  getAdAccount,
  getCampaignWithAccount,
  getOrCreateCampaignAdSet,
  type Ad,
  type AdAccount,
  type AdCreative,
  type AdSet,
} from '@/lib/ads/api';

async function companyName(companyId: string): Promise<string> {
  const { data } = await supabase.from('companies').select('name').eq('id', companyId).maybeSingle();
  return data?.name ?? 'Your company';
}

/**
 * `/ads/campaigns/:campaignId/ads/new`  — create (mode="new")
 * `/ads/ads/:adId/edit`                 — edit  (mode="edit", draft only)
 */
export default function AdBuilderPage({ mode }: { mode: 'new' | 'edit' }) {
  const params = useParams<{ campaignId: string; adId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [adAccount, setAdAccount] = useState<AdAccount | null>(null);
  const [company, setCompany] = useState('');
  const [adSet, setAdSet] = useState<AdSet | null>(null);
  const [initial, setInitial] = useState<{ ad: Ad; creative: AdCreative | null } | null>(null);
  const [backTo, setBackTo] = useState('/ads');
  const [state, setState] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    setErrorMsg(null);
    try {
      if (mode === 'new') {
        const res = await getCampaignWithAccount(params.campaignId!);
        if (!res) return setState('notfound');
        const set = await getOrCreateCampaignAdSet(params.campaignId!);
        setAdAccount(res.adAccount);
        setAdSet(set);
        setCompany(await companyName(res.adAccount.company_id));
        setBackTo(`/ads/campaigns/${params.campaignId}`);
        setState('ready');
      } else {
        const ctx = await getAdContext(params.adId!);
        if (!ctx) return setState('notfound');
        if (ctx.ad.review_status !== 'draft' && ctx.ad.review_status !== 'rejected') {
          toast({
            title: 'This ad can’t be edited right now',
            description: `It is ${ctx.ad.review_status === 'pending' ? 'in review' : ctx.ad.review_status}.`,
          });
          navigate(`/ads/ads/${ctx.ad.id}`, { replace: true });
          return;
        }
        const acct = await getAdAccount(ctx.adAccount.id);
        setAdAccount(acct);
        setCompany(await companyName(ctx.adAccount.company_id));
        setInitial({ ad: ctx.ad, creative: ctx.creative });
        setBackTo(`/ads/ads/${ctx.ad.id}`);
        setState('ready');
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load.');
      setState('error');
    }
  }, [mode, params.campaignId, params.adId, navigate, toast]);

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

  return (
    <Layout user={user} onSignOut={handleSignOut} fullWidth>
      <div className="mx-auto w-full max-w-[960px] px-3 py-4 sm:px-4 sm:py-6">
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
            {mode === 'new' ? 'New ad' : 'Edit ad'}
          </h1>
        </div>

        {state === 'loading' && (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-lg" />
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
          <AdBuilder
            adAccount={adAccount}
            companyName={company}
            adSet={adSet ?? undefined}
            initial={initial ?? undefined}
            onCancel={() => navigate(backTo)}
            onSaved={(ad) => navigate(`/ads/ads/${ad.id}`, { replace: true })}
          />
        )}
      </div>
    </Layout>
  );
}
