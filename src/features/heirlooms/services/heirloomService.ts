import { slotKeyOf } from "@/features/heirlooms/services/heirloomCatalog";
import type {
  Heirloom,
  HeirloomRef,
  HeirloomSet,
  HeirloomStat,
  HeirloomTier,
  LocalizedString,
  NamedId,
  SourceLine,
  StatKey,
} from "@/features/heirlooms/types";
import { blizzardClient } from "@/lib/blizzardClient";
import {
  cleanMarkup,
  localized,
  namespace,
  optional404,
} from "@/lib/blizzardHelpers";
import { formatNumber, humanizeEnum } from "@/lib/format";

/*
 * Blizzard keeps heirlooms in two places:
 *
 *   heirloom/index   every heirloom: its collection id and its item's name
 *     -> heirloom/{id}  the item, its source, and the item rendered at each
 *                       upgrade level (`upgrades`), every tooltip line included
 *
 * so the slot, type, stats and source that the page groups and filters by
 * only come with each record (134 on US, ~15 KB each). The `upgrades` list
 * is always six long: an heirloom with fewer upgrades pads it with copies of
 * its un-upgraded item (upgrade 0, listed last), so the ladder is the
 * distinct upgrade levels, lowest first. Neither the upgrade items nor their
 * costs are in the API.
 */

type Text = LocalizedString | null | undefined;

type DisplayValue = {
  value?: number;
  display_string?: Text;
  display?: { display_string?: Text };
};

type UpgradeItemResponse = {
  item?: { id?: number };
  name?: Text;
  item_class?: { id?: number; name?: Text };
  item_subclass?: { id?: number; name?: Text };
  inventory_type?: { type?: string; name?: Text };
  binding?: { type?: string; name?: Text };
  is_subclass_hidden?: boolean;
  name_description?: { display_string?: Text };
  unique_equipped?: Text;
  limit_category?: Text;
  description?: Text;
  armor?: DisplayValue;
  shield_block?: DisplayValue;
  weapon?: {
    damage?: { display_string?: Text };
    attack_speed?: { display_string?: Text };
    dps?: { value?: number; display_string?: Text };
  };
  stats?: Array<{
    type?: { type?: string; name?: Text };
    value?: number;
    is_equip_bonus?: boolean;
    is_negated?: boolean;
    display?: { display_string?: Text };
  }>;
  spells?: Array<{ description?: Text }>;
  sockets?: Array<{ socket_type?: { type?: string; name?: Text } }>;
  socket_bonus?: Text;
  set?: {
    item_set?: { id?: number; name?: Text };
    items?: unknown[];
    effects?: Array<{ display_string?: Text; required_count?: number }>;
  };
  upgrades?: { value?: number; max_value?: number; display_string?: Text };
  requirements?: { level?: { display_string?: Text } };
  level?: { value?: number; display_string?: Text };
};

type HeirloomResponse = {
  id: number;
  item?: { id?: number; name?: Text };
  source?: { type?: string; name?: Text };
  source_description?: Text;
  upgrades?: Array<{ item?: UpgradeItemResponse; level?: number }>;
};

type HeirloomIndexResponse = {
  heirlooms?: Array<{ id?: number; name?: Text }>;
};

const PRIMARY_STATS: Readonly<Record<string, StatKey>> = {
  STRENGTH: "strength",
  AGILITY: "agility",
  INTELLECT: "intellect",
};

export const STAT_ORDER: readonly StatKey[] = ["strength", "agility", "intellect"];

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** A localized line with WoW's inline markup removed, or undefined when empty. */
const textOf = (value: Text): string | undefined =>
  cleanMarkup(localized(value)) || undefined;

const namedId = (raw: { id?: number; name?: Text } | undefined): NamedId | null =>
  raw && isNumber(raw.id) ? { id: raw.id, name: textOf(raw.name) ?? "" } : null;

/* ------------------------------------------------------------------ */
/* Index                                                               */
/* ------------------------------------------------------------------ */

/** Every heirloom, in Blizzard's (collection) order. */
export const fetchHeirloomIndex = async (signal?: AbortSignal): Promise<HeirloomRef[]> => {
  const response = await blizzardClient.get<HeirloomIndexResponse>(
    "/data/wow/heirloom/index",
    { namespace: namespace("static") },
    { signal },
  );
  return (response.heirlooms ?? [])
    .filter((entry): entry is { id: number; name?: Text } => isNumber(entry.id))
    .map((entry) => ({ id: entry.id, name: textOf(entry.name) ?? `Heirloom #${entry.id}` }));
};

/* ------------------------------------------------------------------ */
/* Source text                                                         */
/* ------------------------------------------------------------------ */

/** "Vendor: Krom Stoutarm", "Garrison Mission: For Hate's Sake" (full-width colon too). */
const LABELLED_LINE = /^([^:：]{1,40}?)\s*[:：]\s*(.+)$/u;

