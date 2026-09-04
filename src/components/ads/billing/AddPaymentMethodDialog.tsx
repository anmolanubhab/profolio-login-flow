import { useState } from 'react';
import { Loader2, ShieldCheck, FlaskConical } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { addPaymentMethod, type SimOutcome } from '@/lib/ads/payments';

const OUTCOMES: { value: SimOutcome; label: string; hint: string }[] = [
  { value: 'ok', label: 'Test card — succeeds', hint: 'Visa •••• 4242 — charges will succeed.' },
  { value: 'decline', label: 'Test card — declined', hint: 'Visa •••• 0002 — charges will be declined.' },
  { value: 'action', label: 'Test card — needs confirmation', hint: 'Visa •••• 3155 — charges pause for a confirmation step.' },
];

interface Props {
  adAccountId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdded: () => void;
}

export function AddPaymentMethodDialog({ adAccountId, open, onOpenChange, onAdded }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [outcome, setOutcome] = useState<SimOutcome>('ok');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await addPaymentMethod(adAccountId, { outcome, holderName: name.trim() || undefined });
      toast({ title: 'Payment method added' });
      setName('');
      setOutcome('ok');
      onOpenChange(false);
      onAdded();
    } catch (e) {
      toast({
        title: 'Could not add',
        description: e instanceof Error ? e.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const meta = OUTCOMES.find((o) => o.value === outcome)!;

  return (
    <Dialog open={open} onOpenChange={(o) => (!saving ? onOpenChange(o) : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Add a payment method
            <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              <FlaskConical className="h-3 w-3" />
              Test mode
            </span>
          </DialogTitle>
          <DialogDescription>
            The card is created by the simulated payment provider. Pick which test card to use.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            Simulated Provider &middot; Test Mode. No real card is entered or stored, no real money
            moves. Profolio keeps only a provider reference plus the card type, last 4 and expiry.
            This is <span className="font-medium text-foreground">not</span> Stripe.
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name on card</Label>
            <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Test card</Label>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as SimOutcome)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTCOMES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{meta.hint}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add method
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
