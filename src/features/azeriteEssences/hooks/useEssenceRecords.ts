import { useQueries } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { essenceQuery } from "@/features/azeriteEssences/hooks/essenceQueries";
import type { Essence, EssenceSummary } from "@/features/azeriteEssences/types";

export type EssenceRecords = {
  /** Essence id -> record, for every record in the cache (loaded by a card or the search). */
  records: ReadonlyMap<number, Essence>;
  /** Records settled either way (loaded, missing or failed). */
  settledCount: number;
  /** Records with none in hand whose last attempt failed, or that are being retried. */
  failedCount: number;
  /** Some failed record is being fetched again after a Retry. */
  retrying: boolean;
  /** The first failed record's error; null while every one is being retried. */
  error: Error | null;
  /** Refetches the failed records that are not already being fetched again. */
  retryFailed: () => void;
  /** Queries this result was combined from. */
  queryCount: number;
};

type CombinedRecords = Omit<EssenceRecords, "retrying"> & {
  /** Failed records being fetched again (part of failedCount). */
  refetchingCount: number;
};

/*
 * As with the spec records, errorUpdateCount is what survives a refetch of a
 * record with no data; isPending alone cannot tell a first load from a Retry.
 */
const combineRecords = (results: UseQueryResult<Essence | null>[]): CombinedRecords => {
  const records = new Map<number, Essence>();
  const failed: UseQueryResult<Essence | null>[] = [];
  let settledCount = 0;
  results.forEach((result) => {
    if (result.data !== undefined) {
      if (result.data) {
        records.set(result.data.id, result.data);
      }
      settledCount += 1;
    } else if (result.errorUpdateCount > 0) {
      failed.push(result);
      settledCount += 1;
    }
  });
  return {
    records,
    settledCount,
    failedCount: failed.length,
    refetchingCount: failed.filter((result) => result.fetchStatus !== "idle").length,
    error: failed.find((result) => result.isError)?.error ?? null,
    retryFailed: () => {
      failed
        .filter((result) => result.fetchStatus === "idle")
        .forEach((result) => void result.refetch());
    },
    queryCount: results.length,
  };
};

const EMPTY: EssenceSummary[] = [];

/**
 * Every essence record the page knows, so the search can match power names
 * ("Concentrated Flame" finds The Crucible of Flame). Cards load their own
 * records as they near the viewport; only a search (an explicit request)
 * fetches the rest, six at a time through the shared limiter.
 */
export const useEssenceRecords = (
  essences: readonly EssenceSummary[] | undefined,
  fetchAll: boolean,
): EssenceRecords & { complete: boolean } => {
  const list = essences ?? EMPTY;
  const { refetchingCount, retryFailed: refetchFailed, ...results } = useQueries({
    queries: list.map((essence) => ({ ...essenceQuery(essence.id), enabled: fetchAll })),
    combine: combineRecords,
  });

  // A record that failed before (on its card, or in an earlier search) is
  // fetched again when the search enables it: that is still loading, not a
  // failure to report. Only after the visitor's Retry does a refetch keep it
  // failed, so the banner and its focused Retry button stay up meanwhile.
  const [retryRequested, setRetryRequested] = useState(false);
  if (!fetchAll && retryRequested) {
    setRetryRequested(false);
  }
  const autoRefetching = retryRequested ? 0 : refetchingCount;
  const retryFailed = useCallback((): void => {
    setRetryRequested(true);
    refetchFailed();
  }, [refetchFailed]);

  const settledCount = results.settledCount - autoRefetching;
  return {
    ...results,
    settledCount,
    failedCount: results.failedCount - autoRefetching,
    retrying: retryRequested && refetchingCount > 0,
    retryFailed,
    // The combine memoized for the previous list can be handed back for a
    // render after the list changes: only a result built from this list counts.
    complete: results.queryCount === list.length && settledCount === list.length,
  };
};
