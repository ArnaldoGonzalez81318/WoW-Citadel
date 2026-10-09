import { useCallback, useState } from "react";
import type { QueryKey } from "@tanstack/react-query";

type FailableQuery = {
  data: unknown;
  error: Error | null;
  errorUpdateCount: number;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
};

export type RetainedFailure = {
  /** The query has no data and its last attempt failed (or that attempt is being retried). */
  failed: boolean;
  /** The error to show: the current one, or the last one while a Retry runs. */
  error: Error | null;
  retrying: boolean;
  /** Refetches unless an attempt is already running (refetch() would restart it). */
  retry: () => void;
};

/*
 * A refetch of a query with no data puts it back to pending and clears its
 * error, so an error banner keyed on isError vanishes the moment its Retry
 * button is pressed, taking keyboard focus with it. errorUpdateCount
 * survives the refetch, so the banner stays (saying "Retrying…") with the
 * last error until the attempt settles. The error is remembered per query
 * key, so a dialog showing another record never borrows the last one's.
 */
const useRetainedFailure = (queryKey: QueryKey, query: FailableQuery): RetainedFailure => {
  const keyHash = JSON.stringify(queryKey);
  const [last, setLast] = useState<{ key: string; error: Error } | null>(null);
  if (query.error !== null && (last?.key !== keyHash || last.error !== query.error)) {
    setLast({ key: keyHash, error: query.error });
  }

  const remembered = last?.key === keyHash ? last.error : null;
  const error = query.error ?? (query.isFetching ? remembered : null);
  // Mounted mid-retry with nothing remembered: a plain loading state, not an empty banner.
  const failed = query.data === undefined && query.errorUpdateCount > 0 && error !== null;
  const { isFetching, refetch } = query;
  const retry = useCallback((): void => {
    if (!isFetching) {
      void refetch();
    }
  }, [isFetching, refetch]);

  return {
    failed,
    error: failed ? error : null,
    retrying: failed && query.isFetching,
    retry,
  };
};

export default useRetainedFailure;
