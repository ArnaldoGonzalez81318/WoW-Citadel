export type { LocalizedString } from "@/lib/blizzardHelpers";

/** A faction as Blizzard references it: id and name only. */
export type FactionRef = {
  id: number;
  name: string;
};

/**
 * Blizzard's faction index: every faction (284 on US, headers included) and
 * the top-level groups the in-game reputation pane opens with (14: the
 * guild, each expansion, and the odd standalone faction).
 */
export type FactionIndex = {
  factions: FactionRef[];
  roots: FactionRef[];
};

/**
 * How a faction is earned, which decides how it is drawn:
 *
 *   - `standard`   the shared Hated…Exalted ladder (reputation tiers 0);
 *   - `friendship` a ladder of its own (Nat Pagle's Stranger…Best Friend,
 *                  a delve companion's 80 levels, a Brawler's Guild season);
 *   - `renown`     numbered renown levels, each with rewards;
 *   - `group`      a header that only folds other factions (no bar of its own);
 *   - `none`       no ladder in the record at all.
 */
export type LadderKind = "standard" | "friendship" | "renown" | "group" | "none";

/** One renown level and what it unlocks. */
export type RenownLevel = {
  level: number;
  /** "Renown 12" */
  name: string;
  rewards: FactionRef[];
};

/** A player side a faction belongs to (Alliance / Horde), when it has one. */
export type FactionSide = {
  /** "ALLIANCE" | "HORDE" */
  type: string;
  name: string;
};

export type Faction = {
  id: number;
  name: string;
  description?: string;
  kind: LadderKind;
  /** The standing ladder (`reputation-tiers/{id}`); 0 is the standard one. */
  ladderId: number | null;
  /** Renown factions only, lowest level first. */
  renownLevels: RenownLevel[];
  /** Folds other factions under it in the reputation pane. */
  isHeader: boolean;
  /** A header that also has a bar of its own (Silvermoon Court, The Tillers). */
  headerShowsBar: boolean;
  /** Keeps rewarding (paragon caches) past the final standing or level. */
  canParagon: boolean;
  side?: FactionSide;
  /** Factions folded under this header, in Blizzard's order. */
  children: FactionRef[];
};

/** One step of a standing ladder: reach `min` points to hold it. */
export type StandingTier = {
  id: number;
  name: string;
  min: number;
  max: number;
};

/** A standing ladder (`reputation-tiers/{id}`), lowest standing first. */
export type StandingLadder = {
  id: number;
  tiers: StandingTier[];
  /** The one faction a friendship ladder belongs to, when Blizzard names it. */
  faction?: FactionRef;
};

/** An entry of the ladder index: friendship ladders carry their faction's name. */
export type StandingLadderSummary = {
  id: number;
  name?: string;
};
