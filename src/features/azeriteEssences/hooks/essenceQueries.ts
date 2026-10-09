import {
  fetchEssence,
  fetchEssenceIcon,
  fetchEssenceList,
  fetchHeartItem,
  fetchPowerSpell,
  fetchSpecIcon,
  fetchSpecialization,
} from "@/features/azeriteEssences/services/azeriteEssenceService";
import { fetchItemMediaUrl, itemKeys } from "@/features/items/services/itemService";
import { createConcurrencyLimiter } from "@/features/pvpTiers/services/concurrencyLimiter";
import { env } from "@/lib/env";

/** Essences have not changed since Battle for Azeroth; a day is cautious. */
export const ESSENCE_STALE_MS = 24 * 60 * 60_000;

/**
 * Records in flight at once. The page reads 39 specialization records up
 * front, then two requests per essence card as it nears the viewport, and
 * a dialog adds its spells and spec icons; started together they would
 * burst through the proxy, which shares Blizzard's quota with every visitor
 * (and Netlify allows each IP 600 requests a minute).
 */
const MAX_RECORDS_IN_FLIGHT = 6;
const limitFetch = createConcurrencyLimiter(MAX_RECORDS_IN_FLIGHT);

export const essenceKeys = {
  list: () => ["azerite-essence-list", env.region, env.locale] as const,
  essence: (essenceId: number) =>
    ["azerite-essence", essenceId, env.region, env.locale] as const,
  icon: (essenceId: number) => ["azerite-essence-icon", essenceId, env.region] as const,
  spec: (specId: number) =>
    ["azerite-essence-spec", specId, env.region, env.locale] as const,
  specIcon: (specId: number) => ["azerite-essence-spec-icon", specId, env.region] as const,
  spell: (spellId: number) =>
    ["azerite-essence-spell", spellId, env.region, env.locale] as const,
  heart: () => ["azerite-essence-heart", env.region, env.locale] as const,
};

/** One request: the whole roster with who can use each essence. */
export const essenceListQuery = () => ({
  queryKey: essenceKeys.list(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchEssenceList(signal),
  staleTime: ESSENCE_STALE_MS,
});

/** An essence's powers; shared by its card, the search and its dialog. */
export const essenceQuery = (essenceId: number) => ({
  queryKey: essenceKeys.essence(essenceId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitFetch(() => fetchEssence(essenceId, signal), signal),
  staleTime: ESSENCE_STALE_MS,
});

export const essenceIconQuery = (essenceId: number) => ({
  queryKey: essenceKeys.icon(essenceId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitFetch(() => fetchEssenceIcon(essenceId, signal), signal),
  staleTime: ESSENCE_STALE_MS,
});

/** A specialization's class and role: what sorts the roster into groups. */
export const specQuery = (specId: number) => ({
  queryKey: essenceKeys.spec(specId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitFetch(() => fetchSpecialization(specId, signal), signal),
  staleTime: ESSENCE_STALE_MS,
});

export const specIconQuery = (specId: number) => ({
  queryKey: essenceKeys.specIcon(specId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitFetch(() => fetchSpecIcon(specId, signal), signal),
  staleTime: ESSENCE_STALE_MS,
});

/** A power's tooltip and icon, only for the essence open in the dialog. */
export const powerSpellQuery = (spellId: number) => ({
  queryKey: essenceKeys.spell(spellId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitFetch(() => fetchPowerSpell(spellId, signal), signal),
  staleTime: ESSENCE_STALE_MS,
});

export const heartItemQuery = () => ({
  queryKey: essenceKeys.heart(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchHeartItem(signal),
  staleTime: ESSENCE_STALE_MS,
});

/** The Items explorer's key and fetcher, so an icon it already loaded is reused. */
export const itemIconQuery = (itemId: number) => ({
  queryKey: itemKeys.media(itemId),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchItemMediaUrl(itemId, signal),
  staleTime: ESSENCE_STALE_MS,
});
