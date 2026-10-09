import { blizzardClient } from "@/lib/blizzardClient";
import { localized, namespace, optional404 } from "@/lib/blizzardHelpers";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import { normalizeForSearch } from "@/lib/fuzzyMatch";
import type {
  Appearance,
  AppearanceCriteria,
  AppearanceHit,
  AppearanceItem,
  AppearancePage,
  AppearanceSet,
  AppearanceSetRef,
  LocalizedString,
  NamedRef,
  SetFilter,
  SetGroup,
  SetKeyword,
  SlotRef,
} from "@/features/itemAppearances/types";

/*
 * Blizzard keeps transmog in three places, none of them with pictures:
 *
 *   item-appearance/set/index -> set/{id}   3,310 sets: a name and a list of appearance ids
 *   item-appearance/{id}                     one look: slot, armor or weapon type, display
 *                                            info id, and every item that wears it
 *   search/item-appearance                   appearances by slot, 1,000 matches at most; its
 *                                            index holds only id, slot and display id
 *
 * There is no render of any look: media/item-appearance/{id} 404s for every
 * id, and an appearance's `media.id` is an icon file, not a media record. So
 * a look is drawn with its first item's icon, from media/item/{itemId} (the
 * Items explorer's cache).
 */

/** Cards per page: 1, 2, 3 and 4 columns all end on a full row. */
export const SET_PAGE_SIZE = 24;
export const APPEARANCE_PAGE_SIZE = 24;

type Reference = { id: number; name?: LocalizedString };
type SlotResponse = { type?: string; name?: LocalizedString };

type SetIndexResponse = {
  appearance_sets?: Reference[];
};

type SetResponse = {
  id: number;
  set_name?: LocalizedString;
  appearances?: Array<{ id?: number }>;
};

type SlotIndexResponse = {
  slots?: Array<{ key?: { href?: string }; type?: string }>;
};

type SlotListResponse = {
  appearances?: Array<{ id?: number }>;
};

type AppearanceResponse = {
  id: number;
  slot?: SlotResponse;
  item_class?: Reference;
  item_subclass?: Reference;
  item_display_info_id?: number;
  items?: Reference[];
};

type SearchResponse = {
  page?: number;
  pageCount?: number;
  resultCountCapped?: boolean;
  results?: Array<{
    data?: { id?: number; slot?: SlotResponse; item_display_info_id?: number };
  }>;
};

type ItemResponse = {
  id: number;
  name?: LocalizedString;
  level?: number;
  quality?: { type?: string; name?: LocalizedString };
  inventory_type?: { type?: string; name?: LocalizedString };
};

/* ------------------------------------------------------------------ */
/* Mapping                                                             */
/* ------------------------------------------------------------------ */

const isId = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const toRef = (reference: Reference | undefined, fallback: string): NamedRef | undefined =>
  reference && isId(reference.id)
    ? { id: reference.id, name: localized(reference.name) || `${fallback} #${reference.id}` }
    : undefined;

const toSlot = (slot: SlotResponse | undefined): SlotRef | undefined =>
  slot?.type ? { type: slot.type, name: localized(slot.name) } : undefined;

const toAppearance = (raw: AppearanceResponse): Appearance => ({
  id: raw.id,
  slot: toSlot(raw.slot),
  itemClass: toRef(raw.item_class, "Class"),
  itemSubclass: toRef(raw.item_subclass, "Type"),
  displayInfoId: isId(raw.item_display_info_id) ? raw.item_display_info_id : undefined,
  items: (raw.items ?? [])
    .map((item) => toRef(item, "Item"))
    .filter((item): item is NamedRef => item !== undefined),
});

/* ------------------------------------------------------------------ */
/* Sets                                                                */
/* ------------------------------------------------------------------ */

/** Every appearance set, in Blizzard's (id) order. */
export const fetchSetIndex = async (signal?: AbortSignal): Promise<AppearanceSetRef[]> => {
  const response = await blizzardClient.get<SetIndexResponse>(
    "/data/wow/item-appearance/set/index",
    { namespace: namespace("static") },
    { signal },
  );
  return (response.appearance_sets ?? [])
    .filter((entry) => isId(entry.id))
    .map((entry) => ({ id: entry.id, name: localized(entry.name) || `Set #${entry.id}` }));
};

