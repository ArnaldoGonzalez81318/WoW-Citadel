/** One player in a leaderboard run. */
export type LeaderboardMember = {
  name: string;
  realmSlug: string;
  specId?: number;
  faction?: "ALLIANCE" | "HORDE";
};

/**
 * One completed run on a connected realm's keystone leaderboard. Blizzard
 * ranks by key level, then time, and includes runs finished over the timer.
 */
export type LeaderboardRun = {
  ranking: number;
  keystoneLevel: number;
  durationMs: number;
  completedTimestamp?: number;
  rating?: {
    value: number;
    /** Blizzard's rating colour, ready for CSS. */
    color?: string;
  };
  members: LeaderboardMember[];
};

export type LeaderboardAffix = {
  id: number;
  name: string;
};

/** A connected realm's top runs for one dungeon in one weekly period. */
export type KeystoneLeaderboard = {
  connectedRealmId: number;
  dungeonId: number;
  periodId: number;
  /** The dungeon map's name (falls back to the board's own name). */
  name: string;
  periodStart?: number;
  periodEnd?: number;
  affixes: LeaderboardAffix[];
  /** Ranked best first (key level, then time); Blizzard lists at most 500. */
  runs: LeaderboardRun[];
};

/** A playable specialization, for party icons and labels. */
export type Specialization = {
  id: number;
  /** "Blood" */
  name: string;
  /** "Death Knight" */
  className?: string;
  role?: "TANK" | "HEALER" | "DAMAGE";
  iconUrl: string | null;
};

/** Start and end of one weekly period (epoch ms). */
export type KeystonePeriod = {
  id: number;
  start: number;
  end: number;
};
