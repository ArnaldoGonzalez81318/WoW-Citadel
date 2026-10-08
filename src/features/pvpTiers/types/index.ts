export type { LocalizedString } from "@/lib/blizzardHelpers";

/** One entry of Blizzard's PvP tier index. */
export type PvpTierSummary = {
  id: number;
  name: string;
};

/**
 * A rating tier (Combatant I … Elite) for one bracket. Blizzard lists every
 * tier once per bracket, so "Combatant I" appears for 2v2, 3v3, rated
 * battlegrounds, Solo Shuffle and Blitz with their own ids and ranges.
 */
export type PvpTier = {
  id: number;
  name: string;
  minRating: number;
  maxRating: number;
  /** Blizzard's bracket type, e.g. "ARENA_2v2", "BATTLEGROUNDS", "SHUFFLE", "BLITZ". */
  bracketType?: string;
  /** Blizzard's numeric rating type (0 = unrated). */
  ratingType?: number;
  iconUrl: string | null;
};

/* ------------------------------------------------------------------ */
/* PvP Tiers page: ladders per bracket and the rank × bracket matrix    */
/* ------------------------------------------------------------------ */

/** How the page names one of Blizzard's bracket types. */
export type PvpBracketMeta = {
  /** Blizzard's bracket type ("ARENA_2v2", "SHUFFLE", …). */
  type: string;
  /** The `bracket` URL value ("2v2", "shuffle", …). */
  slug: string;
  /** Switcher and table column label ("Rated BGs"). */
  label: string;
  /** Section title ("Rated Battlegrounds"). */
  title: string;
};

/** The rating span a bracket's bars are drawn on. */
export type PvpRatingScale = {
  min: number;
  /** Drawn end of the bar (past the top edge when the last tier is open-ended). */
  max: number;
  /** Highest rating Blizzard names in the bracket (a ceiling, or the open tier's floor). */
  top: number;
  /** The highest tier has no ceiling ("2,275+"). */
  openEnded: boolean;
};

/** One bracket's tiers, lowest first. */
export type PvpBracketLadder = {
  meta: PvpBracketMeta;
  tiers: PvpTier[];
  scale: PvpRatingScale;
  /** Rating shared by every pair of neighbouring ranges, when they all overlap alike. */
  uniformOverlap: number | null;
};

/** One rank (Combatant I, …) across every bracket. */
export type PvpTierMatrixRow = {
  /** `rating_type` when Blizzard sends it (it is the same rank in every bracket), else the name. */
  key: string;
  name: string;
  /** The rank's tier in each bracket, by bracket type. */
  cells: ReadonlyMap<string, PvpTier>;
  /** Brackets whose range differs from the row's most common one. */
  outliers: ReadonlySet<string>;
};

export type PvpTierMatrix = {
  brackets: PvpBracketMeta[];
  rows: PvpTierMatrixRow[];
  /** Every rank is listed in every bracket with the same range. */
  uniform: boolean;
};
