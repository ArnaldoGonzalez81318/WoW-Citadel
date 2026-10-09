import type {
  IndexEntry,
  LocalizedString,
  Pet,
  PetAbility,
  PetAbilitySlotRef,
  PetFaction,
  FamilyRef,
} from "@/features/battlePets/types";
import { blizzardClient } from "@/lib/blizzardClient";
import {
  cleanMarkup,
  localized,
  namespace,
  optional404,
} from "@/lib/blizzardHelpers";
import { formatNumber, humanizeEnum } from "@/lib/format";

/*
 * The pet journal and its battle abilities, all static data:
 *
 *   pet/index                 2,179 pets on US, names only (no family)
 *   pet/{id}                  family, source, flags, abilities, an inline
 *                             56px icon, and the creature it summons
 *   creature/{id}             that creature's display ids, whose renders
 *                             come from the shared creature-display query
 *   pet-ability/index         758 abilities, names only
 *   pet-ability/{id}          family, rounds, cooldown, media id
 *   media/pet-ability/{id}    the ability's icon
 *
 * There is no pet search endpoint (search/pet is a 404) and no pet family
 * endpoint, so names are matched locally and families come from records
 * (see familyMemory).
 */

/** Cards per page: 2, 3, 4 and 6 columns all end on a full row. */
export const CATALOG_PAGE_SIZE = 24;

type Reference = { id?: number; name?: LocalizedString };

type IndexResponse = {
  pets?: Reference[];
  abilities?: Reference[];
};

type FamilyResponse = { id?: number; type?: string; name?: LocalizedString };

type PetResponse = {
  id: number;
  name?: LocalizedString;
  battle_pet_type?: FamilyResponse;
  description?: LocalizedString | null;
  is_capturable?: boolean;
  is_tradable?: boolean;
  is_battlepet?: boolean;
  is_alliance_only?: boolean;
  is_horde_only?: boolean;
  should_exclude_if_uncollected?: boolean;
  abilities?: Array<{ ability?: Reference; slot?: number; required_level?: number }>;
  source?: { type?: string; name?: LocalizedString };
  icon?: string;
  creature?: Reference;
  is_random_creature_display?: boolean;
  media?: { id?: number };
};

type AbilityResponse = {
  id: number;
  name?: LocalizedString;
  battle_pet_type?: FamilyResponse;
  rounds?: number;
  cooldown?: number;
  media?: { id?: number };
};

type MediaResponse = {
  assets?: Array<{ key?: string; value?: string }>;
};

type CreatureResponse = {
  creature_displays?: Array<{ id?: number }>;
};

/* ------------------------------------------------------------------ */
/* Mapping                                                             */
/* ------------------------------------------------------------------ */

const toFamily = (raw: FamilyResponse | undefined): FamilyRef | undefined =>
  raw && typeof raw.id === "number"
    ? {
        id: raw.id,
        type: raw.type ?? "",
        name: localized(raw.name) || humanizeEnum(raw.type) || `Family ${raw.id}`,
      }
    : undefined;

const toEntries = (references: Reference[] | undefined, fallback: string): IndexEntry[] =>
  (references ?? [])
    .filter((entry): entry is Reference & { id: number } => typeof entry.id === "number")
    .map((entry) => ({
      id: entry.id,
      name: localized(entry.name) || `${fallback} #${entry.id}`,
    }));

const factionOf = (raw: PetResponse): PetFaction | undefined => {
  if (raw.is_alliance_only && !raw.is_horde_only) {
    return "ALLIANCE";
  }
  if (raw.is_horde_only && !raw.is_alliance_only) {
    return "HORDE";
  }
  return undefined;
};

/** Blizzard lists abilities in no particular order: the bar reads by slot, then level. */
const toAbilities = (raw: PetResponse["abilities"]): PetAbilitySlotRef[] =>
  (raw ?? [])
    .filter(
      (entry) =>
        typeof entry.ability?.id === "number" &&
        typeof entry.slot === "number" &&
        typeof entry.required_level === "number",
    )
    .map((entry) => ({
      id: entry.ability?.id as number,
      name: localized(entry.ability?.name) || `Ability #${entry.ability?.id}`,
      slot: entry.slot as number,
      requiredLevel: entry.required_level as number,
    }))
    .sort((left, right) => left.slot - right.slot || left.requiredLevel - right.requiredLevel);

