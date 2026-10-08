export type { LocalizedString } from "@/lib/blizzardHelpers";

export type PvpFaction = "ALLIANCE" | "HORDE";

/** Blizzard's list of rated PvP seasons. */
export type PvpSeasonIndex = {
  /** Every season id, newest first. */
  seasonIds: number[];
  /** The running season (or the last one, between seasons), per Blizzard. */
  currentId: number | null;
};

/** One rated PvP season's record. */
export type PvpSeason = {
  id: number;
  /**
   * "Midnight Season 2" (Blizzard's "Player vs. Player (…)" wrapper removed).
   * Several older seasons carry no name at all.
   */
  name?: string;
  /** Epoch ms. */
  startTimestamp?: number;
  /** Epoch ms; absent while the season runs. */
  endTimestamp?: number;
};

/**
 * A family of leaderboards as the page groups them. Solo Shuffle and Blitz
 * rank every specialization separately, plus an overall board.
 */
export type PvpBracketGroup = "2v2" | "3v3" | "rbg" | "shuffle" | "blitz" | "other";

/** One leaderboard in a season, parsed from Blizzard's board name. */
export type PvpBoardRef = {
  /** Blizzard's board name and URL segment: "3v3", "shuffle-overall", "blitz-mage-frost". */
  slug: string;
  group: PvpBracketGroup;
  /** "mage-frost" on a per-spec board. */
  specSlug?: string;
  /** Blizzard's specialization id for `specSlug`, when the page knows it. */
  specId?: number;
};

/** One ranked character on a PvP leaderboard. */
export type PvpLadderEntry = {
  rank: number;
  rating: number;
  characterId?: number;
  name: string;
  realmSlug: string;
  faction?: PvpFaction;
  /** Matches (or Solo Shuffle rounds) played, won and lost this season. */
  played: number;
  won: number;
  lost: number;
  /** The rating tier (Combatant I … Elite) the character sits in. */
  tierId?: number;
};

/** A season's leaderboard for one bracket, ranked best first. */
export type PvpLadder = {
  seasonId: number;
  slug: string;
  /** Blizzard's bracket type, e.g. "ARENA_3v3", "SHUFFLE". */
  bracketType?: string;
  entries: PvpLadderEntry[];
};

/**
 * One title's rating cutoff: the rating a player needed (at Blizzard's last
 * update) to earn the season's title in a bracket. Solo Shuffle and Blitz
 * set one per specialization; Blitz and rated battlegrounds one per faction.
 */
export type PvpRewardCutoff = {
  /** "ARENA_3v3", "BATTLEGROUNDS", "SHUFFLE", "BLITZ", … */
  bracketType: string;
  achievementId: number;
  /** "Venomous Gladiator: Midnight Season 2" */
  achievementName: string;
  rating: number;
  faction?: PvpFaction;
  specId?: number;
  /** Blizzard's spec name ("Frost"), until the full specialization is loaded. */
  specName?: string;
};
