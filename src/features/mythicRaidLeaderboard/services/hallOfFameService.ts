import { blizzardClient } from "@/lib/blizzardClient";
import {
  cleanMarkup,
  localized,
  namespace,
  optional404,
} from "@/lib/blizzardHelpers";
import { env } from "@/lib/env";
import { toBcp47 } from "@/lib/format";
import type {
  FactionView,
  GuildRegion,
  HallOfFameBoard,
  HallOfFameEntry,
  HallOfFameFaction,
  HallOfFameRow,
  LocalizedString,
  RaidJournal,
} from "@/features/mythicRaidLeaderboard/types";

/*
 * Blizzard's Hall of Fame: per raid and faction, the first 100 guilds to
 * defeat the raid's final boss on Mythic, each with the kill time, the
 * guild's region (China included) and its realm. One board is about 18 KB
 * and frozen since its raid ended, so "both factions" costs two requests.
 *
 * The raid's art sits in the Encounter Journal, two lookups away:
 *
 *   journal-instance/{id}         name, expansion, location, bosses
 *   media/journal-instance/{id}   600×300 zone tile
 */

type Reference = { id?: number; name?: LocalizedString };

type RawEntry = {
  rank?: number;
  timestamp?: number;
  region?: string;
  faction?: { type?: string };
  guild?: {
    id?: number;
    name?: string;
    realm?: { id?: number; name?: LocalizedString; slug?: string };
  };
};

type HallOfFameResponse = {
  slug?: string;
  entries?: RawEntry[];
};

type JournalInstanceResponse = {
  id: number;
  name?: LocalizedString;
  description?: string;
  expansion?: Reference;
  location?: Reference;
  encounters?: Reference[];
};

type JournalInstanceMediaResponse = {
  assets?: Array<{ key?: string; value?: string }>;
};

/* ------------------------------------------------------------------ */
/* Hall of Fame                                                        */
/* ------------------------------------------------------------------ */

const toEntry =
  (faction: HallOfFameFaction) =>
  (raw: RawEntry, index: number): HallOfFameEntry | undefined => {
    const name = raw.guild?.name?.trim();
    if (!name || typeof raw.timestamp !== "number" || raw.timestamp <= 0) {
      return undefined;
    }
    const realmSlug = raw.guild?.realm?.slug ?? "";
    return {
      rank: typeof raw.rank === "number" ? raw.rank : index + 1,
      // The board, not raw.faction: a few entries carry the other side (a
      // guild that changed faction since, presumably), but they earned their
      // place on this faction's Hall of Fame.
      faction,
      timestamp: raw.timestamp,
      region: (raw.region ?? "").toLowerCase(),
      guild: {
        id: raw.guild?.id,
        name,
        realmName: localized(raw.guild?.realm?.name) || realmSlug,
        realmSlug,
      },
    };
  };

/**
 * One faction's board. A raid Blizzard keeps no Hall of Fame for answers
 * 404, which resolves to an empty board (`found: false`) rather than an
 * error; anything else fails the query so react-query retries it.
 */
export const fetchHallOfFame = async (
  raidSlug: string,
  faction: HallOfFameFaction,
  signal?: AbortSignal,
): Promise<HallOfFameBoard> => {
  const response = await optional404(() =>
    blizzardClient.get<HallOfFameResponse>(
      `/data/wow/leaderboard/hall-of-fame/${encodeURIComponent(raidSlug)}/${faction}`,
      { namespace: namespace("dynamic") },
      { signal },
    ),
  );

  return {
    raidSlug,
    faction,
    found: response !== undefined,
    entries: (response?.entries ?? [])
      .map(toEntry(faction))
      .filter((entry): entry is HallOfFameEntry => entry !== undefined)
      .sort((left, right) => left.rank - right.rank),
  };
};

const FACTION_ORDER: Record<HallOfFameFaction, number> = { alliance: 0, horde: 1 };

/**
 * The rows a view lists. One faction keeps Blizzard's ranks; both merge
 * the boards by kill time and number them in that order. Kills can share a
 * timestamp (two pairs of Horde guilds on Crucible of Storms): the better
 * rank goes first, then Alliance, so the order never shuffles. Undefined
 * until every board the view needs has loaded: a merge missing one side
 * would name the wrong world first.
 */
export const toRows = (
  view: FactionView,
  alliance: HallOfFameBoard | undefined,
  horde: HallOfFameBoard | undefined,
): HallOfFameRow[] | undefined => {
  if (view !== "both") {
    const board = view === "alliance" ? alliance : horde;
    return board?.entries.map((entry) => ({ ...entry, position: entry.rank }));
  }
  if (!alliance || !horde) {
    return undefined;
  }
  return [...alliance.entries, ...horde.entries]
    .sort(
      (left, right) =>
        left.timestamp - right.timestamp ||
        left.rank - right.rank ||
        FACTION_ORDER[left.faction] - FACTION_ORDER[right.faction],
    )
    .map((entry, index) => ({ ...entry, position: index + 1 }));
};

/* ------------------------------------------------------------------ */
/* Encounter Journal                                                   */
/* ------------------------------------------------------------------ */

