export type { LocalizedString } from "@/lib/blizzardHelpers";

/** A Hall of Fame board is per faction: Blizzard ranks each side separately. */
export type HallOfFameFaction = "alliance" | "horde";

/** What the page shows: one faction's board, or both merged in kill order. */
export type FactionView = HallOfFameFaction | "both";

/** The regions Blizzard lists guilds from (China included, unlike its API). */
export type GuildRegion = "us" | "eu" | "kr" | "tw" | "cn";

/**
 * A raid that has a Hall of Fame. Blizzard has no index of them, so the
 * page keeps its own list (see config/hallOfFameRaids.ts); `name` and
 * `expansion` are English fallbacks until the Encounter Journal answers.
 */
export type HallOfFameRaid = {
  /** Hall of Fame slug: "vault-of-the-incarnates". */
  slug: string;
  journalInstanceId: number;
  name: string;
  expansion: string;
};

/** A raid's Encounter Journal entry and art. */
export type RaidJournal = {
  id: number;
  name?: string;
  expansion?: string;
  location?: string;
  description?: string;
  /** Distinct bosses (faction-specific versions of one fight counted once). */
  bossCount: number;
  /** The last encounter: the Mythic kill the Hall of Fame records. */
  finalBoss?: string;
  /** 600×300 zone art, or null when Blizzard has none. */
  imageUrl: string | null;
};

export type HallOfFameGuild = {
  id?: number;
  name: string;
  realmName: string;
  realmSlug: string;
};

/** One guild on a faction's Hall of Fame. */
export type HallOfFameEntry = {
  /** Rank on its faction's board (1–100). */
  rank: number;
  /** The board it is listed on (see the service on why not the entry's own faction). */
  faction: HallOfFameFaction;
  /** Epoch ms of the Mythic final-boss kill. */
  timestamp: number;
  /** Lowercase region code; anything unexpected is kept as given. */
  region: string;
  guild: HallOfFameGuild;
};

/** One faction's Hall of Fame for one raid. */
export type HallOfFameBoard = {
  raidSlug: string;
  faction: HallOfFameFaction;
  /** False when Blizzard answered 404: no board for this raid and faction. */
  found: boolean;
  /** Rank order, earliest kill first. */
  entries: HallOfFameEntry[];
};

/**
 * A row as listed: its board entry plus its position in the list on
 * screen (the faction rank, or the place in kill order when merged).
 */
export type HallOfFameRow = HallOfFameEntry & {
  position: number;
};
