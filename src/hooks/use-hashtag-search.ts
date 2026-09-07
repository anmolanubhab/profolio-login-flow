import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface HashtagResult {
  tag: string;
  postCount: number;
}

const DEBOUNCE_MS = 200;

/**
 * Debounced hashtag autocomplete for the post composer. `query === null` means
 * the picker is closed. Runs through `search_hashtags` (prefix match on the
 * normalized tag, ordered by usage), capped server-side — never a full scan.
 * The typed query itself is always offered as the first option so a brand-new
 * hashtag can be created.
 */
export function useHashtagSearch() {
  const [query, setQuery] = useState<string | null>(null);
  const [results, setResults] = useState<HashtagResult[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    if (query === null) {
      setResults([]);
      setLoading(false);
      return;
    }
    const q = query.trim();
    setLoading(true);
    const mine = ++reqId.current;
    const timer = setTimeout(async () => {
      const { data } = await supabase.rpc('search_hashtags', { q });
      if (mine !== reqId.current) return;
      setResults(
        (data ?? []).map((r: { tag: string; post_count: number }) => ({
          tag: r.tag,
          postCount: r.post_count ?? 0,
        })),
      );
      setLoading(false);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  return { query, setQuery, results, loading };
}
