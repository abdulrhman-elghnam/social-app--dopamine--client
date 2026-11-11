import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage, type ApiResponse } from "../services/api";

type Fetcher<T> = (page: number, size: number) => Promise<ApiResponse<T[]>>;

/**
 * Page-by-page loader for the server's `{ data: T[], meta: { currentPage, totalPages } }` lists.
 * `setItems` lets screens apply optimistic inserts/edits/removals without refetching.
 */
export function usePaginatedList<T extends { _id: string }>(fetcher: Fetcher<T>, size = 10) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const apply = useCallback((response: ApiResponse<T[]>, target: number) => {
    const data = response.data ?? [];
    setItems((current) => {
      if (target === 1) return data;
      const seen = new Set(current.map((item) => item._id));
      return [...current, ...data.filter((item) => !seen.has(item._id))];
    });
    setPage(response.meta?.currentPage ?? target);
    setTotalPages(response.meta?.totalPages ?? target);
    setError(null);
  }, []);

  // First page; re-runs if the fetcher changes (e.g. a different post id).
  useEffect(() => {
    let active = true;
    busy.current = true;
    fetcher(1, size)
      .then((response) => {
        if (active) apply(response, 1);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err, "Could not load"));
      })
      .finally(() => {
        busy.current = false;
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetcher, size, apply]);

  const fetchPage = useCallback(
    async (target: number, setFlag: (value: boolean) => void) => {
      if (busy.current) return;
      busy.current = true;
      setFlag(true);
      try {
        apply(await fetcher(target, size), target);
      } catch (err) {
        setError(errorMessage(err, "Could not load"));
      } finally {
        busy.current = false;
        setFlag(false);
      }
    },
    [apply, fetcher, size]
  );

  const hasMore = page < totalPages;

  return {
    items,
    setItems,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    refresh: useCallback(() => fetchPage(1, setRefreshing), [fetchPage]),
    loadMore: useCallback(() => {
      if (hasMore) void fetchPage(page + 1, setLoadingMore);
    }, [fetchPage, hasMore, page]),
  };
}
