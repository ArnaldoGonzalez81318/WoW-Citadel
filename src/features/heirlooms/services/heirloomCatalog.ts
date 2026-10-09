import type { Heirloom, HeirloomRef, StatKey } from "@/features/heirlooms/types";
import { humanizeEnum } from "@/lib/format";

/*
 * Grouping and filtering over the loaded records. Everything here is pure
 * and keyed by values Blizzard sends (inventory types, item class and
 * subclass ids, source types); every label comes from the records
 * themselves, so the page reads in the API's locale.
 */

/* ------------------------------------------------------------------ */
/* Slots                                                               */
/* ------------------------------------------------------------------ */

type SlotDef = {
  /** The URL's `slot` value. */
  key: string;
  /** Blizzard inventory types worn in that slot, the one that names the group first. */
  types: readonly string[];
};

/**
 * Armor top to bottom, then back and jewellery, then what goes in the
 * hands. A robe is a chest piece and a shield or held-in-off-hand item an
 * off hand, so each pair shares a group.
 */
const SLOT_DEFS: readonly SlotDef[] = [
  { key: "head", types: ["HEAD"] },
  { key: "shoulder", types: ["SHOULDER"] },
  { key: "chest", types: ["CHEST", "ROBE"] },
  { key: "legs", types: ["LEGS"] },
  { key: "back", types: ["CLOAK"] },
  { key: "neck", types: ["NECK"] },
  { key: "finger", types: ["FINGER"] },
  { key: "trinket", types: ["TRINKET"] },
  { key: "one-hand", types: ["WEAPON", "WEAPONMAINHAND", "WEAPONOFFHAND"] },
  { key: "two-hand", types: ["TWOHWEAPON"] },
  { key: "ranged", types: ["RANGED", "RANGEDRIGHT"] },
  { key: "off-hand", types: ["SHIELD", "HOLDABLE"] },
];

/** A slot Blizzard adds later still gets a group of its own, after the known ones. */
export const slotKeyOf = (inventoryType: string): string =>
  SLOT_DEFS.find((def) => def.types.includes(inventoryType))?.key ??
  (inventoryType.toLowerCase() || "other");

const slotRank = (key: string): number => {
  const index = SLOT_DEFS.findIndex((def) => def.key === key);
  return index >= 0 ? index : SLOT_DEFS.length;
};

/** The group's name in the API's words: its first listed type's slot name. */
const slotLabelOf = (key: string, members: readonly Heirloom[]): string => {
  const types = SLOT_DEFS.find((def) => def.key === key)?.types ?? [];
  for (const type of types) {
    const named = members.find((heirloom) => heirloom.inventoryType === type && heirloom.slotName);
    if (named) {
      return named.slotName;
    }
  }
  return members.find((heirloom) => heirloom.slotName)?.slotName ?? humanizeEnum(key);
};

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

export type HeirloomFilters = {
  slot: string | null;
  /** A canonical type key (see TypeIndex). */
  type: string | null;
  stat: StatKey | null;
  source: string | null;
};

export type FilterKey = keyof HeirloomFilters;

export const hasFilters = (filters: HeirloomFilters): boolean =>
  filters.slot !== null || filters.type !== null || filters.stat !== null || filters.source !== null;

/**
 * Item records name a type briefly ("Axe"), so one-handed and two-handed
 * axes (subclasses 0 and 1) read the same; the slot already tells them
 * apart. Types are therefore merged by class and name: each name's key is
 * its class and lowest subclass id ("2-0"), and every subclass sharing the
 * name maps to it.
 */
export type TypeIndex = ReadonlyMap<string, string>;

