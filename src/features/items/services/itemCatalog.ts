import { QUALITY_KEYS, isQualityKey } from "@/theme";
import type { QualityKey } from "@/theme";
import { formatNumber } from "@/lib/format";
import type {
  ItemClassSummary,
  ItemLevelRange,
  ItemSort,
} from "@/features/items/types";

/*
 * Blizzard has no index of item qualities or inventory types (each item
 * names its own, localized), so the filter menus spell them out here, in
 * English. Cards and the dialog always show the item's own localized names.
 */

/** Cards per page: 1, 2, 3 and 4 columns all end on a full row. */
export const ITEM_PAGE_SIZE = 24;

/** Item level bounds the inputs accept; Blizzard's highest is in the hundreds. */
export const MAX_ITEM_LEVEL = 9999;

/* ------------------------------------------------------------------ */
/* Quality                                                             */
/* ------------------------------------------------------------------ */

export const QUALITY_LABEL: Readonly<Record<QualityKey, string>> = {
  poor: "Poor",
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  artifact: "Artifact",
  heirloom: "Heirloom",
};

/** Best first, the order a collector scans for. */
export const QUALITY_OPTIONS: readonly QualityKey[] = [...QUALITY_KEYS].reverse();

export const parseQuality = (value: string): QualityKey | null => {
  const key = value.toLowerCase();
  return isQualityKey(key) ? key : null;
};

/* ------------------------------------------------------------------ */
/* Slots                                                               */
/* ------------------------------------------------------------------ */

export type SlotGroup = {
  /** URL value. */
  key: string;
  label: string;
  /** Blizzard inventory types, ORed in the search (`CHEST||ROBE`). */
  types: readonly string[];
  section: "Armor" | "Weapons";
};

/**
 * Equipment slots as the character pane groups them: robes are chest
 * pieces, and bows (RANGED) sit with guns and wands (RANGEDRIGHT).
 */
export const SLOT_GROUPS: readonly SlotGroup[] = [
  { key: "head", label: "Head", types: ["HEAD"], section: "Armor" },
  { key: "neck", label: "Neck", types: ["NECK"], section: "Armor" },
  { key: "shoulder", label: "Shoulder", types: ["SHOULDER"], section: "Armor" },
  { key: "back", label: "Back", types: ["CLOAK"], section: "Armor" },
  { key: "chest", label: "Chest", types: ["CHEST", "ROBE"], section: "Armor" },
  { key: "shirt", label: "Shirt", types: ["BODY"], section: "Armor" },
  { key: "tabard", label: "Tabard", types: ["TABARD"], section: "Armor" },
  { key: "wrist", label: "Wrist", types: ["WRIST"], section: "Armor" },
  { key: "hands", label: "Hands", types: ["HAND"], section: "Armor" },
  { key: "waist", label: "Waist", types: ["WAIST"], section: "Armor" },
  { key: "legs", label: "Legs", types: ["LEGS"], section: "Armor" },
  { key: "feet", label: "Feet", types: ["FEET"], section: "Armor" },
  { key: "finger", label: "Finger", types: ["FINGER"], section: "Armor" },
  { key: "trinket", label: "Trinket", types: ["TRINKET"], section: "Armor" },
  { key: "one-hand", label: "One-Hand", types: ["WEAPON"], section: "Weapons" },
  { key: "two-hand", label: "Two-Hand", types: ["TWOHWEAPON"], section: "Weapons" },
  { key: "main-hand", label: "Main Hand", types: ["WEAPONMAINHAND"], section: "Weapons" },
  { key: "off-hand", label: "Off Hand", types: ["WEAPONOFFHAND"], section: "Weapons" },
  { key: "held-in-off-hand", label: "Held In Off-hand", types: ["HOLDABLE"], section: "Weapons" },
  { key: "shield", label: "Shield", types: ["SHIELD"], section: "Weapons" },
  { key: "ranged", label: "Ranged", types: ["RANGED", "RANGEDRIGHT", "THROWN"], section: "Weapons" },
];

export const findSlotGroup = (key: string | null): SlotGroup | undefined =>
  key === null ? undefined : SLOT_GROUPS.find((group) => group.key === key);

/** Item classes whose items take an equipment slot (Weapon, Armor). */
export const WEAPON_CLASS_ID = 2;
export const ARMOR_CLASS_ID = 4;

/** The slot filter only means something for gear (or every class at once). */
export const classTakesSlots = (classId: number | null): boolean =>
  classId === null || classId === WEAPON_CLASS_ID || classId === ARMOR_CLASS_ID;

/** Shields and held-in-off-hand frills sit with weapons but are Armor on Blizzard's side. */
const ARMOR_OFF_HANDS: ReadonlySet<string> = new Set(["shield", "held-in-off-hand"]);

/** A slot that cannot hold anything of the class (Head for a Weapon) drops out. */
export const slotFitsClass = (group: SlotGroup, classId: number | null): boolean => {
  if (classId === WEAPON_CLASS_ID) {
    return group.section === "Weapons" && !ARMOR_OFF_HANDS.has(group.key);
  }
  if (classId === ARMOR_CLASS_ID) {
    return group.section === "Armor" || ARMOR_OFF_HANDS.has(group.key);
  }
  return classId === null;
};

/* ------------------------------------------------------------------ */
/* Sort                                                                */
/* ------------------------------------------------------------------ */

export const SORT_OPTIONS: ReadonlyArray<{ value: ItemSort; label: string; description: string }> = [
  // Blizzard dates no item; ids broadly rise with each patch, so id order stands in.
  { value: "newest", label: "Newest", description: "newest first (by item id)" },
  { value: "level", label: "Item level", description: "highest item level first" },
  { value: "name", label: "Name", description: "A to Z" },
];

