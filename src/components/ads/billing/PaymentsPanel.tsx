import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  FlaskConical,
  Loader2,
  RefreshCw,
  Wallet,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatMoney, microsToMajor } from '@/lib/ads/spend';
import {
  confirmPayment,
  getBillingSummary,
  listBillingLedger,
  listTransactions,
  openCheckout,
  refundTransaction,
  LEDGER_LABEL,
  TXN_STATUS_META,
  type BillingLedgerEntry,
  type BillingSummary,
  type BillingTransaction,
  type SimOutcome,
} from '@/lib/ads/payments';

const TONE: Record<string, string> = {
  muted: 'text-muted-foreground',
  warning: 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400',
  success: 'bg-success/15 text-success border-success/30',
  destructive: 'bg-destructive/15 text-destructive border-destructive/30',
};

function fmtDT(d: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return d;
  }
}

interface Props {
  adAccountId: string;
  isAdmin: boolean;
  disabled?: boolean;
  onChanged?: () => void;
}

export function PaymentsPanel({ adAccountId, isAdmin, disabled, onChanged }: Props) {
  const { toast } = useToast();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [txns, setTxns] = useState<BillingTransaction[]>([]);
  const [ledger, setLedger] = useState<BillingLedgerEntry[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payOutcome, setPayOutcome] = useState<SimOutcome>('ok');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const [s, t, l] = await Promise.all([
        getBillingSummary(adAccountId),
        listTransactions(adAccountId),
        listBillingLedger(adAccountId),
      ]);
      setSummary(s);
      setTxns(t);
      setLedger(l);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [adAccountId]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshAll = () => {
    load();
    onChanged?.();
  };

  // While the provider is in test mode the real-money ("live") columns are
  // held at zero and all activity lands in the test_* columns. Show the
  // active set for the headline figures, and surface the other set so the
  // test / live split is always visible.
  const active = summary
    ? summary.testMode
      ? {
          outstandingMicros: summary.testOutstandingMicros,
          lifetimePaidMicros: summary.testLifetimePaidMicros,
          creditMicros: summary.testCreditMicros,
        }
      : {
          outstandingMicros: summary.outstandingMicros,
          lifetimePaidMicros: summary.lifetimePaidMicros,
          creditMicros: summary.creditMicros,
        }
    : { outstandingMicros: 0, lifetimePaidMicros: 0, creditMicros: 0 };
  const cur = summary?.currency ?? 'USD';
  const outstandingMajor = microsToMajor(active.outstandingMicros, cur);
  const suggested = outstandingMajor > 0 ? outstandingMajor.toFixed(2) : '';

  const doPay = async () => {
    const cents = Math.round(Number(payAmount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return;
    setBusy('pay');
    try {
      const txn = await openCheckout(adAccountId, { amountCents: cents, outcome: payOutcome });
      toast({
        title:
          txn?.status === 'succeeded'
            ? 'Payment succeeded'
            : txn?.status === 'failed'
              ? 'Payment declined'
              : txn?.status === 'requires_action'
                ? 'Payment needs confirmation'
                : 'Payment submitted',
      });
      setPayOpen(false);
      setPayAmount('');
      refreshAll();
    } catch (e) {
      toast({
        title: 'Payment failed',
        description: e instanceof Error ? e.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  const doConfirm = async (txnId: string, approve: boolean) => {
    setBusy(txnId);
    try {
      await confirmPayment(adAccountId, txnId, approve);
      refreshAll();
    } catch (e) {
      toast({ title: 'Could not update', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const doRefund = async (txnId: string) => {
    setBusy(txnId);
    try {
      await refundTransaction(adAccountId, txnId);
      toast({ title: 'Refund processed' });
      refreshAll();
    } catch (e) {
      toast({ title: 'Refund failed', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Balance */}
      <Card className="bg-card shadow-card border-0">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="flex items-center gap-2 text-[15px] font-bold">
            <Wallet className="h-4 w-4 text-primary" />
            Account balance
          </CardTitle>
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
            <FlaskConical className="h-3 w-3" />
            {summary ? `${summary.provider} · test mode` : 'test mode'}
          </span>
        </CardHeader>
        <CardContent className="space-y-3">
          {state === 'loading' && <Skeleton className="h-24 w-full rounded-md" />}
          {state === 'error' && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> Couldn’t load billing.
              </span>
              <Button size="sm" variant="outline" onClick={load}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          )}

          {state === 'ready' && summary && (
            <>
              {summary.hold && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">This ad account is on billing hold.</p>
                    <p className="text-xs">
                      {summary.holdReason || 'A payment failed.'} Ads won’t deliver until an
                      outstanding payment succeeds.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {summary.testMode ? 'Outstanding (test)' : 'Outstanding'}
                  </p>
                  <p
                    className={`text-lg font-bold tabular-nums ${
                      outstandingMajor > 0 ? 'text-foreground' : 'text-success'
                    }`}
                  >
                    {formatMoney(Math.max(active.outstandingMicros, 0), cur)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Charge threshold</p>
                  <p className="text-lg font-bold tabular-nums text-foreground">
                    {formatMoney(summary.paymentThresholdCents * 10_000, cur)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {summary.testMode ? 'Paid to date (test)' : 'Paid to date'}
                  </p>
                  <p className="text-lg font-bold tabular-nums text-foreground">
                    {formatMoney(active.lifetimePaidMicros, cur)}
                  </p>
                </div>
              </div>

              {summary.testMode && (
                <div className="flex items-center justify-between rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <span>Live (real-money) balance</span>
                  <span className="tabular-nums font-medium text-foreground">
                    {formatMoney(Math.max(summary.outstandingMicros, 0), cur)} outstanding ·{' '}
                    {formatMoney(summary.lifetimePaidMicros, cur)} paid
                  </span>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Spend accrues as an obligation.{' '}
                {summary.testMode
                  ? 'Every figure above marked “test” is simulated-provider activity — no real money moves, and it is kept separate from the live balance.'
                  : 'Payments run through the configured provider.'}{' '}
                Automatic threshold charging arrives in a later phase.
              </p>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={disabled || !summary.hasPaymentMethod}
                  onClick={() => {
                    setPayAmount(suggested);
                    setPayOpen(true);
                  }}
                >
                  {summary.hold ? 'Retry payment' : 'Make a payment'}
                </Button>
                {!summary.hasPaymentMethod && (
                  <span className="self-center text-xs text-muted-foreground">
                    Add a payment method first.
                  </span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Payment activity */}
      <Card className="bg-card shadow-card border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-[15px] font-bold">Payment activity</CardTitle>
        </CardHeader>
        <CardContent>
          {state === 'ready' && txns.length === 0 && (
            <p className="rounded-md border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
              No payments yet.
            </p>
          )}
          {txns.length > 0 && (
            <ul className="divide-y divide-border/60">
              {txns.map((t) => {
                const meta = TXN_STATUS_META[t.status] ?? { label: t.status, tone: 'muted' };
                const isRefund = t.txn_type === 'refund';
                return (
                  <li key={t.id} className="flex items-center gap-3 py-3">
                    <span className="shrink-0">
                      {t.status === 'succeeded' ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : t.status === 'failed' ? (
                        <XCircle className="h-4 w-4 text-destructive" />
                      ) : isRefund ? (
                        <RotateCcw className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {isRefund ? 'Refund' : 'Charge'} {formatMoney(t.amount_cents * 10_000, t.currency)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {fmtDT(t.occurred_at)}
                        {t.failure_reason ? ` · ${t.failure_reason}` : ''}
                        {t.refunded_amount_cents > 0
                          ? ` · refunded ${formatMoney(t.refunded_amount_cents * 10_000, t.currency)}`
                          : ''}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-medium ${TONE[meta.tone]}`}
                    >
                      {meta.label}
                    </span>
                    {t.status === 'requires_action' && !disabled && (
                      <span className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={busy === t.id}
                          onClick={() => doConfirm(t.id, true)}
                        >
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          disabled={busy === t.id}
                          onClick={() => doConfirm(t.id, false)}
                        >
                          Abandon
                        </Button>
                      </span>
                    )}
                    {isAdmin && t.status === 'succeeded' && t.txn_type === 'charge' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 shrink-0 px-2 text-xs"
                        disabled={busy === t.id}
                        onClick={() => doRefund(t.id)}
                      >
                        {busy === t.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          'Refund'
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

      {/* Ledger */}
      <Card className="bg-card shadow-card border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-[15px] font-bold">Billing ledger</CardTitle>
        </CardHeader>
        <CardContent>
          {state === 'ready' && ledger.length === 0 && (
            <p className="rounded-md border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
              No ledger entries yet.
            </p>
          )}
          {ledger.length > 0 && (
            <ul className="divide-y divide-border/60 text-sm">
              {ledger.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="font-medium text-foreground">
                      {LEDGER_LABEL[e.entry_type] ?? e.entry_type}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">{fmtDT(e.created_at)}</span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className={e.amount_micros < 0 ? 'text-success' : 'text-foreground'}>
                      {e.amount_micros < 0 ? '−' : '+'}
                      {formatMoney(Math.abs(e.amount_micros), e.currency)}
                    </span>
                    <span className="ml-2 block text-[11px] text-muted-foreground">
                      bal {formatMoney(Math.max(e.balance_after_micros, 0), e.currency)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={payOpen} onOpenChange={(o) => (busy ? null : setPayOpen(o))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Make a payment</DialogTitle>
            <DialogDescription>
              Simulated Provider · Test Mode — no real money moves.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Amount ({cur})</Label>
              <Input
                inputMode="decimal"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Simulated outcome</Label>
              <Select value={payOutcome} onValueChange={(v) => setPayOutcome(v as SimOutcome)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ok">Use the default card (succeeds)</SelectItem>
                  <SelectItem value="decline">Force a decline</SelectItem>
                  <SelectItem value="action">Force a confirmation step</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)} disabled={!!busy}>
              Cancel
            </Button>
            <Button onClick={doPay} disabled={busy === 'pay' || !payAmount}>
              {busy === 'pay' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Pay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