export const buildTypeIndex = (heirlooms: readonly Heirloom[]): TypeIndex => {
  const canonicalByName = new Map<string, { key: string; subclass: number }>();
  heirlooms.forEach((heirloom) => {
    if (!heirloom.typeKey || !heirloom.typeName || !heirloom.itemClass) {
      return;
    }
    const subclass = Number(heirloom.typeKey.split("-")[1]);
    const nameKey = `${heirloom.itemClass.id}:${heirloom.typeName}`;
    const current = canonicalByName.get(nameKey);
    if (!current || subclass < current.subclass) {
      canonicalByName.set(nameKey, { key: heirloom.typeKey, subclass });
    }
  });
  const index = new Map<string, string>();
  heirlooms.forEach((heirloom) => {
    if (heirloom.typeKey && heirloom.typeName && heirloom.itemClass) {
      const canonical = canonicalByName.get(`${heirloom.itemClass.id}:${heirloom.typeName}`);
      if (canonical) {
        index.set(heirloom.typeKey, canonical.key);
      }
    }
  });
  return index;
};

export const matchesFilters = (
  heirloom: Heirloom,
  filters: HeirloomFilters,
  types: TypeIndex,
  ignore?: FilterKey,
): boolean =>
  (ignore === "slot" || filters.slot === null || heirloom.slot === filters.slot) &&
  (ignore === "type" ||
    filters.type === null ||
    (heirloom.typeKey !== null && types.get(heirloom.typeKey) === filters.type)) &&
  (ignore === "stat" || filters.stat === null || heirloom.primaryStats.includes(filters.stat)) &&
  (ignore === "source" || filters.source === null || heirloom.source.key === filters.source);

/* ------------------------------------------------------------------ */
/* Facets                                                              */
/* ------------------------------------------------------------------ */

export type FacetOption = {
  value: string;
  label: string;
  /** Matches with every other filter applied. */
  count: number;
  /** Total in the collection, whatever the filters. */
  total: number;
  /** Item class name, for the type menu's sub-headers ("Armor", "Weapon"). */
  group?: string;
};

export type HeirloomFacets = {
  slots: FacetOption[];
  types: FacetOption[];
  stats: FacetOption[];
  sources: FacetOption[];
};

type Tally = { label: string; count: number; total: number; group?: string; rank: number };

const tallyInto = (
  tallies: Map<string, Tally>,
  value: string,
  matches: boolean,
  seed: () => Omit<Tally, "count" | "total">,
): void => {
  const tally = tallies.get(value) ?? { ...seed(), count: 0, total: 0 };
  tally.total += 1;
  if (matches) {
    tally.count += 1;
  }
  tallies.set(value, tally);
};

const toOptions = (
  tallies: Map<string, Tally>,
  compare: (left: [string, Tally], right: [string, Tally]) => number,
): FacetOption[] =>
  [...tallies.entries()]
    .sort(compare)
    .map(([value, tally]) => ({
      value,
      label: tally.label,
      count: tally.count,
      total: tally.total,
      group: tally.group,
    }));

const byLabel = (left: [string, Tally], right: [string, Tally]): number =>
  left[1].label.localeCompare(right[1].label, undefined, { sensitivity: "base" });

/** Armor before weapons; within a class, by subclass id (Cloth → Plate, Axe → Dagger). */
const ARMOR_CLASS_ID = 4;

/**
 * Every value each filter can take across the loaded records, with how many
 * heirlooms it would show given the other filters (so a menu can say
 * "Plate (3)" and grey out what would come up empty).
 */
