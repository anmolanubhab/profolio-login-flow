import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MentionResult {
  id: string;
  name: string;
  avatar: string | null;
  subtitle: string | null;
}

const DEBOUNCE_MS = 250;
const MAX_RESULTS = 6;

/**
 * Debounced people search for @mention autocomplete. `query === null` means the
 * autocomplete is not active (no request, results cleared). Only searches
 * discoverable profiles by display name, capped at MAX_RESULTS -- never a
 * full-table scan, one query per settled keystroke.
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
      const pattern = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`;
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, profession')
        .eq('profile_discovery', true)
        .ilike('display_name', pattern)
        .order('display_name', { ascending: true })
        .limit(MAX_RESULTS);

      if (mine !== reqId.current) return; // a newer keystroke won
      setResults(
        (data || []).map((p) => ({
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