/** One set, or null when Blizzard has no such id (a stale shared link). */
export const fetchSet = async (
  setId: number,
  signal?: AbortSignal,
): Promise<AppearanceSet | null> => {
  const raw = await optional404(() =>
    blizzardClient.get<SetResponse>(
      `/data/wow/item-appearance/set/${setId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  if (!raw) {
    return null;
  }
  return {
    id: raw.id,
    name: localized(raw.set_name) || `Set #${raw.id}`,
    appearanceIds: (raw.appearances ?? [])
      .map((entry) => entry.id)
      .filter((id): id is number => isId(id)),
  };
};

/*
 * Name tags. Only English names carry these words, so the page offers the
 * chips in English locales only. They read the name and nothing else: most
 * set names never say their armor ("Cosmic Penitent's Raiment" is cloth), so
 * the cards show the first piece's type from Blizzard's record as well.
 */
const PVP_TITLE = /\b(gladiator|combatant|aspirant|warmonger)\b/;
const ARMOR_WORDS: ReadonlyArray<[SetKeyword, string]> = [
  ["cloth", "cloth"],
  ["leather", "leather"],
  ["mail", "mail"],
  ["plate", "plate"],
];

export const setFiltersAvailable = (): boolean => env.locale.startsWith("en");

const keywordsOf = (name: string): ReadonlySet<SetKeyword> => {
  const keywords = new Set<SetKeyword>();
  if (!setFiltersAvailable()) {
    return keywords;
  }
  const text = normalizeForSearch(name);
  if (PVP_TITLE.test(text)) {
    keywords.add("pvp");
  }
  // Inside words too: "Battleplate" and "Ringmail" say their armor as well.
  ARMOR_WORDS.forEach(([keyword, word]) => {
    if (text.includes(word)) {
      keywords.add(keyword);
    }
  });
  return keywords;
};

/** The index folded by name, newest name first. */
export const groupSets = (index: readonly AppearanceSetRef[]): SetGroup[] => {
  const byName = new Map<string, number[]>();
  index.forEach((entry) => {
    const ids = byName.get(entry.name);
    if (ids) {
      ids.push(entry.id);
    } else {
      byName.set(entry.name, [entry.id]);
    }
  });
  const groups: SetGroup[] = [];
  byName.forEach((ids, name) => {
    const sorted = [...ids].sort((left, right) => left - right);
    groups.push({
      name,
      ids: sorted,
      newestId: sorted[sorted.length - 1],
      keywords: keywordsOf(name),
    });
  });
  return groups.sort((left, right) => right.newestId - left.newestId);
};

export const matchesSetFilter = (group: SetGroup, filter: SetFilter | null): boolean => {
  if (filter === null) {
    return true;
  }
  if (filter === "other") {
    return !group.keywords.has("pvp");
  }
  return group.keywords.has(filter);
};

/* ------------------------------------------------------------------ */
/* Slots and appearances                                               */
/* ------------------------------------------------------------------ */

/** The slot types Blizzard lists (types only; names come with records). */
export const fetchSlotIndex = async (signal?: AbortSignal): Promise<string[]> => {
  const response = await blizzardClient.get<SlotIndexResponse>(
    "/data/wow/item-appearance/slot/index",
    { namespace: namespace("static") },
    { signal },
  );
  return (response.slots ?? [])
    .map((slot) => {
      if (slot.type) {
        return slot.type;
      }
      // Each entry is only a link: ".../item-appearance/slot/HEAD?namespace=…".
      const match = /\/slot\/([^/?]+)/.exec(slot.key?.href ?? "");
      return match ? decodeURIComponent(match[1]) : "";
    })
    .filter((type) => type.length > 0);
};

/** One appearance, or null when Blizzard has no such id (404). */
export const fetchAppearance = async (
  appearanceId: number,
  signal?: AbortSignal,
): Promise<Appearance | null> => {
  const raw = await optional404(() =>
    blizzardClient.get<AppearanceResponse>(
      `/data/wow/item-appearance/${appearanceId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  return raw ? toAppearance(raw) : null;
};

const sortParam = (criteria: AppearanceCriteria): string =>
  criteria.sort === "oldest" ? "id" : "id:desc";

/**
 * The slot's own id list, paged here. Only used when the search lists
 * nothing for a slot: its index misses a few (the three EQUIPABLESPELL_WEAPON
 * appearances), and such a slot's list is tiny. Its hits carry no name, so
 * the cards name the slot from their own records.
 */
const pageSlotList = async (
  slot: string,
  criteria: AppearanceCriteria,
  page: number,
  signal?: AbortSignal,
): Promise<AppearancePage> => {
  const list = await optional404(() =>
    blizzardClient.get<SlotListResponse>(
      `/data/wow/item-appearance/slot/${encodeURIComponent(slot)}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  const ids = (list?.appearances ?? [])
    .map((entry) => entry.id)
    .filter((id): id is number => isId(id))
    .sort((left, right) => (criteria.sort === "oldest" ? left - right : right - left));
  const start = (page - 1) * APPEARANCE_PAGE_SIZE;
  return {
    hits: ids.slice(start, start + APPEARANCE_PAGE_SIZE).map((id) => ({ id })),
    page,
    pageCount: Math.ceil(ids.length / APPEARANCE_PAGE_SIZE),
    capped: false,
    source: "slot-list",
    total: ids.length,
  };
};

/**
 * One page of appearances, newest (highest id) or oldest first, optionally
 * in one slot. Blizzard counts at most 1,000 matches, so a large slot pages
 * through its newest (or oldest) thousand.
 */
export const searchAppearances = async (
  criteria: AppearanceCriteria,
  page: number,
  signal?: AbortSignal,
): Promise<AppearancePage> => {
  const response = await optional404(() =>
    blizzardClient.get<SearchResponse>(
      "/data/wow/search/item-appearance",
      {
        namespace: namespace("static"),
        orderby: sortParam(criteria),
        _page: page,
        _pageSize: APPEARANCE_PAGE_SIZE,
        ...(criteria.slot ? { "slot.type": criteria.slot } : {}),
      },
      { signal },
    ),
  );
  const pageCount = response?.pageCount ?? 0;
  if (pageCount === 0 && criteria.slot) {
    return pageSlotList(criteria.slot, criteria, page, signal);
  }

  const hits: AppearanceHit[] = (response?.results ?? [])
    .map((entry) => entry.data)
    .filter((data): data is NonNullable<typeof data> & { id: number } => isId(data?.id))
    .map((data) => ({ id: data.id, slot: toSlot(data.slot) }));
  const capped = response?.resultCountCapped === true;
  const resolvedPage = response?.page ?? page;
  return {
    hits,
    page: resolvedPage,
    pageCount,
    capped,
    source: "search",
    // Only a single, uncapped page says exactly how many there are.
    total: !capped && pageCount <= 1 && resolvedPage === 1 ? hits.length : undefined,
  };
};

/* ------------------------------------------------------------------ */
/* Items                                                               */
/* ------------------------------------------------------------------ */

/** The item facts the appearance dialog shows; null when Blizzard has no such item. */
export const fetchAppearanceItem = async (
  itemId: number,
  signal?: AbortSignal,
): Promise<AppearanceItem | null> => {
  const raw = await optional404(() =>
    blizzardClient.get<ItemResponse>(
      `/data/wow/item/${itemId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  if (!raw) {
    return null;
  }
  return {
    id: raw.id,
    name: localized(raw.name) || `Item #${raw.id}`,
    quality: raw.quality?.type?.toLowerCase(),
    qualityName: localized(raw.quality?.name) || undefined,
    level: typeof raw.level === "number" && raw.level > 0 ? raw.level : undefined,
    inventoryType: localized(raw.inventory_type?.name) || undefined,
  };
};

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** "1 piece", "1,808 set names" with grouped digits. */
export const pluralize = (count: number, one: string, many: string): string =>
  `${formatNumber(count)} ${count === 1 ? one : many}`;

/** "Armor · Cloth", or just "Cloth" when the subclass already says it. */
export const appearanceTypeLine = (
  appearance: Pick<Appearance, "itemClass" | "itemSubclass">,
): string => {
  const className = appearance.itemClass?.name;
  const subclassName = appearance.itemSubclass?.name;
  if (className && subclassName && className !== subclassName) {
    return `${className} · ${subclassName}`;
  }
  return subclassName ?? className ?? "";
};
