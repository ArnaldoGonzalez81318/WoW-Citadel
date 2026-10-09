import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { keystoneKeys } from "@/features/mythicKeystone/hooks/keystoneQueries";
import type { KeystonePeriod } from "@/features/mythicLeaderboard/types";
import { env } from "@/lib/env";
import { toBcp47 } from "@/lib/format";

/** "Tue, Oct 13, 11:00 AM", in the viewer's own time zone. */
export const RESET_FORMAT = new Intl.DateTimeFormat(toBcp47(env.locale), {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * How long to wait, after the reset and after the season last arrived,
 * before asking for the season again. The proxy serves dynamic records with
 * `max-age=60, stale-while-revalidate=300` to the browser and `s-maxage=300`
 * at the CDN, so a refetch inside those six minutes is answered with the
 * copy cached before the reset; seven clears them with a minute to spare.
 */
const REFETCH_AFTER_MS = 7 * 60_000;
/**
 * A season that arrived this long after the reset and still ends on the
 * old week is taken as Blizzard's answer (a late publish, or a season the
 * index still calls current after it ended) and is not asked again.
 */
const REFETCH_WINDOW_MS = 60 * 60_000;

export type WeeklyReset =
  /** No period yet, or Blizzard sent no end time. */
  | { kind: "unknown" }
  /** The period's end has passed, and the season does not list the next week yet. */
  | { kind: "rolled-over" }
  | { kind: "upcoming"; resetAt: number; iso: string };

/**
 * When this week's Mythic+ period resets. Blizzard's `end_timestamp` is the
 * last second of the week, per region (the same period id ends at 15:00 UTC
 * on US and 04:00 UTC the next day on EU), so the reset is one second later
 * and always comes from the configured region's own payload.
 *
 * Once the reset passes, the season (whose last period id names the week)
 * is invalidated, but only after the caches above have let go of the old
 * copy, and once per arrival of the season (`seasonUpdatedAt`): if the same
 * period comes back, because Blizzard is slow to publish the new week, the
 * next ask waits another seven minutes, a refetch that fails is not
 * repeated, and an hour after the reset it stops asking, so nothing loops
 * (about nine refetches at most, and none for a page opened more than an
 * hour after the reset).
 */
const useWeeklyReset = (
  period: KeystonePeriod | undefined,
  now: number,
  seasonUpdatedAt: number,
): WeeklyReset => {
  const queryClient = useQueryClient();
  const refetchedForRef = useRef<number | null>(null);
  const resetAt = period && period.end > 0 ? period.end + 1000 : null;
  const rolledOver = resetAt !== null && now >= resetAt;
  // From whichever is later: a season that arrived after the reset may
  // still be a cached copy from before it.
  const refetchDue =
    resetAt !== null &&
    seasonUpdatedAt < resetAt + REFETCH_WINDOW_MS &&
    now >= Math.max(resetAt, seasonUpdatedAt) + REFETCH_AFTER_MS;

  useEffect(() => {
    if (!refetchDue || refetchedForRef.current === seasonUpdatedAt) {
      return;
    }
    refetchedForRef.current = seasonUpdatedAt;
    void queryClient.invalidateQueries({ queryKey: keystoneKeys.season() });
  }, [refetchDue, seasonUpdatedAt, queryClient]);

  if (resetAt === null) {
    return { kind: "unknown" };
  }
  if (rolledOver) {
    return { kind: "rolled-over" };
  }
  return { kind: "upcoming", resetAt, iso: new Date(resetAt).toISOString() };
};

export default useWeeklyReset;
