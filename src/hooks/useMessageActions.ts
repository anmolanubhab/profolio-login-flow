import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ReactionRow {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

export interface PinRow {
  id: string;
  message_id: string;
  conversation_id: string;
  pinned_by: string;
  created_at: string;
}

interface State {
  reactions: ReactionRow[];
  starredIds: Set<string>;
  pins: PinRow[];
  deletedForMeIds: Set<string>;
}

const EMPTY: State = {
  reactions: [],
  starredIds: new Set(),
  pins: [],
  deletedForMeIds: new Set(),
};

/**
 * Loads reactions / stars / pins / per-user deletions for one conversation and
 * exposes optimistic mutations. Keeps its own realtime channel scoped to the
 * side tables so a reaction, pin or delete-for-me never triggers a full
 * message refetch.
 */
export function useMessageActions(conversationId: string | null, userId: string) {
  const [state, setState] = useState<State>(EMPTY);

  const load = useCallback(async () => {
    if (!conversationId) {
      setState(EMPTY);
      return;
    }
    // message ids in this conversation
    const { data: msgRows } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', conversationId);
    const ids = (msgRows ?? []).map((m) => m.id);
    if (ids.length === 0) {
      setState(EMPTY);
      return;
    }

    const [{ data: reactions }, { data: stars }, { data: pins }, { data: deletions }] =
      await Promise.all([
        supabase.from('message_reactions').select('id, message_id, user_id, emoji').in('message_id', ids),
        supabase.from('starred_messages').select('message_id').in('message_id', ids),
        supabase
          .from('pinned_messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false }),
        supabase.from('message_deletions').select('message_id').in('message_id', ids),
      ]);

    setState({
      reactions: (reactions ?? []) as ReactionRow[],
      starredIds: new Set((stars ?? []).map((s) => s.message_id)),
      pins: (pins ?? []) as PinRow[],
      deletedForMeIds: new Set((deletions ?? []).map((d) => d.message_id)),
    });
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: any change to the side tables -> reload (cheap: small queries).
  useEffect(() => {
    if (!conversationId) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const nudge = () => {
      if (t) clearTimeout(t);
      t = setTimeout(load, 250);
    };
    const ch = supabase
      .channel(`msg-actions-${conversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, nudge)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pinned_messages' }, nudge)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_deletions' }, nudge)
      .subscribe();
    return () => {
      if (t) clearTimeout(t);
      supabase.removeChannel(ch);
    };
  }, [conversationId, load]);

  // ---- reactions -----------------------------------------------------------
  const reactionsByMessage = useMemo(() => {
    const map = new Map<string, ReactionRow[]>();
    for (const r of state.reactions) {
      const arr = map.get(r.message_id);
      if (arr) arr.push(r);
      else map.set(r.message_id, [r]);
    }
    return map;
  }, [state.reactions]);

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const existing = state.reactions.find((r) => r.message_id === messageId && r.user_id === userId);
      // optimistic
      setState((s) => {
        const rest = s.reactions.filter((r) => !(r.message_id === messageId && r.user_id === userId));
        const next =
          existing && existing.emoji === emoji
            ? rest
            : [...rest, { id: existing?.id ?? `tmp-${messageId}`, message_id: messageId, user_id: userId, emoji }];
        return { ...s, reactions: next };
      });
      try {
        if (existing && existing.emoji === emoji) {
          await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', userId);
        } else {
          await supabase
            .from('message_reactions')
            .upsert({ message_id: messageId, user_id: userId, emoji }, { onConflict: 'message_id,user_id' });
        }
      } finally {
        load();
      }
    },
    [state.reactions, userId, load],
  );

  // ---- stars -------------------------------------------------------------
  const toggleStar = useCallback(
    async (messageId: string) => {
      const isStarred = state.starredIds.has(messageId);
      setState((s) => {
        const next = new Set(s.starredIds);
        if (isStarred) next.delete(messageId);
        else next.add(messageId);
        return { ...s, starredIds: next };
      });
      try {
        if (isStarred) {
          await supabase.from('starred_messages').delete().eq('message_id', messageId).eq('user_id', userId);
        } else {
          await supabase.from('starred_messages').insert({ message_id: messageId, user_id: userId });
        }
      } finally {
        load();
      }
    },
    [state.starredIds, userId, load],
  );

  /** Star many messages at once (bulk selection). Already-starred ids are skipped. */
  const bulkStar = useCallback(
    async (messageIds: string[]) => {
      const toAdd = messageIds.filter((id) => !state.starredIds.has(id));
      if (toAdd.length === 0) return;
      setState((s) => {
        const next = new Set(s.starredIds);
        toAdd.forEach((id) => next.add(id));
        return { ...s, starredIds: next };
      });
      try {
        await supabase
          .from('starred_messages')
          .insert(toAdd.map((id) => ({ message_id: id, user_id: userId })));
      } finally {
        load();
      }
    },
    [state.starredIds, userId, load],
  );

  // ---- pins ------------------------------------------------------------
  const togglePin = useCallback(
    async (messageId: string) => {
      if (!conversationId) return;
      const isPinned = state.pins.some((p) => p.message_id === messageId);
      try {
        if (isPinned) {
          await supabase.from('pinned_messages').delete().eq('conversation_id', conversationId).eq('message_id', messageId);
        } else {
          await supabase.from('pinned_messages').insert({
            conversation_id: conversationId,
            message_id: messageId,
            pinned_by: userId,
          });
        }
      } finally {
        load();
      }
    },
    [conversationId, state.pins, userId, load],
  );

  /** Pin / unpin many messages at once (bulk "More" menu). */
  const bulkPin = useCallback(
    async (messageIds: string[], pin: boolean) => {
      if (!conversationId) return;
      const pinnedNow = new Set(state.pins.map((p) => p.message_id));
      const targets = messageIds.filter((id) => (pin ? !pinnedNow.has(id) : pinnedNow.has(id)));
      if (targets.length === 0) return;
      try {
        if (pin) {
          await supabase.from('pinned_messages').insert(
            targets.map((id) => ({
              conversation_id: conversationId,
              message_id: id,
              pinned_by: userId,
            })),
          );
        } else {
          await supabase
            .from('pinned_messages')
            .delete()
            .eq('conversation_id', conversationId)
            .in('message_id', targets);
        }
      } finally {
        load();
      }
    },
    [conversationId, state.pins, userId, load],
  );

  // ---- delete for me ---------------------------------------------------
  /**
   * True per-user deletion: inserts a row per (message, user) into
   * message_deletions. The message row itself is never touched, so other
   * participants are unaffected and the hidden state persists across
   * refresh / logout / device.
   */
  const deleteForMe = useCallback(
    async (messageIds: string[]) => {
      const toAdd = messageIds.filter((id) => !state.deletedForMeIds.has(id));
      if (toAdd.length === 0) return;
      setState((s) => {
        const next = new Set(s.deletedForMeIds);
        toAdd.forEach((id) => next.add(id));
        return { ...s, deletedForMeIds: next };
      });
      try {
        await supabase
          .from('message_deletions')
          .upsert(
            toAdd.map((id) => ({ message_id: id, user_id: userId })),
            { onConflict: 'message_id,user_id', ignoreDuplicates: true },
          );
      } finally {
        load();
      }
    },
    [state.deletedForMeIds, userId, load],
  );

  return {
    reactionsByMessage,
    starredIds: state.starredIds,
    pins: state.pins,
    pinnedIds: useMemo(() => new Set(state.pins.map((p) => p.message_id)), [state.pins]),
    deletedForMeIds: state.deletedForMeIds,
    toggleReaction,
    toggleStar,
    bulkStar,
    togglePin,
    bulkPin,
    deleteForMe,
    reload: load,
  };
}
