import { useMemo, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import {
  BILLING_COUNTRIES,
  TAX_ID_BY_COUNTRY,
  upsertBillingProfile,
  type BillingProfile,
  type BillingProfileInput,
} from '@/lib/ads/billing';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function blank(p: BillingProfile | null): BillingProfileInput {
  return {
    legal_name: p?.legal_name ?? '',
    billing_email: p?.billing_email ?? '',
    billing_contact_name: p?.billing_contact_name ?? '',
    billing_country: p?.billing_country ?? '',
    address_line1: p?.address_line1 ?? '',
    address_line2: p?.address_line2 ?? '',
    city: p?.city ?? '',
    state_region: p?.state_region ?? '',
    postal_code: p?.postal_code ?? '',
    tax_id_type: p?.tax_id_type ?? '',
    tax_id_value: p?.tax_id_value ?? '',
  };
}

interface Props {
  adAccountId: string;
  currency: string;
  profile: BillingProfile | null;
  disabled?: boolean;
  onSaved: (p: BillingProfile) => void;
}

export function BillingProfileForm({ adAccountId, currency, profile, disabled, onSaved }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<BillingProfileInput>(() => blank(profile));
  const [saving, setSaving] = useState(false);

  const set = (k: keyof BillingProfileInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const tax = form.billing_country ? TAX_ID_BY_COUNTRY[form.billing_country] : undefined;

  const dirty = useMemo(() => {
    const base = blank(profile);
    return (Object.keys(base) as (keyof BillingProfileInput)[]).some(
      (k) => (form[k] ?? '') !== (base[k] ?? ''),
    );
  }, [form, profile]);

  const emailOk = !form.billing_email || EMAIL_RE.test(form.billing_email.trim());
  const requiredOk =
    !!form.legal_name?.trim() && !!form.billing_email?.trim() && !!form.billing_country?.trim();
  const canSave = dirty && emailOk && requiredOk && !disabled && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const clean: BillingProfileInput = { ...form };
      (Object.keys(clean) as (keyof BillingProfileInput)[]).forEach((k) => {
        const v = (clean[k] ?? '').toString().trim();
        clean[k] = v === '' ? null : v;
      });
      // keep tax_id_type aligned with the chosen country; drop it if no value
      clean.tax_id_type = clean.tax_id_value ? (tax?.type ?? clean.tax_id_type ?? 'other') : null;
      const saved = await upsertBillingProfile(adAccountId, clean);
      onSaved(saved);
      toast({ title: 'Billing details saved' });
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
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Legal / business name" required>
          <Input
            value={form.legal_name ?? ''}
            maxLength={200}
            disabled={disabled}
            onChange={(e) => set('legal_name', e.target.value)}
            placeholder="Acme Pvt Ltd"
          />
        </Field>
        <Field label="Billing contact name">
          <Input
            value={form.billing_contact_name ?? ''}
            maxLength={120}
            disabled={disabled}
            onChange={(e) => set('billing_contact_name', e.target.value)}
          />
        </Field>
        <Field label="Billing email" required invalid={!emailOk} hint={!emailOk ? 'Enter a valid email.' : undefined}>
          <Input
            type="email"
            value={form.billing_email ?? ''}
            maxLength={200}
            disabled={disabled}
            onChange={(e) => set('billing_email', e.target.value)}
            placeholder="billing@company.com"
          />
        </Field>
        <Field label="Billing country" required>
          <Select
            value={form.billing_country ?? ''}
            onValueChange={(v) => set('billing_country', v)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a country" />
            </SelectTrigger>
            <SelectContent>
              {BILLING_COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Billing currency">
        <div className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          {currency} — inherited from the ad account, can’t be changed
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Address line 1" className="sm:col-span-2">
          <Input
            value={form.address_line1 ?? ''}
            maxLength={200}
            disabled={disabled}
            onChange={(e) => set('address_line1', e.target.value)}
          />
        </Field>
        <Field label="Address line 2" className="sm:col-span-2">
          <Input
            value={form.address_line2 ?? ''}
            maxLength={200}
            disabled={disabled}
            onChange={(e) => set('address_line2', e.target.value)}
          />
        </Field>
        <Field label="City">
          <Input
            value={form.city ?? ''}
            maxLength={120}
            disabled={disabled}
            onChange={(e) => set('city', e.target.value)}
          />
        </Field>
        <Field label="State / region">
          <Input
            value={form.state_region ?? ''}
            maxLength={120}
            disabled={disabled}
            onChange={(e) => set('state_region', e.target.value)}
          />
        </Field>
        <Field label="Postal code">
          <Input
            value={form.postal_code ?? ''}
            maxLength={32}
            disabled={disabled}
            onChange={(e) => set('postal_code', e.target.value)}
          />
        </Field>
        {tax && (
          <Field label={tax.label}>
            <Input
              value={form.tax_id_value ?? ''}
              maxLength={64}
              disabled={disabled}
              onChange={(e) => set('tax_id_value', e.target.value)}
              placeholder="Optional"
            />
          </Field>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Fields marked <span className="text-destructive">*</span> are required before billing can
          be activated.
        </p>
        <Button onClick={submit} disabled={!canSave}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save details
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  invalid,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  invalid?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label className={invalid ? 'text-destructive' : undefined}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-destructive">{hint}</p>}
    </div>
  );
}
