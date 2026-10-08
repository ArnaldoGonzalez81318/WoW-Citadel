import type { Query, QueryClient } from "@tanstack/react-query";

import {
  fetchNeighborhood,
  fetchNeighborhoodMaps,
  findNewestInMap,
  findNewestNumber,
} from "@/features/neighborhoods/services/neighborhoodService";
import type { Neighborhood } from "@/features/neighborhoods/types";
import { createConcurrencyLimiter } from "@/features/pvpTiers/services/concurrencyLimiter";
import { env } from "@/lib/env";

const ONE_MINUTE = 60_000;
/** Maps are added with expansions, not hourly. */
const MAPS_STALE_MS = 24 * 60 * ONE_MINUTE;
/** A neighborhood keeps its number and map; a rename is rare. */
const RECORD_STALE_MS = 30 * ONE_MINUTE;
/** Players found neighborhoods all day; ten minutes keeps "newest" honest. */
const NEWEST_STALE_MS = 10 * ONE_MINUTE;

/*
 * A hit never moves (a number stays on its map), but a miss near the top is
 * a number nobody has founded yet, and minutes later it may be taken. The
 * newest search re-asks exactly the numbers it asked before, so if it
 * trusted its misses as long as its hits a refresh would replay the old
 * answer from the cache and stamp it fresh: a miss is only believed as long
 * as "newest" itself.
 */
const recordStaleMs = (record: Neighborhood | null | undefined): number =>
  record === null ? NEWEST_STALE_MS : RECORD_STALE_MS;

/**
 * Every neighborhood request on the page shares this cap: a register page
 * is 25 lookups and the newest-number search six per round, and started
 * together they would burst through the proxy, which shares Blizzard's
 * per-second quota with every other visitor (and Netlify allows each IP
 * 600 a minute).
 */
const MAX_LOOKUPS_IN_FLIGHT = 6;
const limitLookup = createConcurrencyLimiter(MAX_LOOKUPS_IN_FLIGHT);

export const neighborhoodKeys = {
  maps: () => ["neighborhood-maps", env.region, env.locale] as const,
  record: (mapId: number, number: number) =>
    ["neighborhood", mapId, number, env.region, env.locale] as const,
  // Existence only: the answer does not depend on the locale.
  newest: (mapIds: readonly number[]) =>
    ["neighborhood-newest-number", mapIds.join(","), env.region] as const,
  newestInMap: (mapId: number, from: number) =>
    ["neighborhood-newest-in-map", mapId, from, env.region, env.locale] as const,
};

type QueryContext = { signal: AbortSignal };

export const neighborhoodMapsQuery = () => ({
  queryKey: neighborhoodKeys.maps(),
  queryFn: ({ signal }: QueryContext) => fetchNeighborhoodMaps(signal),
  staleTime: MAPS_STALE_MS,
});

/**
 * One number on one map: the neighborhood, or null when it is on another
 * map (or none). Shared by the register, the dialog and both searches, so
 * a neighborhood is asked of a map once per half hour at most, and a miss
 * once per ten minutes (the register's last page then lists neighborhoods
 * founded since, like the newest search).
 */
export const neighborhoodRecordQuery = (mapId: number, number: number) => ({
  queryKey: neighborhoodKeys.record(mapId, number),
  queryFn: ({ signal }: QueryContext) =>
    limitLookup(() => fetchNeighborhood(mapId, number, signal), signal),
  staleTime: (query: Query<Neighborhood | null>) => recordStaleMs(query.state.data),
});

/**
 * The searches walk numbers one round at a time inside a single query, so
 * they read a fresh record straight from the cache and store what they
 * fetch. (Not `fetchQuery`: that applies the app's retry policy to every
 * lookup and the search's own query retries again on top.)
 */
const cachedLookup = (
  queryClient: QueryClient,
  mapId: number,
  number: number,
  signal: AbortSignal,
): Promise<Neighborhood | null> => {
  const key = neighborhoodKeys.record(mapId, number);
  const state = queryClient.getQueryState<Neighborhood | null>(key);
  if (
    state?.data !== undefined &&
    state.status === "success" &&
    Date.now() - state.dataUpdatedAt < recordStaleMs(state.data)
  ) {
    return Promise.resolve(state.data);
  }
  return limitLookup(() => fetchNeighborhood(mapId, number, signal), signal).then(
    (record) => {
      queryClient.setQueryData(key, record);
      return record;
    },
  );
};

/**
 * The region's highest neighborhood number (0 when there are none): the
 * register's last page and the header's count. Every probe asks all maps
 * at once, since a 404 from one map says nothing about the others.
 */
export const newestNumberQuery = (
  queryClient: QueryClient,
  mapIds: readonly number[],
) => ({
  queryKey: neighborhoodKeys.newest(mapIds),
  queryFn: ({ signal }: QueryContext) =>
    findNewestNumber(async (number) => {
      const records = await Promise.all(
        mapIds.map((mapId) => cachedLookup(queryClient, mapId, number, signal)),
      );
      return records.some((record) => record !== null);
    }),
  staleTime: NEWEST_STALE_MS,
});

/** A map's highest-numbered neighborhood at or below the region's newest number. */
export const newestInMapQuery = (
  queryClient: QueryClient,
  mapId: number,
  from: number,
) => ({
  queryKey: neighborhoodKeys.newestInMap(mapId, from),
  queryFn: ({ signal }: QueryContext) =>
    findNewestInMap(
      (number) => cachedLookup(queryClient, mapId, number, signal),
      from,
    ),
  staleTime: NEWEST_STALE_MS,
});
