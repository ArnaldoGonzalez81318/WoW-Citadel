import type { LocalizedString } from "@/lib/blizzardHelpers";

export type { LocalizedString };

export type NamedRef = {
  id: number;
  name: string;
};

/** One entry of the appearance set index. */
export type AppearanceSetRef = {
  id: number;
  name: string;
};

/** Name-based tags, English locales only (see setFilters). */
export type SetKeyword = "pvp" | "cloth" | "leather" | "mail" | "plate";

/** The Sets view's chip filter: a keyword, or "other" for names without a PvP title. */
export type SetFilter = SetKeyword | "other";

/**
 * Every set Blizzard lists under one name. The index often repeats a name
 * (four "Cosmic Penitent's Raiment"): each set lists its own appearances (a
 * piece can recur across them) and sometimes its own items, so the Sets
 * view shows the name once with its versions.
 */
export type SetGroup = {
  name: string;
  /** Set ids under the name, lowest first (the dialog's "Version 1" onwards). */
  ids: number[];
  /**
   * The highest id: set ids grow with every patch, so this sorts newest
   * first, and it is the set the card shows and opens.
   */
  newestId: number;
  keywords: ReadonlySet<SetKeyword>;
};

export type AppearanceSet = {
  id: number;
  name: string;
  /** Blizzard's order (head first, the cloak usually last). */
  appearanceIds: number[];
};

/** A slot as Blizzard types and names it (`ROBE`, "Chest"). */
export type SlotRef = {
  type: string;
  /** Localized; empty when the record carried none. */
  name: string;
};

export type Appearance = {
  id: number;
  slot?: SlotRef;
  itemClass?: NamedRef;
  itemSubclass?: NamedRef;
  /** The client's model display record for the look (no render behind it in the API). */
  displayInfoId?: number;
  /** Every item that wears this look, in Blizzard's order. */
  items: NamedRef[];
};

export type AppearanceSort = "newest" | "oldest";

export type AppearanceCriteria = {
  /** A slot type (`HEAD`), or null for every slot. */
  slot: string | null;
  sort: AppearanceSort;
};

/** A search hit: Blizzard's appearance index holds only the id, slot and display id. */
export type AppearanceHit = {
  id: number;
  slot?: SlotRef;
};

export type AppearancePage = {
  hits: AppearanceHit[];
  page: number;
  pageCount: number;
  /** Blizzard stopped counting at 1,000 matches. */
  capped: boolean;
  /**
   * `slot-list`: the search had nothing for the slot, so the page came from
   * the slot's own id list (see searchAppearances).
   */
  source: "search" | "slot-list";
  /** Exact match count, when Blizzard (or the slot list) gives one. */
  total?: number;
};

/** The parts of an item record the appearance dialog shows. */
export type AppearanceItem = {
  id: number;
  name: string;
  /** Lowercased quality type (`epic`), for the theme's quality colours. */
  quality?: string;
  qualityName?: string;
  level?: number;
  inventoryType?: string;
};
