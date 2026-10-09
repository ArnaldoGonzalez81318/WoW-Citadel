/** Blizzard's three specialization roles, as `role.type` spells them. */
export type RoleType = "TANK" | "HEALER" | "DAMAGE";

export type NamedRef = {
  id: number;
  name: string;
};

/**
 * One essence as Blizzard's essence search lists it: its name and the
 * specializations allowed to use it, enough to filter and group the whole
 * roster before any essence record loads. Spec names come without their
 * class ("Frost" twice), so the class is read from the spec records.
 */
export type EssenceSummary = {
  id: number;
  name: string;
  specs: NamedRef[];
};

/** One rank of an essence: the spell behind its major and its minor power. */
export type EssencePower = {
  id: number;
  rank: number;
  major: NamedRef | null;
  minor: NamedRef | null;
};

/** An essence record: its specializations and its powers, rank 1 first. */
export type Essence = {
  id: number;
  name: string;
  specs: NamedRef[];
  powers: EssencePower[];
};

/** What the page needs from a playable specialization record. */
export type Specialization = {
  id: number;
  /** "Frost" */
  name: string;
  /** "Mage"; null when the record names no class. */
  playableClass: NamedRef | null;
  role: RoleType | null;
  /** Blizzard's localized role name ("Tank", "Heilung"). */
  roleName: string;
};

/** A power's spell: its tooltip text and icon. */
export type PowerSpell = {
  id: number;
  name: string;
  /** The description split into paragraphs, inline markup stripped. */
  paragraphs: string[];
  iconUrl: string | null;
};

/** The Heart of Azeroth itself, for the intro. */
export type HeartItem = {
  id: number;
  name: string;
  /** Blizzard's quality type ("ARTIFACT"), for the item colour. */
  qualityType: string | null;
  qualityName: string;
  /** Its equip line, as the item's tooltip states it. */
  effect: string;
};

/**
 * A section of the roster: the essences open to one combination of roles
 * ("TANK", or "TANK+HEALER+DAMAGE" for the ones every role can use).
 */
export type EssenceGroup = {
  key: string;
  roles: RoleType[];
  essences: EssenceSummary[];
};
