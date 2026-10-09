import { env } from "@/lib/env";
import type { QualityKey } from "@/theme";

/*
 * Blizzard's Game Data API has no pet family endpoint: a family is only ever
 * a `battle_pet_type` inside a pet or ability record. The ten below are the
 * game's own (ids 0–9 in the pet journal's order). Everything else here is
 * game knowledge rather than API data, and the page labels it as such:
 *
 *   iconName        the family's interface icon, served by name from
 *                   Blizzard's render host (checked for all ten)
 *   strongAgainst   its abilities deal 50% more damage to this family
 *   weakAgainst     its abilities deal 33% less damage to this family
 *   representative  a pet of the family (checked against live records),
 *                   whose record names the family in the visitor's locale
 */

type PaletteKey = "primary" | "secondary" | "success" | "warning" | "error" | "info";
export type FamilyAccent = PaletteKey | QualityKey;

export type PetFamily = {
  id: number;
  /** Blizzard's `battle_pet_type.type`. */
  type: string;
  /** English, shown only until a record names the family in the visitor's locale. */
  fallbackName: string;
  iconName: string;
  /** Echoes the colour of the family's in-game icon (theme tokens only). */
  accent: FamilyAccent;
  strongAgainst: number;
  weakAgainst: number;
  representativePetId: number;
};

export const PET_FAMILIES: readonly PetFamily[] = [
  {
    id: 0,
    type: "HUMANOID",
    fallbackName: "Humanoid",
    iconName: "icon_petfamily_humanoid",
    accent: "info",
    strongAgainst: 1,
    weakAgainst: 7,
    representativePetId: 111,
  },
  {
    id: 1,
    type: "DRAGONKIN",
    fallbackName: "Dragonkin",
    iconName: "icon_petfamily_dragon",
    accent: "success",
    strongAgainst: 5,
    weakAgainst: 3,
    representativePetId: 144,
  },
  {
    id: 2,
    type: "FLYING",
    fallbackName: "Flying",
    iconName: "icon_petfamily_flying",
    accent: "secondary",
    strongAgainst: 8,
    weakAgainst: 1,
    representativePetId: 139,
  },
  {
    id: 3,
    type: "UNDEAD",
    fallbackName: "Undead",
    iconName: "icon_petfamily_undead",
    accent: "poor",
    strongAgainst: 0,
    weakAgainst: 8,
    representativePetId: 266,
  },
  {
    id: 4,
    type: "CRITTER",
    fallbackName: "Critter",
    iconName: "icon_petfamily_critter",
    accent: "artifact",
    strongAgainst: 3,
    weakAgainst: 0,
    representativePetId: 55,
  },
  {
    id: 5,
    type: "MAGIC",
    fallbackName: "Magic",
    iconName: "icon_petfamily_magical",
    accent: "epic",
    strongAgainst: 2,
    weakAgainst: 9,
    representativePetId: 229,
  },
  {
    id: 6,
    type: "ELEMENTAL",
    fallbackName: "Elemental",
    iconName: "icon_petfamily_elemental",
    accent: "legendary",
    strongAgainst: 9,
    weakAgainst: 4,
    representativePetId: 279,
  },
  {
    id: 7,
    type: "BEAST",
    fallbackName: "Beast",
    iconName: "icon_petfamily_beast",
    accent: "error",
    strongAgainst: 4,
    weakAgainst: 2,
    representativePetId: 90,
  },
  {
    id: 8,
    type: "AQUATIC",
    fallbackName: "Aquatic",
    iconName: "icon_petfamily_water",
    accent: "heirloom",
    strongAgainst: 6,
    weakAgainst: 5,
    representativePetId: 64,
  },
  {
    id: 9,
    type: "MECHANICAL",
    fallbackName: "Mechanical",
    iconName: "icon_petfamily_mechanical",
    accent: "common",
    strongAgainst: 7,
    weakAgainst: 6,
    representativePetId: 95,
  },
];

const BY_ID: ReadonlyMap<number, PetFamily> = new Map(
  PET_FAMILIES.map((family) => [family.id, family]),
);

export const familyById = (id: number | null | undefined): PetFamily | undefined =>
  id === null || id === undefined ? undefined : BY_ID.get(id);

/** The family whose abilities hit `id` hardest (it takes 50% more from them). */
export const vulnerableTo = (id: number): PetFamily | undefined =>
  PET_FAMILIES.find((family) => family.strongAgainst === id);

/** The family whose abilities hit `id` softest (it takes 33% less from them). */
export const resistantTo = (id: number): PetFamily | undefined =>
  PET_FAMILIES.find((family) => family.weakAgainst === id);

/** The family's 56px icon on Blizzard's render host (no API request). */
export const familyIconUrl = (family: PetFamily): string =>
  `https://render.worldofwarcraft.com/${env.region}/icons/56/${family.iconName}.jpg`;

/** "0"–"9" from the URL, or null. */
export const parseFamilyParam = (value: string): number | null => {
  if (!/^\d$/.test(value)) {
    return null;
  }
  const id = Number(value);
  return BY_ID.has(id) ? id : null;
};
