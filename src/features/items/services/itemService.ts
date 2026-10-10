import { blizzardClient } from "@/lib/blizzardClient";
import type { QueryParams } from "@/lib/blizzardClient";
import {
  localized,
  mapWithConcurrency,
  nameParam,
  nameParamFromTerms,
  namespace,
  optional404,
} from "@/lib/blizzardHelpers";
import type { LocalizedString } from "@/lib/blizzardHelpers";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import { pickAssetUrl } from "@/lib/mediaAssets";
import type { MediaAsset } from "@/lib/mediaAssets";
import {
  MAX_SEARCH_PAGE_SIZE,
  narrowByTypedName,
  relaxedNameTerms,
} from "@/lib/nameSearch";
import { isQualityKey } from "@/theme";
import {
  ITEM_PAGE_SIZE,
  findSlotGroup,
  levelRangeParam,
} from "@/features/items/services/itemCatalog";
import { toItemTooltip } from "@/features/items/services/itemTooltip";
import type { PreviewItemResponse } from "@/features/items/services/itemTooltip";
import type {
  ItemClassDetail,
  ItemClassSummary,
  ItemRecord,
  ItemSearchCriteria,
  ItemSearchPage,
  ItemSort,
  ItemSubclassSummary,
  ItemSummary,
  NamedRef,
} from "@/features/items/types";

/*
 * The item explorer reads four endpoints:
 *
 *   search/item              every filter the page offers (name, class,
 *                            subclass, quality.type, inventory_type.type
 *                            with `||` for OR, level ranges as `[200,300]`)
 *                            and three sorts; 1,000 matches at most, and
 *                            each hit is the item's whole record
 *   item-class/index -> {id} the class tiles and the subclass filter
 *   item/{id}                the record plus `preview_item`, the tooltip
 *   media/item/{id}          the 56px icon (shared with the rest of the app)
 *
 * so a page of 24 cards costs one search plus an icon per card as it nears
 * the viewport.
 */

/* ------------------------------------------------------------------ */
/* Query keys                                                          */
/* ------------------------------------------------------------------ */

const ITEM_KEY_ROOT = ["items", env.region, env.locale] as const;

/**
 * react-query key factory; every key is prefixed once with region + locale.
 * The header search, Quests, Journal, Regions, the Auction House and the
 * search results share `media`, so an icon loaded anywhere is loaded
 * everywhere: its shape must not change.
 */
export const itemKeys = {
  all: ITEM_KEY_ROOT,
  classIndex: () => [...ITEM_KEY_ROOT, "class-index"] as const,
  classDetail: (itemClassId: number | null) =>
    [...ITEM_KEY_ROOT, "class-detail", itemClassId] as const,
  gallery: (
    itemClassId: number | null,
    itemSubclassId: number | null,
    query: string,
  ) =>
    [...ITEM_KEY_ROOT, "gallery", itemClassId, itemSubclassId, query] as const,
  media: (itemId: number) => [...ITEM_KEY_ROOT, "media", itemId] as const,
  detail: (itemId: number) => [...ITEM_KEY_ROOT, "detail", itemId] as const,
};

/* ------------------------------------------------------------------ */
/* Wire types                                                          */
/* ------------------------------------------------------------------ */

type Reference = {
  id: number;
  name?: LocalizedString;
};

type TypedReference = {
  type?: string;
  name?: LocalizedString;
};

/** A search hit's `data` and an item record share this shape. */
type ItemResponse = {
  id: number;
  name?: LocalizedString;
  quality?: TypedReference;
  level?: number;
  required_level?: number;
  item_class?: Reference;
  item_subclass?: Reference;
  inventory_type?: TypedReference;
  sell_price?: number;
  preview_item?: PreviewItemResponse;
};

type SearchResponse = {
  page?: number;
  pageCount?: number;
  resultCountCapped?: boolean;
  results?: Array<{ data: ItemResponse }>;
};

type MediaResponse = {
  assets?: MediaAsset[];
};

type ClassIndexResponse = {
  item_classes?: Reference[];
};

type ClassResponse = {
  class_id?: number;
  name?: LocalizedString;
  item_subclasses?: Reference[];
};

type SubclassResponse = {
  display_name?: LocalizedString;
  verbose_name?: LocalizedString;
};

/* ------------------------------------------------------------------ */
/* Mapping                                                             */
/* ------------------------------------------------------------------ */

const toRef = (reference: Reference | undefined, fallback: string): NamedRef | undefined =>
  reference && typeof reference.id === "number"
    ? { id: reference.id, name: localized(reference.name) || `${fallback} #${reference.id}` }
    : undefined;

const positive = (value: number | undefined): number | undefined =>
  typeof value === "number" && value > 0 ? value : undefined;

