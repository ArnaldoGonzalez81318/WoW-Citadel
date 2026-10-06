import { blizzardClient } from "@/lib/blizzardClient";
import type { LocalizedString } from "@/lib/blizzardHelpers";
import {
  fulfilledValues,
  localized,
  mapWithConcurrency,
  namespace,
  optional404,
} from "@/lib/blizzardHelpers";
import { MAX_SEARCH_PAGE_SIZE } from "@/lib/nameSearch";

/**
 * The catalogue behind instant suggestions.
 *
 * Blizzard's search endpoints only match whole, correctly spelled words, so
 * they can never answer a half-typed or misspelled name. Everything that can
 * be enumerated cheaply is therefore pulled down once and matched locally:
 * the three index endpoints hand over their whole collection in one request,
 * and items — which have no index — are enumerable by quality within the
 * 10-page search cap, which happens to be exactly the famous ones people type.
 */

export type CatalogKind = "item" | "mount" | "toy" | "pet";

export type CatalogEntry = {
  id: number;
  name: string;
  kind: CatalogKind;
};

export type CatalogSource = {
  /** Stable cache key segment, e.g. "mounts", "items-legendary". */
  id: string;
  kind: CatalogKind;
  /** Human label, e.g. "Mounts". */
  label: string;
  /** 0 loads first. */
  priority: number;
  fetchEntries: (signal?: AbortSignal) => Promise<CatalogEntry[]>;
};

/* ------------------------------------------------------------------ */
/* Wire types                                                          */
/* ------------------------------------------------------------------ */

/**
 * Index entries are `{ id, name }`, but `name` arrives as a plain string when
 * a `locale` is requested and as the full locale map when it is not.
 */
type IndexEntry = {
  id?: unknown;
  name?: LocalizedString | null;
};

type IndexCollection = "mounts" | "toys" | "pets";

type IndexResponse = Partial<Record<IndexCollection, IndexEntry[] | undefined>>;

type ItemSearchPage = {
  page?: number;
  pageCount?: number;
  results?: Array<{ data?: IndexEntry }>;
};

/* ------------------------------------------------------------------ */
/* Shared plumbing                                                     */
/* ------------------------------------------------------------------ */

const ITEM_SEARCH_PATH = "/data/wow/search/item";

/** Blizzard rejects `_page` above this, so a query yields at most 1,000 rows. */
const MAX_SEARCH_PAGES = 10;

/**
 * Small enough to stay polite to the shared rate limit, large enough that the
 * eight legendary pages land in three round trips instead of eight.
 */
const ITEM_PAGE_CONCURRENCY = 3;

const toEntry = (
  kind: CatalogKind,
  raw: IndexEntry | undefined,
): CatalogEntry | undefined => {
  const id = raw?.id;
  if (typeof id !== "number" || !Number.isFinite(id)) {
    return undefined;
  }

  const name = localized(raw?.name).trim();
  return name.length > 0 ? { id, name, kind } : undefined;
};

const collect = (
  kind: CatalogKind,
  raw: ReadonlyArray<IndexEntry | undefined> | undefined,
): CatalogEntry[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  const entries: CatalogEntry[] = [];
  raw.forEach((candidate) => {
    const entry = toEntry(kind, candidate);
    if (entry) {
      entries.push(entry);
    }
  });
  return entries;
};

/* ------------------------------------------------------------------ */
/* Index endpoints                                                     */
/* ------------------------------------------------------------------ */

const fetchIndexEntries = async (
  collection: IndexCollection,
  kind: CatalogKind,
  signal?: AbortSignal,
): Promise<CatalogEntry[]> => {
  const response = await optional404(() =>
    blizzardClient.get<IndexResponse | undefined>(
      `/data/wow/${kind}/index`,
      { namespace: namespace("static") },
      { signal },
    ),
  );

  return collect(kind, response?.[collection]);
};

/* ------------------------------------------------------------------ */
/* Item search                                                         */
/* ------------------------------------------------------------------ */

const itemSearchParams = (
  quality: string,
  page: number,
): Record<string, string | number> => ({
  namespace: namespace("static"),
  "quality.type": quality,
  // `orderby=id` keeps paging stable; without it the window can shift between
  // requests and drop or duplicate rows.
  orderby: "id",
  _pageSize: MAX_SEARCH_PAGE_SIZE,
  _page: page,
});

const itemPageEntries = (page: ItemSearchPage | undefined): CatalogEntry[] =>
  collect(
    "item",
    page?.results?.map((result) => result.data),
  );

const fetchItemEntries = async (
  quality: string,
  signal?: AbortSignal,
): Promise<CatalogEntry[]> => {
  const first = await optional404(() =>
    blizzardClient.get<ItemSearchPage | undefined>(
      ITEM_SEARCH_PATH,
      itemSearchParams(quality, 1),
      { signal },
    ),
  );

  if (!first) {
    return [];
  }

  const entries = itemPageEntries(first);
  const reported =
    typeof first.pageCount === "number" && Number.isFinite(first.pageCount)
      ? first.pageCount
      : 1;
  const pageCount = Math.min(Math.max(reported, 1), MAX_SEARCH_PAGES);

  if (pageCount < 2) {
    return entries;
  }

  const pages = Array.from({ length: pageCount - 1 }, (_, index) => index + 2);
  const settled = await mapWithConcurrency(
    pages,
    ITEM_PAGE_CONCURRENCY,
    (page) =>
      blizzardClient.get<ItemSearchPage | undefined>(
        ITEM_SEARCH_PATH,
        itemSearchParams(quality, page),
        { signal },
      ),
    signal,
  );

  // A page that failed leaves a gap in the suggestions rather than sinking the
  // whole source; `mapWithConcurrency` preserves input order, so the entries
  // stay sorted by id.
  fulfilledValues(settled).forEach((page) => {
    entries.push(...itemPageEntries(page));
  });

  return entries;
};

/* ------------------------------------------------------------------ */
/* The sources                                                         */
/* ------------------------------------------------------------------ */

/**
 * Declaration order is load order. Legendaries and artifacts come first
 * because they are the names people actually half-type (Warglaive, Thunderfury,
 * Shadowmourne); the two thousand battle pets come last.
 */
export const CATALOG_SOURCES: CatalogSource[] = [
  {
    id: "items-legendary",
    kind: "item",
    label: "Legendary items",
    priority: 0,
    fetchEntries: (signal) => fetchItemEntries("LEGENDARY", signal),
  },
  {
    id: "items-artifact",
    kind: "item",
    label: "Artifact items",
    priority: 0,
    fetchEntries: (signal) => fetchItemEntries("ARTIFACT", signal),
  },
  {
    id: "mounts",
    kind: "mount",
    label: "Mounts",
    priority: 1,
    fetchEntries: (signal) => fetchIndexEntries("mounts", "mount", signal),
  },
  {
    id: "toys",
    kind: "toy",
    label: "Toys",
    priority: 2,
    fetchEntries: (signal) => fetchIndexEntries("toys", "toy", signal),
  },
  {
    id: "pets",
    kind: "pet",
    label: "Battle pets",
    priority: 2,
    fetchEntries: (signal) => fetchIndexEntries("pets", "pet", signal),
  },
];
