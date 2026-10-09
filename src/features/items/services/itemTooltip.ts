import { cleanMarkup, localized } from "@/lib/blizzardHelpers";
import type { LocalizedString } from "@/lib/blizzardHelpers";
import type {
  ItemTooltip,
  NamedRef,
  TooltipColor,
  TooltipStat,
} from "@/features/items/types";

/*
 * `preview_item` is the tooltip Blizzard would draw for the item: every line
 * already worded and localized (`display_string`), some with the colour the
 * game paints them. This maps it to the lines the dialog draws, in the
 * game's order; anything Blizzard leaves out is simply not drawn.
 */

type Display = {
  display_string?: LocalizedString;
  color?: Partial<TooltipColor> & { a?: number };
};

type TypedName = {
  type?: string;
  name?: LocalizedString;
};

type Ref = {
  id?: number;
  name?: LocalizedString;
};

type DisplayValue = {
  value?: number;
  display_string?: LocalizedString;
};

export type PreviewItemResponse = {
  inventory_type?: TypedName;
  item_subclass?: Ref;
  is_subclass_hidden?: boolean;
  binding?: TypedName;
  unique_equipped?: LocalizedString;
  limit_category?: LocalizedString;
  conjured?: LocalizedString;
  armor?: { value?: number; display?: Display };
  shield_block?: { value?: number; display?: Display };
  weapon?: {
    damage?: DisplayValue;
    attack_speed?: DisplayValue;
    dps?: DisplayValue;
  };
  stats?: Array<{
    type?: TypedName;
    value?: number;
    is_negated?: boolean;
    is_equip_bonus?: boolean;
    display?: Display;
  }>;
  sockets?: Array<{ socket_type?: TypedName; display_string?: LocalizedString }>;
  socket_bonus?: LocalizedString;
  gem_properties?: { effect?: LocalizedString };
  spells?: Array<{ spell?: Ref; description?: LocalizedString }>;
  charges?: DisplayValue;
  durability?: DisplayValue;
  requirements?: Record<
    string,
    { value?: number; display_string?: LocalizedString } | undefined
  >;
  set?: {
    item_set?: Ref;
    items?: Array<{ item?: Ref }>;
    display_string?: LocalizedString;
  };
  level?: DisplayValue;
  name_description?: Display;
  description?: LocalizedString;
  crafting_reagent?: LocalizedString;
  toy?: LocalizedString;
  container_slots?: DisplayValue;
  sell_price?: { value?: number; display_strings?: { header?: LocalizedString } };
};

const text = (value: LocalizedString | undefined | null): string | undefined =>
  cleanMarkup(localized(value)) || undefined;

const colorOf = (display: Display | undefined): TooltipColor | undefined => {
  const color = display?.color;
  return color &&
    typeof color.r === "number" &&
    typeof color.g === "number" &&
    typeof color.b === "number"
    ? { r: color.r, g: color.g, b: color.b }
    : undefined;
};

/** The game's own order for requirement lines; any others follow. */
const REQUIREMENT_ORDER = [
  "playable_races",
  "playable_classes",
  "faction",
  "level",
  "skill",
  "reputation",
  "ability",
];

const requirementLines = (
  requirements: PreviewItemResponse["requirements"],
): string[] => {
  if (!requirements) {
    return [];
  }
  const keys = Object.keys(requirements).sort((left, right) => {
    const a = REQUIREMENT_ORDER.indexOf(left);
    const b = REQUIREMENT_ORDER.indexOf(right);
    return (a < 0 ? REQUIREMENT_ORDER.length : a) - (b < 0 ? REQUIREMENT_ORDER.length : b);
  });
  return keys
    .map((key) => text(requirements[key]?.display_string))
    .filter((line): line is string => line !== undefined);
};

const toRef = (ref: Ref | undefined): NamedRef | undefined =>
  ref && typeof ref.id === "number"
    ? { id: ref.id, name: localized(ref.name) || `Item #${ref.id}` }
    : undefined;

/**
 * Items that are not worn have no slot line in game ("Non-equippable" is
 * never drawn); a bag says "16 Slot Bag" instead of "Bag".
 */
const NO_SLOT_LINE: ReadonlySet<string> = new Set(["NON_EQUIP", "BAG"]);

export const toItemTooltip = (preview: PreviewItemResponse | undefined): ItemTooltip => {
  if (!preview) {
    return { stats: [], sockets: [], spells: [], requirements: [] };
  }

  const slotType = preview.inventory_type?.type;
  const equippable = slotType !== undefined && !NO_SLOT_LINE.has(slotType);
  const slot = equippable ? text(preview.inventory_type?.name) : undefined;
  const subclass =
    equippable && preview.is_subclass_hidden !== true
      ? text(preview.item_subclass?.name)
      : undefined;

  const stats: TooltipStat[] = (preview.stats ?? [])
    .map((stat) => ({
      text: text(stat.display?.display_string) ?? "",
      color: colorOf(stat.display),
      negated: stat.is_negated === true,
      equipBonus: stat.is_equip_bonus === true,
    }))
    .filter((stat) => stat.text.length > 0);

  const sockets = (preview.sockets ?? [])
    .map((socket) => text(socket.display_string) ?? text(socket.socket_type?.name))
    .filter((line): line is string => line !== undefined);
  const socketBonus = text(preview.socket_bonus);
  if (socketBonus) {
    sockets.push(socketBonus);
  }

  const setRef = toRef(preview.set?.item_set);
  const nameDescription = text(preview.name_description?.display_string);
  const sellPrice = preview.sell_price?.value;

  return {
    nameDescription: nameDescription
      ? { text: nameDescription, color: colorOf(preview.name_description) }
      : undefined,
    itemLevel: text(preview.level?.display_string),
    itemLevelValue: typeof preview.level?.value === "number" ? preview.level.value : undefined,
    binding: text(preview.binding?.name),
    unique: text(preview.unique_equipped),
    limitCategory: text(preview.limit_category),
    conjured: text(preview.conjured),
    slot,
    subclass: subclass !== slot ? subclass : undefined,
    containerSlots: text(preview.container_slots?.display_string),
    armor: text(preview.armor?.display?.display_string),
    shieldBlock: text(preview.shield_block?.display?.display_string),
    damage: text(preview.weapon?.damage?.display_string),
    attackSpeed: text(preview.weapon?.attack_speed?.display_string),
    dps: text(preview.weapon?.dps?.display_string),
    stats,
    sockets,
    gemEffect: text(preview.gem_properties?.effect),
    spells: (preview.spells ?? [])
      .map((spell) => text(spell.description))
      .filter((line): line is string => line !== undefined),
    charges: text(preview.charges?.display_string),
    durability: text(preview.durability?.display_string),
    requirements: requirementLines(preview.requirements),
    requiredLevelValue:
      typeof preview.requirements?.level?.value === "number"
        ? preview.requirements.level.value
        : undefined,
    set: setRef
      ? {
          set: setRef,
          label: text(preview.set?.display_string) ?? setRef.name,
          pieces: (preview.set?.items ?? [])
            .map((entry) => toRef(entry.item))
            .filter((entry): entry is NamedRef => entry !== undefined),
        }
      : undefined,
    description: text(preview.description),
    craftingReagent: text(preview.crafting_reagent),
    toy: text(preview.toy),
    sellPrice: typeof sellPrice === "number" && sellPrice > 0 ? sellPrice : undefined,
    sellPriceLabel: text(preview.sell_price?.display_strings?.header),
  };
};
