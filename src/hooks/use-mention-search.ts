import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentProfileId } from '@/hooks/network/useCurrentProfileId';

export interface MentionResult {
  id: string;
  name: string;
  avatar: string | null;
  subtitle: string | null;
}

const DEBOUNCE_MS = 250;
const MAX_RESULTS = 6;

function mentionsFromOf(preferences: unknown): 'everyone' | 'connections' | 'nobody' {
  const v = (preferences as Record<string, unknown> | null)?.mentions_from;
  return v === 'connections' || v === 'nobody' ? v : 'everyone';
}

/**
 * Debounced people search for @mention autocomplete. `query === null` means the
 * autocomplete is not active (no request, results cleared). Only searches
 * discoverable profiles by display name, capped at MAX_RESULTS -- never a
 * full-table scan, one query per settled keystroke.
 *
 * Respects each person's "Mentions & tags" setting
 * (Settings -> Visibility -> profiles.preferences.mentions_from): a person who
 * only allows mentions from connections (or from no one) is dropped from the
 * suggestions for a searcher who isn't allowed -- so the mention token, and
 * therefore the `comment_mention` notification the DB trigger would send, is
 * never created.
 */
export function useMentionSearch() {
  const [query, setQuery] = useState<string | null>(null);
  const [results, setResults] = useState<MentionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);
  const { data: myProfileId } = useCurrentProfileId();

  useEffect(() => {
    if (query === null) {
      setResults([]);
      setLoading(false);
      return;
    }
    const q = query.trim();
    if (q.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const mine = ++reqId.current;
    const timer = setTimeout(async () => {
      const pattern = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`;
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, profession, preferences')
        .eq('profile_discovery', true)
        .ilike('display_name', pattern)
        .order('display_name', { ascending: true })
        .limit(MAX_RESULTS);

      if (mine !== reqId.current) return; // a newer keystroke won

      const rows = data ?? [];

      // Split by mention permission.
      const allowed: typeof rows = [];
      const needConnection: typeof rows = [];
      for (const p of rows) {
        if (p.id === myProfileId) {
          allowed.push(p);
          continue;
        }
        const pref = mentionsFromOf(p.preferences);
        if (pref === 'nobody') continue;
        if (pref === 'connections') needConnection.push(p);
        else allowed.push(p);
      }

      // Resolve which of the connection-gated people the searcher is connected to.
      if (needConnection.length > 0 && myProfileId) {
        const ids = needConnection.map((p) => p.id);
        const { data: links } = await supabase
          .from('friend_requests')
          .select('sender_id, receiver_id')
          .eq('status', 'accepted')
          .or(
            `and(sender_id.eq.${myProfileId},receiver_id.in.(${ids.join(',')})),and(receiver_id.eq.${myProfileId},sender_id.in.(${ids.join(',')}))`,
          );
        if (mine !== reqId.current) return;
        const connected = new Set<string>();
        for (const l of links ?? []) {
          connected.add(l.sender_id === myProfileId ? l.receiver_id : l.sender_id);
        }
        for (const p of needConnection) {
          if (connected.has(p.id)) allowed.push(p);
        }
      }

      setResults(
        allowed.map((p) => ({
          id: p.id,
          name: p.display_name || 'User',
          avatar: p.avatar_url,
          subtitle: p.profession || null,
        })),
      );
      setLoading(false);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, myProfileId]);

  return { query, setQuery, results, loading };
}
