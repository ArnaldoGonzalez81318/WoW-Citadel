import {
  fetchAffixIcon,
  fetchKeystoneLeaderboard,
  fetchKeystonePeriod,
  fetchSpecialization,
} from "@/features/mythicLeaderboard/services/leaderboardService";
import { env } from "@/lib/env";

/** Blizzard rebuilds leaderboards through the week; a few minutes is fresh enough. */
const BOARD_STALE_MS = 5 * 60_000;
/** Specs, affix icons and past periods do not change. */
const STATIC_STALE_MS = 24 * 60 * 60_000;

export const leaderboardKeys = {
  board: (realmId: number, dungeonId: number, periodId: number) =>
    ["keystone-leaderboard", realmId, dungeonId, periodId, env.region, env.locale] as const,
  period: (periodId: number) => ["keystone-period", periodId, env.region] as const,
  spec: (specId: number) => ["playable-specialization", specId, env.region, env.locale] as const,
  affixIcon: (affixId: number) => ["keystone-affix-icon", affixId, env.region] as const,
};

/** `closed`: a finished week, whose ranking is final (up to ~1 MB not worth refetching). */
export const leaderboardQuery = (
  realmId: number,
  dungeonId: number,
  periodId: number,
  closed = false,
) => ({
  queryKey: leaderboardKeys.board(realmId, dungeonId, periodId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchKeystoneLeaderboard(realmId, dungeonId, periodId, signal),
  staleTime: closed ? STATIC_STALE_MS : BOARD_STALE_MS,
});

export const periodQuery = (periodId: number) => ({
  queryKey: leaderboardKeys.period(periodId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchKeystonePeriod(periodId, signal),
  staleTime: STATIC_STALE_MS,
});

export const specQuery = (specId: number) => ({
  queryKey: leaderboardKeys.spec(specId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchSpecialization(specId, signal),
  staleTime: Infinity,
  gcTime: STATIC_STALE_MS,
});

export const affixIconQuery = (affixId: number) => ({
  queryKey: leaderboardKeys.affixIcon(affixId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchAffixIcon(affixId, signal),
  staleTime: Infinity,
  gcTime: STATIC_STALE_MS,
});