/** Search hits carry every locale; records only the requested one. */
export const toItemSummary = (raw: ItemResponse): ItemSummary => {
  const qualityKey = raw.quality?.type?.toLowerCase();
  const slotType = raw.inventory_type?.type;
  return {
    id: raw.id,
    name: localized(raw.name) || `Item #${raw.id}`,
    quality: isQualityKey(qualityKey) ? qualityKey : undefined,
    qualityName: localized(raw.quality?.name) || undefined,
    level: positive(raw.level),
    requiredLevel: positive(raw.required_level),
    itemClass: toRef(raw.item_class, "Class"),
    itemSubclass: toRef(raw.item_subclass, "Subclass"),
    slot: slotType
      ? { type: slotType, name: localized(raw.inventory_type?.name) || slotType }
      : undefined,
    sellPrice: positive(raw.sell_price),
  };
};

/* ------------------------------------------------------------------ */
/* Classes                                                             */
/* ------------------------------------------------------------------ */

/** Every item class with its localized name, in Blizzard's order. */
export const fetchItemClassIndex = async (
  signal?: AbortSignal,
): Promise<ItemClassSummary[]> => {
  const response = await blizzardClient.get<ClassIndexResponse>(
    "/data/wow/item-class/index",
    { namespace: namespace("static") },
    { signal },
  );
  return (response.item_classes ?? [])
    .map((entry) => toRef(entry, "Class"))
    .filter((entry): entry is ItemClassSummary => entry !== undefined);
};

/*
 * Blizzard keeps unused subclass slots in some classes (Consumable lists
 * "RESERVED 13" to "RESERVED 15"); their internal names are the same in
 * every locale and no item is filed under them.
 */
const RESERVED_SUBCLASS = /^RESERVED\b/;

/**
 * Blizzard's class record names one-handed and two-handed weapons alike
 * ("Axe" for ids 0 and 1). For names that collide within a class, the
 * subclass record's verbose name ("Two-Handed Axes") stands in. Only the
 * colliding entries are fetched (six for Weapon). A subclass Blizzard has
 * no record for (404) keeps the short name; any other failure fails the
 * class, so the app's retry policy and the picker's Retry handle it
 * instead of caching duplicate names for a day.
 */
const disambiguateSubclassNames = async (
  itemClassId: number,
  subclasses: ItemSubclassSummary[],
  signal?: AbortSignal,
): Promise<ItemSubclassSummary[]> => {
  const occurrences = new Map<string, number>();
  subclasses.forEach((subclass) => {
    occurrences.set(subclass.name, (occurrences.get(subclass.name) ?? 0) + 1);
  });
  const ambiguous = subclasses.filter((subclass) => (occurrences.get(subclass.name) ?? 0) > 1);
  if (ambiguous.length === 0) {
    return subclasses;
  }

  const verboseNames = await mapWithConcurrency(
    ambiguous,
    6,
    async (subclass) => {
      const detail = await optional404(() =>
        blizzardClient.get<SubclassResponse>(
          `/data/wow/item-class/${itemClassId}/item-subclass/${subclass.id}`,
          { namespace: namespace("static") },
          { signal },
        ),
      );
      return localized(detail?.verbose_name) || localized(detail?.display_name);
    },
    signal,
  );
  const failed = verboseNames.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") {
    throw failed.reason;
  }

  const renamed = new Map<number, string>();
  verboseNames.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value) {
      renamed.set(ambiguous[index].id, result.value);
    }
  });
  return subclasses.map((subclass) => {
    const verbose = renamed.get(subclass.id);
    return verbose ? { ...subclass, name: verbose } : subclass;
  });
};

/** A class and its subclasses, in Blizzard's (id) order. */
export const fetchItemClassDetail = async (
  itemClassId: number,
  signal?: AbortSignal,
): Promise<ItemClassDetail> => {
  const response = await blizzardClient.get<ClassResponse>(
    `/data/wow/item-class/${itemClassId}`,
    { namespace: namespace("static") },
    { signal },
  );
  const subclasses = (response.item_subclasses ?? [])
    .map((entry) => toRef(entry, "Subclass"))
    .filter(
      (entry): entry is ItemSubclassSummary =>
        entry !== undefined && !RESERVED_SUBCLASS.test(entry.name),
    );
  return {
    id: itemClassId,
    name: localized(response.name) || `Class #${itemClassId}`,
    subclasses: await disambiguateSubclassNames(itemClassId, subclasses, signal),
  };
};

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

const ORDER_BY: Readonly<Record<ItemSort, () => string>> = {
  newest: () => "id:desc",
  level: () => "level:desc,id:desc",
  name: () => `name.${env.locale},id`,
};

/** Filters on top of the name terms (keys the proxy allow-lists). */
const filterParams = (criteria: ItemSearchCriteria): QueryParams => {
  const slot = findSlotGroup(criteria.slot);
  const level = levelRangeParam(criteria.level);
  return {
    ...(criteria.classId !== null ? { "item_class.id": criteria.classId } : {}),
    ...(criteria.classId !== null && criteria.subclassId !== null
      ? { "item_subclass.id": criteria.subclassId }
      : {}),
    ...(criteria.quality ? { "quality.type": criteria.quality.toUpperCase() } : {}),
    ...(slot ? { "inventory_type.type": slot.types.join("||") } : {}),
    ...(level ? { level } : {}),
  };
};

