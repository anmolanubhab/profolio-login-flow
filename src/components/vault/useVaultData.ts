import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  buildBreadcrumb,
  fetchAllFolders,
  fetchCertificates,
  fetchChildFolders,
  fetchTrashedFolders,
} from './vaultApi';
import { PAGE_SIZE, type SortDir, type SortField, type VaultCertificate, type VaultFolder, type VaultView } from './types';

interface UseVaultDataArgs {
  view: VaultView;
  folderId: string | null;
  search: string;
  sort: SortField;
  dir: SortDir;
}

export function useVaultData({ view, folderId, search, sort, dir }: UseVaultDataArgs) {
  const debouncedSearch = useDebouncedValue(search, 300);

  const [certs, setCerts] = useState<VaultCertificate[]>([]);
  const [childFolders, setChildFolders] = useState<VaultFolder[]>([]);
  const [allFolders, setAllFolders] = useState<VaultFolder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const loadFolders = useCallback(async () => {
    try {
      setAllFolders(await fetchAllFolders());
    } catch {
      /* nav tree is best-effort */
    }
  }, []);

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      const id = ++reqId.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const [certPage, folders] = await Promise.all([
          fetchCertificates({ view, folderId, search: debouncedSearch, sort, dir, page: nextPage }),
          view === 'all' && !debouncedSearch
            ? fetchChildFolders(folderId)
            : view === 'trash'
              ? fetchTrashedFolders()
              : Promise.resolve<VaultFolder[]>([]),
        ]);
        if (id !== reqId.current) return;
        setChildFolders(folders);
        setTotal(certPage.total);
        setPage(nextPage);
        setCerts((prev) => (append ? [...prev, ...certPage.rows] : certPage.rows));
      } catch (e) {
        if (id !== reqId.current) return;
        setError(e instanceof Error ? e.message : 'Could not load your vault.');
        if (!append) {
          setCerts([]);
          setChildFolders([]);
          setTotal(0);
        }
      } finally {
        if (id === reqId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [view, folderId, debouncedSearch, sort, dir],
  );

  // reload from page 0 whenever the query shape changes
  useEffect(() => {
    load(0, false);
  }, [load]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const refetch = useCallback(() => {
    load(0, false);
    loadFolders();
  }, [load, loadFolders]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore) return;
    if ((page + 1) * PAGE_SIZE >= total) return;
    load(page + 1, true);
  }, [loading, loadingMore, page, total, load]);

  const hasMore = (page + 1) * PAGE_SIZE < total;
  const breadcrumb = useMemo(() => buildBreadcrumb(allFolders, folderId), [allFolders, folderId]);

  return {
    certs,
    childFolders,
    allFolders,
    breadcrumb,
    total,
    hasMore,
    loading,
    loadingMore,
    error,
    refetch,
    loadMore,
  };
}
