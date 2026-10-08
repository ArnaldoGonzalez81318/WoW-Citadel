import { useQueries } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";

import { neighborhoodRecordQuery } from "@/features/neighborhoods/hooks/neighborhoodQueries";
import { pageNumbers } from "@/features/neighborhoods/services/neighborhoodService";
import type { Neighborhood } from "@/features/neighborhoods/types";

type RecordResult = UseQueryResult<Neighborhood | null>;

/* ------------------------------------------------------------------ */
/* One register page                                                   */
/* ------------------------------------------------------------------ */

/** One number on the page: its neighborhood, null (not on this map), or undefined (not known). */
export type RegisterSlot = {
  number: number;
  record: Neighborhood | null | undefined;
  /** Failed after the app's retries; "undefined" for this one means unknown, not loading. */
  failed: boolean;
};

type PageResults = {
  records: Array<Neighborhood | null | undefined>;
  failedFlags: boolean[];
  pending: boolean;
  failed: RecordResult[];
  retrying: boolean;
  error: Error | null;
};

/*
 * A refetch of a record that has no data puts it back to pending and clears
 * its error (query-core's fetchState), so isPending alone cannot tell a
 * first load from a Retry. errorUpdateCount survives the refetch: a number
 * that has failed before is a failure being retried, not a first load, and
 * stays in `failed` so the banner (and the focused Retry button) stays put.
 *
 * Module scope, so react-query only re-runs it when a result changes.
 */
const combinePage = (results: RecordResult[]): PageResults => {
  const failedFlags = results.map(
    (result) => result.data === undefined && result.errorUpdateCount > 0,
  );
  const failed = results.filter((_result, index) => failedFlags[index]);
  return {
    records: results.map((result) => result.data),
    failedFlags,
    pending: results.some(
      (result) => result.isPending && result.errorUpdateCount === 0,
    ),
    failed,
    retrying: failed.some((result) => result.fetchStatus !== "idle"),
    error: failed.find((result) => result.isError)?.error ?? null,
  };
};

export type RegisterPage = {
  slots: RegisterSlot[];
  /** Some number is still on its first load. */
  pending: boolean;
  failedCount: number;
  /** Some failed number is being asked again. */
  retrying: boolean;
  /** The first failed number's error; null while every one is being retried. */
  error: Error | null;
  /** Asks the failed numbers again (after react-query's own retries gave up). */
  retryFailed: () => void;
};

/**
 * The 25 numbers on register page `page`, each asked of map `mapId`: one
 * small request per number, six at a time (the shared limiter), and cached
 * per number so the dialog and the newest-neighborhood searches reuse them.
 * Blizzard has no list to page through instead.
 */
export const useRegisterPage = (
  mapId: number | null,
  page: number | null,
): RegisterPage => {
  const numbers = useMemo(() => (page === null ? [] : pageNumbers(page)), [page]);
  const results = useQueries({
    queries: numbers.map((number) => ({
      ...neighborhoodRecordQuery(mapId ?? 0, number),
      enabled: mapId !== null,
    })),
    combine: combinePage,
  });

  const slots = useMemo(
    () =>
      numbers.map((number, index) => ({
        number,
        record: results.records[index],
        failed: results.failedFlags[index] ?? false,
      })),
    [numbers, results.records, results.failedFlags],
  );

  const { failed } = results;
  return {
    slots,
    pending: results.pending,
    failedCount: failed.length,
    retrying: results.retrying,
    error: results.error,
    // A number already being asked again is left alone: refetch() would
    // cancel that attempt and start it over.
    retryFailed: () => {
      failed
        .filter((result) => result.fetchStatus === "idle")
        .forEach((result) => void result.refetch());
    },
  };
};

/* ------------------------------------------------------------------ */
/* One number, on whichever map has it                                 */
/* ------------------------------------------------------------------ */

type LookupResults = {
  record: Neighborhood | undefined;
  /** Every map answered: none has this number. */
  missing: boolean;
  /** Not found yet and some map has not answered. */
  pending: boolean;
  /** Not found, every map answered or failed, and some failed. */
  error: Error | null;
  failed: RecordResult[];
};

const combineLookup = (results: RecordResult[]): LookupResults => {
  const record = results.find((result) => result.data)?.data ?? undefined;
  const failed = results.filter(
    (result) => result.isError && result.data === undefined,
  );
  const pending = record === undefined && results.some((result) => result.isPending);
  return {
    record,
    missing: results.length > 0 && results.every((result) => result.data === null),
    pending,
    error: record === undefined && !pending ? (failed[0]?.error ?? null) : null,
    failed,
  };
};

export type NeighborhoodLookup = Omit<LookupResults, "failed"> & {
  retry: () => void;
};

/**
 * Neighborhood `number` on whichever map has it: every map is asked at
 * once (two requests at most; a number on the map being browsed is usually
 * cached already) and the one that answers wins. Each number is on one map
 * only, so the order never changes the answer, just which request goes
 * first through the limiter.
 */
export const useNeighborhoodLookup = (
  number: number | null,
  mapIds: readonly number[],
  preferredMapId: number | null,
): NeighborhoodLookup => {
  const ordered = useMemo(
    () =>
      preferredMapId !== null && mapIds.includes(preferredMapId)
        ? [preferredMapId, ...mapIds.filter((id) => id !== preferredMapId)]
        : [...mapIds],
    [mapIds, preferredMapId],
  );
  const { failed, ...lookup } = useQueries({
    queries: ordered.map((mapId) => ({
      ...neighborhoodRecordQuery(mapId, number ?? 0),
      enabled: number !== null,
    })),
    combine: combineLookup,
  });
  return {
    ...lookup,
    retry: () => {
      failed.forEach((result) => void result.refetch());
    },
  };
};
