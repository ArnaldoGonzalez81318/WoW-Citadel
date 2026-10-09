export type { LocalizedString } from "@/lib/blizzardHelpers";

/** An id and its localized name (a required class or race). */
export type NamedRef = {
  id: number;
  name: string;
};

/** A source or faction as Blizzard tags it: an enum code and its localized name. */
export type TypedRef = {
  /** VENDOR, DROP, ALLIANCE… */
  type: string;
  name: string;
};

/** The two factions Blizzard's mount search filters on (`faction.type`). */
export type MountFactionType = "ALLIANCE" | "HORDE";

/** One row of the mount index: every mount, names only. */
export type MountIndexEntry = {
  id: number;
  name: string;
};

/**
 * A mount as Blizzard's mount search describes it: enough for a card (the
 * search hit carries the displays, source and faction, but no description).
 */
export type MountSummary = {
  id: number;
  name: string;
  /**
   * Creature display ids in Blizzard's order with repeats dropped (Swift
   * Spectral Drake lists one display four times); the first is the default look.
   */
  displayIds: number[];
  /** Where it comes from; 42 mounts on US list none. */
  source?: TypedRef;
  /** Set for faction-specific mounts only. */
  faction?: TypedRef;
};

/** A mount's full record: the summary plus its description and requirements. */
export type MountDetail = MountSummary & {
  description?: string;
  /** Classes that may learn it (paladin chargers, warlock steeds…). */
  classes: NamedRef[];
  /** Races that may learn it (Thalassian Charger: Blood Elf). */
  races: NamedRef[];
  /** `should_exclude_if_uncollected`: the Mount Journal hides it until learned. */
  hiddenUntilCollected: boolean;
};

/**
 * Result order. "newest" is by mount id (highest first); "match" ranks a
 * name search by how closely each name answers it.
 */
export type MountSort = "newest" | "name" | "match";

/** A source with how many mounts come from it. */
export type SourceFacet = TypedRef & {
  count: number;
};

/** A faction with how many mounts belong to it. */
export type FactionFacet = TypedRef & {
  type: MountFactionType;
  count: number;
};

/** Every source and faction with their mount counts (and localized names). */
export type MountFacets = {
  /** Most mounts first; sources with none are left out. */
  sources: SourceFacet[];
  factions: FactionFacet[];
};

/** One server-side page of a filtered mount search. */
export type MountSearchPage = {
  mounts: MountSummary[];
  /** 1-based. */
  page: number;
  /** 0 when nothing matched. */
  pageCount: number;
};

/** What a filtered (source and/or faction) search asks Blizzard for. */
export type MountFilterCriteria = {
  source: string | null;
  faction: MountFactionType | null;
  sort: Exclude<MountSort, "match">;
};
