import { fetchItemMediaUrl, itemKeys } from "@/features/items/services/itemService";
import { fetchTokenItem } from "@/features/wowToken/services/tokenItemService";
import { env } from "@/lib/env";

/** Item records and icons change with patches, not hours. */
const ITEM_STALE_MS = 24 * 60 * 60_000;

/*
 * Prices are not keyed here: they read the Regions page's
 * `regionTokenQuery`, whose key for the app's own region is the home
 * ticker's `WOW_TOKEN_QUERY_KEY`, so all three pages share one entry per
 * region. Item names are localized, so their key carries the locale.
 */
export const wowTokenKeys = {
  item: (itemId: number) => ["wow-token", "item", itemId, env.region, env.locale] as const,
};

export const tokenItemQuery = (itemId: number) => ({
  queryKey: wowTokenKeys.item(itemId),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchTokenItem(itemId, signal),
  staleTime: ITEM_STALE_MS,
});

/** The Items explorer's own icon entry, so every page reads one cache. */
export const tokenItemIconQuery = (itemId: number) => ({
  queryKey: itemKeys.media(itemId),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchItemMediaUrl(itemId, signal),
  staleTime: ITEM_STALE_MS,
});
