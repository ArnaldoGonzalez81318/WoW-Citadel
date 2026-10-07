export type { LocalizedString } from "@/lib/blizzardHelpers";

/** One entry of Blizzard's keystone dungeon index (every dungeon ever used for keystones). */
export type KeystoneDungeonSummary = {
  id: number;
  name: string;
};

/** The keystone season currently running, with its dungeon pool. */
export type KeystoneSeason = {
  id: number;
  /** "Midnight Season 2" (Blizzard's "Mythic+ Dungeons (…)" wrapper removed). */
  name: string;
  /** Epoch ms, when Blizzard reports it. */
  startTimestamp?: number;
  /** This season's rotation, by name. */
  dungeons: KeystoneDungeonSummary[];
};

/** A keystone upgrade threshold: finish under `durationMs` for `+level`. */
export type KeystoneTimer = {
  level: number;
  durationMs: number;
};

/**
 * A keystone dungeon merged with its Encounter Journal entry and art. A
 * journal entry or art that Blizzard does not have (404) leaves those fields
 * empty; the dungeon still has a name and timers.
 */
export type KeystoneDungeon = {
  id: number;
  name: string;
  /** Upgrade thresholds, `+1` first (the timer itself). */
  timers: KeystoneTimer[];
  /** In the current season's rotation, per the dungeon record. */
  isTracked: boolean;
  journalInstanceId?: number;
  /**
   * The Encounter Journal instance's name. It differs from `name` for a wing
   * of a split dungeon (Tazavesh: Streets of Wonder -> Tazavesh, the Veiled
   * Market), whose bosses are then the whole instance's.
   */
  instanceName?: string;
  expansion?: string;
  location?: string;
  description?: string;
  bosses: string[];
  /** 600×300 zone art, or null when Blizzard has none. */
  imageUrl: string | null;
};
