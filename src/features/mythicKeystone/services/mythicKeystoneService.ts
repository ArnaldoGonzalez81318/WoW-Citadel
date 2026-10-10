import { blizzardClient } from "@/lib/blizzardClient";
import {
  cleanMarkup,
  localized,
  namespace,
  optional404,
} from "@/lib/blizzardHelpers";
import { MEDIA_ASSET_PREFERENCE, pickAssetUrl } from "@/lib/mediaAssets";
import type { MediaAsset } from "@/lib/mediaAssets";
import type {
  KeystoneDungeon,
  KeystoneDungeonSummary,
  KeystoneSeason,
  KeystoneTimer,
  LocalizedString,
} from "@/features/mythicKeystone/types";

/*
 * Blizzard keeps a keystone dungeon's art two hops from the dungeon itself:
 *
 *   mythic-keystone/dungeon/{id}   name, timers, is_tracked, journal link
 *     -> journal-instance/{id}     expansion, location, bosses, description
 *     -> media/journal-instance    600×300 zone tile
 *
 * and the keystone index lists every dungeon ever used for keystones (87 on
 * US), with no hint which are in the current rotation. The current pool comes
 * from a connected realm's keystone leaderboard index instead, which lists
 * exactly this season's dungeons in one request.
 */

type Reference = { id: number; name?: LocalizedString; key?: { href?: string } };

type KeystoneDungeonIndexResponse = {
  dungeons?: Reference[];
};

type KeystoneDungeonResponse = {
  id: number;
  name?: LocalizedString;
  dungeon?: Reference;
  keystone_upgrades?: Array<{
    upgrade_level?: number;
    qualifying_duration?: number;
  }>;
  is_tracked?: boolean;
};

type JournalInstanceResponse = {
  description?: string;
  expansion?: Reference;
  location?: Reference;
  encounters?: Reference[];
};

type JournalInstanceMediaResponse = {
  assets?: MediaAsset[];
};

/**
 * A journal instance's artwork is a 600x300 `tile` (never an `icon`), so the
 * wide art is preferred ahead of the shared order; the rest of the order then
 * catches an instance Blizzard files under `image` or `zone` instead.
 */
const DUNGEON_ART_PREFERENCE: readonly string[] = [
  "tile",
  ...MEDIA_ASSET_PREFERENCE,
];

type SeasonIndexResponse = {
  current_season?: { id?: number };
};

type SeasonResponse = {
  id: number;
  season_name?: LocalizedString | null;
  start_timestamp?: number;
  periods?: Array<{ id?: number }>;
};

type ConnectedRealmIndexResponse = {
  connected_realms?: Array<{ href?: string }>;
};

type LeaderboardIndexResponse = {
  current_leaderboards?: Reference[];
};

/* ------------------------------------------------------------------ */
/* Index and season                                                    */
/* ------------------------------------------------------------------ */

/**
 * Every keystone dungeon, most recently added first: ids grow as dungeons
 * join the keystone pool, so a returning one (Seat of the Triumvirate)
 * sorts with the season that brought it back, not its expansion.
 */
export const fetchKeystoneDungeonIndex = async (
  signal?: AbortSignal,
): Promise<KeystoneDungeonSummary[]> => {
  const response = await blizzardClient.get<KeystoneDungeonIndexResponse>(
    "/data/wow/mythic-keystone/dungeon/index",
    { namespace: namespace("dynamic") },
    { signal },
  );

  return (response.dungeons ?? [])
    .map((entry) => ({
      id: entry.id,
      name: localized(entry.name) || `Dungeon #${entry.id}`,
    }))
    .sort((left, right) => right.id - left.id);
};

/** "Mythic+ Dungeons (Midnight Season 2)" -> "Midnight Season 2". */
const seasonLabel = (raw: string, id: number): string => {
  // Full-width parentheses too: zh_TW / zh_CN names use （…）.
  const inner = /[(（]([^()（）]+)[)）]\s*$/u.exec(raw)?.[1]?.trim();
  return inner || raw.trim() || `Season ${id}`;
};

const CONNECTED_REALM_ID = /\/connected-realm\/(\d+)/u;

/**
 * Any connected realm's leaderboard index lists the current dungeons; the
 * first realm in the index is as good as any.
 */
