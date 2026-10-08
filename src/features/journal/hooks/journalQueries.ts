import {
  fetchJournalEncounter,
  fetchJournalEncounterIndex,
  fetchJournalInstance,
  fetchJournalInstanceIndex,
  fetchJournalTier,
  fetchJournalTiers,
} from "@/features/journal/services/journalService";
import {
  fetchItemMediaUrl,
  itemKeys,
} from "@/features/items/services/itemService";
import { env } from "@/lib/env";

/** Journal text, loot and art change with patches at most; a day is plenty. */
const STATIC_STALE_MS = 24 * 60 * 60_000;

/** Names are localized, so every key carries the locale as well as the region. */
export const journalKeys = {
  tiers: () => ["encounter-journal", "tiers", env.region, env.locale] as const,
  tier: (tierId: number) =>
    ["encounter-journal", "tier", tierId, env.region, env.locale] as const,
  instance: (instanceId: number) =>
    ["encounter-journal", "instance", instanceId, env.region, env.locale] as const,
  encounter: (encounterId: number) =>
    ["encounter-journal", "encounter", encounterId, env.region, env.locale] as const,
  encounterIndex: () =>
    ["encounter-journal", "encounter-index", env.region, env.locale] as const,
  instanceIndex: () =>
    ["encounter-journal", "instance-index", env.region, env.locale] as const,
};

export const journalTiersQuery = () => ({
  queryKey: journalKeys.tiers(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchJournalTiers(signal),
  staleTime: STATIC_STALE_MS,
});

export const journalTierQuery = (tierId: number) => ({
  queryKey: journalKeys.tier(tierId),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchJournalTier(tierId, signal),
  staleTime: STATIC_STALE_MS,
});

/** Shared by the instance cards and the instance overview, so a pick costs nothing twice. */
export const journalInstanceQuery = (instanceId: number) => ({
  queryKey: journalKeys.instance(instanceId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchJournalInstance(instanceId, signal),
  staleTime: STATIC_STALE_MS,
});

/** Shared by the boss cards, search results and the encounter view. */
export const journalEncounterQuery = (encounterId: number) => ({
  queryKey: journalKeys.encounter(encounterId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchJournalEncounter(encounterId, signal),
  staleTime: STATIC_STALE_MS,
});

export const journalEncounterIndexQuery = () => ({
  queryKey: journalKeys.encounterIndex(),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchJournalEncounterIndex(signal),
  staleTime: STATIC_STALE_MS,
});

export const journalInstanceIndexQuery = () => ({
  queryKey: journalKeys.instanceIndex(),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchJournalInstanceIndex(signal),
  staleTime: STATIC_STALE_MS,
});

/** The Items explorer's key and fetcher, so a loot icon it already loaded is reused. */
export const lootIconQuery = (itemId: number) => ({
  queryKey: itemKeys.media(itemId),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchItemMediaUrl(itemId, signal),
  staleTime: STATIC_STALE_MS,
});
