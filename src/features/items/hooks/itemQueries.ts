import { createConcurrencyLimiter } from "@/features/pvpTiers/services/concurrencyLimiter";
import {
  fetchItemClassDetail,
  fetchItemClassIndex,
  fetchItemMediaUrl,
  fetchItemRecord,
  itemKeys,
  searchItems,
} from "@/features/items/services/itemService";
import { fetchItemSet, fetchItemSetIndex } from "@/features/items/services/itemSetService";
import type { ItemSearchCriteria } from "@/features/items/types";

/** Items, classes and sets change with patches, not hours. */
const STATIC_STALE_MS = 24 * 60 * 60_000;
/** A search page is static data too, but a visitor may page through many; an hour keeps the cache lean. */
const SEARCH_STALE_MS = 60 * 60_000;

/*
 * A page of cards, the class tiles and a page of set cards each start a
 * burst of icon (and set) lookups as they near the viewport. Started
 * together they would go through the proxy at once, which shares
 * Blizzard's per-second quota with every other visitor (and Netlify allows
 * each IP 600 a minute), so they go six at a time. Lookups queued by cards
 * that unmount (a new page) are cancelled and leave the queue.
 */
const MAX_IN_FLIGHT = 6;
const limitIconFetch = createConcurrencyLimiter(MAX_IN_FLIGHT);
/* Separate queues, so an opened item never waits behind a page of set cards. */
const limitRecordFetch = createConcurrencyLimiter(MAX_IN_FLIGHT);
const limitSetFetch = createConcurrencyLimiter(MAX_IN_FLIGHT);

/*
 * Under the shared `itemKeys.all` root (region + locale), beside the keys
 * the rest of the app shares; the explorer's own entries get their own
 * names (its class records are shaped differently from what the old page
 * kept under `itemKeys.classIndex`, so they do not reuse those keys).
 */
export const itemExplorerKeys = {
  classIndex: () => [...itemKeys.all, "explorer-class-index"] as const,
  classDetail: (classId: number) => [...itemKeys.all, "explorer-class-detail", classId] as const,
  search: (criteria: ItemSearchCriteria, page: number) =>
    [
      ...itemKeys.all,
      "explorer-search",
      criteria.name,
      criteria.classId,
      criteria.subclassId,
      criteria.quality,
      criteria.slot,
      criteria.level.min,
      criteria.level.max,
      criteria.sort,
      page,
    ] as const,
  record: (itemId: number) => [...itemKeys.all, "explorer-record", itemId] as const,
  setIndex: () => [...itemKeys.all, "explorer-set-index"] as const,
  set: (setId: number) => [...itemKeys.all, "explorer-set", setId] as const,
};

export const itemSearchQuery = (criteria: ItemSearchCriteria, page: number) => ({
  queryKey: itemExplorerKeys.search(criteria, page),
  queryFn: ({ signal }: { signal: AbortSignal }) => searchItems(criteria, page, signal),
  staleTime: SEARCH_STALE_MS,
});

export const itemClassIndexQuery = () => ({
  queryKey: itemExplorerKeys.classIndex(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchItemClassIndex(signal),
  staleTime: STATIC_STALE_MS,
});

export const itemClassDetailQuery = (classId: number) => ({
  queryKey: itemExplorerKeys.classDetail(classId),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchItemClassDetail(classId, signal),
  staleTime: STATIC_STALE_MS,
});

/**
 * One item with its tooltip (null when Blizzard has none). Shared by the
 * dialog and the set pieces, which list several at once, hence the cap.
 */
export const itemRecordQuery = (itemId: number) => ({
  queryKey: itemExplorerKeys.record(itemId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitRecordFetch(() => fetchItemRecord(itemId, signal), signal),
  staleTime: STATIC_STALE_MS,
});

/** The app-wide icon cache entry (header search, Quests, Journal…), six at a time. */
export const itemIconQuery = (itemId: number) => ({
  queryKey: itemKeys.media(itemId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitIconFetch(() => fetchItemMediaUrl(itemId, signal), signal),
  staleTime: Infinity,
  gcTime: STATIC_STALE_MS,
});

export const itemSetIndexQuery = () => ({
  queryKey: itemExplorerKeys.setIndex(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchItemSetIndex(signal),
  staleTime: STATIC_STALE_MS,
});

/** Shared by the set cards and the set dialog. */
export const itemSetQuery = (setId: number) => ({
  queryKey: itemExplorerKeys.set(setId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitSetFetch(() => fetchItemSet(setId, signal), signal),
  staleTime: STATIC_STALE_MS,
});