const fetchCurrentDungeons = async (
  signal?: AbortSignal,
): Promise<KeystoneDungeonSummary[]> => {
  const realms = await blizzardClient.get<ConnectedRealmIndexResponse>(
    "/data/wow/connected-realm/index",
    { namespace: namespace("dynamic") },
    { signal },
  );
  const realmId = (realms.connected_realms ?? [])
    .map((entry) => CONNECTED_REALM_ID.exec(entry.href ?? "")?.[1])
    .find((id): id is string => id !== undefined);
  if (!realmId) {
    return [];
  }

  const leaderboards = await optional404(() =>
    blizzardClient.get<LeaderboardIndexResponse>(
      `/data/wow/connected-realm/${realmId}/mythic-leaderboard/index`,
      { namespace: namespace("dynamic") },
      { signal },
    ),
  );
  return (leaderboards?.current_leaderboards ?? [])
    .map((entry) => ({
      id: entry.id,
      name: localized(entry.name) || `Dungeon #${entry.id}`,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
};

/** The running season and its dungeon pool (empty between seasons). */
export const fetchCurrentKeystoneSeason = async (
  signal?: AbortSignal,
): Promise<KeystoneSeason | null> => {
  const seasonRequest = (async () => {
    const index = await blizzardClient.get<SeasonIndexResponse>(
      "/data/wow/mythic-keystone/season/index",
      { namespace: namespace("dynamic") },
      { signal },
    );
    const seasonId = index.current_season?.id;
    if (typeof seasonId !== "number") {
      return null;
    }
    return blizzardClient.get<SeasonResponse>(
      `/data/wow/mythic-keystone/season/${seasonId}`,
      { namespace: namespace("dynamic") },
      { signal },
    );
  })();

  const [season, dungeons] = await Promise.all([
    seasonRequest,
    fetchCurrentDungeons(signal),
  ]);
  if (!season) {
    return null;
  }

  return {
    id: season.id,
    name: seasonLabel(localized(season.season_name), season.id),
    startTimestamp:
      typeof season.start_timestamp === "number"
        ? season.start_timestamp
        : undefined,
    dungeons,
    periodIds: (season.periods ?? [])
      .map((period) => period.id)
      .filter((id): id is number => typeof id === "number")
      .sort((left, right) => left - right),
  };
};

/* ------------------------------------------------------------------ */
/* One dungeon, with its journal entry and art                          */
/* ------------------------------------------------------------------ */

const toTimers = (
  upgrades: KeystoneDungeonResponse["keystone_upgrades"],
): KeystoneTimer[] =>
  (upgrades ?? [])
    .filter(
      (entry): entry is { upgrade_level: number; qualifying_duration: number } =>
        typeof entry.upgrade_level === "number" &&
        typeof entry.qualifying_duration === "number" &&
        entry.qualifying_duration > 0,
    )
    .map((entry) => ({
      level: entry.upgrade_level,
      durationMs: entry.qualifying_duration,
    }))
    .sort((left, right) => left.level - right.level)
    // A +2/+3 threshold no faster than the one before it is filler (Seat of
    // the Triumvirate reports 20:00 for all three), not a real target.
    .filter(
      (entry, index, timers) =>
        index === 0 || entry.durationMs < timers[index - 1].durationMs,
    );

/**
 * Dungeon record, journal entry and art for one card. The journal and media
 * lookups may 404 (those fields stay empty); any other failure fails the
 * card, so react-query retries it instead of caching a card without art for
 * a day.
 */
export const fetchKeystoneDungeon = async (
  dungeonId: number,
  signal?: AbortSignal,
): Promise<KeystoneDungeon> => {
  const dungeon = await blizzardClient.get<KeystoneDungeonResponse>(
    `/data/wow/mythic-keystone/dungeon/${dungeonId}`,
    { namespace: namespace("dynamic") },
    { signal },
  );

  const journalId = dungeon.dungeon?.id;
  const [journal, media] =
    typeof journalId === "number"
      ? await Promise.all([
          optional404(() =>
            blizzardClient.get<JournalInstanceResponse>(
              `/data/wow/journal-instance/${journalId}`,
              { namespace: namespace("static") },
              { signal },
            ),
          ),
          optional404(() =>
            blizzardClient.get<JournalInstanceMediaResponse>(
              `/data/wow/media/journal-instance/${journalId}`,
              { namespace: namespace("static") },
              { signal },
            ),
          ),
        ])
      : [undefined, undefined];

  const tile = pickAssetUrl(media?.assets, DUNGEON_ART_PREFERENCE);

  return {
    id: dungeon.id,
    name: localized(dungeon.name) || `Dungeon #${dungeon.id}`,
    timers: toTimers(dungeon.keystone_upgrades),
    isTracked: dungeon.is_tracked === true,
    journalInstanceId: journalId,
    instanceName: localized(dungeon.dungeon?.name) || undefined,
    expansion: localized(journal?.expansion?.name) || undefined,
    location: localized(journal?.location?.name) || undefined,
    description: cleanMarkup(journal?.description) || undefined,
    bosses: (journal?.encounters ?? [])
      .map((encounter) => localized(encounter.name))
      .filter((name) => name.length > 0),
    imageUrl: tile ?? null,
  };
};

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** 1_800_000 -> "30:00". */
export const formatTimer = (durationMs: number): string => {
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};
