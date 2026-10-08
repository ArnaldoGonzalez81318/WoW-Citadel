import {
  fetchHallOfFame,
  fetchRaidJournal,
} from "@/features/mythicRaidLeaderboard/services/hallOfFameService";
import type { HallOfFameFaction } from "@/features/mythicRaidLeaderboard/types";
import { env } from "@/lib/env";

/**
 * A Hall of Fame closes when its 100th guild gets in, and every board the
 * API still serves closed years ago; journal text and art change with
 * patches at most. A day is plenty for both.
 */
const STALE_MS = 24 * 60 * 60_000;

export const hallOfFameKeys = {
  board: (raidSlug: string, faction: HallOfFameFaction) =>
    ["mythic-raid-hall-of-fame", raidSlug, faction, env.region, env.locale] as const,
  journal: (journalInstanceId: number) =>
    ["mythic-raid-journal", journalInstanceId, env.region, env.locale] as const,
};

export const hallOfFameQuery = (raidSlug: string, faction: HallOfFameFaction) => ({
  queryKey: hallOfFameKeys.board(raidSlug, faction),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchHallOfFame(raidSlug, faction, signal),
  staleTime: STALE_MS,
});

/** Shared by the picker tiles and the raid overview so both read one cache entry. */
export const raidJournalQuery = (journalInstanceId: number) => ({
  queryKey: hallOfFameKeys.journal(journalInstanceId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchRaidJournal(journalInstanceId, signal),
  staleTime: STALE_MS,
});