/**
 * Blizzard's source text as blocks of labelled lines: a blank line between
 * vendors starts a new block, "Label: value" splits at its first colon, and
 * prose wrapped over several lines ("Gather and combine the Dimmed Primeval
 * Fire,\nWater, Storm, and Earth.") is joined back into one.
 */
const parseSourceText = (raw: string | undefined): SourceLine[][] => {
  if (!raw) {
    return [];
  }
  return raw
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => {
      const lines: SourceLine[] = [];
      block
        .split("\n")
        .map((line) => cleanMarkup(line))
        .filter((line) => line.length > 0)
        .forEach((line) => {
          const match = LABELLED_LINE.exec(line);
          if (match) {
            lines.push({ label: match[1].trim(), value: match[2].trim() });
            return;
          }
          const previous = lines[lines.length - 1];
          if (previous && previous.label === null) {
            previous.value = `${previous.value} ${line}`;
          } else {
            lines.push({ label: null, value: line });
          }
        });
      return lines;
    })
    .filter((lines) => lines.length > 0);
};

/* ------------------------------------------------------------------ */
/* One heirloom                                                        */
/* ------------------------------------------------------------------ */

/**
 * "Requires level 1 to 34 (34)" → 1–34. The numbers are the only part that
 * reads the same in every locale; a line without two of them gives null.
 */
const parseLevelRange = (text: string | undefined): { min: number; max: number } | null => {
  const numbers = (text ?? "").match(/\d+/g)?.map(Number) ?? [];
  if (numbers.length < 2) {
    return null;
  }
  const [min, max] = numbers;
  return min <= max ? { min, max } : null;
};

const toStat = (
  raw: NonNullable<UpgradeItemResponse["stats"]>[number],
): HeirloomStat | null => {
  const type = raw.type?.type;
  if (!type || !isNumber(raw.value)) {
    return null;
  }
  const name = textOf(raw.type?.name) ?? type;
  return {
    type,
    name,
    value: raw.value,
    display: textOf(raw.display?.display_string) ?? `+${formatNumber(raw.value)} ${name}`,
    bonus: raw.is_equip_bonus === true,
    negated: raw.is_negated === true,
  };
};

/** "(2) Set: …" carries its piece count in `required_count`. */
const toSet = (raw: UpgradeItemResponse["set"]): HeirloomSet | undefined => {
  const id = raw?.item_set?.id;
  if (!raw || !isNumber(id)) {
    return undefined;
  }
  return {
    id,
    name: textOf(raw.item_set?.name) ?? `Item set #${id}`,
    pieceCount: raw.items?.length ?? 0,
    effects: (raw.effects ?? [])
      .map((effect) => ({
        count: isNumber(effect.required_count) ? effect.required_count : null,
        text: textOf(effect.display_string) ?? "",
      }))
      .filter((effect) => effect.text.length > 0),
  };
};

const toTier = (item: UpgradeItemResponse): HeirloomTier => {
  const requirementText = textOf(item.requirements?.level?.display_string);
  return {
    upgrade: isNumber(item.upgrades?.value) ? item.upgrades.value : null,
    maxUpgrade: isNumber(item.upgrades?.max_value) ? item.upgrades.max_value : null,
    upgradeText: textOf(item.upgrades?.display_string),
    itemLevel: isNumber(item.level?.value) ? item.level.value : null,
    itemLevelText: textOf(item.level?.display_string),
    requirementText,
    levelRange: parseLevelRange(requirementText),
    armor: isNumber(item.armor?.value) ? item.armor.value : null,
    armorText: textOf(item.armor?.display?.display_string),
    blockText: textOf(item.shield_block?.display?.display_string),
    damageText: textOf(item.weapon?.damage?.display_string),
    speedText: textOf(item.weapon?.attack_speed?.display_string),
    dps: isNumber(item.weapon?.dps?.value) ? item.weapon.dps.value : null,
    dpsText: textOf(item.weapon?.dps?.display_string),
    stats: (item.stats ?? [])
      .map(toStat)
      .filter((stat): stat is HeirloomStat => stat !== null),
    spells: (item.spells ?? [])
      .map((spell) => textOf(spell.description))
      .filter((line): line is string => line !== undefined),
    set: toSet(item.set),
  };
};

/**
 * The distinct upgrade levels, lowest first. Blizzard pads the list to six
 * with copies of upgrade 0 (see the module note), so repeats are dropped; an
 * entry without an upgrade level is kept and ordered by its item level.
 */
const toLadder = (items: UpgradeItemResponse[]): HeirloomTier[] => {
  const seen = new Set<number>();
  const tiers: HeirloomTier[] = [];
  items.forEach((item) => {
    const tier = toTier(item);
    if (tier.upgrade !== null) {
      if (seen.has(tier.upgrade)) {
        return;
      }
      seen.add(tier.upgrade);
    }
    tiers.push(tier);
  });
  const rank = (tier: HeirloomTier): number => tier.upgrade ?? tier.itemLevel ?? 0;
  return tiers.sort((left, right) => rank(left) - rank(right));
};

