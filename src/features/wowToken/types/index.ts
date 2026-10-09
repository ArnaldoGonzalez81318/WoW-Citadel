import type { UseQueryResult } from "@tanstack/react-query";

import type { TokenHistoryPoint } from "@/features/search/hooks/useWowTokenHistory";
import type { WowTokenPrice } from "@/features/search/services/tokenService";
import type { Region } from "@/lib/region";

export type { Region } from "@/lib/region";
export type { TokenHistoryPoint } from "@/features/search/hooks/useWowTokenHistory";
export type { WowTokenPrice } from "@/features/search/services/tokenService";

/** One of the two token items, as Blizzard's item record describes it. */
export type TokenItem = {
  id: number;
  /** "WoW Token" in the app locale. */
  name: string;
  /** Blizzard's own item text, markup stripped. */
  description: string;
};

/** The live price of one region, with the facts the page labels it with. */
export type RegionPrice = {
  region: Region;
  /** The region this build of the app is configured for (`env.region`). */
  isHome: boolean;
  /** Blizzard's tag once the region record is in, the namespace suffix until then. */
  tag: string;
  /** "North America", "Europe", … in the app locale; null until (or unless) the record loads. */
  name: string | null;
  token: UseQueryResult<WowTokenPrice>;
};

/** Every region's stored prices, oldest first. */
export type TokenHistories = Readonly<Record<Region, readonly TokenHistoryPoint[]>>;

export const HISTORY_RANGES = ["6h", "24h", "7d", "30d", "all"] as const;

/** How far back the history chart looks; "all" is every stored price. */
export type HistoryRange = (typeof HISTORY_RANGES)[number];

/** A run of stored prices summarised for the stats row. */
export type RangeStats = {
  count: number;
  first: TokenHistoryPoint;
  last: TokenHistoryPoint;
  low: TokenHistoryPoint;
  high: TokenHistoryPoint;
  /** Mean of the stored prices in copper (each sample counts once). */
  average: number;
};
