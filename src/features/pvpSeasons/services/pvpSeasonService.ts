import { BlizzardRequestError, blizzardClient } from "@/lib/blizzardClient";
import { localized, namespace, optional404 } from "@/lib/blizzardHelpers";
import { parseBoard, sortBoards } from "@/features/pvpSeasons/services/pvpBrackets";
import type {
  LocalizedString,
  PvpBoardRef,
  PvpFaction,
  PvpLadder,
  PvpLadderEntry,
  PvpRewardCutoff,
  PvpSeason,
  PvpSeasonIndex,
} from "@/features/pvpSeasons/types";

/*
 * Rated PvP seasons live in the dynamic namespace:
 *
 *   pvp-season/index                       every season id, and the current one
 *   pvp-season/{id}                        name (often missing), start and end
 *   pvp-season/{id}/pvp-leaderboard/index  the season's boards, by slug (85 now)
 *   pvp-season/{id}/pvp-leaderboard/{slug} one board: up to ~5,000 characters,
 *                                          about 2 MB for Arena 3v3
 *   pvp-season/{id}/pvp-reward/index       title cutoffs per bracket, spec, faction
 *
 * A board is only ever fetched for the bracket on screen, and paged on the
 * client. The oldest seasons in the index (22–26 on US) answer 403 Forbidden
 * for every one of these records: Blizzard lists them but no longer serves
 * them. The index itself loads with the same credentials, so the page reads
 * a 403 on one season as "not published" (see `isUnpublishedSeasonError`)
 * rather than as rejected credentials; the error still propagates.
 */

type Reference = { id?: number; name?: LocalizedString };

type SeasonIndexResponse = {
  seasons?: Array<{ id?: number }>;
  current_season?: { id?: number };
};

type SeasonResponse = {
  id: number;
  season_name?: LocalizedString | null;
  season_start_timestamp?: number;
  season_end_timestamp?: number;
};

type LeaderboardIndexResponse = {
  leaderboards?: Array<{ name?: string }>;
};

type RawEntry = {
  character?: { id?: number; name?: string; realm?: { id?: number; slug?: string } };
  faction?: { type?: string };
  rank?: number;
  rating?: number;
  season_match_statistics?: { played?: number; won?: number; lost?: number };
  tier?: { id?: number };
};

type LeaderboardResponse = {
  bracket?: { type?: string };
  entries?: RawEntry[];
};

type RewardIndexResponse = {
  rewards?: Array<{
    bracket?: { id?: number; type?: string };
    achievement?: Reference;
    rating_cutoff?: number;
    faction?: { type?: string };
    specialization?: Reference;
  }>;
};

type MediaResponse = {
  assets?: Array<{ key?: string; value?: string }>;
};

/* ------------------------------------------------------------------ */
/* Seasons                                                             */
/* ------------------------------------------------------------------ */

/** "Player vs. Player (Midnight Season 2)" -> "Midnight Season 2". */
const seasonLabel = (raw: string): string | undefined => {
  // Full-width parentheses too: zh_TW / zh_CN names use （…）.
  const inner = /[(（]([^()（）]+)[)）]\s*$/u.exec(raw)?.[1]?.trim();
  return inner || raw.trim() || undefined;
};

/** Every season id, newest first, and the one Blizzard calls current. */
export const fetchPvpSeasonIndex = async (
  signal?: AbortSignal,
): Promise<PvpSeasonIndex> => {
  const response = await blizzardClient.get<SeasonIndexResponse>(
    "/data/wow/pvp-season/index",
    { namespace: namespace("dynamic") },
    { signal },
  );
  const seasonIds = Array.from(
    new Set(
      (response.seasons ?? [])
        .map((season) => season.id)
        .filter((id): id is number => typeof id === "number"),
    ),
  ).sort((left, right) => right - left);
  const currentId = response.current_season?.id;
  return {
    seasonIds,
    currentId: typeof currentId === "number" ? currentId : (seasonIds[0] ?? null),
  };
};

/** One season's name and dates. A 403 (an unpublished season) throws like any other error. */
export const fetchPvpSeason = async (
  seasonId: number,
  signal?: AbortSignal,
): Promise<PvpSeason> => {
  const response = await blizzardClient.get<SeasonResponse>(
    `/data/wow/pvp-season/${seasonId}`,
    { namespace: namespace("dynamic") },
    { signal },
  );
  return {
    id: response.id,
    name: seasonLabel(localized(response.season_name)),
    startTimestamp:
      typeof response.season_start_timestamp === "number"
        ? response.season_start_timestamp
        : undefined,
    endTimestamp:
      typeof response.season_end_timestamp === "number"
        ? response.season_end_timestamp
        : undefined,
  };
};

/**
 * Blizzard lists the oldest seasons but answers 403 for their records. Only
 * meaningful for per-season requests made after the season index loaded
 * with the same credentials; an index 403 is a real credentials problem.
 */
export const isUnpublishedSeasonError = (error: unknown): boolean =>
  error instanceof BlizzardRequestError && error.status === 403;

/* ------------------------------------------------------------------ */
/* Leaderboards                                                        */
/* ------------------------------------------------------------------ */

/**
 * The season's boards: team and overall boards in Blizzard's order, then the
 * per-spec boards sorted by slug (`sortBoards`). A season without boards
 * (404) has none.
 */
