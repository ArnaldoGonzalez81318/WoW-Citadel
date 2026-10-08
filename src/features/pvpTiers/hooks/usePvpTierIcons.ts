import { useQueries, useQueryClient } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback } from "react";

import {
  TIER_STALE_MS,
  pvpTierIconQuery,
  pvpTierKeys,
} from "@/features/pvpTiers/hooks/pvpTierQueries";
import type { PvpTier } from "@/features/pvpTiers/types";

export type PvpTierIcon = {
  /** null when Blizzard has no icon or it failed to load: the tile shows the rank's initial. */
  url: string | null;
  loading: boolean;
};

export type PvpTierIcons = ReadonlyMap<number, PvpTierIcon>;

/**
 * Icons for the given tiers only, on demand: the page asks for the bracket
 * on screen (nine), not all 45, because Blizzard gives a rank the same icon
 * in every bracket and the other 36 would repeat the same URLs. Each is its
 * own query, so a failed icon (after react-query's retries) only costs that
 * tile its picture, never the tier's range. Seeded from a tier the PvP
 * Seasons page already loaded whole, and kept while fresh, so switching
 * back to a bracket costs nothing.
 */
export const usePvpTierIcons = (tierIds: readonly number[]): PvpTierIcons => {
  const queryClient = useQueryClient();
  const combine = useCallback(
    (results: UseQueryResult<string | null>[]): PvpTierIcons => {
      const icons = new Map<number, PvpTierIcon>();
      results.forEach((result, index) => {
        icons.set(tierIds[index], {
          url: result.data ?? null,
          loading: result.isPending,
        });
      });
      return icons;
    },
    [tierIds],
  );

  return useQueries({
    queries: tierIds.map((tierId) => ({
      ...pvpTierIconQuery(tierId),
      gcTime: TIER_STALE_MS,
      initialData: (): string | null | undefined =>
        queryClient.getQueryData<PvpTier>(pvpTierKeys.tier(tierId))?.iconUrl,
      initialDataUpdatedAt: () =>
        queryClient.getQueryState(pvpTierKeys.tier(tierId))?.dataUpdatedAt,
    })),
    combine,
  });
};
