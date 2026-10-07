import {
  fetchCurrentKeystoneSeason,
  fetchKeystoneDungeon,
  fetchKeystoneDungeonIndex,
} from "@/features/mythicKeystone/services/mythicKeystoneService";
import { env } from "@/lib/env";

const ONE_HOUR = 60 * 60_000;
/** Timers change with patches, journal text and art far less; a day is plenty. */
const DUNGEON_STALE_MS = 24 * ONE_HOUR;

export const keystoneKeys = {
  index: () => ["keystone-dungeon-index", env.region] as const,
  season: () => ["keystone-current-season", env.region] as const,
  dungeon: (dungeonId: number) =>
    ["keystone-dungeon", dungeonId, env.region, env.locale] as const,
};

export const keystoneIndexQuery = () => ({
  queryKey: keystoneKeys.index(),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchKeystoneDungeonIndex(signal),
  staleTime: ONE_HOUR,
});

export const keystoneSeasonQuery = () => ({
  queryKey: keystoneKeys.season(),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchCurrentKeystoneSeason(signal),
  staleTime: ONE_HOUR,
});

/** Shared by the cards and the dialog so both read one cache entry. */
export const keystoneDungeonQuery = (dungeonId: number) => ({
  queryKey: keystoneKeys.dungeon(dungeonId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchKeystoneDungeon(dungeonId, signal),
  staleTime: DUNGEON_STALE_MS,
});