export const parseSort = (value: string): ItemSort | null =>
  SORT_OPTIONS.some((option) => option.value === value) ? (value as ItemSort) : null;

/* ------------------------------------------------------------------ */
/* Item level range (`ilvl=200-300`, `200-`, `-300`)                   */
/* ------------------------------------------------------------------ */

const toLevel = (raw: string): number | null => {
  if (raw === "") {
    return null;
  }
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value <= MAX_ITEM_LEVEL ? value : null;
};

/** `undefined` for a malformed value (the page drops it from the URL). */
export const parseLevelRange = (value: string): ItemLevelRange | undefined => {
  if (value === "") {
    return { min: null, max: null };
  }
  const match = /^(\d{0,4})-(\d{0,4})$/.exec(value);
  if (!match) {
    return undefined;
  }
  const min = toLevel(match[1]);
  const max = toLevel(match[2]);
  if ((match[1] !== "" && min === null) || (match[2] !== "" && max === null)) {
    return undefined;
  }
  if (min === null && max === null) {
    return undefined;
  }
  // A reversed range ("300-200") is what the visitor meant the right way round.
  if (min !== null && max !== null && min > max) {
    return { min: max, max: min };
  }
  return { min, max };
};

export const formatLevelParam = ({ min, max }: ItemLevelRange): string | null =>
  min === null && max === null ? null : `${min ?? ""}-${max ?? ""}`;

export const hasLevelRange = ({ min, max }: ItemLevelRange): boolean =>
  min !== null || max !== null;

/** "Item level 200–300", "Item level 200+", "Item level ≤ 300". */
export const describeLevelRange = ({ min, max }: ItemLevelRange): string => {
  if (min !== null && max !== null) {
    return min === max
      ? `Item level ${formatNumber(min)}`
      : `Item level ${formatNumber(min)}–${formatNumber(max)}`;
  }
  if (min !== null) {
    return `Item level ${formatNumber(min)}+`;
  }
  return `Item level ≤ ${formatNumber(max ?? 0)}`;
};

/** Blizzard's range syntax: `[200,300]`, `[200,]`, `[,300]`. */
export const levelRangeParam = ({ min, max }: ItemLevelRange): string | undefined =>
  min === null && max === null ? undefined : `[${min ?? ""},${max ?? ""}]`;

/* ------------------------------------------------------------------ */
/* Class tiles                                                         */
/* ------------------------------------------------------------------ */

/**
 * The class tiles' order and the item each borrows its icon from (Blizzard
 * gives item classes no art of their own): gear first, then what people
 * look up most, legacy classes last. The names always come from the class
 * index; a class missing here (a new one) still gets a tile, after these,
 * with a letter in place of the icon.
 */
const CLASS_TILE_ICONS: ReadonlyArray<{ classId: number; iconItemId?: number }> = [
  { classId: 2, iconItemId: 19019 }, // Weapon: Thunderfury, Blessed Blade of the Windseeker
  { classId: 4, iconItemId: 271456 }, // Armor: Tempered Horns of the Jade Warlord
  { classId: 0, iconItemId: 5512 }, // Consumable: Healthstone
  { classId: 3, iconItemId: 228634 }, // Gem: Thunderlord's Crackling Citrine
  { classId: 8, iconItemId: 223692 }, // Item Enhancement: Enchant Chest - Crystalline Radiance
  { classId: 5, iconItemId: 228819 }, // Reagent: Excessively Bejeweled Curio
  { classId: 7, iconItemId: 2589 }, // Tradeskill: Linen Cloth
  { classId: 9, iconItemId: 278332 }, // Recipe: Recipe: Puffer Plate
  { classId: 19, iconItemId: 222574 }, // Profession: Silver Tongue's Quill
  { classId: 1, iconItemId: 4500 }, // Container: Traveler's Backpack
  { classId: 20, iconItemId: 280513 }, // Housing: Color-Curious Candle
  { classId: 17, iconItemId: 82800 }, // Battle Pets: Pet Cage
  { classId: 15, iconItemId: 6948 }, // Miscellaneous: Hearthstone
  { classId: 12, iconItemId: 184155 }, // Quest: Recovered Containment Pack
  { classId: 13, iconItemId: 228965 }, // Key: Astral Key
  { classId: 18, iconItemId: 122284 }, // WoW Token
  { classId: 16, iconItemId: 153177 }, // Glyph: Golden Charger's Bridle
  { classId: 6, iconItemId: 24412 }, // Projectile: Warden's Arrow
  { classId: 11 }, // Quiver: Blizzard's search lists none today
];

export type ClassTile = ItemClassSummary & {
  iconItemId?: number;
};

/** The index's classes in tile order (see CLASS_TILE_ICONS). */
export const orderClassTiles = (classes: readonly ItemClassSummary[]): ClassTile[] => {
  const byId = new Map(classes.map((entry) => [entry.id, entry]));
  const placed = new Set<number>();
  const tiles: ClassTile[] = [];
  CLASS_TILE_ICONS.forEach(({ classId, iconItemId }) => {
    const entry = byId.get(classId);
    if (entry) {
      placed.add(classId);
      tiles.push({ ...entry, iconItemId });
    }
  });
  [...classes]
    .filter((entry) => !placed.has(entry.id))
    .sort((left, right) => left.id - right.id)
    .forEach((entry) => tiles.push({ ...entry }));
  return tiles;
};
