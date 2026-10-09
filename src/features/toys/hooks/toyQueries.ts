import { fetchItemMediaUrl, itemKeys } from "@/features/items/services/itemService";
import { createConcurrencyLimiter } from "@/features/pvpTiers/services/concurrencyLimiter";
import { getToyEntry, putToyEntry } from "@/features/toys/services/toyRecordStore";
import { fetchToy, fetchToyIndex, fetchToyItem } from "@/features/toys/services/toyService";
import { env } from "@/lib/env";

/** Toys and their items change with patches, not hours. */
export const TOY_STALE_MS = 24 * 60 * 60_000;

/*
 * A page of 24 cards starts a record lookup per card as it nears the
 * viewport, then an icon lookup once the record names the item. Started
 * together they would burst through the proxy, which shares Blizzard's
 * per-second quota with every other visitor (and Netlify allows each IP 600
 * a minute); six of each at a time land a page in about a second. Cards left
 * behind by a page change cancel their queued lookups. The source scan's
 * reads queue here too, so a card never waits behind more than its share.
 */
const limitToyFetch = createConcurrencyLimiter(6);
const limitIconFetch = createConcurrencyLimiter(6);

/* Names are localized, so every key carries the locale. */
export const toyKeys = {
  index: () => ["toys", "index", env.region, env.locale] as const,
  toy: (toyId: number) => ["toys", "toy", toyId, env.region, env.locale] as const,
  item: (itemId: number) => ["toys", "item", itemId, env.region, env.locale] as const,
};

export const toyIndexQuery = () => ({
  queryKey: toyKeys.index(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchToyIndex(signal),
  staleTime: TOY_STALE_MS,
});

/**
 * One toy record (null when Blizzard has none). Shared by the cards, the
 * spotlight, the dialog and the source scan, and kept in the browser's
 * record store for a day: a record read on an earlier visit is this query's
 * initial data, so it costs no request at all.
 */
export const toyQuery = (toyId: number) => ({
  queryKey: toyKeys.toy(toyId),
  queryFn: async ({ signal }: { signal: AbortSignal }) => {
    const record = await limitToyFetch(() => fetchToy(toyId, signal), signal);
    putToyEntry(toyId, record);
    return record;
  },
  initialData: () => getToyEntry(toyId)?.record,
  initialDataUpdatedAt: () => getToyEntry(toyId)?.fetchedAt,
  staleTime: TOY_STALE_MS,
  gcTime: TOY_STALE_MS,
});

/** The toy's item record: its tooltip text, for the dialog and the spotlight. */
export const toyItemQuery = (itemId: number) => ({
  queryKey: toyKeys.item(itemId),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchToyItem(itemId, signal),
  staleTime: TOY_STALE_MS,
});

/** The Items explorer's own cache entry: an icon seen there costs nothing here. */
export const toyIconQuery = (itemId: number) => ({
  queryKey: itemKeys.media(itemId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitIconFetch(() => fetchItemMediaUrl(itemId, signal), signal),
  staleTime: Infinity,
  gcTime: TOY_STALE_MS,
});
