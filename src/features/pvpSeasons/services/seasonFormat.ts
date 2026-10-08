import type { PvpSeason } from "@/features/pvpSeasons/types";
import { env } from "@/lib/env";
import { toBcp47 } from "@/lib/format";

const WEEK_MS = 7 * 24 * 60 * 60_000;

const dayFormatter = new Intl.DateTimeFormat(toBcp47(env.locale), { dateStyle: "medium" });
const monthFormatter = new Intl.DateTimeFormat(toBcp47(env.locale), {
  month: "short",
  year: "numeric",
});

/** "Aug 14, 2026" */
export const formatSeasonDay = (timestamp: number): string =>
  dayFormatter.format(new Date(timestamp));

/** Placeholder until a season's record loads, and the name of an unnamed one. */
export const fallbackSeasonName = (seasonId: number): string => `Season ${seasonId}`;

/**
 * "Aug 2026 – present", "Mar 2026 – Aug 2026": short enough for the season
 * picker's second line, and what tells the unnamed older seasons apart.
 */
export const seasonMonths = (season: PvpSeason | undefined): string | undefined => {
  if (!season?.startTimestamp) {
    return undefined;
  }
  const start = monthFormatter.format(new Date(season.startTimestamp));
  const end = season.endTimestamp ? monthFormatter.format(new Date(season.endTimestamp)) : "present";
  return `${start} – ${end}`;
};

/** Whole weeks between two instants (at least one). */
export const weeksBetween = (start: number, end: number): number =>
  Math.max(1, Math.round((end - start) / WEEK_MS));
