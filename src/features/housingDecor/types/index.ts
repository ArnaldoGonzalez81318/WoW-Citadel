import type { QualityKey } from "@/theme";

export type { LocalizedString } from "@/lib/blizzardHelpers";

/** The catalogue's three tabs. */
export type HousingTab = "decor" | "fixtures" | "rooms";

/**
 * The page's URL state. `q` is one search for whichever tab is open (it
 * survives a tab switch); `page` and `sort` belong to Decor, `kind` to
 * Fixtures; `decor`, `fixture` and `room` open their dialogs.
 */
export type HousingParams = {
  tab: string;
  q: string;
  page: string;
  sort: string;
  kind: string;
  decor: string;
  fixture: string;
  room: string;
};

/** How the decor grid is ordered while nothing is searched. */
export type DecorSort = "newest" | "name";

/** One entry of Blizzard's decor index (2,131 on US). */
export type DecorEntry = {
  id: number;
  name: string;
};

/**
 * What Blizzard's decor search adds to an index entry: the item that adds
 * the decor to the House Chest (a few decor link none).
 */
export type DecorItemLink = {
  decorId: number;
  itemId?: number;
};

/** A decor item's search hit, enough to tint a card. */
export type DecorItemSummary = {
  itemId: number;
  quality?: QualityKey;
  qualityName?: string;
};

/** One dye slot of a decor: Blizzard numbers them 0 to 2 and names the dye family. */
export type DyeSlot = {
  index: number;
  /** "Wood", "Metal", "General" as Blizzard writes it (not localized). */
  category: string;
};

/** A decor record. */
export type Decor = {
  id: number;
  name: string;
  item?: { id: number; name: string };
  dyeSlots: DyeSlot[];
  /** `default_collection_count`: set on a few basics (10 Sturdy Wooden Interior Pillars). */
  defaultCollectionCount?: number;
};

/** The item behind a decor, as its tooltip describes it. */
export type DecorItem = {
  id: number;
  name: string;
  quality?: QualityKey;
  qualityName?: string;
  /** "Housing · Decor", from the item's class and subclass. */
  typeLine?: string;
  /** "Binds to Warband". */
  binding?: string;
  /** Flavor text, as Blizzard writes it (some carry their own quotes). */
  description?: string;
  /** "Use: Add this Decor to your House Chest.", repeats dropped. */
  effects: string[];
  /** "Requires Tranquillien - Exalted". */
  requirements: string[];
  /** Copper; 0 when vendors will not buy it. */
  sellPrice: number;
};

/** What a fixture is, read from its English name (see housingCatalog). */
export type FixtureKind =
  | "base"
  | "roof"
  | "dormer"
  | "window"
  | "fortification"
  | "door"
  | "tower"
  | "chimney"
  | "unnamed";

/** One fixture from Blizzard's fixture search. */
export type Fixture = {
  id: number;
  /** Localized, whitespace tidied; "" when Blizzard names none. */
  name: string;
  /** The English name, which the families and kinds are read from. */
  englishName: string;
};

/** A fixture inside its family: the variant part of its name, if it has one. */
export type FixtureMember = Fixture & {
  /** "Forest" of "Woodland Dormer - Forest"; null when the name has no variant. */
  variant: string | null;
};

/**
 * Fixtures sharing a name before " - " ("Woodland Dormer"), or sharing a
 * whole name (the eighteen "Faceted Roof" fixtures).
 */
export type FixtureFamily = {
  /** The English family name, lowercased (stable across locales). */
  key: string;
  /** Localized family name. */
  name: string;
  kind: FixtureKind;
  /** By variant name, then id. */
  members: FixtureMember[];
  /** Some member has a variant name (colours), rather than identical names. */
  hasVariants: boolean;
  /** Family and variant names, for the name search. */
  searchText: string;
};

/** A hook point on a fixture, as its record lists it. */
export type FixtureHook = {
  id: number;
  /** "Door", "Window", "Roof Window", "Tower", "Chimney" (localized). */
  type: string;
};

/** A fixture record: its name and the hooks other fixtures attach to. */
export type FixtureRecord = {
  id: number;
  name: string;
  hooks: FixtureHook[];
};

/** How many hook points of one type Blizzard's hook index lists. */
export type HookTypeCount = {
  type: string;
  count: number;
};

/** The shape a room's English name gives it. */
export type RoomShape =
  | "square"
  | "octagon"
  | "t-shaped"
  | "l-shaped"
  | "cross"
  | "circle"
  | "hallway"
  | "closet"
  | "entry"
  | "stairwell"
  | "plot"
  | "themed";

/** The size word in a room's English name, smallest first. */
export type RoomSize = "tiny" | "small" | "medium" | "large";

/** One room from Blizzard's room search. */
export type Room = {
  id: number;
  /** Localized. */
  name: string;
  englishName: string;
  shape: RoomShape;
  size?: RoomSize;
  /** "Left" of "Stairwell (Left)": the stairwell's hand, mirrored in its plan. */
  hand?: "left" | "right";
  /** The localized words in brackets ("Small", "klein"), shown as the size. */
  qualifier?: string;
};
