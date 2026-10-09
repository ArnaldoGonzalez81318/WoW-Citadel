import { useCallback, useState } from "react";

export type RetainableQuery = {
  data: unknown;
  error: unknown;
  errorUpdateCount: number;
  isFetching: boolean;
  refetch: () => unknown;
};

export type RetainedError = {
  /** The failure to show, kept while a Retry is in flight; undefined otherwise. */
  error: unknown;
  retrying: boolean;
  /** Does nothing while an attempt is already running (refetch would restart it). */
  retry: () => void;
};

/**
 * A Retry puts a query with no data back to pending and clears its error,
 * so an error block drawn from `isError` would vanish, taking the focused
 * Retry button with it, and come back if the retry fails. This keeps the
 * last error of the same `scope` (the query's id) on screen until data
 * arrives; errorUpdateCount survives the refetch, so it knows the query has
 * failed before.
 */
const useRetainedError = (scope: string, query: RetainableQuery): RetainedError => {
  const [last, setLast] = useState<{ scope: string; error: unknown } | null>(null);
  if (query.error && (last?.scope !== scope || last.error !== query.error)) {
    setLast({ scope, error: query.error });
  }
  const failed = query.data === undefined && query.errorUpdateCount > 0;
  const { isFetching, refetch } = query;
  const retry = useCallback((): void => {
    if (!isFetching) {
      void refetch();
    }
  }, [isFetching, refetch]);
  return {
    error: failed ? (query.error ?? (last?.scope === scope ? last.error : undefined)) : undefined,
    retrying: failed && isFetching,
    retry,
  };
};

export default useRetainedError;
