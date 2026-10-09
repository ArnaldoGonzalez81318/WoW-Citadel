export type { LocalizedString } from "@/lib/blizzardHelpers";

/** The two catalogues the page browses: the pet journal and the battle abilities. */
export type CatalogKind = "pet" | "ability";

/** One entry of a Blizzard index: what the grid pages through before any record loads. */
export type IndexEntry = {
  id: number;
  name: string;
};

/**
 * A battle pet family (Blizzard's `battle_pet_type`): 0 Humanoid to 9
 * Mechanical, the order the in-game pet journal lists them in.
 */
export type FamilyRef = {
  id: number;
  /** Blizzard's enum: HUMANOID, DRAGONKIN… */
  type: string;
  /** Localized ("Mechanical"). */
  name: string;
};

export type PetFaction = "ALLIANCE" | "HORDE";

/** One of a pet's battle abilities, as its record lists it. */
export type PetAbilitySlotRef = {
  id: number;
  name: string;
  /** 0, 1 or 2: the column of the in-game ability bar. */
  slot: number;
  /** The pet level it unlocks at (1, 2, 4, 10, 15, 20). */
  requiredLevel: number;
};

/** A pet journal entry. */
export type Pet = {
  id: number;
  name: string;
  family?: FamilyRef;
  description?: string;
  /** Can be caught in a wild pet battle. */
  isCapturable: boolean;
  /** Can be traded (caged). */
  isTradable: boolean;
  /** Blizzard's `is_battlepet`; the companions without it list no abilities. */
  isBattlePet: boolean;
  /** Set when only one faction can learn it. */
  faction?: PetFaction;
  /** Blizzard flags it to stay out of the journal until collected. */
  hiddenUntilCollected: boolean;
  /** Sorted by slot, then level: the order the dialog's bar reads in. */
  abilities: PetAbilitySlotRef[];
  /** "Drop", "Pet Battle", "Vendor"… (localized), with Blizzard's enum. */
  source?: { type: string; name: string };
  /** Blizzard's 56px icon, inline in the record. */
  iconUrl: string | null;
  /** The pet media record, for a pet whose record carries no icon. */
  mediaId?: number;
  /** The creature it summons: its model render lives there. */
  creature?: { id: number; name: string };
  /** Blizzard picks one of the creature's displays at random. */
  isRandomDisplay: boolean;
};

/** A pet battle ability's record. */
export type PetAbility = {
  id: number;
  name: string;
  /** The family whose damage type it deals (and whose pets it suits). */
  family?: FamilyRef;
  /** Blizzard's `rounds` field. */
  rounds?: number;
  /** Rounds before it can be used again; absent when it has none. */
  cooldown?: number;
  mediaId?: number;
};

/** "newest" by id, "name" A to Z, "match" best match first (only while searching). */
export type CatalogSort = "newest" | "name" | "match";
