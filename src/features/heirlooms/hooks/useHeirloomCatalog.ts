import { useQueries, useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  heirloomIndexQuery,
  heirloomQuery,
} from "@/features/heirlooms/hooks/heirloomQueries";
import { newestFirst } from "@/features/heirlooms/services/heirloomCatalog";
import type { Heirloom, HeirloomRef } from "@/features/heirlooms/types";

const EMPTY: HeirloomRef[] = [];

type RecordResult = UseQueryResult<Heirloom | null>;

export type HeirloomRecords = {
  /** Heirloom id -> its record, for the records loaded so far. */
  records: ReadonlyMap<number, Heirloom>;
  /** Records answered: loaded, or not in Blizzard's data (404). */
  settledCount: number;
  /** Listed in the index, but Blizzard has no record for it (404). */
  missingCount: number;
  /** Records still on their first load (a Retry counts as failed, not pending). */
  pendingCount: number;
  /** Record queries this result was combined from. */
  queryCount: number;
  /** Records with no data whose last attempt failed, or that are being retried. */
  failedCount: number;
  /** Some failed record is being fetched again. */
  retrying: boolean;
  /** The first failed record's error; null while every one is being retried. */
  error: Error | null;
  /** Refetches the failed records that are not already being fetched again. */
  retryFailed: () => void;
  /** Positions (in the query list) of the failed and the missing records. */
  failedAt: number[];
  missingAt: number[];
};

/*
 * A refetch of a record with no data puts it back to pending and clears its
 * error, so isPending alone cannot tell a first load from a Retry;
 * errorUpdateCount survives it (the same reasoning as the Reputations
 * groups). Module scope, so react-query only re-runs it when a result changes.
 */
const combineRecords = (results: RecordResult[]): HeirloomRecords => {
  const records = new Map<number, Heirloom>();
  const failed: RecordResult[] = [];
  const failedAt: number[] = [];
  const missingAt: number[] = [];
  let settledCount = 0;
  let pendingCount = 0;
  results.forEach((result, position) => {
    if (result.data !== undefined) {
      settledCount += 1;
      if (result.data) {
        records.set(result.data.id, result.data);
      } else {
        missingAt.push(position);
      }
    } else if (result.errorUpdateCount > 0) {
      failed.push(result);
      failedAt.push(position);
    } else {
      pendingCount += 1;
    }
  });
  return {
    records,
    settledCount,
    missingCount: missingAt.length,
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
    failedAt,
    missingAt,
  };
};

export type HeirloomCatalog = Omit<HeirloomRecords, "failedAt" | "missingAt"> & {
  index: UseQueryResult<HeirloomRef[]>;
  /** The index, in Blizzard's (collection) order. */
  entries: HeirloomRef[];
  /** Every record has loaded, 404'd or failed (false until the index is in). */
  settled: boolean;
  /** Settled with nothing failed: the filters' options cover the whole collection. */
  complete: boolean;
  /** Heirlooms whose record failed (a Retry is offered) or that Blizzard has no record of. */
  failedIds: ReadonlySet<number>;
  missingIds: ReadonlySet<number>;
};

/**
 * The heirloom index and every heirloom's record: 134 static requests on
 * US, six at a time, cached for a day. The page needs them all to group by
 * slot and filter by type, stat and source, so they start with the page;
 * the newest come first (the page leads with them), and a heirloom opened
 * from a shared link ahead of those, so its dialog does not wait in line.
 */
export const useHeirloomCatalog = (priorityId: number | null): HeirloomCatalog => {
  const index = useQuery(heirloomIndexQuery());
  const entries = index.data ?? EMPTY;
  const order = useMemo(() => {
    const newest = newestFirst(entries);
    const at = priorityId === null ? -1 : newest.findIndex((entry) => entry.id === priorityId);
    return at <= 0 ? newest : [newest[at], ...newest.slice(0, at), ...newest.slice(at + 1)];
  }, [entries, priorityId]);

  const { failedAt, missingAt, ...results } = useQueries({
    queries: order.map((entry) => heirloomQuery(entry.id)),
    combine: combineRecords,
  });

  // In the render where the index lands, react-query (5.90) hands back the
  // combine result memoized for the previous, empty query list: nothing
  // pending. Without the count check the page would call the collection
  // settled with no records for one render, and drop every filter in the
  // URL as unknown.
  const covered = index.data !== undefined && results.queryCount === order.length;
  const settled = covered && results.pendingCount === 0;

  // Positions only mean something against the list they were combined from.
  const failedIds = useMemo(
    () => new Set(covered ? failedAt.map((position) => order[position].id) : []),
    [covered, failedAt, order],
  );
  const missingIds = useMemo(
    () => new Set(covered ? missingAt.map((position) => order[position].id) : []),
    [covered, missingAt, order],
  );

  return {
    ...results,
    index,
    entries,
    settled,
    complete: settled && results.failedCount === 0,
    failedIds,
    missingIds,
  };
};