export const fetchPvpBoardIndex = async (
  seasonId: number,
  signal?: AbortSignal,
): Promise<PvpBoardRef[]> => {
  const response = await optional404(() =>
    blizzardClient.get<LeaderboardIndexResponse>(
      `/data/wow/pvp-season/${seasonId}/pvp-leaderboard/index`,
      { namespace: namespace("dynamic") },
      { signal },
    ),
  );
  const slugs = (response?.leaderboards ?? [])
    .map((board) => board.name?.trim())
    .filter((slug): slug is string => typeof slug === "string" && slug.length > 0);
  return sortBoards(Array.from(new Set(slugs)).map(parseBoard));
};

const toFaction = (type: string | undefined): PvpFaction | undefined =>
  type === "ALLIANCE" || type === "HORDE" ? type : undefined;

const count = (value: number | undefined): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const toEntry = (raw: RawEntry): PvpLadderEntry | undefined => {
  const name = raw.character?.name?.trim();
  if (!name || typeof raw.rank !== "number" || typeof raw.rating !== "number") {
    return undefined;
  }
  const stats = raw.season_match_statistics;
  return {
    rank: raw.rank,
    rating: raw.rating,
    characterId: raw.character?.id,
    name,
    realmSlug: raw.character?.realm?.slug ?? "",
    faction: toFaction(raw.faction?.type),
    played: count(stats?.played),
    won: count(stats?.won),
    lost: count(stats?.lost),
    tierId: typeof raw.tier?.id === "number" ? raw.tier.id : undefined,
  };
};

/**
 * One board, ranked best first, kept as compact entries (the raw 3v3 board
 * is ~2 MB of JSON). A board Blizzard has not built yet (404) is empty.
 */
export const fetchPvpLadder = async (
  seasonId: number,
  slug: string,
  signal?: AbortSignal,
): Promise<PvpLadder> => {
  const response = await optional404(() =>
    blizzardClient.get<LeaderboardResponse>(
      `/data/wow/pvp-season/${seasonId}/pvp-leaderboard/${encodeURIComponent(slug)}`,
      { namespace: namespace("dynamic") },
      { signal },
    ),
  );
  return {
    seasonId,
    slug,
    bracketType: response?.bracket?.type,
    entries: (response?.entries ?? [])
      .map(toEntry)
      .filter((entry): entry is PvpLadderEntry => entry !== undefined)
      .sort((left, right) => left.rank - right.rank),
  };
};

/* ------------------------------------------------------------------ */
/* Rewards                                                             */
/* ------------------------------------------------------------------ */

/** Every title cutoff of the season. A season without rewards (404) has none. */
export const fetchPvpRewards = async (
  seasonId: number,
  signal?: AbortSignal,
): Promise<PvpRewardCutoff[]> => {
  const response = await optional404(() =>
    blizzardClient.get<RewardIndexResponse>(
      `/data/wow/pvp-season/${seasonId}/pvp-reward/index`,
      { namespace: namespace("dynamic") },
      { signal },
    ),
  );
  return (response?.rewards ?? []).flatMap((reward): PvpRewardCutoff[] => {
    const achievementId = reward.achievement?.id;
    const bracketType = reward.bracket?.type;
    if (
      typeof achievementId !== "number" ||
      typeof reward.rating_cutoff !== "number" ||
      !bracketType
    ) {
      return [];
    }
    const specId = reward.specialization?.id;
    return [
      {
        bracketType,
        achievementId,
        achievementName:
          localized(reward.achievement?.name) || `Achievement #${achievementId}`,
        rating: reward.rating_cutoff,
        faction: toFaction(reward.faction?.type),
        specId: typeof specId === "number" ? specId : undefined,
        specName: localized(reward.specialization?.name) || undefined,
      },
    ];
  });
};

/**
 * A season's name from its titles, for the seasons Blizzard left unnamed:
 * "Sinful Gladiator: Shadowlands Season 1" -> "Shadowlands Season 1". Only
 * a suffix with a number counts, so "Hero of the Horde: Sinful" never does.
 */
export const seasonNameFromCutoffs = (
  cutoffs: readonly PvpRewardCutoff[],
): string | undefined => {
  const ordered = [
    ...cutoffs.filter((cutoff) => cutoff.bracketType === "ARENA_3v3"),
    ...cutoffs,
  ];
  for (const cutoff of ordered) {
    const separator = cutoff.achievementName.lastIndexOf(":");
    const suffix = separator >= 0 ? cutoff.achievementName.slice(separator + 1).trim() : "";
    if (/\d/u.test(suffix)) {
      return suffix;
    }
  }
  return undefined;
};

/* ------------------------------------------------------------------ */
/* Achievement icons                                                   */
/* ------------------------------------------------------------------ */

/** A title achievement's icon, or null when Blizzard has none. */
export const fetchAchievementIcon = async (
  achievementId: number,
  signal?: AbortSignal,
): Promise<string | null> => {
  const media = await optional404(() =>
    blizzardClient.get<MediaResponse>(
      `/data/wow/media/achievement/${achievementId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  return (
    media?.assets?.find((asset) => asset.key === "icon")?.value ??
    media?.assets?.[0]?.value ??
    null
  );
};
