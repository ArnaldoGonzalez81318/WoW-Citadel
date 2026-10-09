import { isCancelledError, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  abilityQuery,
  petQuery,
} from "@/features/battlePets/hooks/battlePetQueries";
import {
  NO_FAMILY,
  rememberFamily,
  useKnownFamilies,
} from "@/features/battlePets/services/familyMemory";
import { paceScan } from "@/features/battlePets/services/scanPacer";
import type { CatalogKind, Pet, PetAbility } from "@/features/battlePets/types";
import { isAbortError } from "@/lib/errors";

/** Records fetched at once by one scan (the record limiter caps them all together). */
const SCAN_WORKERS = 6;
/** Fetches of one record a scan restarts after react-query cancels them (see below). */
const MAX_RESTARTS = 3;

export type FamilyScanOptions = {
  kind: CatalogKind;
  /** The list in the order it is shown; matches are found in this order. */
  ids: readonly number[];
  /** The family to find, or null to learn every id's family (counting). */
  familyId: number | null;
  /** Stop once this many matches are known (Infinity: scan the whole list). */
  wanted: number;
  enabled: boolean;
};

export type FamilyScan = {
  /**
   * Matching ids in list order, up to the first id whose family is not
   * known yet: past that gap the order is not settled, so nothing there is
   * shown until it fills.
   */
  matches: number[];
  /** How many ids, from the start of the list, have a known family. */
  checked: number;
  /** Every id in the list has a known family. */
  complete: boolean;
  /** Records are being fetched right now. */
  active: boolean;
  /**
   * A record that could not be fetched, while this view still needs it; the
   * scan has stopped at it.
   */
  error: Error | null;
  /** Fetching again after `error` (Retry, or a new filter that reaches it). */
  retrying: boolean;
  retry: () => void;
};

/** The kind is part of it: pet and ability ids overlap (111 is a pet and an ability). */
type Failure = { kind: CatalogKind; id: number; error: Error };

const walkPrefix = (
  ids: readonly number[],
  families: ReadonlyMap<number, number>,
  familyId: number | null,
): Pick<FamilyScan, "matches" | "checked" | "complete"> => {
  const matches: number[] = [];
  let checked = 0;
  for (const id of ids) {
    const family = families.get(id);
    if (family === undefined) {
      break;
    }
    checked += 1;
    if (familyId === null ? family !== NO_FAMILY : family === familyId) {
      matches.push(id);
    }
  }
  return { matches, checked, complete: checked === ids.length };
};

/**
 * Finds the ids of one family in a list whose families Blizzard's index
 * does not give: it walks the list in order, fetching each record whose
 * family is not yet known (see familyMemory), until `wanted` matches are
 * known or the list ends. Records go through the shared record cache, so a
 * card or the dialog never fetches one again, and through `paceScan`, so a
 * long scan keeps to the proxy's rate limit.
 *
 * A record that fails (after the app-wide retries) stops the scan there:
 * later matches could not be placed in order around it. Retry, or any new
 * filter, picks it up again.
 */
