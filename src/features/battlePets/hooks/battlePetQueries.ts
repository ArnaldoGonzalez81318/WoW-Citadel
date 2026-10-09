import {
  fetchAbility,
  fetchAbilityIcon,
  fetchAbilityIndex,
  fetchCreatureDisplayIds,
  fetchPet,
  fetchPetIcon,
  fetchPetIndex,
} from "@/features/battlePets/services/battlePetService";
import {
  rememberFamily,
  rememberFamilyName,
} from "@/features/battlePets/services/familyMemory";
import type { FamilyRef, PetAbility, Pet } from "@/features/battlePets/types";
import { createConcurrencyLimiter } from "@/features/pvpTiers/services/concurrencyLimiter";
import { env } from "@/lib/env";

/** The journal changes with patches, not hours. */
const STATIC_STALE_MS = 24 * 60 * 60_000;

/*
 * A page of 24 cards starts 24 record lookups as it nears the viewport, and
 * a family scan many more. Started together they would burst through the
 * proxy, which shares Blizzard's per-second quota with every other visitor,
 * so records go six at a time; a page left behind (its cards unmount)
 * cancels its queued lookups. A card's art (icons, and the creature record
 * that names a pet's model) gets a cap of its own so it never waits behind
 * a scan.
 */
const MAX_IN_FLIGHT = 6;
const limitRecordFetch = createConcurrencyLimiter(MAX_IN_FLIGHT);
const limitArtFetch = createConcurrencyLimiter(MAX_IN_FLIGHT);

/*
 * Names are localized, so those keys carry the locale; icons and display
 * ids are not (the render host is per region only).
 */
export const battlePetKeys = {
  petIndex: () => ["battle-pets", "pet-index", env.region, env.locale] as const,
  pet: (petId: number) => ["battle-pets", "pet", petId, env.region, env.locale] as const,
  petIcon: (mediaId: number) => ["battle-pets", "pet-icon", mediaId, env.region] as const,
  abilityIndex: () => ["battle-pets", "ability-index", env.region, env.locale] as const,
  ability: (abilityId: number) =>
    ["battle-pets", "ability", abilityId, env.region, env.locale] as const,
  abilityIcon: (mediaId: number) =>
    ["battle-pets", "ability-icon", mediaId, env.region] as const,
  creatureDisplays: (creatureId: number) =>
    ["battle-pets", "creature-displays", creatureId, env.region] as const,
};

/** Every record seen teaches the page its family (and the family's name). */
const learnFamily = (family: FamilyRef | undefined): void => {
  if (family) {
    rememberFamilyName(family.id, family.name);
  }
};

const notePet = (petId: number, pet: Pet | null): Pet | null => {
  rememberFamily("pet", petId, pet?.family?.id);
  learnFamily(pet?.family);
  return pet;
};

const noteAbility = (abilityId: number, ability: PetAbility | null): PetAbility | null => {
  rememberFamily("ability", abilityId, ability?.family?.id);
  learnFamily(ability?.family);
  return ability;
};

export const petIndexQuery = () => ({
  queryKey: battlePetKeys.petIndex(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchPetIndex(signal),
  staleTime: STATIC_STALE_MS,
  gcTime: STATIC_STALE_MS,
});

export const abilityIndexQuery = () => ({
  queryKey: battlePetKeys.abilityIndex(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchAbilityIndex(signal),
  staleTime: STATIC_STALE_MS,
  gcTime: STATIC_STALE_MS,
});

/** Shared by the cards, the family scan and the dialog, so a pet is fetched once. */
export const petQuery = (petId: number) => ({
  queryKey: battlePetKeys.pet(petId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitRecordFetch(async () => notePet(petId, await fetchPet(petId, signal)), signal),
  staleTime: STATIC_STALE_MS,
});

export const petIconQuery = (mediaId: number) => ({
  queryKey: battlePetKeys.petIcon(mediaId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitArtFetch(() => fetchPetIcon(mediaId, signal), signal),
  staleTime: Infinity,
  gcTime: STATIC_STALE_MS,
});

export const abilityQuery = (abilityId: number) => ({
  queryKey: battlePetKeys.ability(abilityId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitRecordFetch(
      async () => noteAbility(abilityId, await fetchAbility(abilityId, signal)),
      signal,
    ),
  staleTime: STATIC_STALE_MS,
});

export const abilityIconQuery = (mediaId: number) => ({
  queryKey: battlePetKeys.abilityIcon(mediaId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitArtFetch(() => fetchAbilityIcon(mediaId, signal), signal),
  staleTime: Infinity,
  gcTime: STATIC_STALE_MS,
});

/** Shared by the cards (the first display's render) and the dialog (every look). */
export const creatureDisplaysQuery = (creatureId: number) => ({
  queryKey: battlePetKeys.creatureDisplays(creatureId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limitArtFetch(() => fetchCreatureDisplayIds(creatureId, signal), signal),
  staleTime: STATIC_STALE_MS,
});
