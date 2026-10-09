import { blizzardClient } from "@/lib/blizzardClient";
import {
  cleanMarkup,
  localized,
  namespace,
  optional404,
} from "@/lib/blizzardHelpers";
import { isQualityKey } from "@/theme";
import {
  classifyRoom,
  packIds,
  tidyName,
} from "@/features/housingDecor/services/housingCatalog";
import type {
  Decor,
  DecorEntry,
  DecorItem,
  DecorItemLink,
  DecorItemSummary,
  Fixture,
  FixtureRecord,
  HookTypeCount,
  LocalizedString,
  Room,
} from "@/features/housingDecor/types";

/*
 * Player housing in Blizzard's game data API, probed on US:
 *
 *   decor/index                2,131 decor, names only
 *   search/decor               each hit names the decor's item; `id=1||2`
 *                              finds a page of ids in one request
 *   decor/{id}                 its item, dye slots, default collection count
 *   search/item                the items' quality, the same way by id
 *   item/{id}                  the tooltip: binding, use text, flavor, price
 *   media/item/{id}            the icon (the Items explorer's shared cache)
 *   search/fixture             593 fixtures with every locale's name
 *   fixture/{id}               its hooks: Door, Window, Roof Window, Tower,
 *                              Chimney (only bases and roofs have any)
 *   fixture-hook/index         1,812 hooks, named by type
 *   search/room                39 rooms with every locale's name
 *
 * There is no decor render or fixture art anywhere in the API, and a
 * fixture-hook search filtered by its parent fixture finds nothing, so
 * hooks come from the fixture records. Room records hold an id and a name.
 */

/** Blizzard's largest page, and its cap on any one search. */
const SEARCH_RESULT_CAP = 1000;
/** Windows of 1,000 read before giving up: 600-odd fixtures fit in the first. */
const MAX_SEARCH_WINDOWS = 5;

type Reference = { id: number; name?: LocalizedString };

type SearchResponse<T> = {
  page?: number;
  pageCount?: number;
  resultCountCapped?: boolean;
  results?: Array<{ data?: T }>;
};

type DecorIndexResponse = { decor_items?: Reference[] };

type DecorHit = { id: number; item?: Reference };

type ItemHit = {
  id: number;
  quality?: { type?: string; name?: LocalizedString };
};

type DecorResponse = {
  id: number;
  name?: LocalizedString;
  /** One item on every record seen (despite the plural); a list is read too. */
  items?: Reference | Reference[];
  dye_slots?: Array<{ slot_index?: number; dye_color_category?: string }>;
  default_collection_count?: number;
};

type DisplayString = { display_string?: LocalizedString };

type ItemResponse = {
  id: number;
  name?: LocalizedString;
  quality?: { type?: string; name?: LocalizedString };
  item_class?: Reference;
  item_subclass?: Reference;
  sell_price?: number;
  preview_item?: {
    binding?: { name?: LocalizedString };
    description?: LocalizedString;
    spells?: Array<{ description?: LocalizedString }>;
    requirements?: Record<string, DisplayString | unknown>;
    sell_price?: { value?: number };
  };
};

type NamedHit = { id: number; name?: LocalizedString };

type FixtureResponse = {
  id: number;
  name?: LocalizedString | null;
  hooks?: Reference[];
};

type HookIndexResponse = { fixture_hooks?: Reference[] };

const isId = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const qualityOf = (quality: { type?: string; name?: LocalizedString } | undefined) => {
  const key = quality?.type?.toLowerCase();
  return {
    quality: isQualityKey(key) ? key : undefined,
    qualityName: localized(quality?.name) || undefined,
  };
};

/* ------------------------------------------------------------------ */
/* Decor                                                               */
/* ------------------------------------------------------------------ */

/** Every decor's id and name, in Blizzard's order (the page sorts them). */
export const fetchDecorIndex = async (signal?: AbortSignal): Promise<DecorEntry[]> => {
  const response = await blizzardClient.get<DecorIndexResponse>(
    "/data/wow/decor/index",
    { namespace: namespace("static") },
    { signal },
  );
  return (response.decor_items ?? [])
    .filter((entry) => isId(entry.id))
    .map((entry) => ({
      id: entry.id,
      name: tidyName(localized(entry.name)) || `Decor #${entry.id}`,
    }));
};

