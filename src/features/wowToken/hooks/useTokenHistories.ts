import { useEffect, useSyncExternalStore } from "react";

import {
  getHistoriesSnapshot,
  recordSample,
  subscribeHistories,
} from "@/features/wowToken/services/tokenHistoryStore";
import type { RegionPrice, TokenHistories } from "@/features/wowToken/types";
import { isRegion } from "@/lib/region";

/** Every region's stored prices, live across components and tabs. */
export const useTokenHistories = (): TokenHistories =>
  useSyncExternalStore(subscribeHistories, getHistoriesSnapshot, getHistoriesSnapshot);

/**
 * Records each distinct Blizzard sample (its own `last_updated_timestamp`,
 * never the fetch time) into its region's history. Keyed on a string of
 * the four samples, so a refetch that returns the same price records
 * nothing, and StrictMode's second run is a no-op (the store dedupes on `t`).
 */
export const useRecordTokenSamples = (prices: readonly RegionPrice[]): void => {
  const signature = prices
    .map(({ region, token }) =>
      token.data ? `${region}:${token.data.lastUpdated.getTime()}:${token.data.price}` : "",
    )
    .filter(Boolean)
    .join("|");

  useEffect(() => {
    if (!signature) {
      return;
    }
    signature.split("|").forEach((entry) => {
      const [region, t, price] = entry.split(":");
      if (isRegion(region)) {
        recordSample(region, { t: Number(t), price: Number(price) });
      }
    });
  }, [signature]);
};
