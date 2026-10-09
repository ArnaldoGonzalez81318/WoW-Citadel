import { humanizeEnum } from "@/lib/format";

/*
 * Blizzard's slot index lists 24 slot types and nothing else: a slot's name
 * only arrives inside a search hit or an appearance record. The menu needs
 * names before either has loaded, so each type carries Blizzard's own en_US
 * name as a stand-in, replaced by the localized one as soon as the page has
 * seen it (see useSlotNames).
 *
 * Blizzard gives three pairs the same name ("Chest" for CHEST and ROBE,
 * "Off Hand" for SHIELD and WEAPONOFFHAND, "Ranged" for RANGED and
 * RANGEDRIGHT). The hints below tell them apart in the menu; they are game
 * knowledge about which items use each slot, not API data.
 */

export type SlotGroup = "armor" | "weapons" | "other";

type SlotEntry = {
  type: string;
  group: SlotGroup;
  /** Blizzard's en_US name for the slot. */
  label: string;
  /** Shown in brackets when another slot has the same name. */
  hint?: string;
};

const SLOT_CATALOG: readonly SlotEntry[] = [
  { type: "HEAD", group: "armor", label: "Head" },
  { type: "SHOULDER", group: "armor", label: "Shoulder" },
  { type: "CLOAK", group: "armor", label: "Back" },
  { type: "CHEST", group: "armor", label: "Chest" },
  { type: "ROBE", group: "armor", label: "Chest", hint: "robe" },
  { type: "BODY", group: "armor", label: "Shirt" },
  { type: "TABARD", group: "armor", label: "Tabard" },
  { type: "WRIST", group: "armor", label: "Wrist" },
  { type: "HAND", group: "armor", label: "Hands" },
  { type: "WAIST", group: "armor", label: "Waist" },
  { type: "LEGS", group: "armor", label: "Legs" },
  { type: "FEET", group: "armor", label: "Feet" },
  { type: "WEAPON", group: "weapons", label: "One-Hand" },
  { type: "TWOHWEAPON", group: "weapons", label: "Two-Hand" },
  { type: "WEAPONMAINHAND", group: "weapons", label: "Main Hand" },
  { type: "WEAPONOFFHAND", group: "weapons", label: "Off Hand", hint: "weapon" },
  { type: "SHIELD", group: "weapons", label: "Off Hand", hint: "shield" },
  { type: "HOLDABLE", group: "weapons", label: "Held In Off-hand" },
  { type: "RANGED", group: "weapons", label: "Ranged", hint: "bow" },
  { type: "RANGEDRIGHT", group: "weapons", label: "Ranged", hint: "gun, crossbow, wand" },
  { type: "AMMO", group: "other", label: "Ammo" },
  { type: "PROFESSION_TOOL", group: "other", label: "Profession Tool" },
  { type: "PROFESSION_GEAR", group: "other", label: "Profession Equipment" },
  // Blizzard names no appearance in this slot (its three records say
  // Two-Hand), so its type is spelled out instead.
  { type: "EQUIPABLESPELL_WEAPON", group: "other", label: "Equipable spell weapon" },
];

const CATALOG_BY_TYPE: ReadonlyMap<string, SlotEntry> = new Map(
  SLOT_CATALOG.map((entry) => [entry.type, entry]),
);
const CATALOG_ORDER: ReadonlyMap<string, number> = new Map(
  SLOT_CATALOG.map((entry, index) => [entry.type, index]),
);

/** The slots this page knows, for the menu before (or without) Blizzard's index. */
export const KNOWN_SLOT_TYPES: readonly string[] = SLOT_CATALOG.map((entry) => entry.type);

export const SLOT_GROUP_LABELS: Readonly<Record<SlotGroup, string>> = {
  armor: "Armor",
  weapons: "Weapons",
  other: "Other",
};

export const SLOT_GROUP_ORDER: readonly SlotGroup[] = ["armor", "weapons", "other"];

/** Blizzard's own types are upper-case words with underscores. */
export const isSlotType = (value: string): boolean => /^[A-Z][A-Z_]*$/.test(value);

export type SlotOption = {
  type: string;
  group: SlotGroup;
  /** Unique within the menu ("Chest (robe)" beside "Chest"). */
  label: string;
};

/**
 * The menu's slots: every type the index lists, in paper-doll order (types
 * this page does not know go last, under Other), named from `learned` where
 * the page has seen a localized name.
 */
export const buildSlotOptions = (
  types: readonly string[],
  learned: ReadonlyMap<string, string>,
): SlotOption[] => {
  const ordered = [...new Set(types)].sort(
    (left, right) =>
      (CATALOG_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (CATALOG_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER) || left.localeCompare(right),
  );
  const base = ordered.map((type) => {
    const entry = CATALOG_BY_TYPE.get(type);
    return {
      type,
      group: entry?.group ?? ("other" as const),
      name: learned.get(type) || entry?.label || humanizeEnum(type),
      hint: entry?.hint,
    };
  });
  const counts = new Map<string, number>();
  base.forEach((slot) => counts.set(slot.name, (counts.get(slot.name) ?? 0) + 1));
  return base.map((slot) => ({
    type: slot.type,
    group: slot.group,
    label:
      (counts.get(slot.name) ?? 0) > 1 && slot.hint ? `${slot.name} (${slot.hint})` : slot.name,
  }));
};

/** A slot's name for copy: the localized one when known, else Blizzard's en_US. */
export const slotName = (type: string, learned: ReadonlyMap<string, string>): string =>
  learned.get(type) || CATALOG_BY_TYPE.get(type)?.label || humanizeEnum(type);