/**
 * Searches by id, `ids` at a time (at most a couple of requests: the proxy
 * caps a value at 256 characters). Hits for ids Blizzard does not index are
 * simply absent.
 */
const searchByIds = async <T extends { id: number }>(
  path: string,
  ids: readonly number[],
  signal?: AbortSignal,
): Promise<T[]> => {
  const hits: T[] = [];
  for (const value of packIds(ids)) {
    const response = await blizzardClient.get<SearchResponse<T>>(
      path,
      {
        namespace: namespace("static"),
        id: value,
        _page: 1,
        _pageSize: Math.min(SEARCH_RESULT_CAP, value.split("||").length),
      },
      { signal },
    );
    (response.results ?? []).forEach((result) => {
      if (result.data && isId(result.data.id)) {
        hits.push(result.data);
      }
    });
  }
  return hits;
};

/** Which item each of these decor comes from: one search for a page of cards. */
export const fetchDecorItemLinks = async (
  decorIds: readonly number[],
  signal?: AbortSignal,
): Promise<DecorItemLink[]> => {
  const hits = await searchByIds<DecorHit>("/data/wow/search/decor", decorIds, signal);
  const itemByDecor = new Map(hits.map((hit) => [hit.id, hit.item?.id]));
  return decorIds.map((decorId) => {
    const itemId = itemByDecor.get(decorId);
    return { decorId, itemId: isId(itemId) ? itemId : undefined };
  });
};

/** The quality of each of these items: one search for a page of cards. */
export const fetchDecorItemSummaries = async (
  itemIds: readonly number[],
  signal?: AbortSignal,
): Promise<DecorItemSummary[]> => {
  const hits = await searchByIds<ItemHit>("/data/wow/search/item", itemIds, signal);
  return hits.map((hit) => ({ itemId: hit.id, ...qualityOf(hit.quality) }));
};

