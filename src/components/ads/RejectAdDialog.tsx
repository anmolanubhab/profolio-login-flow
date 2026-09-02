import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { REJECTION_REASON_MAX, REJECTION_REASON_MIN } from '@/lib/ads/api';

/**
 * Reject dialog — the reason is required and is shown verbatim to the
 * advertiser, so the copy nudges toward something actionable.
 */
export function RejectAdDialog({
  open,
  onOpenChange,
  onConfirm,
  submitting,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (reason: string) => void;
  submitting: boolean;
}) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  const tooShort = trimmed.length < REJECTION_REASON_MIN;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!submitting) {
          onOpenChange(o);
          if (!o) setReason('');
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject this ad?</AlertDialogTitle>
          <AlertDialogDescription>
            The advertiser sees this reason exactly as written. Be specific about what needs to
            change so they can fix and resubmit.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="reject-reason">Reason for rejection</Label>
          <Textarea
            id="reject-reason"
            value={reason}
            rows={4}
            maxLength={REJECTION_REASON_MAX}
            placeholder="e.g. The headline overstates results — please soften the claim, or add a source."
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{tooShort ? `At least ${REJECTION_REASON_MIN} characters.` : ' '}</span>
            <span>
              {trimmed.length}/{REJECTION_REASON_MAX}
            </span>
          </div>
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={tooShort || submitting}
            onClick={() => onConfirm(trimmed)}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reject ad
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
