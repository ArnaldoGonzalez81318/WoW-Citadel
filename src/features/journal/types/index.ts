export type { LocalizedString } from "@/lib/blizzardHelpers";

/** A name and id, the shape every journal list entry shares. */
export type JournalRef = {
  id: number;
  name: string;
};

/**
 * One entry of the journal's expansion index. Blizzard files a "Current
 * Season" pseudo-tier among the expansions; `isCurrentSeason` marks it.
 */
export type JournalTierSummary = JournalRef & {
  isCurrentSeason: boolean;
};

/** An expansion (or the Current Season) with its instances, in journal order. */
export type JournalTier = JournalRef & {
  raids: JournalRef[];
  dungeons: JournalRef[];
};

/** "RAID", "DUNGEON", or whatever else Blizzard adds; shown humanized. */
export type JournalCategory = string;

/** A difficulty an instance can be run on, with its group size. */
export type JournalMode = {
  /** "LFR", "NORMAL", "MYTHIC_KEYSTONE", "LEGACY_25_MAN_HEROIC", … */
  type: string;
  /** Blizzard's localized name: "Raid Finder", "25 Player (Heroic)". */
  name: string;
  players?: number;
};

/**
 * A dungeon or raid merged with its 600×300 zone art. Fields Blizzard leaves
 * out (world-boss "raids" have no location or level) stay undefined.
 */
export type JournalInstance = JournalRef & {
  description?: string;
  category?: JournalCategory;
  expansion?: JournalRef;
  location?: string;
  minimumLevel?: number;
  modes: JournalMode[];
  /** Bosses (and the odd primer page) in journal order. */
  encounters: JournalRef[];
  /** The zone tile, or null when Blizzard has no art (404). */
  imageUrl: string | null;
};

/** One paragraph, or a run of `$bullet;` lines, of an ability's text. */
export type JournalBodyBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

/**
 * A node of an encounter's ability tree (stages, roles, adds, spells).
 * Text keeps Blizzard's `[Spell Name]` references for the renderer to mark.
 */
export type JournalSection = {
  id: number;
  title: string;
  body: JournalBodyBlock[];
  spell?: JournalRef;
  /** An add's model, for the sections that introduce one. */
  displayId?: number;
  sections: JournalSection[];
};

export type JournalCreature = JournalRef & {
  displayId?: number;
};

/** A loot entry: `id` is the journal's own row id, `itemId` the item's. */
export type JournalLootItem = {
  id: number;
  itemId: number;
  name: string;
};

export type JournalEncounter = JournalRef & {
  description?: string;
  instance?: JournalRef;
  category?: JournalCategory;
  /** Difficulties the encounter appears on (names localized). */
  modes: Array<{ type: string; name: string }>;
  /** The boss first, then any adds or council members. */
  creatures: JournalCreature[];
  loot: JournalLootItem[];
  sections: JournalSection[];
};
