import {
  fetchAppearance,
  fetchAppearanceItem,
  fetchSet,
  fetchSetIndex,
  fetchSlotIndex,
  searchAppearances,
} from "@/features/itemAppearances/services/appearanceService";
import { createPriorityLimiter } from "@/features/itemAppearances/services/priorityLimiter";
import type { FetchPriority } from "@/features/itemAppearances/services/priorityLimiter";
import type { AppearanceCriteria } from "@/features/itemAppearances/types";
import {
  fetchItemMediaUrl,
  itemKeys,
} from "@/features/items/services/itemService";
import { env } from "@/lib/env";

/** Sets, appearances and items change with patches, not hours. */
const STATIC_STALE_MS = 24 * 60 * 60_000;
/**
 * A search page is static too, but a visitor may page through dozens; an
 * hour keeps the cache lean.
 */
const SEARCH_STALE_MS = 60 * 60_000;

/*
 * A set card needs three lookups in a row (its set, its first piece, that
 * piece's first item's icon) and an appearance card two, all started as the
 * card nears the viewport. A page of 24 started at once would burst through
 * the proxy, which shares Blizzard's per-second quota with every other
 * visitor (and Netlify allows each IP 600 a minute), so records go six at a
 * time and icons six at a time beside them (an icon never waits behind a
 * page of records). Within each, a dialog's lookups go first and a set
 * card's first piece goes before the next cards' sets, so the top row
 * finishes before the rows below it start (see priorityLimiter). A card that
 * unmounts (a new page) cancels what it still had queued.
 */
const MAX_IN_FLIGHT = 6;
const limitRecordFetch = createPriorityLimiter(MAX_IN_FLIGHT);
const limitIconFetch = createPriorityLimiter(MAX_IN_FLIGHT);

/*
 * Names are localized, so those keys carry the locale; the slot index holds
 * types only, so its key does not.
 */
export const appearanceKeys = {
  all: () => ["item-appearances"] as const,
  setIndex: () => ["item-appearances", "set-index", env.region, env.locale] as const,
  set: (setId: number) => ["item-appearances", "set", setId, env.region, env.locale] as const,
  slotIndex: () => ["item-appearances", "slot-index", env.region] as const,
  /** Prefix of every search page (see useSlotNames). */
  searches: () => ["item-appearances", "search"] as const,
  search: (criteria: AppearanceCriteria, page: number) =>
    [
      "item-appearances",
      "search",
      criteria.slot,
      criteria.sort,
      page,
      env.region,
      env.locale,
    ] as const,
  /** Prefix of every appearance record (see useSlotNames). */
  appearances: () => ["item-appearances", "appearance"] as const,
  appearance: (appearanceId: number) =>
    ["item-appearances", "appearance", appearanceId, env.region, env.locale] as const,
  item: (itemId: number) => ["item-appearances", "item", itemId, env.region, env.locale] as const,
};

export const setIndexQuery = () => ({
  queryKey: appearanceKeys.setIndex(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchSetIndex(signal),
  staleTime: STATIC_STALE_MS,
});

/**
 * Shared by the set card and the set dialog, so opening a card costs
 * nothing. `priority` only orders the fetch; the cache entry is the same.
 */
export const setQuery = (setId: number, priority: FetchPriority = "card") => ({
  queryKey: appearanceKeys.set(setId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitRecordFetch(() => fetchSet(setId, signal), signal, priority),
  staleTime: STATIC_STALE_MS,
});

export const slotIndexQuery = () => ({
  queryKey: appearanceKeys.slotIndex(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchSlotIndex(signal),
  staleTime: STATIC_STALE_MS,
});

export const appearanceSearchQuery = (criteria: AppearanceCriteria, page: number) => ({
  queryKey: appearanceKeys.search(criteria, page),
  queryFn: ({ signal }: { signal: AbortSignal }) => searchAppearances(criteria, page, signal),
  staleTime: SEARCH_STALE_MS,
});

/** Shared by the appearance cards, the set pieces, both dialogs and the set cards' icons. */
export const appearanceQuery = (appearanceId: number, priority: FetchPriority = "card") => ({
  queryKey: appearanceKeys.appearance(appearanceId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitRecordFetch(() => fetchAppearance(appearanceId, signal), signal, priority),
  staleTime: STATIC_STALE_MS,
});

/** An item's quality and level, for the appearance dialog (and nothing behind it). */
export const appearanceItemQuery = (itemId: number) => ({
  queryKey: appearanceKeys.item(itemId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitRecordFetch(() => fetchAppearanceItem(itemId, signal), signal, "dialog"),
  staleTime: STATIC_STALE_MS,
});

/**
 * The Items explorer's own cache entry: an icon seen there (or in the
 * Journal) costs nothing here.
 */
export const itemIconQuery = (itemId: number, priority: FetchPriority = "card") => ({
  queryKey: itemKeys.media(itemId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitIconFetch(() => fetchItemMediaUrl(itemId, signal), signal, priority),
  staleTime: Infinity,
  gcTime: STATIC_STALE_MS,
});
