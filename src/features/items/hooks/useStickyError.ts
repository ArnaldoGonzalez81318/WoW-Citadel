import { useCallback, useState } from "react";

export type RetryableQuery = {
  /** The query's own data (not placeholder data standing in for it). */
  data: unknown;
  error: unknown;
  errorUpdateCount: number;
  isFetching: boolean;
  refetch: () => unknown;
};

export type StickyError = {
  /** The failure to show, kept while a Retry is in flight; undefined otherwise. */
  error: unknown;
  retrying: boolean;
  /** Ignored while a retry is already running (refetch would restart it). */
  retry: () => void;
};

/**
 * A Retry puts a query with no data back to pending and clears its error,
 * so an error block rendered from `isError` would vanish, taking the focused
 * Retry button with it, and come back if the retry fails. This keeps the
 * last error on screen for a query that has failed before (errorUpdateCount
 * survives the refetch) until data arrives. `key` names the query, so one
 * query's error is never shown for another.
 */
const useStickyError = (key: string, query: RetryableQuery): StickyError => {
  const [last, setLast] = useState<{ key: string; error: unknown } | null>(null);
  if (query.error && (last?.key !== key || last.error !== query.error)) {
    setLast({ key, error: query.error });
  }
  const failed = query.data === undefined && query.errorUpdateCount > 0;
  const { isFetching, refetch } = query;
  const retry = useCallback((): void => {
    if (!isFetching) {
      void refetch();
    }
  }, [isFetching, refetch]);
  return {
    error: failed ? (query.error ?? (last?.key === key ? last.error : undefined)) : undefined,
    retrying: failed && isFetching,
    retry,
  };
};

export default useStickyError;
