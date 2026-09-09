import { useCallback, useMemo, useRef, useState } from 'react';

/**
 * Drive-style selection over an ordered id list:
 *   plain click  -> replace selection with this id
 *   ctrl/cmd     -> toggle this id, keep the rest
 *   shift        -> range from the anchor to this id
 *   ctrl/cmd + A -> select all (handled by the shell)
 *   Escape       -> clear (handled by the shell)
 */
export function useVaultSelection(orderedIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const anchor = useRef<string | null>(null);

  const clear = useCallback(() => {
    setSelected(new Set());
    anchor.current = null;
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(orderedIds));
    anchor.current = orderedIds[0] ?? null;
  }, [orderedIds]);

  const selectOne = useCallback((id: string) => {
    setSelected(new Set([id]));
    anchor.current = id;
  }, []);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    anchor.current = id;
  }, []);

  const range = useCallback(
    (id: string) => {
      const a = anchor.current ?? id;
      const i = orderedIds.indexOf(a);
      const j = orderedIds.indexOf(id);
      if (i === -1 || j === -1) {
        selectOne(id);
        return;
      }
      const [lo, hi] = i < j ? [i, j] : [j, i];
      setSelected(new Set(orderedIds.slice(lo, hi + 1)));
    },
    [orderedIds, selectOne],
  );

  /** Route a click event to the right selection behaviour. */
  const handleClick = useCallback(
    (id: string, e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => {
      if (e.shiftKey) return range(id);
      if (e.ctrlKey || e.metaKey) return toggle(id);
      return selectOne(id);
    },
    [range, toggle, selectOne],
  );

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);
  const ids = useMemo(() => [...selected], [selected]);

  return { selected, ids, count: selected.size, isSelected, handleClick, selectOne, toggle, selectAll, clear, setSelected };
}
