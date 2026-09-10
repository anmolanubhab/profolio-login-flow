import { useEffect, useState } from 'react';

/**
 * Reactive `window.matchMedia`. SSR-safe (returns false until mounted).
 * Use for layout decisions that need to actually mount/unmount a subtree
 * rather than just hide it with CSS.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
