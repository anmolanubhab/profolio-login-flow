import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MentionResult {
  id: string;
  name: string;
  avatar: string | null;
  subtitle: string | null;
}

const DEBOUNCE_MS = 250;

/**
 * Debounced people search for @mention autocomplete. `query === null` means the
 * autocomplete is not active (no request, results cleared). Only searches
 * discoverable profiles by display name, capped server-side -- never a
 * full-table scan, one query per settled keystroke.
 *
 * Runs through the `search_mentionable_people` RPC (SECURITY DEFINER) so each
 * person's "Mentions & tags" setting (profiles.preferences.mentions_from) is
 * honoured without exposing the `preferences` blob to the client: a person who
 * only allows mentions from connections (or from no one) is dropped for a
 * searcher who isn't allowed -- so the mention token, and therefore the
 * `comment_mention` notification the DB trigger would send, is never created.
 * The RPC also re-applies the block + profile-visibility filtering that RLS
 * used to do for the old direct SELECT.
 */
export function useMentionSearch() {
  const [query, setQuery] = useState<string | null>(null);
  const [results, setResults] = useState<MentionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

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
      const { data } = await supabase.rpc('search_mentionable_people', { q });

      if (mine !== reqId.current) return; // a newer keystroke won

      setResults(
        (data ?? []).map((p) => ({
          id: p.id,
          name: p.display_name || 'User',
          avatar: p.avatar_url,
          subtitle: p.profession || null,
        })),
      );
      setLoading(false);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  return { query, setQuery, results, loading };
}
