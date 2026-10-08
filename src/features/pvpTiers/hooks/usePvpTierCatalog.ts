import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient, UseQueryResult } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import {
  pvpTierIndexQuery,
  pvpTierKeys,
  pvpTierRecordQuery,
} from "@/features/pvpTiers/hooks/pvpTierQueries";
import { createConcurrencyLimiter } from "@/features/pvpTiers/services/concurrencyLimiter";
import type { PvpTier, PvpTierSummary } from "@/features/pvpTiers/types";

/** Records in flight at once (one request each). */
const MAX_TIERS_IN_FLIGHT = 6;
const limitTierFetch = createConcurrencyLimiter(MAX_TIERS_IN_FLIGHT);
const EMPTY: PvpTierSummary[] = [];

/**
 * `pvpTierRecordQuery` under this page's request cap: the record only, no
 * icon (the page fetches icons for the bracket on screen; see
 * `usePvpTierIcons`). Kept for as long as it stays fresh, so coming back
 * later in the session costs no requests at all, and seeded from a tier the
 * PvP Seasons page already loaded whole, so those cost none either.
 */
export const throttledPvpTierRecordQuery = (
  tierId: number,
  queryClient: QueryClient,
) => {
  const base = pvpTierRecordQuery(tierId);
  return {
    ...base,
    queryFn: (context: { signal: AbortSignal }) =>
      limitTierFetch(() => base.queryFn(context), context.signal),
    gcTime: base.staleTime,
    initialData: (): PvpTier | undefined => {
      const whole = queryClient.getQueryData<PvpTier>(pvpTierKeys.tier(tierId));
      return whole ? { ...whole, iconUrl: null } : undefined;
    },
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(pvpTierKeys.tier(tierId))?.dataUpdatedAt,
  };
};

type TierResults = {
  /** Every tier loaded so far, in index order. */
  tiers: PvpTier[];
  pendingCount: number;
  failedCount: number;
  firstError: unknown;
  /** Refetches only the tiers that failed (after react-query's own retries). */
  retryFailed: () => void;
};

/** Module-level, so `useQueries` only re-runs it when a result changes. */
const combineTiers = (results: UseQueryResult<PvpTier>[]): TierResults => {
  const tiers: PvpTier[] = [];
  const failed: UseQueryResult<PvpTier>[] = [];
  let pendingCount = 0;
  results.forEach((result) => {
    if (result.data) {
      tiers.push(result.data);
    } else if (result.isError) {
      failed.push(result);
    } else {
      pendingCount += 1;
    }
  });
  return {
    tiers,
    pendingCount,
    failedCount: failed.length,
    firstError: failed[0]?.error ?? null,
    retryFailed: () => {
      failed.forEach((result) => void result.refetch());
    },
  };
};

export type PvpTierCatalog = TierResults & {
  index: UseQueryResult<PvpTierSummary[]>;
  /** Tiers in Blizzard's index. */
  total: number;
  /**
   * Every tier query has finished, loaded or failed (false until the index is
   * in). Latched: retrying failed tiers puts them back to pending, and the
   * page keeps what it already shows meanwhile instead of returning to
   * skeletons.
   */
  settled: boolean;
  /** Every tier loaded: nothing pending, nothing failed. */
  complete: boolean;
  /**
   * Distinct names in the index: how many ranks a complete bracket has (each
   * rank is listed once per bracket), so a ladder can show before the
   * other brackets finish loading.
   */
  expectedRanks: number;
};

/**
 * Every PvP tier with its bracket and range (`iconUrl` stays null: icons
 * come from `usePvpTierIcons`). Blizzard's index carries no bracket, so the
 * brackets, the ladders and the matrix all need every tier's record: 45
 * small static records, fetched six at a time and cached for a day.
 */
export const usePvpTierCatalog = (): PvpTierCatalog => {
  const queryClient = useQueryClient();
  const index = useQuery(pvpTierIndexQuery());
  const summaries = index.data ?? EMPTY;
  const results = useQueries({
    queries: summaries.map((summary) =>
      throttledPvpTierRecordQuery(summary.id, queryClient),
    ),
    combine: combineTiers,
  });
  const expectedRanks = useMemo(
    () => new Set(summaries.map((summary) => summary.name)).size,
    [summaries],
  );

  // Data, not isSuccess: a failed background refetch keeps the index it had.
  const settledNow = index.data !== undefined && results.pendingCount === 0;
  const [hasSettled, setHasSettled] = useState(false);
  useEffect(() => {
    if (settledNow) {
      setHasSettled(true);
    }
  }, [settledNow]);

  return {
    ...results,
    index,
    total: summaries.length,
    settled: settledNow || (hasSettled && index.data !== undefined),
    complete: settledNow && results.failedCount === 0,
    expectedRanks,
  };
};
