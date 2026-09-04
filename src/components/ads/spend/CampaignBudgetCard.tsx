import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2, Wallet, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { amountToCents, centsToAmount, getOrCreateCampaignAdSet, type AdSet } from '@/lib/ads/api';
import {
  BID_STRATEGY_META,
  PACING_STATE_META,
  formatMoney,
  getCampaignBudgetStatus,
  updateAdSetBidding,
  updateCampaignBudget,
  validateCampaignBudget,
  type BidStrategy,
  type CampaignBudgetStatus,
} from '@/lib/ads/spend';

const TONE_CLASS: Record<string, string> = {
  muted: 'text-muted-foreground',
  warning: 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400',
  success: 'bg-success/15 text-success border-success/30',
  destructive: 'bg-destructive/15 text-destructive border-destructive/30',
};

interface Props {
  campaignId: string;
  currency: string;
  dailyBudgetCents: number | null;
  totalBudgetCents: number;
  canManage: boolean;
  onBudgetChange?: () => void;
}

export function CampaignBudgetCard({
  campaignId,
  currency,
  dailyBudgetCents,
  totalBudgetCents,
  canManage,
  onBudgetChange,
}: Props) {
  const { toast } = useToast();
  const [status, setStatus] = useState<CampaignBudgetStatus | null>(null);
  const [adSet, setAdSet] = useState<AdSet | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // edit form
  const [daily, setDaily] = useState('');
  const [total, setTotal] = useState('');
  const [strategy, setStrategy] = useState<BidStrategy>('auto');
  const [bidAmount, setBidAmount] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const [st, set, val] = await Promise.all([
        getCampaignBudgetStatus(campaignId),
        getOrCreateCampaignAdSet(campaignId),
        validateCampaignBudget(campaignId),
      ]);
      setStatus(st);
      setAdSet(set);
      setIssues(val.issues);
      setDaily(centsToAmount(dailyBudgetCents));
      setTotal(centsToAmount(totalBudgetCents));
      setStrategy(set.bid_strategy);
      setBidAmount(centsToAmount(set.bid_amount_cents));
      setState('ready');
    } catch {
      setState('error');
    }
  }, [campaignId, dailyBudgetCents, totalBudgetCents]);

  useEffect(() => {
    load();
  }, [load]);

  const meta = BID_STRATEGY_META[strategy];
  const needsAmount = meta.needsAmount;
  const amountInvalid = needsAmount && amountToCents(bidAmount) <= 0;
  const noBudget = !daily.trim() && !total.trim();

  const save = async () => {
    if (!adSet || amountInvalid || noBudget) return;
    setSaving(true);
    try {
      await updateCampaignBudget(campaignId, {
        daily_budget_cents: daily.trim() ? amountToCents(daily) : null,
        total_budget_cents: total.trim() ? amountToCents(total) : 0,
      });
      await updateAdSetBidding(adSet.id, {
        bid_strategy: strategy,
        bid_amount_cents: needsAmount ? amountToCents(bidAmount) : null,
      });
      toast({ title: 'Budget & bidding updated' });
      setEditing(false);
      onBudgetChange?.();
      load();
    } catch (e) {
      toast({
        title: 'Could not save',
        description: e instanceof Error ? e.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-card shadow-card border-0">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-[15px] font-bold">
          <Wallet className="h-4 w-4 text-primary" />
          Budget &amp; spend
        </CardTitle>
        {state === 'ready' && status && (
          <Badge variant="outline" className={TONE_CLASS[PACING_STATE_META[status.pacingState].tone]}>
            {PACING_STATE_META[status.pacingState].label}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {state === 'loading' && <Skeleton className="h-32 w-full rounded-md" />}
        {state === 'error' && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Couldn’t load budget.
            </span>
            <Button size="sm" variant="outline" onClick={load}>
              Retry
            </Button>
          </div>
        )}

        {state === 'ready' && status && !editing && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric
                label="Daily budget"
                value={
                  status.dailyBudgetMicros == null
                    ? 'None'
                    : formatMoney(status.dailyBudgetMicros, status.currency)
                }
              />
              <Metric
                label="Total budget"
                value={
                  status.totalBudgetMicros == null
                    ? 'None'
                    : formatMoney(status.totalBudgetMicros, status.currency)
                }
              />
              <Metric label="Spent today" value={formatMoney(status.spendTodayMicros, status.currency)} />
              <Metric label="Spent total" value={formatMoney(status.spendTotalMicros, status.currency)} />
            </div>

            {(status.dailyRemainingMicros != null || status.totalRemainingMicros != null) && (
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                {status.dailyRemainingMicros != null && (
                  <span>
                    Remaining today:{' '}
                    <span className="font-medium text-foreground">
                      {formatMoney(status.dailyRemainingMicros, status.currency)}
                    </span>
                  </span>
                )}
                {status.totalRemainingMicros != null && (
                  <span>
                    Remaining total:{' '}
                    <span className="font-medium text-foreground">
                      {formatMoney(status.totalRemainingMicros, status.currency)}
                    </span>
                  </span>
                )}
              </div>
            )}

            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {adSet ? BID_STRATEGY_META[adSet.bid_strategy].label : 'Automatic'}
              </span>
              {adSet?.bid_amount_cents ? ` · ${formatMoney(
                adSet.bid_amount_cents * 10_000,
                status.currency,
              )}` : ''}
              {' — '}
              {adSet ? BID_STRATEGY_META[adSet.bid_strategy].charge : ''}. Internal spend only; no
              payment is taken (a later phase adds real billing).
            </div>

            {issues.length > 0 && (
              <ul className="space-y-1 text-xs text-amber-600 dark:text-amber-400">
                {issues.map((i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {i}
                  </li>
                ))}
              </ul>
            )}

            {canManage && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit budget &amp; bidding
              </Button>
            )}
          </>
        )}

        {state === 'ready' && editing && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Daily budget ({currency})</Label>
                <Input
                  inputMode="decimal"
                  value={daily}
                  onChange={(e) => setDaily(e.target.value)}
                  placeholder="e.g. 20"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Total budget ({currency})</Label>
                <Input
                  inputMode="decimal"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Bidding</Label>
              <Select value={strategy} onValueChange={(v) => setStrategy(v as BidStrategy)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(BID_STRATEGY_META) as BidStrategy[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {BID_STRATEGY_META[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{meta.hint}</p>
            </div>

            {needsAmount && (
              <div className="space-y-1.5">
                <Label>
                  Bid amount ({currency}
                  {strategy === 'max_cpm' ? ' per 1,000 impressions' : ' per click'})
                </Label>
                <Input
                  inputMode="decimal"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  aria-invalid={amountInvalid}
                />
                {amountInvalid && (
                  <p className="text-xs text-destructive">Enter a bid amount greater than 0.</p>
                )}
              </div>
            )}

            {noBudget && (
              <p className="text-xs text-destructive">
                Set a daily budget, a total budget, or both.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  load();
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={saving || amountInvalid || noBudget}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
