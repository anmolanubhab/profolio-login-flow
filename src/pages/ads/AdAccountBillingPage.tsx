import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, AlertCircle, RefreshCw, CreditCard, Plus, ShieldCheck, ReceiptText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getAdAccount, type AdAccount } from '@/lib/ads/api';
import {
  BILLING_STATUS_META,
  getBillingProfile,
  isBillingManager,
  listBillingEvents,
  listInvoices,
  listPaymentMethods,
  type BillingEvent,
  type BillingProfile,
  type Invoice,
  type PaymentMethod,
} from '@/lib/ads/billing';
import { BillingStatusBadge } from '@/components/ads/billing/BillingStatusBadge';
import { BillingProfileForm } from '@/components/ads/billing/BillingProfileForm';
import { PaymentMethodList } from '@/components/ads/billing/PaymentMethodList';
import { AddPaymentMethodDialog } from '@/components/ads/billing/AddPaymentMethodDialog';
import { BillingActivityList } from '@/components/ads/billing/BillingActivityList';
import { PaymentsPanel } from '@/components/ads/billing/PaymentsPanel';
import { useIsAdReviewer } from '@/hooks/useIsAdReviewer';

export default function AdAccountBillingPage() {
  const { id } = useParams<{ id: string }>();
  const { data: isReviewer } = useIsAdReviewer();
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<AdAccount | null>(null);
  const [manager, setManager] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<BillingProfile | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [events, setEvents] = useState<BillingEvent[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const loadBilling = useCallback(async (accountId: string) => {
    const [p, m, e, inv] = await Promise.all([
      getBillingProfile(accountId),
      listPaymentMethods(accountId),
      listBillingEvents(accountId),
      listInvoices(accountId),
    ]);
    setProfile(p);
    setMethods(m);
    setEvents(e);
    setInvoices(inv);
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setState('loading');
    setErrorMsg(null);
    try {
      const acct = await getAdAccount(id);
      if (!acct) {
        setState('notfound');
        return;
      }
      setAccount(acct);
      const isMgr = await isBillingManager(acct.id);
      setManager(isMgr);
      if (isMgr) await loadBilling(acct.id);
      setState('ready');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load billing.');
      setState('error');
    }
  }, [id, loadBilling]);

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

  const closed = account?.status === 'closed' || account?.status === 'suspended';
  const statusMeta = profile ? BILLING_STATUS_META[profile.status] : BILLING_STATUS_META.setup_required;

  return (
    <Layout user={user} onSignOut={handleSignOut} fullWidth>
      <div className="mx-auto w-full max-w-[760px] px-3 py-4 sm:px-4 sm:py-6">
        <div className="mb-4 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => navigate(account ? `/ads/accounts/${account.id}` : '/ads')}
            aria-label="Back to ad account"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <CreditCard className="h-5 w-5 text-primary" />
            Billing
          </h1>
        </div>

        {state === 'loading' && (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        )}

        {state === 'notfound' && (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <AlertCircle className="mb-3 h-8 w-8 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Ad account not found</h2>
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

        {state === 'ready' && account && manager === false && (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <ShieldCheck className="mb-3 h-8 w-8 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Billing is restricted</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Only the owner or a super admin of this company can view or manage billing for this
                ad account.
              </p>
              <Button className="mt-5" variant="outline" onClick={() => navigate(`/ads/accounts/${account.id}`)}>
                Back to ad account
              </Button>
            </CardContent>
          </Card>
        )}

        {state === 'ready' && account && manager && (
          <div className="space-y-4">
            {/* Status */}
            <Card className="bg-card shadow-card border-0">
              <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">Billing status</span>
                    <BillingStatusBadge status={profile?.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{statusMeta.hint}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  Currency <span className="font-medium text-foreground">{account.currency}</span>
                </span>
              </CardContent>
            </Card>

            {closed && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                This ad account is {account.status}. Billing details are read-only until it’s
                reopened.
              </div>
            )}

            {/* Billing details */}
            <Card className="bg-card shadow-card border-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-[15px] font-bold">Billing details</CardTitle>
              </CardHeader>
              <CardContent>
                <BillingProfileForm
                  adAccountId={account.id}
                  currency={account.currency}
                  profile={profile}
                  disabled={!!closed}
                  onSaved={(p) => {
                    setProfile(p);
                    loadBilling(account.id);
                  }}
                />
              </CardContent>
            </Card>

            {/* Payment methods */}
            <Card className="bg-card shadow-card border-0">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-[15px] font-bold">Payment methods</CardTitle>
                {!closed && (
                  <Button size="sm" onClick={() => setAddOpen(true)}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p>
                    <span className="font-medium text-foreground">Simulated Provider · Test Mode.</span>{' '}
                    Profolio stores only a provider reference plus the card type, last 4 and expiry —
                    never the full number or CVV. No real money moves; this is not Stripe.
                  </p>
                </div>
                <PaymentMethodList
                  methods={methods}
                  disabled={!!closed}
                  onChanged={() => loadBilling(account.id)}
                />
              </CardContent>
            </Card>

            {/* Balance, payments, ledger (K3-B) */}
            <PaymentsPanel
              adAccountId={account.id}
              isAdmin={!!isReviewer}
              disabled={!!closed}
              onChanged={() => loadBilling(account.id)}
            />

            {/* Invoices */}
            <Card className="bg-card shadow-card border-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-[15px] font-bold">Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                {invoices.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-md border border-dashed bg-card px-6 py-8 text-center">
                    <ReceiptText className="h-6 w-6 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">No invoices yet</p>
                    <p className="max-w-xs text-xs text-muted-foreground">
                      Billing hasn’t produced any charges. Invoices will appear here once ad spend is
                      billed in a later phase.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border/60 rounded-md border text-sm">
                    {invoices.map((inv) => (
                      <li key={inv.id} className="flex items-center justify-between gap-3 p-3">
                        <span className="font-medium text-foreground">
                          {inv.invoice_number ?? 'Draft'}
                        </span>
                        <span className="text-muted-foreground">
                          {inv.currency} {(inv.total_cents / 100).toLocaleString()} · {inv.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Activity */}
            <Card className="bg-card shadow-card border-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-[15px] font-bold">Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <BillingActivityList events={events} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {account && (
        <AddPaymentMethodDialog
          adAccountId={account.id}
          open={addOpen}
          onOpenChange={setAddOpen}
          onAdded={() => loadBilling(account.id)}
        />
      )}
    </Layout>
  );
}
