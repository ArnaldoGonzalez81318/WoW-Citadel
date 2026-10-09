import type { QueryClient } from "@tanstack/react-query";

import {
  fetchItemMediaUrl,
  itemKeys,
} from "@/features/items/services/itemService";
import {
  fetchHeirloom,
  fetchHeirloomIndex,
} from "@/features/heirlooms/services/heirloomService";
import type { Heirloom } from "@/features/heirlooms/types";
import { createConcurrencyLimiter } from "@/features/pvpTiers/services/concurrencyLimiter";
import { env } from "@/lib/env";

/** Heirlooms change with patches, not days. */
export const HEIRLOOM_STALE_MS = 24 * 60 * 60_000;

/**
 * Records in flight at once. Grouping by slot needs every record (134 on
 * US); started together they would burst through the proxy, which shares
 * Blizzard's quota with every visitor (and Netlify allows each IP 600
 * requests a minute). Six at a time loads them in a few seconds.
 */
const MAX_RECORDS_IN_FLIGHT = 6;
const limitRecordFetch = createConcurrencyLimiter(MAX_RECORDS_IN_FLIGHT);

/**
 * Icons get a queue of their own: behind the records' they would wait for
 * the whole collection, and the first screen of cards asks for ~30 at once.
 */
const MAX_ICONS_IN_FLIGHT = 6;
const limitIconFetch = createConcurrencyLimiter(MAX_ICONS_IN_FLIGHT);

/** Names and tooltip lines are localized, so every key carries the locale too. */
export const heirloomKeys = {
  index: () => ["heirlooms", "index", env.region, env.locale] as const,
  record: (heirloomId: number) =>
    ["heirlooms", "record", heirloomId, env.region, env.locale] as const,
};

// The whole collection is ~2.4 MB of records: kept for as long as it stays
// fresh, so coming back to the page after the app's 30-minute gcTime does
// not load all 134 again.
export const heirloomIndexQuery = () => ({
  queryKey: heirloomKeys.index(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchHeirloomIndex(signal),
  staleTime: HEIRLOOM_STALE_MS,
  gcTime: HEIRLOOM_STALE_MS,
});

/*
 * Record fetches still waiting for a slot, per heirloom. A count, not a
 * flag: StrictMode's remount queues a second fetch before the cancelled
 * first one has left the queue.
 */
const queuedRecords = new Map<number, number>();
const countQueued = (heirloomId: number, delta: 1 | -1): void => {
  const next = (queuedRecords.get(heirloomId) ?? 0) + delta;
  if (next > 0) {
    queuedRecords.set(heirloomId, next);
  } else {
    queuedRecords.delete(heirloomId);
  }
};

/** Heirlooms a dialog was opened on: their record skips the queue. */
const urgentRecords = new Set<number>();

const fetchRecord = (heirloomId: number, signal: AbortSignal): Promise<Heirloom | null> => {
  if (urgentRecords.has(heirloomId)) {
    return fetchHeirloom(heirloomId, signal);
  }
  countQueued(heirloomId, 1);
  let waiting = true;
  const leaveQueue = (): void => {
    if (waiting) {
      waiting = false;
      countQueued(heirloomId, -1);
    }
  };
  return limitRecordFetch(() => {
    leaveQueue();
    return fetchHeirloom(heirloomId, signal);
  }, signal).finally(leaveQueue);
};

/** Shared by the collection, the cards and the dialog: one request per heirloom. */
export const heirloomQuery = (heirloomId: number) => ({
  queryKey: heirloomKeys.record(heirloomId),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchRecord(heirloomId, signal),
  staleTime: HEIRLOOM_STALE_MS,
  gcTime: HEIRLOOM_STALE_MS,
});

/**
 * Pulls a record still waiting in the queue to the front, for a dialog
 * opened on it (a card clicked while the collection loads), so it does not
 * wait for a hundred others. Cancelling aborts the waiting fetch, which
 * drops it from the limiter and puts the query back where it was; the
 * refetch then runs outside the queue. A record already in flight or
 * loaded is left alone.
 */
export const prioritizeHeirloom = (queryClient: QueryClient, heirloomId: number): void => {
  if (!queuedRecords.has(heirloomId)) {
    return;
  }
  urgentRecords.add(heirloomId);
  const filters = { queryKey: heirloomKeys.record(heirloomId), exact: true };
  void queryClient
    .cancelQueries(filters)
    .then(() => queryClient.refetchQueries(filters));
};

/** The Items explorer's key and fetcher, so an icon it already loaded is reused. */
export const heirloomIconQuery = (itemId: number) => ({
  queryKey: itemKeys.media(itemId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitIconFetch(() => fetchItemMediaUrl(itemId, signal), signal),
  staleTime: HEIRLOOM_STALE_MS,
});