/** The search's order, for candidates narrowed here (see searchItems). */
const compareBySort = (sort: ItemSort) => (left: ItemSummary, right: ItemSummary): number => {
  if (sort === "name") {
    return (
      left.name.localeCompare(right.name, undefined, { sensitivity: "base" }) ||
      left.id - right.id
    );
  }
  if (sort === "level") {
    return (right.level ?? 0) - (left.level ?? 0) || right.id - left.id;
  }
  return right.id - left.id;
};

const emptyPage = (page: number): ItemSearchPage => ({
  items: [],
  page,
  pageCount: 0,
  total: 0,
  capped: false,
  narrowed: false,
});

/**
 * One page of items matching `criteria`, in the chosen order.
 *
 * Blizzard matches whole words only: when nothing matches every word, the
 * last one is probably half typed ("Thunderfury, Bles"), so the finished
 * words are searched again and the candidates narrowed here (see
 * nameSearch), then put in the chosen order.
 */
export const searchItems = async (
  criteria: ItemSearchCriteria,
  page: number,
  signal?: AbortSignal,
): Promise<ItemSearchPage> => {
  const filters = filterParams(criteria);
  const strict = await optional404(() =>
    blizzardClient.get<SearchResponse>(
      "/data/wow/search/item",
      {
        namespace: namespace("static"),
        orderby: ORDER_BY[criteria.sort](),
        _page: page,
        _pageSize: ITEM_PAGE_SIZE,
        ...(criteria.name ? nameParam(criteria.name) : {}),
        ...filters,
      },
      { signal },
    ),
  );

  const pageCount = strict?.pageCount ?? 0;
  // A page past the end of real matches is a stale page number, not a
  // half-typed word: report the page count so the caller can step back.
  if (pageCount > 0 || !criteria.name) {
    const items = (strict?.results ?? []).map((entry) => toItemSummary(entry.data));
    const resolvedPage = strict?.page ?? page;
    return {
      items,
      page: resolvedPage,
      pageCount,
      total: pageCount <= 1 && resolvedPage === 1 ? items.length : undefined,
      capped: strict?.resultCountCapped === true,
      narrowed: false,
    };
  }

  const relaxed = relaxedNameTerms(criteria.name);
  if (!relaxed) {
    return emptyPage(page);
  }

  // Ranked by relevance (no `orderby`) so the closest names come first.
  const candidates = await optional404(() =>
    blizzardClient.get<SearchResponse>(
      "/data/wow/search/item",
      {
        namespace: namespace("static"),
        _page: 1,
        _pageSize: MAX_SEARCH_PAGE_SIZE,
        ...nameParamFromTerms(relaxed),
        ...filters,
      },
      { signal },
    ),
  );
  if (!candidates) {
    return emptyPage(page);
  }

  const narrowed = narrowByTypedName(
    (candidates.results ?? [])
      .map((entry) => toItemSummary(entry.data))
      .sort(compareBySort(criteria.sort)),
    criteria.name,
    (item) => item.name,
    { page, pageSize: ITEM_PAGE_SIZE },
  );
  if (narrowed.total === 0) {
    return emptyPage(page);
  }
  return {
    items: narrowed.results,
    page,
    pageCount: narrowed.pageCount,
    total: narrowed.total,
    capped: (candidates.pageCount ?? 1) > 1 || candidates.resultCountCapped === true,
    narrowed: true,
  };
};

/* ------------------------------------------------------------------ */
/* Records and media                                                   */
/* ------------------------------------------------------------------ */

/** An item with its tooltip preview, or null when Blizzard has no such id (404). */
export const fetchItemRecord = async (
  itemId: number,
  signal?: AbortSignal,
): Promise<ItemRecord | null> => {
  const raw = await optional404(() =>
    blizzardClient.get<ItemResponse>(
      `/data/wow/item/${itemId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  return raw ? { ...toItemSummary(raw), tooltip: toItemTooltip(raw.preview_item) } : null;
};

/**
 * Icon URL for an item, or `null` when Blizzard has no media for it (404 or
 * an empty asset list). Never `undefined`: react-query rejects a queryFn
 * that resolves to it.
 */
export const fetchItemMediaUrl = async (
  itemId: number,
  signal?: AbortSignal,
): Promise<string | null> => {
  const url = await optional404(async () => {
    const response = await blizzardClient.get<MediaResponse>(
      `/data/wow/media/item/${itemId}`,
      { namespace: namespace("static") },
      { signal },
    );

    return pickAssetUrl(response.assets);
  });

  return url ?? null;
};

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** "1 item", "24 items" with grouped digits. */
export const pluralize = (count: number, one: string, many: string): string =>
  `${formatNumber(count)} ${count === 1 ? one : many}`;

/**
 * A card's type line: "Armor · Plate" when the subclass says more than the
 * class, the one name otherwise ("Consumable", "Housing").
 */
export const itemTypeLine = (item: Pick<ItemSummary, "itemClass" | "itemSubclass">): string => {
  const className = item.itemClass?.name;
  const subclassName = item.itemSubclass?.name;
  if (subclassName && className && subclassName !== className) {
    return `${className} · ${subclassName}`;
  }
  return subclassName ?? className ?? "";
};
