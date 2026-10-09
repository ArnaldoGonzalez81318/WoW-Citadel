import type {
  CategoryItems,
  CategoryRef,
  ReagentItem,
  SlotType,
  SlotTypeRef,
} from "@/features/modifiedCrafting/types";
import { blizzardClient } from "@/lib/blizzardClient";
import {
  cleanMarkup,
  localized,
  namespace,
  optional404,
} from "@/lib/blizzardHelpers";
import type { LocalizedString } from "@/lib/blizzardHelpers";
import { formatNumber } from "@/lib/format";

/*
 * Blizzard keeps modified crafting as two flat lists and one relation:
 *
 *   modified-crafting/reagent-slot-type/index   389 slot types, names only
 *     -> reagent-slot-type/{id}                 { description, compatible_categories }
 *   modified-crafting/category/index            588 categories, names only
 *     -> category/{id}                          { id, name } (nothing the index lacks)
 *
 * so a slot type's categories cost one request each, and the inverse ("which
 * slot types take this category?") costs all 389. Neither list has media.
 * The reagents themselves live on items: an item record carries
 * `modified_crafting.category`, and the item search filters on it, so a
 * category's reagents (with their icons) are one search away.
 */

type Reference = { id: number; name?: LocalizedString | null };

type SlotTypeIndexResponse = { slot_types?: Reference[] };
type CategoryIndexResponse = { categories?: Reference[] };

type SlotTypeResponse = {
  id: number;
  /** The slot type's name again (the index's `name`); absent on unnamed ones. */
  description?: LocalizedString | null;
  compatible_categories?: Reference[];
};

type ItemSearchResponse = {
  pageCount?: number;
  results?: Array<{
    data?: {
      id?: number;
      name?: LocalizedString;
      quality?: { type?: string };
      modified_crafting?: { description?: LocalizedString | null };
    };
  }>;
};

const toRef = (entry: Reference): { id: number; name: string | null } => ({
  id: entry.id,
  name: localized(entry.name ?? undefined).trim() || null,
});

const toRefs = (entries: Reference[] | undefined): Array<{ id: number; name: string | null }> =>
  (entries ?? []).filter((entry) => typeof entry.id === "number").map(toRef);

/* ------------------------------------------------------------------ */
/* Indexes                                                             */
/* ------------------------------------------------------------------ */

/**
 * Every reagent slot type. `locale` is explicit because the page also reads
 * the English names, whatever the app's locale, to sort slot types into
 * themes by the words in their names.
 */
export const fetchSlotTypeIndex = async (
  locale: string,
  signal?: AbortSignal,
): Promise<SlotTypeRef[]> => {
  const response = await blizzardClient.get<SlotTypeIndexResponse>(
    "/data/wow/modified-crafting/reagent-slot-type/index",
    { namespace: namespace("static"), locale },
    { signal },
  );
  return toRefs(response.slot_types);
};

export const fetchCategoryIndex = async (signal?: AbortSignal): Promise<CategoryRef[]> => {
  const response = await blizzardClient.get<CategoryIndexResponse>(
    "/data/wow/modified-crafting/category/index",
    { namespace: namespace("static") },
    { signal },
  );
  return toRefs(response.categories);
};

/* ------------------------------------------------------------------ */
/* One slot type                                                       */
/* ------------------------------------------------------------------ */

