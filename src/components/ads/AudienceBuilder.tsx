import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { CriteriaChipInput } from '@/components/ads/CriteriaChipInput';
import {
  MIN_AUDIENCE_SIZE,
  TARGETING_DIMENSIONS,
  audienceCriteriaCount,
  createAudience,
  previewAudienceReach,
  updateAudience,
  type AdAccount,
  type AdAudience,
  type AudienceSpec,
} from '@/lib/ads/api';

interface AudienceBuilderProps {
  adAccount: AdAccount;
  initial?: AdAudience;
  onSaved: (audience: AdAudience) => void;
  onCancel: () => void;
}

const NAME_MAX = 120;

function specFromAudience(a: AdAudience | undefined): AudienceSpec {
  if (!a || typeof a.spec !== 'object' || a.spec === null) return {};
  return a.spec as AudienceSpec;
}

export function AudienceBuilder({ adAccount, initial, onSaved, onCancel }: AudienceBuilderProps) {
  const { toast } = useToast();

  const [name, setName] = useState(initial?.name ?? '');
  const [spec, setSpec] = useState<AudienceSpec>(() => specFromAudience(initial));
  const [minYears, setMinYears] = useState(
    initial ? (specFromAudience(initial).min_years_experience?.toString() ?? '') : '',
  );
  const [saving, setSaving] = useState(false);

  // server-side reach preview
  const [reach, setReach] = useState<number | null>(null);
  const [reachLoading, setReachLoading] = useState(false);
  const [reachError, setReachError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const effectiveSpec = useMemo<AudienceSpec>(() => {
    const s: AudienceSpec = { v: 1 };
    for (const d of TARGETING_DIMENSIONS) {
      const vals = spec[d.key];
      if (vals && vals.length) s[d.key] = vals;
    }
    const y = Number.parseFloat(minYears);
    if (Number.isFinite(y) && y > 0) s.min_years_experience = y;
    return s;
  }, [spec, minYears]);

  const criteriaCount = audienceCriteriaCount(effectiveSpec);

  const runPreview = useCallback(
    (s: AudienceSpec) => {
      setReachLoading(true);
      setReachError(null);
      previewAudienceReach(adAccount.id, s)
        .then((n) => {
          setReach(n);
          setReachLoading(false);
        })
        .catch((e) => {
          setReachError(e instanceof Error ? e.message : 'Could not estimate audience size.');
          setReachLoading(false);
        });
    },
    [adAccount.id],
  );

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runPreview(effectiveSpec), 400);
    return () => clearTimeout(debounceRef.current);
  }, [effectiveSpec, runPreview]);

  const trimmedName = name.trim();
  const nameError =
    trimmedName.length < 2 || trimmedName.length > NAME_MAX ? `Use 2–${NAME_MAX} characters.` : null;
  const [submitted, setSubmitted] = useState(false);

  const setDimension = (key: (typeof TARGETING_DIMENSIONS)[number]['key'], vals: string[]) =>
    setSpec((prev) => ({ ...prev, [key]: vals }));

  const clearAll = () => {
    setSpec({});
    setMinYears('');
  };

  const handleSave = async () => {
    setSubmitted(true);
    if (nameError) {
      toast({ title: 'Add an audience name', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const saved = initial
        ? await updateAudience(initial.id, { name: trimmedName, spec: effectiveSpec })
        : await createAudience(adAccount.id, trimmedName, effectiveSpec);
      toast({ title: initial ? 'Audience saved' : 'Audience created' });
      onSaved(saved);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not save the audience.';
      toast({
        title: 'Save failed',
        description: /row-level security|not authorized/i.test(message)
          ? 'You’re not authorized to manage audiences in this ad account.'
          : message,
        variant: 'destructive',
      });
      setSaving(false);
    }
  };

  const meetsMin = reach != null && reach >= MIN_AUDIENCE_SIZE;

  return (
    <div className="space-y-4 pb-24">
      {/* Name */}
      <Card className="bg-card shadow-card border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-[15px] font-bold">Audience name</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <Label htmlFor="aud-name" className="sr-only">
            Audience name
          </Label>
          <Input
            id="aud-name"
            value={name}
            maxLength={NAME_MAX}
            placeholder="e.g. Senior engineers — India"
            onChange={(e) => setName(e.target.value)}
            aria-invalid={submitted && !!nameError}
          />
          {submitted && nameError && <p className="text-xs text-destructive">{nameError}</p>}
        </CardContent>
      </Card>

      {/* Live estimate */}
      <Card className={cn('border-0 shadow-card', meetsMin ? 'bg-success/5' : 'bg-card')}>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            {reachLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <Users className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              {reachError
                ? 'Estimate unavailable'
                : reach == null
                  ? 'Estimating…'
                  : reach === 0
                    ? `Fewer than ${MIN_AUDIENCE_SIZE.toLocaleString()} eligible members`
                    : `About ${reach.toLocaleString()}+ eligible members`}
            </p>
            <p className="text-xs text-muted-foreground">
              {reachError
                ? reachError
                : meetsMin
                  ? 'Meets the minimum — this audience can run ads. Sizes are rounded and computed on the server from public, discoverable profiles only.'
                  : reach === 0
                    ? `Broaden your targeting. Exact sizes below ${MIN_AUDIENCE_SIZE.toLocaleString()} aren’t shown, to protect members’ privacy.`
                    : `Needs at least ${MIN_AUDIENCE_SIZE.toLocaleString()} to attach to a campaign.`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Criteria */}
      <Card className="bg-card shadow-card border-0">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <div>
            <CardTitle className="text-[15px] font-bold">Targeting</CardTitle>
            <p className="text-xs text-muted-foreground">
              Every criterion you add must match (AND). Within one box, any value matches (OR).
            </p>
          </div>
          {criteriaCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear all
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {TARGETING_DIMENSIONS.map((d) => (
            <CriteriaChipInput
              key={d.key}
              label={d.label}
              help={d.help}
              placeholder={d.placeholder}
              values={spec[d.key] ?? []}
              onChange={(next) => setDimension(d.key, next)}
            />
          ))}

          <div className="space-y-1.5">
            <Label htmlFor="aud-minyears">Minimum years of experience</Label>
            <Input
              id="aud-minyears"
              inputMode="decimal"
              value={minYears}
              placeholder="Any"
              className="w-28"
              onChange={(e) => setMinYears(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Computed from the earliest role in a member&apos;s experience.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          You only ever see the total count above — never the individual people it represents.
          Members who are private or not discoverable are never included.
        </span>
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-[720px] items-center justify-between gap-3 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-4">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save audience
          </Button>
        </div>
      </div>
    </div>
  );
}
