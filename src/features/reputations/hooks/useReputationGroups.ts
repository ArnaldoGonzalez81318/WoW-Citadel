import { useQueries, useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import {
  factionIndexQuery,
  factionQuery,
} from "@/features/reputations/hooks/reputationQueries";
import type { Faction, FactionIndex, FactionRef } from "@/features/reputations/types";

const EMPTY: FactionRef[] = [];

export type RootRecords = {
  /**
   * Root id -> its record, for the roots loaded so far. A root Blizzard has
   * no record for (404) is settled but absent; its tile says so itself.
   */
  records: ReadonlyMap<number, Faction>;
  /** Roots still on their first load (a Retry counts as failed, not pending). */
  pendingCount: number;
  /** Root queries this result was combined from. */
  queryCount: number;
  /** Roots with no record whose last attempt failed, or that are being retried. */
  failedCount: number;
  /** Some failed root is being fetched again. */
  retrying: boolean;
  /** The first failed root's error; null while every one is being retried. */
  error: Error | null;
  /** Refetches the failed roots that are not already being fetched again. */
  retryFailed: () => void;
};

/*
 * A refetch of a record with no data puts it back to pending and clears its
 * error, so isPending alone cannot tell a first load from a Retry;
 * errorUpdateCount survives it (the same reasoning as the Professions
 * gallery). Module scope, so react-query only re-runs it when a result changes.
 */
const combineRoots = (results: UseQueryResult<Faction | null>[]): RootRecords => {
  const records = new Map<number, Faction>();
  const failed: UseQueryResult<Faction | null>[] = [];
  let pendingCount = 0;
  results.forEach((result) => {
    if (result.data !== undefined) {
      if (result.data) {
        records.set(result.data.id, result.data);
      }
    } else if (result.errorUpdateCount > 0) {
      failed.push(result);
    } else {
      pendingCount += 1;
    }
  });
  return {
    records,
    pendingCount,
    queryCount: results.length,
    failedCount: failed.length,
    retrying: failed.some((result) => result.fetchStatus !== "idle"),
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

export type ReputationGroups = RootRecords & {
  index: UseQueryResult<FactionIndex>;
  roots: FactionRef[];
  /** Every root has loaded or failed (false until the index is in). */
  settled: boolean;
};

/**
 * The faction index and every root group's record: 14 small static requests
 * on US, six at a time, cached for a day. They name each group's factions
 * (so the tiles can count them) and every first-level faction's parent.
 */
export const useReputationGroups = (): ReputationGroups => {
  const index = useQuery(factionIndexQuery());
  const roots = index.data?.roots ?? EMPTY;
  const results = useQueries({
    queries: roots.map((root) => factionQuery(root.id)),
    combine: combineRoots,
  });
  return {
    ...results,
    index,
    roots,
    // In the render where the index lands, react-query (5.90) hands back the
    // combine result memoized for the previous, empty query list: no pending
    // roots. Without the count check the page would settle on no records for
    // one render and lock the default group onto the guild's in the URL.
    settled:
      index.data !== undefined &&
      results.queryCount === roots.length &&
      results.pendingCount === 0,
  };
};
