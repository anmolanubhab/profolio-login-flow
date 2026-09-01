import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Megaphone, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AD_ACCOUNT_CURRENCIES,
  AD_ACCOUNT_TIMEZONES,
  createAdAccount,
  getAuthorizedCompanies,
  type AdAccount,
  type AuthorizedCompany,
} from '@/lib/ads/api';

interface CreateAdAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (account: AdAccount) => void;
  /** Pre-select this company and hide the picker (used from a company context). */
  lockedCompanyId?: string;
}

const NAME_MAX = 80;

export function CreateAdAccountDialog({
  open,
  onOpenChange,
  onCreated,
  lockedCompanyId,
}: CreateAdAccountDialogProps) {
  const { toast } = useToast();

  const [companies, setCompanies] = useState<AuthorizedCompany[] | null>(null);
  const [companiesError, setCompaniesError] = useState<string | null>(null);

  const [companyId, setCompanyId] = useState('');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [timezone, setTimezone] = useState('UTC');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load the authorized company list once per open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCompanies(null);
    setCompaniesError(null);
    getAuthorizedCompanies()
      .then((list) => {
        if (cancelled) return;
        setCompanies(list);
        if (lockedCompanyId && list.some((c) => c.id === lockedCompanyId)) {
          setCompanyId(lockedCompanyId);
        } else if (list.length === 1) {
          setCompanyId(list[0].id);
        }
      })
      .catch((e) => {
        if (!cancelled) setCompaniesError(e instanceof Error ? e.message : 'Failed to load companies');
      });
    return () => {
      cancelled = true;
    };
  }, [open, lockedCompanyId]);

  // Reset the form each time the dialog is closed.
  useEffect(() => {
    if (open) return;
    setCompanyId('');
    setName('');
    setCurrency('USD');
    setTimezone('UTC');
    setAgreed(false);
    setSubmitting(false);
  }, [open]);

  const trimmedName = name.trim();
  const nameValid = trimmedName.length >= 2 && trimmedName.length <= NAME_MAX;
  const canSubmit = !!companyId && nameValid && !!currency && !!timezone && agreed && !submitting;

  const selectedCompany = useMemo(
    () => companies?.find((c) => c.id === companyId) ?? null,
    [companies, companyId],
  );

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const account = await createAdAccount({
        companyId,
        name: trimmedName,
        currency,
        timezone,
        agreementAccepted: agreed,
      });
      toast({ title: 'Ad account created', description: `“${account.name}” is ready.` });
      onCreated(account);
      onOpenChange(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not create the ad account.';
      toast({
        title: 'Create failed',
        description: /row-level security|not authorized/i.test(message)
          ? 'You’re not authorized to create an ad account for that company.'
          : message,
        variant: 'destructive',
      });
      setSubmitting(false);
    }
  };

  const noCompanies = companies !== null && companies.length === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => (!submitting ? onOpenChange(o) : null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Create an ad account
          </DialogTitle>
          <DialogDescription>
            An ad account is the billing and reporting container for one of your companies. You can
            create campaigns inside it in a later step.
          </DialogDescription>
        </DialogHeader>

        {companiesError ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{companiesError}</span>
          </div>
        ) : companies === null ? (
          <div className="space-y-4 py-1">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-2/3" />
          </div>
        ) : noCompanies ? (
          <div className="rounded-md border border-dashed p-6 text-center">
            <Building2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No eligible companies</p>
            <p className="mt-1 text-xs text-muted-foreground">
              You can only advertise for a company you own or are a team member of. Create or join a
              company first.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Company picker — authorized companies only */}
            <div className="space-y-1.5">
              <Label htmlFor="ad-company">Company</Label>
              {lockedCompanyId && selectedCompany ? (
                <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{selectedCompany.name}</span>
                </div>
              ) : (
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger id="ad-company">
                    <SelectValue placeholder="Choose a company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {c.name}
                          <span className="text-xs text-muted-foreground">
                            ({c.relation === 'owner' ? 'Owner' : 'Team member'})
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Account name */}
            <div className="space-y-1.5">
              <Label htmlFor="ad-name">Account name</Label>
              <Input
                id="ad-name"
                value={name}
                maxLength={NAME_MAX}
                placeholder="e.g. Acme — Global"
                onChange={(e) => setName(e.target.value)}
                aria-invalid={name.length > 0 && !nameValid}
              />
              <p className="text-xs text-muted-foreground">
                {name.length > 0 && !nameValid
                  ? `Use 2–${NAME_MAX} characters.`
                  : 'Shown in reporting and billing. You can rename it later.'}
              </p>
            </div>

            {/* Currency — locked after creation */}
            <div className="space-y-1.5">
              <Label htmlFor="ad-currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="ad-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AD_ACCOUNT_CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Permanent — currency can’t be changed once the account is created.
              </p>
            </div>

            {/* Reporting time zone */}
            <div className="space-y-1.5">
              <Label htmlFor="ad-timezone">Reporting time zone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="ad-timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AD_ACCOUNT_TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ads Agreement — checkbox and label are siblings (never nest a
                Radix checkbox inside its <label>: the forwarded click double
                -fires and cancels the toggle). */}
            <div className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox
                id="ad-agreement"
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                className="mt-0.5"
              />
              <Label
                htmlFor="ad-agreement"
                className="cursor-pointer text-sm font-normal leading-relaxed text-muted-foreground"
              >
                I have read and agree to the{' '}
                <span className="font-medium text-foreground">Profolio Ads Agreement</span>, and I’m
                authorized to enter into it on behalf of this company.
              </Label>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || noCompanies}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create ad account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
