import {
  fetchCreature,
  fetchCreatureFamily,
  fetchCreatureFamilyIcon,
  fetchCreatureFamilyIndex,
  fetchCreatureTypes,
  fetchPetSpecialization,
  searchCreatures,
} from "@/features/creatures/services/creatureService";
import type { CreatureSearchCriteria } from "@/features/creatures/types";
import { createConcurrencyLimiter } from "@/features/pvpTiers/services/concurrencyLimiter";
import { env } from "@/lib/env";

/** Creatures, families and specs change with patches, not hours. */
const STATIC_STALE_MS = 24 * 60 * 60_000;
/** A search page is static data too, but a visitor may page through many; an hour keeps the cache lean. */
const SEARCH_STALE_MS = 60 * 60_000;

/**
 * The family gallery needs all 84 family records to group them by pet
 * spec (the index has names only). Started together they would burst
 * through the proxy, which shares Blizzard's per-second quota with every
 * other visitor (and Netlify allows each IP 600 a minute), so they go six at
 * a time. Every family fetch shares the cap, so a single family's record
 * (the results banner, the dialog) never doubles up with the gallery's.
 */
const MAX_FAMILIES_IN_FLIGHT = 6;
const limitFamilyFetch = createConcurrencyLimiter(MAX_FAMILIES_IN_FLIGHT);
/**
 * On a wide screen most of the gallery's tiles are near the
 * viewport at once, so their icons get a cap of their own (apart from the
 * records, so an icon never waits behind the whole catalog).
 */
const limitIconFetch = createConcurrencyLimiter(MAX_FAMILIES_IN_FLIGHT);

/*
 * Names are localized, so those keys carry the locale; icons are not (the
 * render host is per region only).
 */
export const creatureKeys = {
  search: (criteria: CreatureSearchCriteria, page: number) =>
    [
      "creature-search",
      criteria.name,
      criteria.typeId,
      criteria.familyId,
      criteria.tameable,
      page,
      env.region,
      env.locale,
    ] as const,
  creature: (creatureId: number) =>
    ["creature", creatureId, env.region, env.locale] as const,
  types: () => ["creature-types", env.region, env.locale] as const,
  familyIndex: () => ["creature-family-index", env.region, env.locale] as const,
  family: (familyId: number) =>
    ["creature-family", familyId, env.region, env.locale] as const,
  familyIcon: (familyId: number) =>
    ["creature-family-icon", familyId, env.region] as const,
  petSpec: (specId: number) =>
    ["hunter-pet-specialization", specId, env.region, env.locale] as const,
};

export const creatureSearchQuery = (criteria: CreatureSearchCriteria, page: number) => ({
  queryKey: creatureKeys.search(criteria, page),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    searchCreatures(criteria, page, signal),
  staleTime: SEARCH_STALE_MS,
});

/** One creature (null when Blizzard has none); the dialog seeds it from the clicked card. */
export const creatureQuery = (creatureId: number) => ({
  queryKey: creatureKeys.creature(creatureId),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchCreature(creatureId, signal),
  staleTime: STATIC_STALE_MS,
});

export const creatureTypesQuery = () => ({
  queryKey: creatureKeys.types(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchCreatureTypes(signal),
  staleTime: STATIC_STALE_MS,
});

export const creatureFamilyIndexQuery = () => ({
  queryKey: creatureKeys.familyIndex(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchCreatureFamilyIndex(signal),
  staleTime: STATIC_STALE_MS,
});

/**
 * Shared by the gallery (to group), the results banner and the dialog (for
 * the pet spec). Kept for as long as it stays fresh, so coming back to the
 * gallery later in the session costs no requests at all.
 */
export const creatureFamilyQuery = (familyId: number) => ({
  queryKey: creatureKeys.family(familyId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitFamilyFetch(() => fetchCreatureFamily(familyId, signal), signal),
  staleTime: STATIC_STALE_MS,
  gcTime: STATIC_STALE_MS,
});

/** Shared by the gallery tiles, the cards' family line, the banner and the dialog. */
export const creatureFamilyIconQuery = (familyId: number) => ({
  queryKey: creatureKeys.familyIcon(familyId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitIconFetch(() => fetchCreatureFamilyIcon(familyId, signal), signal),
  staleTime: Infinity,
  gcTime: STATIC_STALE_MS,
});

export const petSpecializationQuery = (specId: number) => ({
  queryKey: creatureKeys.petSpec(specId),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchPetSpecialization(specId, signal),
  staleTime: Infinity,
  gcTime: STATIC_STALE_MS,
});
