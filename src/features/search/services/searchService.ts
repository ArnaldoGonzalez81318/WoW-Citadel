import type { EntityKind, SearchResult } from "@/features/search/types";
import { blizzardClient } from "@/lib/blizzardClient";
import {
  cleanMarkup,
  localized,
  nameParam,
  namespace,
  optional404,
} from "@/lib/blizzardHelpers";
import type { LocalizedString } from "@/lib/blizzardHelpers";
import { getExternalLink } from "@/lib/externalLinks";
import { isQualityKey } from "@/theme";

/** Results per page; the Pagination and the "Showing 1–24" summary derive from it. */
export const SEARCH_PAGE_SIZE = 24;

export type SearchPage = {
  results: SearchResult[];
  page: number;
  pageCount: number;
  /** Total matches when Blizzard reports one; never fabricated. */
  total?: number;
};

export type SearchFetchOptions = {
  page?: number;
  signal?: AbortSignal;
};

export type SearchFetcher = (
  query: string,
  options?: SearchFetchOptions,
) => Promise<SearchPage>;

type SearchResponse<T> = {
  page?: number;
  pageSize?: number;
  pageCount?: number;
  resultCountTotal?: number;
  results?: Array<{
    key: { href: string };
    data: T;
  }>;
};

type ItemSearchResult = {
  id: number;
  name: LocalizedString;
  level?: number;
  item_class?: { name?: LocalizedString };
  item_subclass?: { name?: LocalizedString };
  inventory_type?: { name?: LocalizedString };
  quality?: { type?: string; name?: LocalizedString };
  media?: { id: number };
};

type SpellSearchResult = {
  id: number;
  name: LocalizedString;
  description?: LocalizedString;
  media?: { id: number };
};

type MountSearchResult = {
  id: number;
  name: LocalizedString;
  description?: LocalizedString;
  source?: { name?: LocalizedString };
  faction?: { name?: LocalizedString };
  is_flying_mount?: boolean;
};

type CreatureSearchResult = {
  id: number;
  name: LocalizedString;
  description?: LocalizedString;
  level?: number;
  type?: { name?: LocalizedString };
  creature_type?: { name?: LocalizedString };
  creature_family?: { name?: LocalizedString };
};

const EMPTY_PAGE: SearchPage = { results: [], page: 1, pageCount: 1, total: 0 };

const emptyPage = (): SearchPage => ({ ...EMPTY_PAGE, results: [] });

type SearchEntry<T> = NonNullable<SearchResponse<T>["results"]>[number];

/** Joins the non-empty parts with the meta separator used across the app. */
const joinParts = (parts: Array<string | undefined>): string =>
  parts.filter((part): part is string => Boolean(part)).join(" · ");

const externalFields = (
  kind: EntityKind,
  id: number,
  name: string,
): Pick<SearchResult, "kind" | "externalUrl" | "externalLabel"> => {
  const link = getExternalLink(kind, id, name);
  return {
    kind,
    externalUrl: link?.url,
    externalLabel: link?.label,
  };
};

const runSearch = async <T>(
  path: string,
  orderby: string,
  query: string,
  { page = 1, signal }: SearchFetchOptions,
  mapper: (entry: SearchEntry<T>) => SearchResult,
): Promise<SearchPage> => {
  const trimmed = query.trim();
  if (!trimmed) {
    return emptyPage();
  }

  const response = await optional404(() =>
    blizzardClient.get<SearchResponse<T>>(
      path,
      {
        namespace: namespace("static"),
        orderby,
        _page: page,
        _pageSize: SEARCH_PAGE_SIZE,
        ...nameParam(trimmed),
      },
      { signal },
    ),
  );

  if (!response) {
    return emptyPage();
  }

  return {
    results: (response.results ?? [])
      .map(mapper)
      .filter((item) => Boolean(item.name)),
    page: response.page ?? page,
    pageCount: response.pageCount ?? 1,
    total: response.resultCountTotal,
  };
};

