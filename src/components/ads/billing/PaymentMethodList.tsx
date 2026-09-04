import { useState } from 'react';
import { CreditCard, Loader2, MoreVertical, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  removePaymentMethod,
  setDefaultPaymentMethod,
  type PaymentMethod,
} from '@/lib/ads/billing';

interface Props {
  methods: PaymentMethod[];
  disabled?: boolean;
  onChanged: () => void;
}

export function PaymentMethodList({ methods, disabled, onChanged }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<PaymentMethod | null>(null);

  const makeDefault = async (m: PaymentMethod) => {
    setBusy(m.id);
    try {
      await setDefaultPaymentMethod(m.id);
      toast({ title: 'Default payment method updated' });
      onChanged();
    } catch (e) {
      toast({
        title: 'Could not update',
        description: e instanceof Error ? e.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!confirmRemove) return;
    setBusy(confirmRemove.id);
    try {
      await removePaymentMethod(confirmRemove.id);
      toast({ title: 'Payment method removed' });
      setConfirmRemove(null);
      onChanged();
    } catch (e) {
      toast({
        title: 'Could not remove',
        description: e instanceof Error ? e.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  if (methods.length === 0) {
    return (
      <p className="rounded-md border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
        No payment methods yet.
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y divide-border/60 rounded-md border">
        {methods.map((m) => (
          <li key={m.id} className="flex items-center gap-3 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <span className="capitalize">{m.display_brand || m.method_type}</span>
                {m.display_last4 && <span className="text-muted-foreground">•••• {m.display_last4}</span>}
                {m.is_default && (
                  <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                    <Star className="h-3 w-3" />
                    Default
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {m.billing_name ? `${m.billing_name} · ` : ''}
                {m.exp_month && m.exp_year
                  ? `Expires ${String(m.exp_month).padStart(2, '0')}/${m.exp_year}`
                  : 'No expiry on file'}
              </p>
            </div>
            {!disabled && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy === m.id}>
                    {busy === m.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MoreVertical className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!m.is_default && (
                    <DropdownMenuItem onClick={() => makeDefault(m)}>
                      Set as default
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setConfirmRemove(m)}
                  >
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </li>
        ))}
      </ul>

      <AlertDialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this payment method?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRemove?.is_default && methods.length > 1
                ? 'It’s the default. The most recently added remaining method will become the default.'
                : 'You can add it again later.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                remove();
              }}
              disabled={!!busy}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
