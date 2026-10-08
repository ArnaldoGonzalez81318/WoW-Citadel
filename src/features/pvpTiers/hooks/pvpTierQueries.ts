import {
  fetchPvpTier,
  fetchPvpTierIcon,
  fetchPvpTierIndex,
  fetchPvpTierRecord,
} from "@/features/pvpTiers/services/pvpTierService";
import { env } from "@/lib/env";

/** Tiers change with expansions, not days. */
export const TIER_STALE_MS = 24 * 60 * 60_000;

export const pvpTierKeys = {
  index: () => ["pvp-tier-index", env.region, env.locale] as const,
  tier: (tierId: number) => ["pvp-tier", tierId, env.region, env.locale] as const,
  record: (tierId: number) =>
    ["pvp-tier-record", tierId, env.region, env.locale] as const,
  /** Not localized: an icon is a render URL, the same in every locale. */
  icon: (tierId: number) => ["pvp-tier-icon", tierId, env.region] as const,
};

export const pvpTierIndexQuery = () => ({
  queryKey: pvpTierKeys.index(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchPvpTierIndex(signal),
  staleTime: TIER_STALE_MS,
});

/**
 * A tier with its icon (two requests), as the PvP Seasons page uses it. The
 * PvP Tiers page fetches the halves separately but seeds them from this
 * entry, so a tier the Seasons page already loaded costs it nothing.
 */
export const pvpTierQuery = (tierId: number) => ({
  queryKey: pvpTierKeys.tier(tierId),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchPvpTier(tierId, signal),
  staleTime: TIER_STALE_MS,
});

/** A tier's record without its icon (`iconUrl` null): one request instead of two. */
export const pvpTierRecordQuery = (tierId: number) => ({
  queryKey: pvpTierKeys.record(tierId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchPvpTierRecord(tierId, signal),
  staleTime: TIER_STALE_MS,
});

/** A tier's icon URL alone (null when Blizzard has none). */
export const pvpTierIconQuery = (tierId: number) => ({
  queryKey: pvpTierKeys.icon(tierId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchPvpTierIcon(tierId, signal),
  staleTime: TIER_STALE_MS,
});
