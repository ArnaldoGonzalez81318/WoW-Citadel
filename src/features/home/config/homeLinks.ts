import { findNavItemBySlug } from "@/components/layout/navigation/navConfig";
import { preloadRouteChunk } from "@/components/layout/navigation/navUtils";
import { CURRENT_SEASON_TIER_ID } from "@/features/journal/services/journalService";

/** The menu's own path for an explorer, so a route that moves in navConfig moves here too. */
const pathFor = (slug: string): string =>
  findNavItemBySlug(slug)?.path ?? `/category/${slug}`;

const withParams = (
  path: string,
  params: Readonly<Record<string, number>>,
): string =>
  `${path}?${new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  ).toString()}`;

/** Explorer routes the home page links to. */
export const HOME_PATHS = {
  wowToken: pathFor("wow-token"),
  keystoneDungeons: pathFor("mythic-keystone-dungeon"),
  keystoneLeaderboards: pathFor("mythic-keystone-leaderboard"),
  hallOfFame: pathFor("mythic-raid-leaderboard"),
  journal: pathFor("journal"),
  pvpSeasons: pathFor("pvp-season"),
} as const;

/**
 * One dungeon's board for this week: the leaderboard page checks `?dungeon`
 * against the running season and opens on the current period by itself.
 */
export const leaderboardForDungeon = (dungeonId: number): string =>
  withParams(HOME_PATHS.keystoneLeaderboards, { dungeon: dungeonId });

/** The Encounter Journal on its Current Season tier. */
export const journalSeason = (): string =>
  withParams(HOME_PATHS.journal, { expansion: CURRENT_SEASON_TIER_ID });

/** One raid or dungeon, opened inside the Current Season tier it is listed in. */
export const journalInstance = (instanceId: number): string =>
  withParams(HOME_PATHS.journal, {
    expansion: CURRENT_SEASON_TIER_ID,
    instance: instanceId,
  });

export const pvpSeasonPath = (seasonId: number): string =>
  withParams(HOME_PATHS.pvpSeasons, { season: seasonId });

/**
 * Warms the destination's route chunk (never its data) on hover or focus.
 * The preloader keys category routes on everything after `/category/`, so
 * a query string would read as part of the slug and warm the wrong page.
 */
export const preloadLink = (to: string): void => {
  preloadRouteChunk(to.split("?")[0]);
};
