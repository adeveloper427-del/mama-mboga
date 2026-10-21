import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, toApiError } from '@/services';
import { onSessionChanged, onTablesChanged, type TableName } from '@/services/realtime';

/**
 * Data-fetching hook used by every screen.
 *
 * - Caches results by key, so revisiting a screen shows data instantly while
 *   it refreshes in the background (stale-while-revalidate).
 * - Re-fetches silently when any of `tables` change, so a seller accepting an
 *   order updates the customer's tracking screen without a manual refresh.
 * - Exposes `refreshing` for pull-to-refresh and `error` for error states.
 */
const cache = new Map<string, unknown>();

export function clearQueryCache() {
  cache.clear();
}

export interface QueryResult<T> {
  data: T | undefined;
  error: ApiError | null;
  loading: boolean;
  refreshing: boolean;
  refetch: () => Promise<void>;
  setData: (updater: (prev: T | undefined) => T | undefined) => void;
}

export function useQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  tables: TableName[] = [],
): QueryResult<T> {
  const [data, setDataState] = useState<T | undefined>(() => (key ? (cache.get(key) as T | undefined) : undefined));
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(() => !!key && !cache.has(key));
  const [refreshing, setRefreshing] = useState(false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const mounted = useRef(true);
  const requestId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent') => {
      if (!key) return;
      const id = ++requestId.current;
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      try {
        const result = await fetcherRef.current();
        if (!mounted.current || id !== requestId.current) return; // a newer request won
        cache.set(key, result);
        setDataState(result);
        setError(null);
      } catch (e) {
        if (!mounted.current || id !== requestId.current) return;
        // Keep showing cached data on background failures; surface the error otherwise.
        if (mode !== 'silent' || !cache.has(key)) setError(toApiError(e));
      } finally {
        if (mounted.current && id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [key],
  );

  useEffect(() => {
    if (!key) {
      setDataState(undefined);
      setLoading(false);
      return;
    }
    const cached = cache.get(key) as T | undefined;
    setDataState(cached);
    run(cached === undefined ? 'initial' : 'silent');
  }, [key, run]);

  const tablesKey = tables.join(',');
  useEffect(() => {
    if (!key || !tablesKey) return;
    return onTablesChanged(tablesKey.split(',') as TableName[], () => run('silent'));
  }, [key, tablesKey, run]);

  // A screen can mount before the saved session is restored (deep link or refresh);
  // reload once the session changes rather than leaving an authentication error.
  useEffect(() => {
    if (!key) return;
    return onSessionChanged(() => run('silent'));
  }, [key, run]);

  const refetch = useCallback(() => run(error ? 'initial' : 'refresh'), [run, error]);

  const setData = useCallback(
    (updater: (prev: T | undefined) => T | undefined) => {
      setDataState((prev) => {
        const next = updater(prev);
        if (key) cache.set(key, next);
        return next;
      });
    },
    [key],
  );

  return { data, error, loading, refreshing, refetch, setData };
}
