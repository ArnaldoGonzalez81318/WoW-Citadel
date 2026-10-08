import {
  fetchAchievementIcon,
  fetchPvpBoardIndex,
  fetchPvpLadder,
  fetchPvpRewards,
  fetchPvpSeason,
  fetchPvpSeasonIndex,
} from "@/features/pvpSeasons/services/pvpSeasonService";
import { env } from "@/lib/env";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Blizzard rebuilds a running season's boards through the day; minutes is fresh enough. */
const LIVE_BOARD_STALE_MS = 10 * MINUTE;
/**
 * A board is up to ~2 MB of JSON (kept as compact entries): one the viewer
 * has left is dropped after a few minutes instead of the app's 30, so
 * paging through specs does not pile them up in memory.
 */
const BOARD_GC_MS = 5 * MINUTE;

export const pvpSeasonKeys = {
  index: () => ["pvp-season-index", env.region] as const,
  season: (seasonId: number) => ["pvp-season", seasonId, env.region, env.locale] as const,
  boards: (seasonId: number) => ["pvp-season-boards", seasonId, env.region] as const,
  ladder: (seasonId: number, slug: string) =>
    ["pvp-season-ladder", seasonId, slug, env.region] as const,
  rewards: (seasonId: number) =>
    ["pvp-season-rewards", seasonId, env.region, env.locale] as const,
  achievementIcon: (achievementId: number) =>
    ["achievement-icon", achievementId, env.region] as const,
};

export const pvpSeasonIndexQuery = () => ({
  queryKey: pvpSeasonKeys.index(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchPvpSeasonIndex(signal),
  staleTime: HOUR,
});

/** Shared by the season picker's options and the season header. */
export const pvpSeasonQuery = (seasonId: number) => ({
  queryKey: pvpSeasonKeys.season(seasonId),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchPvpSeason(seasonId, signal),
  staleTime: HOUR,
});

/** `ended`: a past season, whose boards and cutoffs are final. */
export const pvpBoardIndexQuery = (seasonId: number, ended = false) => ({
  queryKey: pvpSeasonKeys.boards(seasonId),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchPvpBoardIndex(seasonId, signal),
  staleTime: ended ? DAY : HOUR,
});

export const pvpLadderQuery = (seasonId: number, slug: string, ended = false) => ({
  queryKey: pvpSeasonKeys.ladder(seasonId, slug),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchPvpLadder(seasonId, slug, signal),
  staleTime: ended ? DAY : LIVE_BOARD_STALE_MS,
  gcTime: BOARD_GC_MS,
});

export const pvpRewardsQuery = (seasonId: number, ended = false) => ({
  queryKey: pvpSeasonKeys.rewards(seasonId),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchPvpRewards(seasonId, signal),
  staleTime: ended ? DAY : HOUR,
});

export const achievementIconQuery = (achievementId: number) => ({
  queryKey: pvpSeasonKeys.achievementIcon(achievementId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchAchievementIcon(achievementId, signal),
  staleTime: Infinity,
  gcTime: DAY,
});
