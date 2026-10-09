import { useQueries } from "@tanstack/react-query";

import {
  REGIONS,
  regionRecordQuery,
  regionTokenQuery,
} from "@/features/regions/hooks/regionQueries";
import type { RegionPrice } from "@/features/wowToken/types";
import { env } from "@/lib/env";

/**
 * The live token price of all four regions, with each region's name.
 *
 * Prices use the Regions page's `regionTokenQuery`, whose key for the app's
 * own region is `WOW_TOKEN_QUERY_KEY`, the one the home page's token card
 * reads: arriving from either page shows its prices at once, and the three
 * never disagree. They
 * poll on that query's interval; a refocused tab also refetches a price
 * past its stale time, since the poll pauses while the tab is hidden.
 *
 * The region records (two tiny requests per region, an hour fresh, shared
 * with the Regions page) only supply localized names; until one loads, or
 * if it fails, the card falls back to the tag, and the price is unaffected.
 */
export const useRegionTokenPrices = (): RegionPrice[] => {
  const tokens = useQueries({
    queries: REGIONS.map((region) => ({
      ...regionTokenQuery(region),
      refetchOnWindowFocus: true,
    })),
  });
  const records = useQueries({
    queries: REGIONS.map((region) => regionRecordQuery(region)),
  });

  return REGIONS.map((region, index) => {
    const record = records[index].data;
    return {
      region,
      isHome: region === env.region,
      tag: record?.tag ?? region.toUpperCase(),
      name: record?.name ?? null,
      token: tokens[index],
    };
  });
};

export default useRegionTokenPrices;
