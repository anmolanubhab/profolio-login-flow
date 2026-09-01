import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_OBJECTIVE_GROUP_ORDER,
  amountToCents,
  centsToAmount,
  createCampaignDraft,
  updateCampaignDraft,
  type AdAccount,
  type Campaign,
  type CampaignObjective,
} from '@/lib/ads/api';

interface CampaignFormProps {
  adAccount: AdAccount;
  /** Present in edit mode. Must be a `draft` campaign. */
  initial?: Campaign;
  onSaved: (campaign: Campaign) => void;
  onCancel: () => void;
}

const NAME_MIN = 2;
const NAME_MAX = 120;

function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function CampaignForm({ adAccount, initial, onSaved, onCancel }: CampaignFormProps) {
  const { toast } = useToast();

  const [name, setName] = useState(initial?.name ?? '');
  const [objective, setObjective] = useState<CampaignObjective | ''>(initial?.objective ?? '');
  const [totalBudget, setTotalBudget] = useState(centsToAmount(initial?.total_budget_cents));
  const [dailyBudget, setDailyBudget] = useState(centsToAmount(initial?.daily_budget_cents));
  const [startAt, setStartAt] = useState(isoToLocalInput(initial?.start_at));
  const [hasEndDate, setHasEndDate] = useState(!!initial?.end_at);
  const [endAt, setEndAt] = useState(isoToLocalInput(initial?.end_at));
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const trimmedName = name.trim();
  const nameError =
    trimmedName.length === 0
      ? 'Enter a campaign name.'
      : trimmedName.length < NAME_MIN || trimmedName.length > NAME_MAX
        ? `Use ${NAME_MIN}–${NAME_MAX} characters.`
        : null;
  const objectiveError = objective === '' ? 'Choose an objective.' : null;

  const totalCents = amountToCents(totalBudget);
  const dailyCents = amountToCents(dailyBudget);
  const budgetError =
    (totalBudget.trim() !== '' && totalCents === 0) || (dailyBudget.trim() !== '' && dailyCents === 0)
      ? 'Enter a budget greater than 0.'
      : null;

  const startIso = localInputToIso(startAt);
  const endIso = hasEndDate ? localInputToIso(endAt) : null;
  const scheduleError =
    hasEndDate && startIso && endIso && new Date(endIso) <= new Date(startIso)
      ? 'The end date must be after the start date.'
      : hasEndDate && !endAt
        ? 'Add an end date or turn off “Set an end date”.'
        : null;

  // Draft only strictly needs a name + objective (both NOT NULL in the schema);
  // budget/schedule are validated for integrity but optional until submit.
  // The Save button stays enabled so an invalid attempt surfaces the inline
  // errors (rather than a silently-disabled button); `handleSave` gates.
  const blockingError = nameError || objectiveError || budgetError || scheduleError;

  const objectivesByGroup = useMemo(
    () =>
      CAMPAIGN_OBJECTIVE_GROUP_ORDER.map((group) => ({
        group,
        items: CAMPAIGN_OBJECTIVES.filter((o) => o.group === group),
      })),
    [],
  );

  const handleSave = async () => {
    setSubmitted(true);
    if (blockingError || objective === '') {
      toast({ title: 'Check the highlighted fields', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: trimmedName,
        objective,
        totalBudgetCents: totalCents,
        dailyBudgetCents: dailyCents > 0 ? dailyCents : null,
        startAt: startIso,
        endAt: endIso,
      };
      const campaign = initial
        ? await updateCampaignDraft(initial.id, payload)
        : await createCampaignDraft({ adAccountId: adAccount.id, ...payload });
      toast({ title: initial ? 'Draft saved' : 'Campaign draft created' });
      onSaved(campaign);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not save the campaign.';
      toast({
        title: 'Save failed',
        description: /row-level security|not authorized/i.test(message)
          ? 'You’re not authorized to manage campaigns in this ad account.'
          : message,
        variant: 'destructive',
      });
      setSaving(false);
    }
  };

  const showError = (err: string | null) => submitted && err;

  return (
    <div className="space-y-4 pb-24">
      {/* Campaign name */}
      <Card className="bg-card shadow-card border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-[15px] font-bold">Campaign name</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <Label htmlFor="c-name" className="sr-only">
            Campaign name
          </Label>
          <Input
            id="c-name"
            value={name}
            maxLength={NAME_MAX}
            placeholder="e.g. Q3 Brand push — India"
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!showError(nameError)}
          />
          <p className={cn('text-xs', showError(nameError) ? 'text-destructive' : 'text-muted-foreground')}>
            {showError(nameError) || 'Shown in your campaign list and reporting. You can change it later.'}
          </p>
        </CardContent>
      </Card>

      {/* Objective */}
      <Card className="bg-card shadow-card border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-[15px] font-bold">Objective</CardTitle>
          <p className="text-xs text-muted-foreground">
            What do you want this campaign to achieve? This can’t change after the campaign leaves
            draft.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {objectivesByGroup.map(({ group, items }) => (
            <div key={group} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {items.map((o) => {
                  const selected = objective === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setObjective(o.value)}
                      aria-pressed={selected}
                      className={cn(
                        'rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        selected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'hover:bg-muted/50',
                      )}
                    >
                      <span className="block text-sm font-medium text-foreground">{o.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {o.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {showError(objectiveError) && (
            <p className="text-xs text-destructive">{objectiveError}</p>
          )}
        </CardContent>
      </Card>

      {/* Budget */}
      <Card className="bg-card shadow-card border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-[15px] font-bold">Budget</CardTitle>
          <p className="text-xs text-muted-foreground">
            Set a daily budget, a total budget, or both. Amounts are in {adAccount.currency}. Required
            before you submit for review.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="c-daily">Daily budget</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{adAccount.currency}</span>
              <Input
                id="c-daily"
                inputMode="decimal"
                value={dailyBudget}
                placeholder="0.00"
                onChange={(e) => setDailyBudget(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-total">Total budget</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{adAccount.currency}</span>
              <Input
                id="c-total"
                inputMode="decimal"
                value={totalBudget}
                placeholder="0.00"
                onChange={(e) => setTotalBudget(e.target.value)}
              />
            </div>
          </div>
          {showError(budgetError) && (
            <p className="text-xs text-destructive sm:col-span-2">{budgetError}</p>
          )}
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card className="bg-card shadow-card border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-[15px] font-bold">Schedule</CardTitle>
          <p className="text-xs text-muted-foreground">
            Times use this ad account’s reporting time zone ({adAccount.timezone.replace(/_/g, ' ')}).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-start">Start date &amp; time</Label>
            <Input
              id="c-start"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="w-full sm:w-auto"
            />
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="c-hasend"
              checked={hasEndDate}
              onCheckedChange={(v) => setHasEndDate(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="c-hasend" className="cursor-pointer text-sm font-normal">
              Set an end date
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                Leave off to run continuously from the start date.
              </span>
            </Label>
          </div>

          {hasEndDate && (
            <div className="space-y-1.5">
              <Label htmlFor="c-end">End date &amp; time</Label>
              <Input
                id="c-end"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full sm:w-auto"
              />
            </div>
          )}

          {showError(scheduleError) && (
            <p className="text-xs text-destructive">{scheduleError}</p>
          )}
        </CardContent>
      </Card>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-[720px] items-center justify-between gap-3 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-4">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save draft
          </Button>
        </div>
      </div>
    </div>
  );
}