export const searchItems: SearchFetcher = (query, options = {}) =>
  runSearch<ItemSearchResult>(
    "/data/wow/search/item",
    "level:desc",
    query,
    options,
    ({ key, data }) => {
      const name = localized(data.name);
      const itemClass = localized(data.item_class?.name);
      const itemSubclass = localized(data.item_subclass?.name);
      const inventoryType = localized(data.inventory_type?.name);
      const qualityType = data.quality?.type?.toLowerCase();
      const quality = isQualityKey(qualityType) ? qualityType : undefined;
      const qualityName = localized(data.quality?.name);
      const itemLevel =
        typeof data.level === "number" && data.level > 0
          ? `Item level ${data.level}`
          : undefined;
      const classLabel = joinParts([
        itemClass,
        itemSubclass && itemSubclass !== itemClass ? itemSubclass : undefined,
      ]);

      const meta: SearchResult["meta"] = [];
      if (typeof data.level === "number" && data.level > 0) {
        meta.push({ label: "Item level", value: String(data.level) });
      }
      if (inventoryType) {
        meta.push({ label: "Slot", value: inventoryType });
      }
      if (qualityName) {
        meta.push({ label: "Quality", value: qualityName });
      }

      return {
        id: data.id,
        name,
        href: key.href,
        summary: joinParts([itemLevel, classLabel]),
        details: inventoryType,
        typeLabel: itemClass || "Item",
        subtitle: joinParts([itemLevel, classLabel || undefined]) || undefined,
        quality,
        meta,
        ...externalFields("item", data.id, name),
      };
    },
  );

export const searchSpells: SearchFetcher = (query, options = {}) =>
  runSearch<SpellSearchResult>(
    "/data/wow/search/spell",
    "id:desc",
    query,
    options,
    ({ key, data }) => {
      const name = localized(data.name);
      const description = cleanMarkup(localized(data.description));

      return {
        id: data.id,
        name,
        href: key.href,
        summary: "Spell",
        details: description,
        typeLabel: "Spell",
        subtitle: description || undefined,
        meta: [],
        ...externalFields("spell", data.id, name),
      };
    },
  );

export const searchMounts: SearchFetcher = (query, options = {}) =>
  runSearch<MountSearchResult>(
    "/data/wow/search/mount",
    "id:desc",
    query,
    options,
    ({ key, data }) => {
      const name = localized(data.name);
      const source = localized(data.source?.name);
      const affiliation = localized(data.faction?.name);
      const tag = data.is_flying_mount ? "Flying" : undefined;

      const meta: SearchResult["meta"] = [];
      if (source) {
        meta.push({ label: "Source", value: source });
      }
      if (affiliation) {
        meta.push({ label: "Faction", value: affiliation });
      }

      return {
        id: data.id,
        name,
        href: key.href,
        summary: source,
        details: cleanMarkup(localized(data.description)),
        typeLabel: "Mount",
        tag: tag ?? (affiliation || undefined),
        subtitle: joinParts([source, tag]) || undefined,
        meta,
        ...externalFields("mount", data.id, name),
      };
    },
  );

export const searchCreatures: SearchFetcher = (query, options = {}) =>
  runSearch<CreatureSearchResult>(
    "/data/wow/search/creature",
    "level:desc",
    query,
    options,
    ({ key, data }) => {
      const name = localized(data.name);
      const type = localized(data.type?.name ?? data.creature_type?.name);
      const family = localized(data.creature_family?.name);
      const level =
        typeof data.level === "number" && data.level > 0
          ? `Level ${data.level}`
          : undefined;

      const meta: SearchResult["meta"] = [];
      if (level) {
        meta.push({ label: "Level", value: String(data.level) });
      }
      if (type) {
        meta.push({ label: "Type", value: type });
      }
      if (family) {
        meta.push({ label: "Family", value: family });
      }

      return {
        id: data.id,
        name,
        href: key.href,
        summary: joinParts([level, type, family]) || undefined,
        details: cleanMarkup(localized(data.description)),
        typeLabel: "Creature",
        subtitle: joinParts([level, type]) || undefined,
        meta,
        ...externalFields("npc", data.id, name),
      };
    },
  );
