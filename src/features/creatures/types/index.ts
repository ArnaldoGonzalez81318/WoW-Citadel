export type { LocalizedString } from "@/lib/blizzardHelpers";

/** An id and its localized name (a creature's type or family, a pet spec). */
export type NamedRef = {
  id: number;
  name: string;
};

/**
 * One creature as Blizzard's creature search and creature records both
 * describe it: the search hands back the whole record, so a card already
 * holds everything the detail dialog shows.
 */
export type Creature = {
  id: number;
  name: string;
  /** Beast, Dragonkin, Non-combat Pet… */
  type?: NamedRef;
  /** The hunter pet family (Wolf, Owl…), for beasts that have one. */
  family?: NamedRef;
  /** Display ids in Blizzard's order; the first is the creature's usual look. */
  displayIds: number[];
  /** A hunter can tame it. */
  isTameable: boolean;
};

/** A creature type from Blizzard's type index (15 on US). */
export type CreatureType = NamedRef;

/** A creature family from Blizzard's family index (84 on US). */
export type CreatureFamilySummary = NamedRef;

/** A creature family's record. */
export type CreatureFamily = {
  id: number;
  name: string;
  /**
   * The hunter pet specialization its pets take (Ferocity, Tenacity or
   * Cunning). Absent for families no hunter tames: warlock demons and other
   * classes' summoned minions.
   */
  specialization?: NamedRef;
  /** Blizzard lists an icon for the family (most minion families have none). */
  hasIcon: boolean;
};

/** A hunter pet specialization with its in-game blurb and icon. */
export type PetSpecialization = {
  id: number;
  name: string;
  description?: string;
  iconUrl: string | null;
};

/** What a creature search asks Blizzard for. */
export type CreatureSearchCriteria = {
  /** Trimmed and at least two characters, or "" to search by filters only. */
  name: string;
  typeId: number | null;
  familyId: number | null;
  /** true: tameable only; false: untameable only; null: either. */
  tameable: boolean | null;
};

/** One page of creature search results. */
export type CreatureSearchPage = {
  creatures: Creature[];
  /** 1-based. */
  page: number;
  /** 0 when nothing matched. */
  pageCount: number;
  /**
   * Every match, when that is known: a single page, or names narrowed here.
   * Blizzard's creature search reports no total, only the page count.
   */
  total?: number;
  /**
   * Blizzard stops paging at 1,000 matches (`resultCountCapped`), or, for a
   * half-typed last word, there were more candidates than the 100 narrowed
   * here: either way the pages do not reach every match.
   */
  capped: boolean;
  /**
   * Nothing matched every word as typed, so these are the candidates for the
   * finished words that still match the half-typed last one (see nameSearch).
   */
  narrowed: boolean;
};
