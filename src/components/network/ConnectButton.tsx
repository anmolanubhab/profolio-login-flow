import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { rateLimiter, RATE_LIMITS } from '@/lib/rate-limiter';
import { personName, type NetworkPerson } from '@/lib/network';

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
  onChanged,
}: ConnectButtonProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [state, setState] = useState<Relationship>(relationship);
  const [reqId, setReqId] = useState<string | null>(requestId ?? null);
  const [busy, setBusy] = useState(false);
  const [errored, setErrored] = useState(false);
  const inFlight = useRef(false);

  // Keep in sync if the parent query refetches with a new relationship.
  useEffect(() => {
    setState(relationship);
    setReqId(requestId ?? null);
  }, [relationship, requestId]);

  const settle = (next: Relationship) => {
    setState(next);
    setErrored(false);
    queryClient.invalidateQueries({ queryKey: ['network-counts'] });
    onChanged?.(next);
  };

  const fail = (message: string) => {
    setErrored(true);
    toast({ title: "Something went wrong", description: message, variant: 'destructive' });
  };

  const run = async (fn: () => Promise<void>) => {
    if (inFlight.current) return; // prevent duplicate requests
    inFlight.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const sendRequest = () =>
    run(async () => {
      const rlKey = `friend_request_${myProfileId}`;
      if (rateLimiter.isRateLimited(rlKey, RATE_LIMITS.MESSAGE_SEND)) {
        const secs = Math.ceil(rateLimiter.getTimeUntilReset(rlKey) / 1000);
        fail(`Please wait ${secs}s before sending another request.`);
        return;
      }
      try {
        // Plain insert — the sender may INSERT/DELETE their own request rows but
        // not UPDATE them (that policy is receiver-only), so upsert can't be used.
        let { data, error } = await supabase
          .from('friend_requests')
          .insert({ sender_id: myProfileId, receiver_id: person.id, status: 'pending' })
          .select('id')
          .single();

        // A stale row from a previous invite in either state — clear it and retry.
        if (error?.code === '23505') {
          await supabase
            .from('friend_requests')
            .delete()
            .eq('sender_id', myProfileId)
            .eq('receiver_id', person.id);
          ({ data, error } = await supabase
            .from('friend_requests')
            .insert({ sender_id: myProfileId, receiver_id: person.id, status: 'pending' })
            .select('id')
            .single());
        }
        if (error) throw error;

        setReqId(data!.id);
        await supabase.from('notifications').insert({
          user_id: person.id,
          type: 'friend_request',
          payload: { sender_id: myProfileId },
        });

        toast({ title: 'Invitation sent', description: `Invitation sent to ${personName(person)}.` });
        settle('pending_outgoing');
      } catch (err: any) {
        fail(err.message ?? 'Please try again.');
      }
    });

  const withdrawRequest = () =>
    run(async () => {
      try {
        const query = supabase.from('friend_requests').delete();
        const { error } = reqId
          ? await query.eq('id', reqId)
          : await query.eq('sender_id', myProfileId).eq('receiver_id', person.id);
        if (error) throw error;
        setReqId(null);
        toast({ title: 'Invitation withdrawn' });
        settle('none');
      } catch (err: any) {
        fail(err.message ?? 'Please try again.');
      }
    });

  const acceptRequest = () =>
    run(async () => {
      try {
        const upd = supabase.from('friend_requests').update({ status: 'accepted' });
        const { error: updErr } = reqId
          ? await upd.eq('id', reqId)
          : await upd.eq('sender_id', person.id).eq('receiver_id', myProfileId);
        if (updErr) throw updErr;

        const { error: connErr } = await supabase.from('connections').insert({
          user_id: myProfileId,
          connection_id: person.id,
          status: 'accepted',
        });
        if (connErr && connErr.code !== '23505') throw connErr;

        await supabase.from('notifications').insert({
          user_id: person.id,
          type: 'connection_accepted',
          payload: { connection_id: myProfileId },
        });

        toast({ title: 'Connection added', description: `You are now connected with ${personName(person)}.` });
        queryClient.invalidateQueries({ queryKey: ['network-invitations'] });
        queryClient.invalidateQueries({ queryKey: ['network-connections'] });
        settle('connected');
      } catch (err: any) {
        fail(err.message ?? 'Please try again.');
      }
    });

  if (state === 'self') return null;

  if (busy) {
    return (
      <Button size={size} variant="outline" disabled className={className}>
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        Working…
      </Button>
    );
  }

  if (errored) {
    return (
      <Button
        size={size}
        variant="outline"
        className={className}
        onClick={() =>
          state === 'pending_outgoing'
            ? withdrawRequest()
            : state === 'pending_incoming'
              ? acceptRequest()
              : sendRequest()
        }
      >
        Try again
      </Button>
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
      <Button
        size={size}
        variant="outline"
        className={className}
        onClick={withdrawRequest}
        aria-label={`Withdraw invitation to ${personName(person)}`}
      >
        <Clock className="mr-1.5 h-4 w-4" />
        Pending
      </Button>
    );
  }

  if (state === 'pending_incoming') {
    return (
      <Button
        size={size}
        className={className}
        onClick={acceptRequest}
        aria-label={`Accept invitation from ${personName(person)}`}
      >
        <Check className="mr-1.5 h-4 w-4" />
        Accept
      </Button>
    );
  }

  return (
    <Button
      size={size}
      className={className}
      onClick={sendRequest}
      aria-label={`Connect with ${personName(person)}`}
    >
      <UserPlus className="mr-1.5 h-4 w-4" />
      Connect
    </Button>
  );
}
