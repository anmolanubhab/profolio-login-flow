import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, AlertCircle, RefreshCw, BarChart3, Megaphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { listAdAccounts, type AdAccount } from '@/lib/ads/api';
import { AdAnalyticsPanel } from '@/components/ads/analytics/AdAnalyticsPanel';

/** `/ads/analytics` — account-level advertising analytics dashboard. */
export default function AdAnalyticsDashboardPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [user, setUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<AdAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = params.get('account');

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await listAdAccounts();
      setAccounts(list);
      if (list.length > 0 && !list.some((a) => a.id === selected)) {
        setParams((p) => {
          p.set('account', list[0].id);
          return p;
        });
      }
    } catch (e) {
      setAccounts([]);
      setError(e instanceof Error ? e.message : 'Failed to load ad accounts.');
    }
  }, [selected, setParams]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return navigate('/');
      setUser(user);
      load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const account = accounts?.find((a) => a.id === selected) ?? null;
  const loading = accounts === null;

  return (
    <Layout user={user} onSignOut={handleSignOut} fullWidth>
      <div className="mx-auto w-full max-w-[860px] px-3 py-4 sm:px-4 sm:py-6">
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
            <BarChart3 className="h-5 w-5 text-primary" />
            Analytics
          </h1>
        </div>

        {loading && !error && <Skeleton className="h-64 w-full rounded-lg" />}

        {error && (
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

        {!loading && !error && accounts && accounts.length === 0 && (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Megaphone className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Nothing to report yet</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Create an ad account and run a campaign — its impressions and clicks will show up
                here.
              </p>
              <Button className="mt-5" variant="outline" onClick={() => navigate('/ads')}>
                Back to Advertising
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && !error && account && (
          <div className="space-y-4">
            {accounts && accounts.length > 1 && (
              <Select
                value={account.id}
                onValueChange={(v) =>
                  setParams((p) => {
                    p.set('account', v);
                    return p;
                  })
                }
              >
                <SelectTrigger className="w-full sm:w-[280px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <AdAnalyticsPanel
              key={account.id}
              scope="account"
              scopeId={account.id}
              breakdownLevel="campaign"
              refreshAccountId={account.id}
              title={`${account.name} — performance`}
              onBreakdownRowClick={(row) => navigate(`/ads/campaigns/${row.id}`)}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}