/**
 * Battle of Dazar'alor lists each faction's version of a fight separately
 * ("Grong, the Jungle Lord" and "Grong, the Revenant"; two "Jadefire
 * Masters"): twelve encounters for nine bosses. Counting the names before
 * the first comma (full-width too, for zh_TW) gives the real nine.
 */
const countBosses = (names: string[]): number =>
  new Set(names.map((name) => name.split(/[,，]/u)[0].trim().toLowerCase()))
    .size;

/**
 * Journal entry and art for one raid. Either lookup may 404 (those fields
 * stay empty); any other failure fails the query, so react-query retries it
 * instead of caching a tile without art for a day.
 */
export const fetchRaidJournal = async (
  journalInstanceId: number,
  signal?: AbortSignal,
): Promise<RaidJournal> => {
  const [journal, media] = await Promise.all([
    optional404(() =>
      blizzardClient.get<JournalInstanceResponse>(
        `/data/wow/journal-instance/${journalInstanceId}`,
        { namespace: namespace("static") },
        { signal },
      ),
    ),
    optional404(() =>
      blizzardClient.get<JournalInstanceMediaResponse>(
        `/data/wow/media/journal-instance/${journalInstanceId}`,
        { namespace: namespace("static") },
        { signal },
      ),
    ),
  ]);

  const assets = media?.assets ?? [];
  const tile =
    assets.find((asset) => asset.key === "tile")?.value ?? assets[0]?.value;
  const bosses = (journal?.encounters ?? [])
    .map((encounter) => localized(encounter.name))
    .filter((name) => name.length > 0);

  return {
    id: journalInstanceId,
    name: localized(journal?.name) || undefined,
    expansion: localized(journal?.expansion?.name) || undefined,
    location: localized(journal?.location?.name) || undefined,
    description: cleanMarkup(journal?.description) || undefined,
    bossCount: countBosses(bosses),
    finalBoss: bosses[bosses.length - 1],
    imageUrl: tile ?? null,
  };
};

/* ------------------------------------------------------------------ */
/* Labels and links                                                    */
/* ------------------------------------------------------------------ */

const GUILD_REGIONS: readonly GuildRegion[] = ["us", "eu", "kr", "tw", "cn"];

export const isGuildRegion = (value: string): value is GuildRegion =>
  (GUILD_REGIONS as readonly string[]).includes(value);

/** The official armory covers every region but China. */
const ARMORY_REGIONS: ReadonlySet<string> = new Set(["us", "eu", "kr", "tw"]);

/**
 * The armory's guild slug: lowercase, spaces to hyphens, everything else
 * kept and percent-encoded ("Die Gummibärenbande" -> die-gummib%C3%A4renbande,
 * "У беляша" -> %D1%83-…), all checked live. Apostrophes are dropped as in
 * realm slugs; no Hall of Fame guild has one, so that part is unverified.
 */
export const guildSlug = (name: string): string =>
  name.trim().toLowerCase().replace(/['’]/gu, "").replace(/\s+/gu, "-");

/**
 * The guild's page on the official armory, in the app's language and the
 * guild's own region; undefined for China (no armory) or a missing realm.
 */
export const guildArmoryUrl = (entry: HallOfFameEntry): string | undefined => {
  if (!ARMORY_REGIONS.has(entry.region) || !entry.guild.realmSlug) {
    return undefined;
  }
  return `https://worldofwarcraft.blizzard.com/${toBcp47(env.locale).toLowerCase()}/guild/${entry.region}/${encodeURIComponent(entry.guild.realmSlug)}/${encodeURIComponent(guildSlug(entry.guild.name))}`;
};

export const FACTION_LABEL: Record<HallOfFameFaction, string> = {
  alliance: "Alliance",
  horde: "Horde",
};

/** "World first" / "Alliance first": what position 1 is in a view. */
export const firstLabel = (view: FactionView): string =>
  view === "both" ? "World first" : `${FACTION_LABEL[view]} first`;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Time behind the first kill, at the two largest units: "+3d 4h",
 * "+4h 15m", "+12m", and "+<1m" for a kill in the same minute.
 */
export const formatGap = (ms: number): string => {
  const gap = Math.max(0, ms);
  if (gap < MINUTE) {
    return "+<1m";
  }
  const days = Math.floor(gap / DAY);
  const hours = Math.floor((gap % DAY) / HOUR);
  const minutes = Math.floor((gap % HOUR) / MINUTE);
  if (days > 0) {
    return `+${days}d ${hours}h`;
  }
  return hours > 0 ? `+${hours}h ${minutes}m` : `+${minutes}m`;
};

let dateFormatter: Intl.DateTimeFormat | undefined;
let dateTimeFormatter: Intl.DateTimeFormat | undefined;

/** "Dec 23, 2022" in the app's language. */
export const formatKillDate = (timestamp: number): string => {
  dateFormatter ??= new Intl.DateTimeFormat(toBcp47(env.locale), {
    dateStyle: "medium",
  });
  return dateFormatter.format(new Date(timestamp));
};

/** "Dec 23, 2022, 5:40 PM", in the viewer's time zone. */
export const formatKillTime = (timestamp: number): string => {
  dateTimeFormatter ??= new Intl.DateTimeFormat(toBcp47(env.locale), {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return dateTimeFormatter.format(new Date(timestamp));
};
