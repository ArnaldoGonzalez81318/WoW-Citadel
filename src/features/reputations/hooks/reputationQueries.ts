import { createConcurrencyLimiter } from "@/features/pvpTiers/services/concurrencyLimiter";
import {
  fetchFaction,
  fetchFactionIndex,
  fetchLadder,
  fetchLadderIndex,
} from "@/features/reputations/services/reputationService";
import { env } from "@/lib/env";

/** Factions and their ladders change with patches, not days. */
export const REPUTATION_STALE_MS = 24 * 60 * 60_000;

/**
 * Records in flight at once. The page loads the 14 root groups and the
 * selected group's factions (up to 20) together, and a page of search
 * results is 25 cards; started at once they would burst through the proxy,
 * which shares Blizzard's quota with every visitor (and Netlify allows each
 * IP 600 requests a minute).
 */
const MAX_RECORDS_IN_FLIGHT = 6;
const limitRecordFetch = createConcurrencyLimiter(MAX_RECORDS_IN_FLIGHT);

export const reputationKeys = {
  index: () => ["reputation-faction-index", env.region, env.locale] as const,
  /** Prefix of every faction record (see `useFactionParents`). */
  factions: () => ["reputation-faction"] as const,
  faction: (factionId: number) =>
    ["reputation-faction", factionId, env.region, env.locale] as const,
  ladderIndex: () => ["reputation-tiers-index", env.region, env.locale] as const,
  ladder: (ladderId: number) =>
    ["reputation-tiers", ladderId, env.region, env.locale] as const,
};

export const factionIndexQuery = () => ({
  queryKey: reputationKeys.index(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchFactionIndex(signal),
  staleTime: REPUTATION_STALE_MS,
});

/**
 * One faction record under the page's request cap. Shared by the group
 * tiles, the cards, the sub-group sections and the dialog, so each faction
 * costs one request however many places show it.
 */
export const factionQuery = (factionId: number) => ({
  queryKey: reputationKeys.faction(factionId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitRecordFetch(() => fetchFaction(factionId, signal), signal),
  staleTime: REPUTATION_STALE_MS,
});

export const ladderIndexQuery = () => ({
  queryKey: reputationKeys.ladderIndex(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchLadderIndex(signal),
  staleTime: REPUTATION_STALE_MS,
});

/** A standing ladder; ladder 0 (the standard one) is one entry for every card. */
export const ladderQuery = (ladderId: number) => ({
  queryKey: reputationKeys.ladder(ladderId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitRecordFetch(() => fetchLadder(ladderId, signal), signal),
  staleTime: REPUTATION_STALE_MS,
});
