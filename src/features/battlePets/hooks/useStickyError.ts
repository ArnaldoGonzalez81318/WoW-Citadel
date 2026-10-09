import { useCallback, useState } from "react";

export type RetryableQuery = {
  data: unknown;
  error: Error | null;
  errorUpdateCount: number;
  isFetching: boolean;
  refetch: () => unknown;
};

export type StickyError = {
  /** The failure to show, kept while a Retry is in flight; null otherwise. */
  error: Error | null;
  retrying: boolean;
  /** Ignored while a fetch is already running (refetch would restart it). */
  retry: () => void;
};

/**
 * A Retry puts a query with no data back to pending and clears its error,
 * so an error block rendered from `isError` would swap for a skeleton,
 * taking the focused Retry button with it. This keeps the last error on
 * screen for a query that has failed before (errorUpdateCount survives the
 * refetch) until data arrives. `key` names the query, so one pet's error is
 * never shown for another's.
 */
const useStickyError = (key: string, query: RetryableQuery): StickyError => {
  const [last, setLast] = useState<{ key: string; error: Error } | null>(null);
  if (query.error) {
    if (last?.key !== key || last.error !== query.error) {
      setLast({ key, error: query.error });
    }
  } else if (last !== null && last.key !== key) {
    // Another query is shown now. If the failed one comes back (a dialog
    // reopened on it), react-query refetches it on its own: that is a fresh
    // load, not a Retry in flight, so it shows as loading, not as the old
    // error with a Retry that could do nothing.
    setLast(null);
  }
  const failed = query.data === undefined && query.errorUpdateCount > 0;
  const { isFetching, refetch } = query;
  const retry = useCallback((): void => {
    if (!isFetching) {
      void refetch();
    }
  }, [isFetching, refetch]);
  const error = failed ? (query.error ?? (last?.key === key ? last.error : null)) : null;
  return {
    error,
    retrying: error !== null && isFetching,
    retry,
  };
};

export default useStickyError;
