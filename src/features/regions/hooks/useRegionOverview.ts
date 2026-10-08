import { useQueries } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import {
  REGIONS,
  regionMakeupQuery,
  regionRealmCountsQuery,
  regionRecordQuery,
  regionTokenQuery,
} from "@/features/regions/hooks/regionQueries";
import type {
  Region,
  RegionRealmCounts,
  RegionRealmMakeup,
  RegionRecord,
} from "@/features/regions/types";
import type { WowTokenPrice } from "@/features/search/services/tokenService";
import { env } from "@/lib/env";

/** Everything the page knows about one region, one query per source. */
export type RegionColumn = {
  region: Region;
  /** The region this build of the app is configured for (`env.region`). */
  isHome: boolean;
  /** Blizzard's tag once the record is in, the namespace suffix until then. */
  tag: string;
  record: UseQueryResult<RegionRecord | null>;
  token: UseQueryResult<WowTokenPrice>;
  counts: UseQueryResult<RegionRealmCounts>;
  makeup: UseQueryResult<RegionRealmMakeup>;
};

/**
 * The four regions' cheap facts (record, token, realm counts: a handful of
 * small requests each) load at once; the heavy realm makeup waits for
 * `makeupEnabled`, which the page ties to its tables nearing the viewport.
 */
export const useRegionOverview = (makeupEnabled: boolean): RegionColumn[] => {
  const records = useQueries({
    queries: REGIONS.map((region) => regionRecordQuery(region)),
  });
  const tokens = useQueries({
    queries: REGIONS.map((region) => regionTokenQuery(region)),
  });
  const counts = useQueries({
    queries: REGIONS.map((region) => regionRealmCountsQuery(region)),
  });
  const makeups = useQueries({
    queries: REGIONS.map((region) => ({
      ...regionMakeupQuery(region),
      enabled: makeupEnabled,
    })),
  });

  return REGIONS.map((region, index) => ({
    region,
    isHome: region === env.region,
    tag: records[index].data?.tag ?? region.toUpperCase(),
    record: records[index],
    token: tokens[index],
    counts: counts[index],
    makeup: makeups[index],
  }));
};