/** A slot type and the categories it accepts; null when Blizzard has no such id. */
export const fetchSlotType = async (
  slotTypeId: number,
  signal?: AbortSignal,
): Promise<SlotType | null> => {
  const response = await optional404(() =>
    blizzardClient.get<SlotTypeResponse>(
      `/data/wow/modified-crafting/reagent-slot-type/${slotTypeId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  if (!response) {
    return null;
  }
  return {
    id: response.id,
    name: localized(response.description ?? undefined).trim() || null,
    categories: toRefs(response.compatible_categories),
  };
};

/* ------------------------------------------------------------------ */
/* A category's reagents (item search)                                 */
/* ------------------------------------------------------------------ */

/**
 * The modifier text on a reagent, readable or null. Blizzard's strings hold
 * the game's tooltip tokens: `$ev1` is a value the game fills in (shown as
 * "X"), `$en1` a stat it names (that sentence is dropped, since it says
 * nothing without the stat), and `$@spelldesc…` pulls in a spell's text the
 * API does not include. Some reagents just repeat their own name.
 * `hasValue` says whether the kept text has such an "X".
 */
export const readableEffect = (
  raw: LocalizedString | null | undefined,
  itemName: string,
): { text: string; hasValue: boolean } | null => {
  const text = localized(raw ?? undefined);
  if (!text) {
    return null;
  }
  const sentences = text
    .split(/\|n/i)
    .map((part) => {
      const cleaned = cleanMarkup(part.replace(/\$@spelldesc\d+/gi, ""));
      return {
        text: cleaned.replace(/\$ev\d*/gi, "X").trim(),
        hasValue: /\$ev/i.test(cleaned),
      };
    })
    .filter(
      (part) =>
        part.text.length > 0 &&
        !part.text.includes("$") &&
        part.text.toLocaleLowerCase() !== itemName.toLocaleLowerCase(),
    );
  return sentences.length > 0
    ? {
        text: sentences.map((part) => part.text).join(" "),
        hasValue: sentences.some((part) => part.hasValue),
      }
    : null;
};

/**
 * Up to `pageSize` reagents of one category, newest item first. Some
 * categories (socket #489, for one) have no item carrying them: an empty
 * list, not an error.
 */
export const fetchCategoryItems = async (
  categoryId: number,
  pageSize: number,
  signal?: AbortSignal,
): Promise<CategoryItems> => {
  const response = await optional404(() =>
    blizzardClient.get<ItemSearchResponse>(
      "/data/wow/search/item",
      {
        namespace: namespace("static"),
        "modified_crafting.category.id": categoryId,
        orderby: "id:desc",
        _page: 1,
        _pageSize: pageSize,
      },
      { signal },
    ),
  );
  const items: ReagentItem[] = [];
  (response?.results ?? []).forEach((result) => {
    const data = result.data;
    if (!data || typeof data.id !== "number") {
      return;
    }
    const name = localized(data.name).trim() || `Item #${data.id}`;
    const effect = readableEffect(data.modified_crafting?.description, name);
    items.push({
      id: data.id,
      name,
      quality: data.quality?.type ? data.quality.type.toLowerCase() : null,
      effect: effect?.text ?? null,
      effectHasValue: effect?.hasValue ?? false,
    });
  });
  return { items, more: (response?.pageCount ?? 0) > 1 };
};

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** "1 slot type", "389 slot types" with grouped digits. */
export const pluralize = (count: number, one: string, many: string): string =>
  `${formatNumber(count)} ${count === 1 ? one : many}`;

/** Ids read as identifiers, never "1,204". */
export const formatId = (id: number): string => `#${formatNumber(id, { useGrouping: false })}`;

export const slotTypeName = (slot: { id: number; name: string | null }): string =>
  slot.name ?? `Unnamed slot type ${formatId(slot.id)}`;

export const categoryName = (category: { id: number; name: string | null }): string =>
  category.name ?? `Unnamed category ${formatId(category.id)}`;

/**
 * Same-name items (a reagent's quality ranks share one name) as one entry,
 * newest id first within it, in the order their names first appear.
 */
export const groupItemsByName = (
  items: readonly ReagentItem[],
): Array<{ name: string; items: ReagentItem[] }> => {
  const groups = new Map<string, ReagentItem[]>();
  items.forEach((item) => {
    const list = groups.get(item.name);
    if (list) {
      list.push(item);
    } else {
      groups.set(item.name, [item]);
    }
  });
  return Array.from(groups, ([name, list]) => ({ name, items: list }));
};
