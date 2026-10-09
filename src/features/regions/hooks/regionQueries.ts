import { fetchItemMediaUrl, itemKeys } from "@/features/items/services/itemService";
import {
  fetchRegionRealmCounts,
  fetchRegionRealmMakeup,
  fetchRegionRecord,
  fetchRegionTokenPrice,
} from "@/features/regions/services/regionService";
import type { Region } from "@/features/regions/types";
import {
  TOKEN_REFRESH_MINUTES,
  WOW_TOKEN_QUERY_KEY,
} from "@/features/search/hooks/useWowTokenPrice";
import { env } from "@/lib/env";
import { SUPPORTED_REGIONS } from "@/lib/region";

/** Every API region, in the order Blizzard's own pickers use. */
export const REGIONS: readonly Region[] = SUPPORTED_REGIONS;

/** The WoW Token item; its icon heads every card's price. */
export const WOW_TOKEN_ITEM_ID = 122284;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** Names and tags never change; the patch string does, a few times a year. */
const RECORD_STALE_MS = HOUR;
const COUNTS_STALE_MS = HOUR;
/** As long as the Connected Realms explorer keeps its catalog fresh. */
const MAKEUP_STALE_MS = 30 * MINUTE;
/** A little under the refresh interval, so a remount refetches. */
const TOKEN_STALE_MS = (TOKEN_REFRESH_MINUTES - 1) * MINUTE;
const TOKEN_REFETCH_MS = TOKEN_REFRESH_MINUTES * MINUTE;
const ICON_STALE_MS = 24 * HOUR;

/*
 * Keys name the region the data was fetched from (each request names that
 * region's namespace), not the build's `env.region`, which would only
 * duplicate entries; localized payloads add `env.locale`.
 */
export const regionKeys = {
  record: (region: Region) =>
    ["regions", "record", region, env.locale] as const,
  realmCounts: (region: Region) => ["regions", "realm-counts", region] as const,
  makeup: (region: Region) =>
    ["regions", "realm-makeup", region, env.locale] as const,
  /**
   * `WOW_TOKEN_QUERY_KEY`'s shape (`["wow-token-price", region]`), so the
   * app's own region has one entry, which the home page's token card reads
   * too: arriving from the home page shows its price at once, and the two
   * never disagree.
   */
  token: (region: Region) => [WOW_TOKEN_QUERY_KEY[0], region] as const,
};

export const regionRecordQuery = (region: Region) => ({
  queryKey: regionKeys.record(region),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchRegionRecord(region, signal),
  staleTime: RECORD_STALE_MS,
});

export const regionTokenQuery = (region: Region) => ({
  queryKey: regionKeys.token(region),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchRegionTokenPrice(region, signal),
  staleTime: TOKEN_STALE_MS,
  // Blizzard republishes roughly every 20 minutes; four tiny requests per
  // interval keep a page left open honest.
  refetchInterval: TOKEN_REFETCH_MS,
});

export const regionRealmCountsQuery = (region: Region) => ({
  queryKey: regionKeys.realmCounts(region),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchRegionRealmCounts(region, signal),
  staleTime: COUNTS_STALE_MS,
});

export const regionMakeupQuery = (region: Region) => ({
  queryKey: regionKeys.makeup(region),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchRegionRealmMakeup(region, signal),
  staleTime: MAKEUP_STALE_MS,
});

/** The Items explorer's own icon entry, so both read one cache. */
export const tokenIconQuery = () => ({
  queryKey: itemKeys.media(WOW_TOKEN_ITEM_ID),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchItemMediaUrl(WOW_TOKEN_ITEM_ID, signal),
  staleTime: ICON_STALE_MS,
});
