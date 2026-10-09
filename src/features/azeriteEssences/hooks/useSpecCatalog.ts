import { useQueries } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { specQuery } from "@/features/azeriteEssences/hooks/essenceQueries";
import type { EssenceSummary, Specialization } from "@/features/azeriteEssences/types";

export type SpecRecords = {
  /** Spec id -> its record, for the specs loaded so far (a 404 is settled but absent). */
  specs: ReadonlyMap<number, Specialization>;
  /** Spec queries this result was combined from. */
  queryCount: number;
  /** Specs still loading (until the catalog first settles, a failed one fetched again too). */
  pendingCount: number;
  /** Specs with no record whose last attempt failed, or that are being retried. */
  failedCount: number;
  /** Some failed spec is being fetched again. */
  retrying: boolean;
  /** The first failed spec's error; null while every one is being retried. */
  error: Error | null;
  /** Refetches the failed specs that are not already being fetched again. */
  retryFailed: () => void;
};

type CombinedSpecs = SpecRecords & {
  /** Failed specs being fetched again (part of failedCount). */
  refetchingCount: number;
};

/*
 * A refetch of a record with no data puts it back to pending and clears its
 * error, so isPending alone cannot tell a first load from a Retry;
 * errorUpdateCount survives it (the reasoning of the Reputations groups).
 * Module scope, so react-query only re-runs it when a result changes.
 */
const combineSpecs = (results: UseQueryResult<Specialization | null>[]): CombinedSpecs => {
  const specs = new Map<number, Specialization>();
  const failed: UseQueryResult<Specialization | null>[] = [];
  let pendingCount = 0;
  results.forEach((result) => {
    if (result.data !== undefined) {
      if (result.data) {
        specs.set(result.data.id, result.data);
      }
    } else if (result.errorUpdateCount > 0) {
      failed.push(result);
    } else {
      pendingCount += 1;
    }
  });
  const refetchingCount = failed.filter((result) => result.fetchStatus !== "idle").length;
  return {
    specs,
    queryCount: results.length,
    pendingCount,
    failedCount: failed.length,
    refetchingCount,
    retrying: refetchingCount > 0,
    error: failed.find((result) => result.isError)?.error ?? null,
    retryFailed: () => {
      // One already being fetched again is left alone: refetch() would
      // cancel that attempt and start it over.
      failed
        .filter((result) => result.fetchStatus === "idle")
        .forEach((result) => void result.refetch());
    },
  };
};

export type SpecCatalog = SpecRecords & {
  /** Every spec id the roster names, ascending. */
  specIds: number[];
  /** Every spec has loaded or failed (false until the roster is in). */
  settled: boolean;
};

const EMPTY: EssenceSummary[] = [];

/**
 * The specialization records behind the roster's roles and classes: one per
 * spec any essence allows (39 on US), six at a time, cached for a day.
 */
export const useSpecCatalog = (essences: readonly EssenceSummary[] | undefined): SpecCatalog => {
  const list = essences ?? EMPTY;
  const specIds = useMemo(() => {
    const ids = new Set<number>();
    list.forEach((essence) => essence.specs.forEach((spec) => ids.add(spec.id)));
    return [...ids].sort((left, right) => left - right);
  }, [list]);
  const { refetchingCount, ...results } = useQueries({
    queries: specIds.map((specId) => specQuery(specId)),
    combine: combineSpecs,
  });

  // Coming back to the page within gcTime, specs that failed last visit are
  // fetched again on mount, already "failed" (errorUpdateCount) but with no
  // error to show: until the catalog first settles they are still loading,
  // or the roster would be grouped as "unknown roles" with no banner. After
  // that, a refetch (a Retry, a reconnect) keeps them failed, so the grid
  // holds still and the banner keeps its Retry.
  const [settledOnce, setSettledOnce] = useState(false);
  const autoRefetching = settledOnce ? 0 : refetchingCount;
  const pendingCount = results.pendingCount + autoRefetching;
  const settled =
    essences !== undefined &&
    // In the render where the roster lands, react-query (5.90) hands back the
    // combine result memoized for the previous, empty query list: nothing
    // pending. Without the count check the page would group the roster with
    // no roles for one render (every essence "unknown").
    results.queryCount === specIds.length &&
    pendingCount === 0;
  if (settled && !settledOnce) {
    setSettledOnce(true);
  }

  return {
    ...results,
    pendingCount,
    failedCount: results.failedCount - autoRefetching,
    retrying: results.retrying && autoRefetching === 0,
    specIds,
    settled,
  };
};