const useFamilyScan = ({
  kind,
  ids,
  familyId,
  wanted,
  enabled,
}: FamilyScanOptions): FamilyScan => {
  const queryClient = useQueryClient();
  const { families, version } = useKnownFamilies(kind);
  const [active, setActive] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [attempt, setAttempt] = useState(0);

  const prefix = useMemo(
    () => walkPrefix(ids, families, familyId),
    // `version` stands for the live map's contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ids, families, familyId, version],
  );
  const needMore = enabled && !prefix.complete && prefix.matches.length < wanted;

  useEffect(() => {
    if (!needMore) {
      return undefined;
    }
    const controller = new AbortController();
    const { signal } = controller;
    const inFlight = new Set<number>();
    let cursor = 0;
    let stopped = false;

    const throwIfAborted = (): void => {
      if (signal.aborted) {
        throw signal.reason ?? new DOMException("The operation was aborted", "AbortError");
      }
    };

    // A card or dialog showing the same record shares the scan's request;
    // when it unmounts mid-request (a page change), react-query cancels the
    // fetch, which is no failure of the record: fetch it again.
    const fetchShared = async <T>(run: () => Promise<T>): Promise<T> => {
      for (let restarts = 0; ; restarts += 1) {
        try {
          return await run();
        } catch (error) {
          throwIfAborted();
          if (!isCancelledError(error) || restarts >= MAX_RESTARTS) {
            throw error;
          }
        }
      }
    };

    const fetchFamily = async (id: number): Promise<void> => {
      if (kind === "pet") {
        const options = petQuery(id);
        const cached = queryClient.getQueryData<Pet | null>(options.queryKey);
        if (cached === undefined) {
          await paceScan(signal);
          // The wait may have outlived this scan (a new filter, a page change).
          throwIfAborted();
        }
        const pet =
          cached !== undefined ? cached : await fetchShared(() => queryClient.fetchQuery(options));
        // The query's own fetch records it too; this covers a record that was
        // already cached before the stored map expired.
        rememberFamily("pet", id, pet?.family?.id);
        return;
      }
      const options = abilityQuery(id);
      const cached = queryClient.getQueryData<PetAbility | null>(options.queryKey);
      if (cached === undefined) {
        await paceScan(signal);
        throwIfAborted();
      }
      const ability =
        cached !== undefined ? cached : await fetchShared(() => queryClient.fetchQuery(options));
      rememberFamily("ability", id, ability?.family?.id);
    };

    // Enough once the ids handed out so far hold `wanted` matches: any still
    // in flight among them only fill gaps before those matches.
    const enough = (): boolean => {
      let found = 0;
      for (let index = 0; index < cursor; index += 1) {
        const family = families.get(ids[index]);
        if (
          family !== undefined &&
          (familyId === null ? family !== NO_FAMILY : family === familyId)
        ) {
          found += 1;
          if (found >= wanted) {
            return true;
          }
        }
      }
      return false;
    };

    const nextId = (): number | undefined => {
      while (cursor < ids.length) {
        const id = ids[cursor];
        cursor += 1;
        if (!families.has(id) && !inFlight.has(id)) {
          return id;
        }
      }
      return undefined;
    };

    const worker = async (): Promise<void> => {
      while (!stopped && !signal.aborted && !enough()) {
        const id = nextId();
        if (id === undefined) {
          return;
        }
        inFlight.add(id);
        try {
          await fetchFamily(id);
        } catch (error) {
          if (signal.aborted || isAbortError(error)) {
            return;
          }
          stopped = true;
          setFailure({
            kind,
            id,
            error: error instanceof Error ? error : new Error("Could not load a record"),
          });
          return;
        } finally {
          inFlight.delete(id);
        }
      }
    };

    setActive(true);
    void Promise.all(Array.from({ length: SCAN_WORKERS }, worker)).finally(() => {
      if (!signal.aborted) {
        setActive(false);
      }
    });
    return () => {
      controller.abort();
      setActive(false);
    };
  }, [needMore, kind, ids, familyId, wanted, families, queryClient, attempt]);

  // A failure counts while this scan still needs records and the failed one
  // is still unknown and still in this list. Once a retry (or any later
  // fetch) settles it, or the view no longer needs it (an earlier page, a
  // family whose matches all come before it), the banner goes: its Retry
  // would have nothing to fetch.
  const failed =
    failure !== null &&
    needMore &&
    failure.kind === kind &&
    !families.has(failure.id) &&
    ids.includes(failure.id)
      ? failure
      : null;

  const retry = useCallback((): void => {
    setAttempt((value) => value + 1);
  }, []);

  return {
    ...prefix,
    active,
    error: failed?.error ?? null,
    // A failure on screen while records are being fetched is being retried:
    // the banner (and its focused button) stays until it settles.
    retrying: failed !== null && active,
    retry,
  };
};

export default useFamilyScan;
