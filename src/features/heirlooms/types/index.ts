import type { LocalizedString } from "@/lib/blizzardHelpers";

export type { LocalizedString };

/** An entry of the heirloom index: the collection id and the item's name. */
export type HeirloomRef = {
  id: number;
  name: string;
};

export type NamedId = {
  id: number;
  name: string;
};

/** The three primary stats an heirloom can carry (the URL's `stat` values). */
export type StatKey = "strength" | "agility" | "intellect";

export type HeirloomStat = {
  /** Blizzard's stat type ("CRIT_RATING"). */
  type: string;
  /** Localized stat name ("Critical Strike"). */
  name: string;
  value: number;
  /** Blizzard's own line ("+15 Critical Strike"). */
  display: string;
  /** `is_equip_bonus`: drawn green in the game's tooltip. */
  bonus: boolean;
  /** `is_negated`: Blizzard greys the line out (a primary stat the wearer may not use). */
  negated: boolean;
};

export type SetEffect = {
  /** Pieces needed ("(2) Set: …" → 2); null when Blizzard leaves it out. */
  count: number | null;
  text: string;
};

export type HeirloomSet = {
  id: number;
  name: string;
  pieceCount: number;
  effects: SetEffect[];
};

/**
 * One step of an heirloom's upgrade ladder: the item as Blizzard renders it
 * at that upgrade level, with every line localized by the API.
 */
export type HeirloomTier = {
  /** Upgrades applied (0 is the item as it comes); null when not given. */
  upgrade: number | null;
  /** Upgrades the heirloom takes in all. */
  maxUpgrade: number | null;
  /** "Heirloom Upgrade Level: 1/6" */
  upgradeText?: string;
  itemLevel: number | null;
  /** "Item Level 34" */
  itemLevelText?: string;
  /** "Requires level 1 to 34 (34)" */
  requirementText?: string;
  /** The character levels it scales across, read from the requirement line. */
  levelRange: { min: number; max: number } | null;
  armor: number | null;
  armorText?: string;
  blockText?: string;
  damageText?: string;
  speedText?: string;
  dps: number | null;
  dpsText?: string;
  stats: HeirloomStat[];
  /** "Equip: …" / "Use: …" lines. */
  spells: string[];
  set?: HeirloomSet;
};

/** One line of Blizzard's source text: "Vendor: Krom Stoutarm" → label + value. */
export type SourceLine = {
  label: string | null;
  value: string;
};

export type Heirloom = {
  id: number;
  itemId: number;
  name: string;
  /** Slot group key (see heirloomCatalog's SLOT_DEFS); the URL's `slot` values. */
  slot: string;
  /** Blizzard's inventory type ("TWOHWEAPON"). */
  inventoryType: string;
  /** Localized slot name ("Two-Hand"). */
  slotName: string;
  itemClass: NamedId | null;
  /** `${classId}-${subclassId}` (the URL's `type`), or null when Blizzard hides the subclass. */
  typeKey: string | null;
  /** Localized armor or weapon type ("Mail", "Staff"), when shown. */
  typeName: string | null;
  source: { key: string; name: string };
  /** Blizzard's source description, one block per vendor (or mission, event…). */
  sourceBlocks: SourceLine[][];
  binding?: string;
  /** Blizzard's name description ("Heroic", "Mythic"): tells same-name heirlooms apart. */
  variant?: string;
  unique?: string;
  limitCategory?: string;
  description?: string;
  sockets: string[];
  socketBonus?: string;
  primaryStats: StatKey[];
  /** Localized names of the primary stats it carries. */
  statNames: Partial<Record<StatKey, string>>;
  /** Lowest upgrade first, one per upgrade level Blizzard lists. */
  tiers: HeirloomTier[];
  maxUpgrade: number | null;
  minItemLevel: number | null;
  maxItemLevel: number | null;
  /** Highest character level the top tier scales to. */
  maxCharacterLevel: number | null;
};