const minOf = (values: Array<number | null>): number | null => {
  const numbers = values.filter(isNumber);
  return numbers.length > 0 ? Math.min(...numbers) : null;
};

const maxOf = (values: Array<number | null>): number | null => {
  const numbers = values.filter(isNumber);
  return numbers.length > 0 ? Math.max(...numbers) : null;
};

/**
 * One heirloom, or null when Blizzard has no such record (404): a shared
 * link to a removed heirloom then shows "not found" instead of retrying.
 * Any other failure throws, so react-query retries it.
 */
export const fetchHeirloom = async (
  heirloomId: number,
  signal?: AbortSignal,
): Promise<Heirloom | null> => {
  const response = await optional404(() =>
    blizzardClient.get<HeirloomResponse>(
      `/data/wow/heirloom/${heirloomId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  if (!response) {
    return null;
  }

  const items = (response.upgrades ?? [])
    .map((upgrade) => upgrade.item)
    .filter((item): item is UpgradeItemResponse => item !== undefined);
  const first: UpgradeItemResponse = items[0] ?? {};
  const tiers = toLadder(items);
  const top = tiers[tiers.length - 1];

  const itemId = response.item?.id ?? first.item?.id ?? 0;
  const name =
    textOf(response.item?.name) ?? textOf(first.name) ?? `Heirloom #${response.id}`;
  const inventoryType = first.inventory_type?.type ?? "";
  const itemClass = namedId(first.item_class);
  const itemSubclass = namedId(first.item_subclass);
  // Trinkets, rings, necks, cloaks and held-in-off-hand items carry a
  // placeholder subclass ("Miscellaneous", or Cloth on a cloak) flagged
  // `is_subclass_hidden`; only a shown subclass is a type worth filtering by.
  const shownType =
    itemClass && itemSubclass && first.is_subclass_hidden !== true && itemSubclass.name
      ? itemSubclass
      : null;

  const statNames: Partial<Record<StatKey, string>> = {};
  tiers.forEach((tier) =>
    tier.stats.forEach((stat) => {
      const key = PRIMARY_STATS[stat.type];
      if (key && !statNames[key]) {
        statNames[key] = stat.name;
      }
    }),
  );

  const sourceType = response.source?.type ?? "";
  const sourceName = textOf(response.source?.name);

  return {
    id: response.id,
    itemId,
    name,
    slot: slotKeyOf(inventoryType),
    inventoryType,
    slotName: textOf(first.inventory_type?.name) ?? "",
    itemClass,
    typeKey: shownType && itemClass ? `${itemClass.id}-${shownType.id}` : null,
    typeName: shownType?.name ?? null,
    source: {
      key: sourceType.toLowerCase() || "unknown",
      name: sourceName ?? (humanizeEnum(sourceType) || "Unknown"),
    },
    sourceBlocks: parseSourceText(localized(response.source_description)),
    binding: textOf(first.binding?.name),
    variant: textOf(first.name_description?.display_string),
    unique: textOf(first.unique_equipped),
    limitCategory: textOf(first.limit_category),
    description: textOf(first.description),
    sockets: (first.sockets ?? [])
      .map((socket) => textOf(socket.socket_type?.name))
      .filter((label): label is string => label !== undefined),
    socketBonus: textOf(first.socket_bonus),
    primaryStats: STAT_ORDER.filter((key) => statNames[key] !== undefined),
    statNames,
    tiers,
    maxUpgrade: top?.maxUpgrade ?? null,
    minItemLevel: minOf(tiers.map((tier) => tier.itemLevel)),
    maxItemLevel: maxOf(tiers.map((tier) => tier.itemLevel)),
    maxCharacterLevel: maxOf(tiers.map((tier) => tier.levelRange?.max ?? null)),
  };
};

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

export const pluralize = (count: number, one: string, many: string): string =>
  `${formatNumber(count)} ${count === 1 ? one : many}`;

/** "34–69", or the one level when the ladder has a single item level. */
export const itemLevelRange = (heirloom: Heirloom): string | null => {
  const { minItemLevel: min, maxItemLevel: max } = heirloom;
  if (min === null || max === null) {
    return null;
  }
  return min === max ? formatNumber(max) : `${formatNumber(min)}–${formatNumber(max)}`;
};

/** "1/6": the same in every locale, unlike Blizzard's "Heirloom Upgrade Level: 1/6". */
export const upgradeLabel = (tier: HeirloomTier): string =>
  tier.upgrade !== null && tier.maxUpgrade !== null
    ? `${formatNumber(tier.upgrade)}/${formatNumber(tier.maxUpgrade)}`
    : "—";

/** "Shoulder · Mail", "Trinket" */
export const slotLine = (heirloom: Heirloom): string =>
  [heirloom.slotName, heirloom.typeName].filter(Boolean).join(" · ");
