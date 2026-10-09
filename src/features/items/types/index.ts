import type { QualityKey } from "@/theme";

export type { LocalizedString } from "@/lib/blizzardHelpers";

export type NamedRef = {
  id: number;
  name: string;
};

export type ItemClassSummary = NamedRef;

export type ItemSubclassSummary = NamedRef;

export type ItemClassDetail = NamedRef & {
  subclasses: ItemSubclassSummary[];
};

/** An inventory type: Blizzard's enum (`HEAD`) and its localized name ("Head"). */
export type ItemSlot = {
  type: string;
  name: string;
};

/**
 * What a search hit says about an item: enough for a card, and the seed of
 * the detail dialog until the full record (with its tooltip) loads.
 */
export type ItemSummary = {
  id: number;
  name: string;
  quality?: QualityKey;
  /** Localized quality name ("Epic"), for screen readers and the dialog. */
  qualityName?: string;
  /** Base item level from the record (the tooltip may show a scaled one). */
  level?: number;
  requiredLevel?: number;
  itemClass?: NamedRef;
  itemSubclass?: NamedRef;
  slot?: ItemSlot;
  sellPrice?: number;
};

/** The search's sort orders; `newest` (highest item id first) is the landing view. */
export type ItemSort = "newest" | "level" | "name";

export type ItemLevelRange = {
  min: number | null;
  max: number | null;
};

export type ItemSearchCriteria = {
  name: string;
  classId: number | null;
  subclassId: number | null;
  /** Blizzard's quality enum, lowercased (`epic`). */
  quality: QualityKey | null;
  /** A slot group key from `SLOT_GROUPS` (`chest` covers CHEST and ROBE). */
  slot: string | null;
  level: ItemLevelRange;
  sort: ItemSort;
};

export type ItemSearchPage = {
  items: ItemSummary[];
  page: number;
  pageCount: number;
  /** Exact match count, only when the response lets us know it. */
  total?: number;
  /** Blizzard stopped counting at 1,000 matches. */
  capped: boolean;
  /** Candidates of a half-typed name, narrowed here (see nameSearch). */
  narrowed: boolean;
};

/** A tooltip line Blizzard colours itself (stats, name descriptions). */
export type TooltipColor = {
  r: number;
  g: number;
  b: number;
};

export type TooltipStat = {
  text: string;
  color?: TooltipColor;
  /** Grey in game: the stat does not apply to the previewing character. */
  negated: boolean;
  /** Secondary stats ("+75 Critical Strike"), green in game. */
  equipBonus: boolean;
};

export type ItemSetPreview = {
  set: NamedRef;
  /** "Jade Warlord's Dominion (0/5)" */
  label: string;
  pieces: NamedRef[];
};

/**
 * Blizzard's `preview_item`: the item's tooltip as the game draws it, with
 * the item's default bonuses applied (so its item level may differ from
 * the record's base level).
 */
export type ItemTooltip = {
  nameDescription?: { text: string; color?: TooltipColor };
  itemLevel?: string;
  /** The previewed item level, to compare with the record's base level. */
  itemLevelValue?: number;
  binding?: string;
  unique?: string;
  limitCategory?: string;
  conjured?: string;
  /** Left half of the slot line ("Head", "One-Hand"); absent for bag items. */
  slot?: string;
  /** Right half ("Plate", "Sword"); absent when Blizzard hides the subclass. */
  subclass?: string;
  containerSlots?: string;
  armor?: string;
  shieldBlock?: string;
  damage?: string;
  attackSpeed?: string;
  dps?: string;
  stats: TooltipStat[];
  sockets: string[];
  gemEffect?: string;
  spells: string[];
  charges?: string;
  durability?: string;
  requirements: string[];
  /** The previewed required level, to compare with the record's base one. */
  requiredLevelValue?: number;
  set?: ItemSetPreview;
  description?: string;
  craftingReagent?: string;
  toy?: string;
  sellPrice?: number;
  /** Blizzard's localized "Sell Price:". */
  sellPriceLabel?: string;
};

/** An item's record: the summary plus the API's tooltip preview. */
export type ItemRecord = ItemSummary & {
  tooltip: ItemTooltip;
};

export type ItemSetSummary = NamedRef;

export type ItemSetBonus = {
  requiredCount: number;
  text: string;
};

export type ItemSet = NamedRef & {
  pieces: NamedRef[];
  bonuses: ItemSetBonus[];
};
