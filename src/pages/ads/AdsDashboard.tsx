import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Megaphone, Plus, AlertCircle, Building2, ChevronRight, RefreshCw, ClipboardCheck, FlaskConical, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AdAccountStatusBadge } from '@/components/ads/AdAccountStatusBadge';
import { CreateAdAccountDialog } from '@/components/ads/CreateAdAccountDialog';
import { useIsAdReviewer } from '@/hooks/useIsAdReviewer';
import { listAdAccounts, type AdAccount } from '@/lib/ads/api';

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

/** `/ads` — advertiser dashboard shell + ad-account list. */
export default function AdsDashboard() {
  const navigate = useNavigate();
  const { data: isReviewer } = useIsAdReviewer();
  const [user, setUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<AdAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setAccounts(await listAdAccounts());
    } catch (e) {
      setAccounts([]);
      setError(e instanceof Error ? e.message : 'Failed to load ad accounts.');
    }
  }, []);

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

  const loading = accounts === null;

  return (
    <Layout user={user} onSignOut={handleSignOut} fullWidth>
      <div className="mx-auto w-full max-w-[880px] px-3 py-5 sm:px-4 sm:py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:flex">
              <Megaphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Advertising</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Manage the ad accounts for companies you run on Profolio.
              </p>
            </div>
          </div>
          {!loading && accounts.length > 0 && (
            <Button onClick={() => setCreateOpen(true)} className="shrink-0">
              <Plus className="mr-2 h-4 w-4" />
              Create ad account
            </Button>
          )}
        </div>

        {/* Reviewer entries */}
        {isReviewer && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => navigate('/ads/review')}
              className="flex w-full items-center gap-3 rounded-lg border bg-card p-4 text-left shadow-card transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <ClipboardCheck className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Ad review queue</p>
                <p className="text-xs text-muted-foreground">Review submitted ads</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate('/ads/delivery')}
              className="flex w-full items-center gap-3 rounded-lg border bg-card p-4 text-left shadow-card transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <FlaskConical className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Test delivery</p>
                <p className="text-xs text-muted-foreground">Who receives sponsored ads</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* Analytics entry */}
        {!loading && !error && accounts.length > 0 && (
          <button
            onClick={() => navigate('/ads/analytics')}
            className="mb-4 flex w-full items-center gap-3 rounded-lg border bg-card p-4 text-left shadow-card transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Analytics</p>
              <p className="text-xs text-muted-foreground">
                Impressions, clicks and CTR by campaign, ad set and ad
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        )}

        {/* Error state */}
        {error && (
          <Card className="mb-4 border-destructive/30 bg-destructive/5">
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

        {/* Loading state */}
        {loading && !error && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[76px] w-full rounded-lg" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && accounts.length === 0 && (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Megaphone className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Create your first ad account</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                An ad account holds the currency, time zone and billing details for one company. You
                need one before you can build a campaign.
              </p>
              <Button className="mt-5" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create ad account
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Account list */}
        {!loading && !error && accounts.length > 0 && (
          <ul className="space-y-3">
            {accounts.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => navigate(`/ads/accounts/${a.id}`)}
                  className="flex w-full items-center gap-4 rounded-lg border bg-card p-4 text-left shadow-card transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-foreground">{a.name}</span>
                      <AdAccountStatusBadge status={a.status} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {a.currency} · {a.timezone.replace(/_/g, ' ')} · created {fmtDate(a.created_at)}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CreateAdAccountDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(acct) => navigate(`/ads/accounts/${acct.id}`)}
      />
    </Layout>
  );
}
