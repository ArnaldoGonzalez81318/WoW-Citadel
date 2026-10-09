import { useQuery } from "@tanstack/react-query";

import {
  abilityIconQuery,
  petIconQuery,
} from "@/features/battlePets/hooks/battlePetQueries";
import type { Pet, PetAbility } from "@/features/battlePets/types";

/** The pet's icon: inline in its record, else (rarely) from its media record. */
export const usePetIcon = (
  pet: Pet | null | undefined,
): { src: string | null; pending: boolean } => {
  const needsMedia =
    pet !== null && pet !== undefined && pet.iconUrl === null && pet.mediaId !== undefined;
  const mediaQuery = useQuery({
    ...petIconQuery(pet?.mediaId ?? 0),
    enabled: needsMedia,
  });
  if (!pet) {
    return { src: null, pending: false };
  }
  return {
    src: pet.iconUrl ?? mediaQuery.data ?? null,
    pending: needsMedia && mediaQuery.isPending,
  };
};

/**
 * An ability's icon, from its media record once the ability's own record
 * names it (the media id has matched the ability id in every record seen,
 * but the record is what says so).
 */
export const useAbilityIcon = (
  ability: PetAbility | null | undefined,
  enabled = true,
): { src: string | null; pending: boolean } => {
  const mediaId = ability ? (ability.mediaId ?? ability.id) : undefined;
  const iconQuery = useQuery({
    ...abilityIconQuery(mediaId ?? 0),
    enabled: enabled && mediaId !== undefined,
  });
  return {
    src: iconQuery.data ?? null,
    pending: mediaId !== undefined && iconQuery.isPending,
  };
};
