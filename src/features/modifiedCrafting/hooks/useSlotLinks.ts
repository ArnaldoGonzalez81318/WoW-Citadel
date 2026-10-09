import { useQueries } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { slotTypeQuery } from "@/features/modifiedCrafting/hooks/modifiedCraftingQueries";
import type { SlotType } from "@/features/modifiedCrafting/types";

const NO_IDS: readonly number[] = [];

type CombinedLinks = {
  /** Slot type id -> record, for the records read so far (404s are absent). */
  records: ReadonlyMap<number, SlotType>;
  /** Category id -> the slot types that accept it, newest slot first. */
  acceptedBy: ReadonlyMap<number, readonly number[]>;
  /** Records read (a 404 counts: it is settled, just empty). */
  loadedCount: number;
  /** Records still on their first load (a Retry counts as failed, not pending). */
  pendingCount: number;
  /** Slot type queries this result was combined from. */
  queryCount: number;
  failedCount: number;
  retrying: boolean;
  /** The first failed record's error; null while every one is being retried. */
  error: Error | null;
  retryFailed: () => void;
};

/*
 * Module scope, so react-query only re-runs it when a result changes. A
 * Retry puts a record with no data back to pending and clears its error;
 * errorUpdateCount survives that, so a retried record still counts as
 * failed (the same reasoning as the Reputations groups).
 */
const combineLinks = (results: UseQueryResult<SlotType | null>[]): CombinedLinks => {
  const records = new Map<number, SlotType>();
  const acceptedBy = new Map<number, number[]>();
  const failed: UseQueryResult<SlotType | null>[] = [];
  let loadedCount = 0;
  let pendingCount = 0;
  results.forEach((result) => {
    if (result.data !== undefined) {
      loadedCount += 1;
      const record = result.data;
      if (record) {
        records.set(record.id, record);
        record.categories.forEach((category) => {
          const list = acceptedBy.get(category.id);
          if (list) {
            list.push(record.id);
          } else {
            acceptedBy.set(category.id, [record.id]);
          }
        });
      }
    } else if (result.errorUpdateCount > 0) {
      failed.push(result);
    } else {
      pendingCount += 1;
    }
  });
  acceptedBy.forEach((list) => list.sort((left, right) => right - left));
  return {
    records,
    acceptedBy,
    loadedCount,
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

export type SlotLinks = CombinedLinks & {
  /** The map is being built (or was): the view or a dialog asked for it. */
  enabled: boolean;
  /** The slot type list has loaded, so `total` is known. */
  listed: boolean;
  /** Slot types to read. */
  total: number;
  /** Every record has loaded or failed. */
  settled: boolean;
  /** Every record has loaded: `acceptedBy` is the whole truth. */
  complete: boolean;
};

/**
 * Which slot types accept each category: Blizzard only lists the other
 * direction, so this reads every slot type record (389 on US), six at a
 * time behind whatever is on screen, into the same cache entries the cards
 * use, and keeps them for a day. It runs only while `enabled` (the
 * categories view is open, or a category dialog's "Accepted by" section
 * came into view); leaving cancels what is still queued, and coming back
 * picks up where it stopped. A card or dialog that needs a record still
 * queued here moves it up (promoteSlotType).
 */
export const useSlotLinks = (
  /** Every slot type id; undefined until the index has loaded. */
  slotIds: readonly number[] | undefined,
  enabled: boolean,
): SlotLinks => {
  const ids = enabled && slotIds ? slotIds : NO_IDS;
  const combined = useQueries({
    queries: ids.map((id) => slotTypeQuery(id, "low")),
    combine: combineLinks,
  });
  // When the list changes (the view opens, the index lands) react-query
  // (5.90) first hands back the combine result memoized for the previous
  // list, for one render: the empty list before it would read as "all 0
  // loaded". Only a result built from this list may say it is settled or
  // complete (an index that lists nothing is complete at once).
  const current = enabled && slotIds !== undefined && combined.queryCount === ids.length;
  return {
    ...combined,
    enabled,
    listed: slotIds !== undefined,
    total: ids.length,
    settled: current && combined.pendingCount === 0,
    complete: current && combined.loadedCount === ids.length,
  };
};
