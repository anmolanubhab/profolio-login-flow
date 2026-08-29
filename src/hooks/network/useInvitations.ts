import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCurrentProfileId } from './useCurrentProfileId';
import {
  PERSON_FIELDS,
  maskName,
  personName,
  type NetworkPerson,
  type ReceivedInvitation,
  type SentInvitation,
} from '@/lib/network';

interface InvitationsData {
  received: ReceivedInvitation[];
  sent: SentInvitation[];
}

const EMPTY: InvitationsData = { received: [], sent: [] };

function mapPerson(row: any): NetworkPerson {
  return {
    id: row.id,
    user_id: row.user_id,
    // Invitation is still pending, so the viewer is not yet a connection.
    display_name: maskName(row.display_name, row.last_name_visibility, false),
    full_name: row.full_name ?? null,
    headline: row.headline ?? null,
    profession: row.profession ?? null,
    location: row.location ?? null,
    avatar_url: row.avatar_url ?? null,
  };
}

export function useInvitations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: myProfileId } = useCurrentProfileId();
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const queryKey = useMemo(() => ['network-invitations', myProfileId] as const, [myProfileId]);

  const query = useQuery({
    queryKey,
    enabled: !!myProfileId,
    staleTime: 15 * 1000,
    queryFn: async (): Promise<InvitationsData> => {
      const [receivedRes, sentRes] = await Promise.all([
        supabase
          .from('friend_requests')
          .select(`id, created_at, sender:profiles!friend_requests_sender_id_fkey(${PERSON_FIELDS})`)
          .eq('receiver_id', myProfileId!)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('friend_requests')
          .select(`id, created_at, receiver:profiles!friend_requests_receiver_id_fkey(${PERSON_FIELDS})`)
          .eq('sender_id', myProfileId!)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
      ]);

      if (receivedRes.error) throw receivedRes.error;
      if (sentRes.error) throw sentRes.error;

      return {
        received: (receivedRes.data ?? [])
          .filter((r: any) => r.sender)
          .map((r: any) => ({ id: r.id, created_at: r.created_at, person: mapPerson(r.sender) })),
        sent: (sentRes.data ?? [])
          .filter((r: any) => r.receiver)
          .map((r: any) => ({ id: r.id, created_at: r.created_at, person: mapPerson(r.receiver) })),
      };
    },
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ['network-counts'] });
    queryClient.invalidateQueries({ queryKey: ['network-connections'] });
  }, [queryClient, queryKey]);

  /** Optimistically drop a row from a list, returning a rollback function. */
  const optimisticRemove = useCallback(
    (list: 'received' | 'sent', id: string) => {
      const previous = queryClient.getQueryData<InvitationsData>(queryKey);
      queryClient.setQueryData<InvitationsData>(queryKey, (curr) => {
        const base = curr ?? EMPTY;
        return { ...base, [list]: base[list].filter((row) => row.id !== id) };
      });
      return () => queryClient.setQueryData(queryKey, previous);
    },
    [queryClient, queryKey],
  );

  const withBusy = useCallback(
    async (id: string, fn: () => Promise<void>) => {
      if (busyIds.has(id)) return; // prevent double submit
      setBusyIds((s) => new Set(s).add(id));
      try {
        await fn();
      } finally {
        setBusyIds((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }
    },
    [busyIds],
  );

  const accept = useCallback(
    (invitation: ReceivedInvitation) =>
      withBusy(invitation.id, async () => {
        const rollback = optimisticRemove('received', invitation.id);
        try {
          const { error: updateError } = await supabase
            .from('friend_requests')
            .update({ status: 'accepted' })
            .eq('id', invitation.id);
          if (updateError) throw updateError;

          const { error: connError } = await supabase.from('connections').insert({
            user_id: myProfileId!,
            connection_id: invitation.person.id,
            status: 'accepted',
          });
          // 23505 = already connected (either direction) — that's fine.
          if (connError && connError.code !== '23505') throw connError;

          await supabase.from('notifications').insert({
            user_id: invitation.person.id,
            type: 'connection_accepted',
            payload: { connection_id: myProfileId },
          });

          toast({
            title: 'Connection added',
            description: `You are now connected with ${personName(invitation.person)}.`,
          });
          refresh();
        } catch (err: any) {
          rollback();
          toast({
            title: "Couldn't accept invitation",
            description: err.message ?? 'Please try again.',
            variant: 'destructive',
          });
        }
      }),
    [withBusy, optimisticRemove, myProfileId, toast, refresh],
  );

  const decline = useCallback(
    (invitation: ReceivedInvitation) =>
      withBusy(invitation.id, async () => {
        const rollback = optimisticRemove('received', invitation.id);
        try {
          // Receiver-only UPDATE policy allows marking the request 'rejected'.
          const { error } = await supabase
            .from('friend_requests')
            .update({ status: 'rejected' })
            .eq('id', invitation.id);
          if (error) throw error;
          toast({ title: 'Invitation ignored' });
          refresh();
        } catch (err: any) {
          rollback();
          toast({
            title: "Couldn't ignore invitation",
            description: err.message ?? 'Please try again.',
            variant: 'destructive',
          });
        }
      }),
    [withBusy, optimisticRemove, toast, refresh],
  );

  const withdraw = useCallback(
    (invitation: SentInvitation) =>
      withBusy(invitation.id, async () => {
        const rollback = optimisticRemove('sent', invitation.id);
        try {
          const { error } = await supabase
            .from('friend_requests')
            .delete()
            .eq('id', invitation.id);
          if (error) throw error;
          toast({ title: 'Invitation withdrawn' });
          refresh();
        } catch (err: any) {
          rollback();
          toast({
            title: "Couldn't withdraw invitation",
            description: err.message ?? 'Please try again.',
            variant: 'destructive',
          });
        }
      }),
    [withBusy, optimisticRemove, toast, refresh],
  );

  const data = query.data ?? EMPTY;

  return {
    received: data.received,
    sent: data.sent,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
    isBusy: (id: string) => busyIds.has(id),
    accept,
    decline,
    withdraw,
  };
}