const toPet = (raw: PetResponse): Pet => {
  const sourceType = raw.source?.type ?? "";
  const sourceName = localized(raw.source?.name) || humanizeEnum(sourceType);
  return {
    id: raw.id,
    name: localized(raw.name) || `Pet #${raw.id}`,
    family: toFamily(raw.battle_pet_type),
    description: cleanMarkup(localized(raw.description)) || undefined,
    isCapturable: raw.is_capturable === true,
    isTradable: raw.is_tradable === true,
    isBattlePet: raw.is_battlepet === true,
    faction: factionOf(raw),
    hiddenUntilCollected: raw.should_exclude_if_uncollected === true,
    abilities: toAbilities(raw.abilities),
    source: sourceName ? { type: sourceType, name: sourceName } : undefined,
    iconUrl: typeof raw.icon === "string" && raw.icon.length > 0 ? raw.icon : null,
    mediaId: raw.media?.id,
    creature:
      typeof raw.creature?.id === "number"
        ? { id: raw.creature.id, name: localized(raw.creature.name) }
        : undefined,
    isRandomDisplay: raw.is_random_creature_display === true,
  };
};

const toAbility = (raw: AbilityResponse): PetAbility => ({
  id: raw.id,
  name: localized(raw.name) || `Ability #${raw.id}`,
  family: toFamily(raw.battle_pet_type),
  rounds: typeof raw.rounds === "number" ? raw.rounds : undefined,
  cooldown: typeof raw.cooldown === "number" && raw.cooldown > 0 ? raw.cooldown : undefined,
  mediaId: raw.media?.id,
});

const iconOf = (media: MediaResponse | undefined): string | null => {
  const assets = media?.assets ?? [];
  return assets.find((asset) => asset.key === "icon")?.value ?? assets[0]?.value ?? null;
};

/* ------------------------------------------------------------------ */
/* Requests                                                            */
/* ------------------------------------------------------------------ */

/** Every pet in the journal, in Blizzard's (unsorted) order. */
export const fetchPetIndex = async (signal?: AbortSignal): Promise<IndexEntry[]> => {
  const response = await blizzardClient.get<IndexResponse>(
    "/data/wow/pet/index",
    { namespace: namespace("static") },
    { signal },
  );
  return toEntries(response.pets, "Pet");
};

/** Every pet battle ability, in Blizzard's order. */
export const fetchAbilityIndex = async (signal?: AbortSignal): Promise<IndexEntry[]> => {
  const response = await blizzardClient.get<IndexResponse>(
    "/data/wow/pet-ability/index",
    { namespace: namespace("static") },
    { signal },
  );
  return toEntries(response.abilities, "Ability");
};

/** One pet, or null when Blizzard has no such id (404). */
export const fetchPet = async (petId: number, signal?: AbortSignal): Promise<Pet | null> => {
  const raw = await optional404(() =>
    blizzardClient.get<PetResponse>(
      `/data/wow/pet/${petId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  return raw ? toPet(raw) : null;
};

/** A pet's icon from its media record, for the rare record without an inline one. */
export const fetchPetIcon = async (mediaId: number, signal?: AbortSignal): Promise<string | null> =>
  iconOf(
    await optional404(() =>
      blizzardClient.get<MediaResponse>(
        `/data/wow/media/pet/${mediaId}`,
        { namespace: namespace("static") },
        { signal },
      ),
    ),
  );

/** One ability, or null when Blizzard has no such id (404). */
export const fetchAbility = async (
  abilityId: number,
  signal?: AbortSignal,
): Promise<PetAbility | null> => {
  const raw = await optional404(() =>
    blizzardClient.get<AbilityResponse>(
      `/data/wow/pet-ability/${abilityId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  return raw ? toAbility(raw) : null;
};

/** An ability's 56px icon, or null when Blizzard has none (404). */
export const fetchAbilityIcon = async (
  mediaId: number,
  signal?: AbortSignal,
): Promise<string | null> =>
  iconOf(
    await optional404(() =>
      blizzardClient.get<MediaResponse>(
        `/data/wow/media/pet-ability/${mediaId}`,
        { namespace: namespace("static") },
        { signal },
      ),
    ),
  );

/** The display ids of the creature a pet summons (empty when it has none, or no record). */
export const fetchCreatureDisplayIds = async (
  creatureId: number,
  signal?: AbortSignal,
): Promise<number[]> => {
  const raw = await optional404(() =>
    blizzardClient.get<CreatureResponse>(
      `/data/wow/creature/${creatureId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  return (raw?.creature_displays ?? [])
    .map((display) => display.id)
    .filter((id): id is number => typeof id === "number" && id > 0);
};

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** "1 pet", "2,179 pets" with grouped digits. */
export const pluralize = (count: number, one: string, many: string): string =>
  `${formatNumber(count)} ${count === 1 ? one : many}`;

/** "1 round · 3-round cooldown", from the two fields Blizzard gives. */
export const abilityTiming = (ability: Pick<PetAbility, "rounds" | "cooldown">): string => {
  const parts: string[] = [];
  if (ability.rounds !== undefined) {
    parts.push(pluralize(ability.rounds, "round", "rounds"));
  }
  parts.push(
    ability.cooldown !== undefined
      ? `${formatNumber(ability.cooldown)}-round cooldown`
      : "No cooldown",
  );
  return parts.join(" · ");
};
