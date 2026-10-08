import { blizzardClient } from "@/lib/blizzardClient";
import { localized, namespace, optional404 } from "@/lib/blizzardHelpers";
import type {
  LocalizedString,
  PvpTier,
  PvpTierSummary,
} from "@/features/pvpTiers/types";

/*
 * Shared by the PvP Tiers and PvP Seasons pages: the tier index (45 entries
 * on US, nine ranks for each of five brackets), one tier's rating range and
 * bracket, and its icon (together, or each on its own). All static data,
 * cached for a long time.
 */

type TierIndexResponse = {
  tiers?: Array<{ id: number; name?: LocalizedString }>;
};

type TierResponse = {
  id: number;
  name?: LocalizedString;
  min_rating?: number;
  max_rating?: number;
  bracket?: { id?: number; type?: string };
  rating_type?: number;
};

type MediaResponse = {
  assets?: Array<{ key?: string; value?: string }>;
};

export const fetchPvpTierIndex = async (
  signal?: AbortSignal,
): Promise<PvpTierSummary[]> => {
  const response = await blizzardClient.get<TierIndexResponse>(
    "/data/wow/pvp-tier/index",
    { namespace: namespace("static") },
    { signal },
  );
  return (response.tiers ?? []).map((tier) => ({
    id: tier.id,
    name: localized(tier.name) || `Tier #${tier.id}`,
  }));
};

/**
 * One tier's record (rating range, bracket, rank) without its icon, so
 * `iconUrl` is null. The PvP Tiers page needs every record but only the
 * icons of the bracket on screen: Blizzard gives a rank the same icon in
 * every bracket, so fetching all 45 icons would repeat the same nine URLs.
 */
export const fetchPvpTierRecord = async (
  tierId: number,
  signal?: AbortSignal,
): Promise<PvpTier> => {
  const tier = await blizzardClient.get<TierResponse>(
    `/data/wow/pvp-tier/${tierId}`,
    { namespace: namespace("static") },
    { signal },
  );
  return {
    id: tier.id,
    name: localized(tier.name) || `Tier #${tier.id}`,
    minRating: tier.min_rating ?? 0,
    maxRating: tier.max_rating ?? 0,
    bracketType: tier.bracket?.type,
    ratingType: tier.rating_type,
    iconUrl: null,
  };
};

/** One tier's icon URL: null when Blizzard has none (404); other failures throw. */
export const fetchPvpTierIcon = async (
  tierId: number,
  signal?: AbortSignal,
): Promise<string | null> => {
  const media = await optional404(() =>
    blizzardClient.get<MediaResponse>(
      `/data/wow/media/pvp-tier/${tierId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  const assets = media?.assets ?? [];
  return (
    assets.find((asset) => asset.key === "icon")?.value ??
    assets[0]?.value ??
    null
  );
};

/** One tier with its icon. A missing icon (404) leaves `iconUrl` null; other failures throw. */
export const fetchPvpTier = async (
  tierId: number,
  signal?: AbortSignal,
): Promise<PvpTier> => {
  const [tier, iconUrl] = await Promise.all([
    fetchPvpTierRecord(tierId, signal),
    fetchPvpTierIcon(tierId, signal),
  ]);
  return { ...tier, iconUrl };
};