/** A decor record, or null when Blizzard has no such id (404). */
export const fetchDecor = async (
  decorId: number,
  signal?: AbortSignal,
): Promise<Decor | null> => {
  const raw = await optional404(() =>
    blizzardClient.get<DecorResponse>(
      `/data/wow/decor/${decorId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  if (!raw) {
    return null;
  }
  const item = Array.isArray(raw.items) ? raw.items[0] : raw.items;
  return {
    id: raw.id,
    name: tidyName(localized(raw.name)) || `Decor #${raw.id}`,
    item:
      item && isId(item.id)
        ? { id: item.id, name: tidyName(localized(item.name)) || `Item #${item.id}` }
        : undefined,
    dyeSlots: (raw.dye_slots ?? [])
      .filter((slot) => typeof slot.dye_color_category === "string")
      .map((slot) => ({ index: slot.slot_index ?? 0, category: slot.dye_color_category ?? "" }))
      .sort((left, right) => left.index - right.index),
    defaultCollectionCount:
      typeof raw.default_collection_count === "number" && raw.default_collection_count > 0
        ? raw.default_collection_count
        : undefined,
  };
};

/**
 * Blizzard repeats a decor item's use text, once as "This Decor will be
 * added…" and once as "Use: This Decor will be added…": a line that ends
 * another one is dropped, in any locale.
 */
const distinctEffects = (lines: string[]): string[] =>
  lines.filter(
    (line, index) =>
      lines.indexOf(line) === index &&
      !lines.some((other) => other !== line && other.length > line.length && other.endsWith(line)),
  );

const displayStrings = (requirements: Record<string, unknown> | undefined): string[] =>
  Object.values(requirements ?? {})
    .map((entry) =>
      entry && typeof entry === "object" && "display_string" in entry
        ? cleanMarkup(localized((entry as DisplayString).display_string))
        : "",
    )
    .filter(Boolean);

/** A decor's item as its tooltip describes it, or null when Blizzard has no such item (404). */
export const fetchDecorItem = async (
  itemId: number,
  signal?: AbortSignal,
): Promise<DecorItem | null> => {
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
  const preview = raw.preview_item;
  const typeLine = [localized(raw.item_class?.name), localized(raw.item_subclass?.name)]
    .filter(Boolean)
    .join(" · ");
  return {
    id: raw.id,
    name: tidyName(localized(raw.name)) || `Item #${raw.id}`,
    ...qualityOf(raw.quality),
    typeLine: typeLine || undefined,
    binding: localized(preview?.binding?.name) || undefined,
    description: cleanMarkup(localized(preview?.description)) || undefined,
    effects: distinctEffects(
      (preview?.spells ?? [])
        .map((spell) => cleanMarkup(localized(spell.description)))
        .filter(Boolean),
    ),
    requirements: displayStrings(preview?.requirements),
    sellPrice: Math.max(0, preview?.sell_price?.value ?? raw.sell_price ?? 0),
  };
};

/* ------------------------------------------------------------------ */
/* Fixtures and rooms                                                  */
/* ------------------------------------------------------------------ */

/**
 * Every hit of a search, by id: a search stops at 1,000 results, so when
 * one fills up the next starts after the last id it saw.
 */
const searchAll = async <T extends { id: number }>(
  path: string,
  signal?: AbortSignal,
): Promise<T[]> => {
  const hits: T[] = [];
  let from: number | null = null;
  for (let window = 0; window < MAX_SEARCH_WINDOWS; window += 1) {
    const response: SearchResponse<T> = await blizzardClient.get<SearchResponse<T>>(
      path,
      {
        namespace: namespace("static"),
        orderby: "id",
        id: from === null ? undefined : `[${from},]`,
        _page: 1,
        _pageSize: SEARCH_RESULT_CAP,
      },
      { signal },
    );
    const page = (response.results ?? [])
      .map((result) => result.data)
      .filter((data): data is T => data !== undefined && isId(data.id));
    hits.push(...page);
    if (page.length < SEARCH_RESULT_CAP) {
      break;
    }
    from = page[page.length - 1].id + 1;
  }
  return hits;
};

const englishOf = (name: LocalizedString | undefined): string =>
  tidyName(localized(name, "en_US"));

/** Hook counts by type (Window 16, Door 8), most first. */
export const countHooks = (hooks: readonly { type: string }[]): HookTypeCount[] => {
  const counts = new Map<string, number>();
  hooks.forEach((hook) => counts.set(hook.type, (counts.get(hook.type) ?? 0) + 1));
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((left, right) => right.count - left.count || left.type.localeCompare(right.type));
};

/** Every fixture with its localized and English names (one request on US). */
export const fetchFixtures = async (signal?: AbortSignal): Promise<Fixture[]> => {
  const hits = await searchAll<NamedHit>("/data/wow/search/fixture", signal);
  return hits.map((hit) => ({
    id: hit.id,
    name: tidyName(localized(hit.name)),
    englishName: englishOf(hit.name),
  }));
};

/** A fixture record with its hook points, or null when Blizzard has no such id (404). */
export const fetchFixture = async (
  fixtureId: number,
  signal?: AbortSignal,
): Promise<FixtureRecord | null> => {
  const raw = await optional404(() =>
    blizzardClient.get<FixtureResponse>(
      `/data/wow/fixture/${fixtureId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  if (!raw) {
    return null;
  }
  return {
    id: raw.id,
    name: tidyName(localized(raw.name ?? undefined)),
    hooks: (raw.hooks ?? [])
      .filter((hook) => isId(hook.id))
      .map((hook) => ({ id: hook.id, type: localized(hook.name) || "Hook" })),
  };
};

/** How many hooks of each type Blizzard lists, most first. */
export const fetchHookTypeCounts = async (signal?: AbortSignal): Promise<HookTypeCount[]> => {
  const response = await blizzardClient.get<HookIndexResponse>(
    "/data/wow/fixture-hook/index",
    { namespace: namespace("static") },
    { signal },
  );
  return countHooks(
    (response.fixture_hooks ?? []).map((hook) => ({ type: localized(hook.name) || "Hook" })),
  );
};

/** Every room, its shape and size read from the English name (one request). */
export const fetchRooms = async (signal?: AbortSignal): Promise<Room[]> => {
  const hits = await searchAll<NamedHit>("/data/wow/search/room", signal);
  return hits.map((hit) =>
    classifyRoom(
      hit.id,
      tidyName(localized(hit.name)) || `Room #${hit.id}`,
      englishOf(hit.name),
    ),
  );
};
