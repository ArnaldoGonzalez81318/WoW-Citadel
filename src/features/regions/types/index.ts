import type { Region } from "@/lib/region";

export type { Region } from "@/lib/region";
export type { LocalizedString } from "@/lib/blizzardHelpers";

/** Blizzard's record for one API region (`/data/wow/region/{id}`). */
export type RegionRecord = {
  /** Blizzard's region id: US 1, KR 2, EU 3, TW 4. */
  id: number;
  /** The API region (and namespace suffix) the record came from. */
  region: Region;
  /** "North America", "Europe", "Korea", "Taiwan" in the app locale. */
  name: string;
  /** "US", "EU", "KR", "TW". */
  tag: string;
  /** The live game build, e.g. "12.1.0". */
  patch?: string;
};

/** How many entries the region's two realm indexes list. */
export type RegionRealmCounts = {
  connectedRealms: number;
  /**
   * Every realm record, Blizzard's internal account, instance, battleground
   * and GM-support servers included (they host no characters).
   */
  realms: number;
};

/** One bar of a makeup breakdown: a key, its display label and a count. */
export type MakeupEntry = {
  key: string;
  label: string;
  count: number;
};

/**
 * A region's realms summarised from its connected-realm search: who lives
 * where, in which language, under which ruleset, and how full it is. Only
 * the tallies are cached, never the ~350 KB search payload behind them.
 */
export type RegionRealmMakeup = {
  connectedRealms: number;
  /** Realms that belong to a connected realm (the ones that host characters). */
  realms: number;
  /** Per connected realm, densest tier first ("Full", "High", … "New Players"). */
  population: MakeupEntry[];
  /** Per realm, keyed by IANA zone ("America/Chicago"); most realms first. */
  timezones: MakeupEntry[];
  /** Per realm, keyed by Blizzard locale ("enGB"); most realms first. */
  languages: MakeupEntry[];
  /** Per realm, Blizzard's own grouping ("United States", "Oceanic", "German"). */
  categories: MakeupEntry[];
  /** Per realm, keyed by ruleset ("NORMAL", "RP"); most realms first. */
  rulesets: MakeupEntry[];
  /** Connected realms Blizzard reports as "DOWN". */
  down: number;
  /** Connected realms with a login queue right now. */
  queued: number;
  tournamentRealms: number;
};
