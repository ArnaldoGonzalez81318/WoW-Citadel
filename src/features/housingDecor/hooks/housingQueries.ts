import {
  fetchItemMediaUrl,
  itemKeys,
} from "@/features/items/services/itemService";
import {
  fetchDecor,
  fetchDecorIndex,
  fetchDecorItem,
  fetchDecorItemLinks,
  fetchDecorItemSummaries,
  fetchFixture,
  fetchFixtures,
  fetchHookTypeCounts,
  fetchRooms,
} from "@/features/housingDecor/services/housingService";
import { createConcurrencyLimiter } from "@/features/pvpTiers/services/concurrencyLimiter";
import { env } from "@/lib/env";

/** Housing data changes with patches, not hours. */
const STATIC_STALE_MS = 24 * 60 * 60_000;
/** A page's batch is static too, but a visitor may page through many; an hour keeps the cache lean. */
const PAGE_STALE_MS = 60 * 60_000;

/*
 * Records (a decor, its item, a family's fixtures) go six at a time: a roof
 * family opens eighteen fixture records at once, and the proxy shares
 * Blizzard's per-second quota with every visitor (Netlify allows each IP
 * 600 requests a minute). Icons get a cap of their own, so a card's icon
 * never waits behind a dialog's records.
 */
const MAX_IN_FLIGHT = 6;
const limitRecordFetch = createConcurrencyLimiter(MAX_IN_FLIGHT);
const limitIconFetch = createConcurrencyLimiter(MAX_IN_FLIGHT);

/*
 * Names are localized, so those keys carry the locale; the decor-to-item
 * links are ids only.
 */
export const housingKeys = {
  decorIndex: () => ["housing-decor", "decor-index", env.region, env.locale] as const,
  itemLinks: (decorIds: readonly number[]) =>
    ["housing-decor", "item-links", decorIds.join(","), env.region] as const,
  itemSummaries: (itemIds: readonly number[]) =>
    ["housing-decor", "item-summaries", itemIds.join(","), env.region, env.locale] as const,
  decor: (decorId: number) => ["housing-decor", "decor", decorId, env.region, env.locale] as const,
  item: (itemId: number) => ["housing-decor", "item", itemId, env.region, env.locale] as const,
  fixtures: () => ["housing-decor", "fixtures", env.region, env.locale] as const,
  fixture: (fixtureId: number) =>
    ["housing-decor", "fixture", fixtureId, env.region, env.locale] as const,
  hookCounts: () => ["housing-decor", "hook-counts", env.region, env.locale] as const,
  rooms: () => ["housing-decor", "rooms", env.region, env.locale] as const,
};

export const decorIndexQuery = () => ({
  queryKey: housingKeys.decorIndex(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchDecorIndex(signal),
  staleTime: STATIC_STALE_MS,
});

/** One search for a page of decor: which item each comes from (so its icon can load). */
export const decorItemLinksQuery = (decorIds: readonly number[]) => ({
  queryKey: housingKeys.itemLinks(decorIds),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchDecorItemLinks(decorIds, signal),
  staleTime: PAGE_STALE_MS,
});

/** One search for a page's items: their quality, which tints the cards. */
export const decorItemSummariesQuery = (itemIds: readonly number[]) => ({
  queryKey: housingKeys.itemSummaries(itemIds),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchDecorItemSummaries(itemIds, signal),
  staleTime: PAGE_STALE_MS,
});

/** The Items explorer's key and fetcher, so an icon loaded anywhere in the app is reused. */
export const decorIconQuery = (itemId: number) => ({
  queryKey: itemKeys.media(itemId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitIconFetch(() => fetchItemMediaUrl(itemId, signal), signal),
  staleTime: STATIC_STALE_MS,
});

export const decorQuery = (decorId: number) => ({
  queryKey: housingKeys.decor(decorId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitRecordFetch(() => fetchDecor(decorId, signal), signal),
  staleTime: STATIC_STALE_MS,
});

export const decorItemQuery = (itemId: number) => ({
  queryKey: housingKeys.item(itemId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitRecordFetch(() => fetchDecorItem(itemId, signal), signal),
  staleTime: STATIC_STALE_MS,
});

export const fixturesQuery = () => ({
  queryKey: housingKeys.fixtures(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchFixtures(signal),
  staleTime: STATIC_STALE_MS,
});

/** Shared by every row of a family's dialog, so reopening it costs nothing. */
export const fixtureQuery = (fixtureId: number) => ({
  queryKey: housingKeys.fixture(fixtureId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitRecordFetch(() => fetchFixture(fixtureId, signal), signal),
  staleTime: STATIC_STALE_MS,
});

export const hookCountsQuery = () => ({
  queryKey: housingKeys.hookCounts(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchHookTypeCounts(signal),
  staleTime: STATIC_STALE_MS,
});

export const roomsQuery = () => ({
  queryKey: housingKeys.rooms(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchRooms(signal),
  staleTime: STATIC_STALE_MS,
});
