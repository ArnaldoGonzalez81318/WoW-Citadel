import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import { PET_FAMILIES } from "@/features/battlePets/config/petFamilies";
import { petQuery } from "@/features/battlePets/hooks/battlePetQueries";
import { useLearnedFamilyNames } from "@/features/battlePets/services/familyMemory";
import { env } from "@/lib/env";

/** In English the fallbacks already are Blizzard's names (checked against live records). */
const ENGLISH = env.locale.startsWith("en");

/**
 * Family id -> its name in the visitor's locale. Blizzard has no family
 * endpoint, so the names come from records: every pet or ability the page
 * loads teaches its family's name (see battlePetQueries). In English the
 * fallbacks are already Blizzard's names; in any other locale, a family no
 * record has named yet fetches its representative pet (one small cached
 * request per family, ten at most) rather than showing English.
 */
const useFamilyNames = (): ReadonlyMap<number, string> => {
  const learned = useLearnedFamilyNames();
  const missing = ENGLISH ? [] : PET_FAMILIES.filter((family) => !learned.has(family.id));
  useQueries({
    queries: missing.map((family) => petQuery(family.representativePetId)),
  });

  return useMemo(() => {
    const names = new Map<number, string>();
    PET_FAMILIES.forEach((family) => {
      names.set(family.id, learned.get(family.id) ?? family.fallbackName);
    });
    return names;
  }, [learned]);
};

export default useFamilyNames;
