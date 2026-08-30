import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { rateLimiter, RATE_LIMITS } from '@/lib/rate-limiter';
import { personName, type NetworkPerson } from '@/lib/network';
import {
  connectionErrorMessage,
  respondToConnectionRequest,
  sendConnectionRequest,
  withdrawConnectionRequest,
} from '@/lib/network/connectionApi';
import { ConnectNoteDialog } from './ConnectNoteDialog';

export type Relationship =
  | 'none'
  | 'pending_outgoing'
  | 'pending_incoming'
  | 'connected'
  | 'self';

interface ConnectButtonProps {
  person: NetworkPerson;
  myProfileId: string;
  relationship: Relationship;
  requestId?: string | null;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  /** Show the LinkedIn "Add a note?" step before sending (profile context). */
  promptNote?: boolean;
  /** Called after any successful mutation so parent lists can refresh counts. */
  onChanged?: (next: Relationship) => void;
}

export function ConnectButton({
  person,
  myProfileId,
  relationship,
  requestId,
  size = 'sm',
  className,
  promptNote = false,
  onChanged,
}: ConnectButtonProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [state, setState] = useState<Relationship>(relationship);
  const [reqId, setReqId] = useState<string | null>(requestId ?? null);
  const [busy, setBusy] = useState(false);
  const [errored, setErrored] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    setState(relationship);
    setReqId(requestId ?? null);
  }, [relationship, requestId]);

  const settle = (next: Relationship) => {
    setState(next);
    setErrored(false);
    queryClient.invalidateQueries({ queryKey: ['network-counts'] });
    queryClient.invalidateQueries({ queryKey: ['people-search'] });
    queryClient.invalidateQueries({ queryKey: ['network-invitations'] });
    queryClient.invalidateQueries({ queryKey: ['network-connections'] });
    onChanged?.(next);
  };

  const fail = (message: string) => {
    setErrored(true);
    toast({ title: 'Something went wrong', description: message, variant: 'destructive' });
  };

  const run = async (fn: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const doSend = (note: string | null) =>
    run(async () => {
      setNoteOpen(false);
      const rlKey = `friend_request_${myProfileId}`;
      if (rateLimiter.isRateLimited(rlKey, RATE_LIMITS.MESSAGE_SEND)) {
        const secs = Math.ceil(rateLimiter.getTimeUntilReset(rlKey) / 1000);
        fail(`Please wait ${secs}s before sending another invitation.`);
        return;
      }
      try {
        const result = await sendConnectionRequest(person.id, note);
        if (result === 'connected') {
          toast({ title: 'Connection added', description: `You are now connected with ${personName(person)}.` });
          settle('connected');
        } else {
          toast({ title: 'Invitation sent', description: `Invitation sent to ${personName(person)}.` });
          settle('pending_outgoing');
        }
      } catch (err) {
        fail(connectionErrorMessage(err));
      }
    });

  const startSend = () => {
    if (promptNote) setNoteOpen(true);
    else doSend(null);
  };

  const doWithdraw = () =>
    run(async () => {
      setWithdrawOpen(false);
      try {
        if (reqId) await withdrawConnectionRequest(reqId);
        setReqId(null);
        toast({ title: `Invitation to ${personName(person)} withdrawn` });
        settle('none');
      } catch (err) {
        fail(connectionErrorMessage(err));
      }
    });

  const doAccept = () =>
    run(async () => {
      if (!reqId) {
        fail('This invitation is no longer available.');
        return;
      }
      try {
        await respondToConnectionRequest(reqId, true);
        toast({ title: 'Connection added', description: `You are now connected with ${personName(person)}.` });
        settle('connected');
      } catch (err) {
        fail(connectionErrorMessage(err));
      }
    });

  if (state === 'self') return null;

  const noteDialog = (
    <ConnectNoteDialog
      open={noteOpen}
      onOpenChange={setNoteOpen}
      personName={personName(person)}
      onSend={doSend}
      sending={busy}
    />
  );

  const withdrawDialog = (
    <AlertDialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Withdraw invitation to {personName(person)}?</AlertDialogTitle>
          <AlertDialogDescription>
            They won't be notified. You can send a new invitation later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={doWithdraw}>Withdraw</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (busy) {
    return (
      <>
        <Button size={size} variant="outline" disabled className={className}>
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          Working…
        </Button>
        {noteDialog}
        {withdrawDialog}
      </>
    );
  }

  if (errored) {
    return (
      <>
        <Button
          size={size}
          variant="outline"
          className={className}
          onClick={() =>
            state === 'pending_outgoing'
              ? setWithdrawOpen(true)
              : state === 'pending_incoming'
                ? doAccept()
                : startSend()
          }
        >
          Try again
        </Button>
        {noteDialog}
        {withdrawDialog}
      </>
    );
  }

  if (state === 'connected') {
    return (
      <Button size={size} variant="secondary" disabled className={className}>
        <Check className="mr-1.5 h-4 w-4" />
        Connected
      </Button>
    );
  }

  if (state === 'pending_outgoing') {
    return (
      <>
        <Button
          size={size}
          variant="outline"
          className={className}
          onClick={() => setWithdrawOpen(true)}
          aria-label={`Withdraw invitation to ${personName(person)}`}
        >
          <Clock className="mr-1.5 h-4 w-4" />
          Pending
        </Button>
        {withdrawDialog}
      </>
    );
  }

  if (state === 'pending_incoming') {
    return (
      <Button
        size={size}
        className={className}
        onClick={doAccept}
        aria-label={`Accept invitation from ${personName(person)}`}
      >
        <Check className="mr-1.5 h-4 w-4" />
        Accept
      </Button>
    );
  }

  return (
    <>
      <Button
        size={size}
        className={className}
        onClick={startSend}
        aria-label={`Connect with ${personName(person)}`}
      >
        <UserPlus className="mr-1.5 h-4 w-4" />
        Connect
      </Button>
      {noteDialog}
    </>
  );
}