export const buildFacets = (
  heirlooms: readonly Heirloom[],
  filters: HeirloomFilters,
  types: TypeIndex,
): HeirloomFacets => {
  const slots = new Map<string, Tally>();
  const typeTallies = new Map<string, Tally>();
  const stats = new Map<string, Tally>();
  const sources = new Map<string, Tally>();
  const slotMembers = new Map<string, Heirloom[]>();

  heirlooms.forEach((heirloom) => {
    tallyInto(slots, heirloom.slot, matchesFilters(heirloom, filters, types, "slot"), () => ({
      label: "",
      rank: slotRank(heirloom.slot),
    }));
    const members = slotMembers.get(heirloom.slot);
    if (members) {
      members.push(heirloom);
    } else {
      slotMembers.set(heirloom.slot, [heirloom]);
    }

    const typeKey = heirloom.typeKey ? types.get(heirloom.typeKey) : undefined;
    if (typeKey && heirloom.typeName && heirloom.itemClass) {
      const itemClass = heirloom.itemClass;
      const typeName = heirloom.typeName;
      tallyInto(typeTallies, typeKey, matchesFilters(heirloom, filters, types, "type"), () => ({
        label: typeName,
        group: itemClass.name || undefined,
        // Armor first, then by class id, then subclass id.
        rank:
          (itemClass.id === ARMOR_CLASS_ID ? -1000 : itemClass.id * 1000) +
          Number(typeKey.split("-")[1]),
      }));
    }

    const statMatch = matchesFilters(heirloom, filters, types, "stat");
    heirloom.primaryStats.forEach((stat) => {
      tallyInto(stats, stat, statMatch, () => ({
        label: heirloom.statNames[stat] ?? humanizeEnum(stat),
        rank: ["strength", "agility", "intellect"].indexOf(stat),
      }));
    });

    tallyInto(
      sources,
      heirloom.source.key,
      matchesFilters(heirloom, filters, types, "source"),
      () => ({ label: heirloom.source.name, rank: 0 }),
    );
  });

  slots.forEach((tally, key) => {
    tally.label = slotLabelOf(key, slotMembers.get(key) ?? []);
  });

  const byRank = (left: [string, Tally], right: [string, Tally]): number =>
    left[1].rank - right[1].rank || byLabel(left, right);

  return {
    slots: toOptions(slots, byRank),
    types: toOptions(typeTallies, byRank),
    stats: toOptions(stats, byRank),
    // The most common source first (Vendor, then Drop…).
    sources: toOptions(sources, (left, right) => right[1].total - left[1].total || byLabel(left, right)),
  };
};

/* ------------------------------------------------------------------ */
/* Groups                                                              */
/* ------------------------------------------------------------------ */

export type SlotGroup = {
  key: string;
  label: string;
  heirlooms: Heirloom[];
};

/**
 * Within a slot, by type (Cloth, Leather, Mail, Plate; Axe, Dagger…) and
 * then name. Hellscream's weapons come in three of each name: the one with
 * no name description first, then Heroic and Mythic, which Blizzard's ids
 * (724–734 Heroic, 746–756 Mythic) already put in that order.
 */
const compareInSlot = (left: Heirloom, right: Heirloom): number =>
  (left.typeName ?? "").localeCompare(right.typeName ?? "", undefined, { sensitivity: "base" }) ||
  left.name.localeCompare(right.name, undefined, { sensitivity: "base" }) ||
  Number(left.variant !== undefined) - Number(right.variant !== undefined) ||
  left.id - right.id;

export const groupBySlot = (heirlooms: readonly Heirloom[], facets: HeirloomFacets): SlotGroup[] => {
  const members = new Map<string, Heirloom[]>();
  heirlooms.forEach((heirloom) => {
    const list = members.get(heirloom.slot);
    if (list) {
      list.push(heirloom);
    } else {
      members.set(heirloom.slot, [heirloom]);
    }
  });
  return facets.slots
    .filter((slot) => members.has(slot.value))
    .map((slot) => ({
      key: slot.value,
      label: slot.label,
      heirlooms: (members.get(slot.value) ?? []).sort(compareInSlot),
    }));
};

/* ------------------------------------------------------------------ */
/* Order                                                               */
/* ------------------------------------------------------------------ */

/**
 * Highest collection id first. The index is in the collection's own order;
 * ids grow as heirlooms are added, so this puts the latest additions first.
 */
export const newestFirst = (entries: readonly HeirloomRef[]): HeirloomRef[] =>
  [...entries].sort((left, right) => right.id - left.id);
