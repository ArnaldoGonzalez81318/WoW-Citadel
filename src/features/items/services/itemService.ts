import type { SearchResult, SearchResultMeta } from "@/features/search/types";
import type {
  ItemClassDetail,
  ItemClassIndexResponse,
  ItemDetail,
  ItemSubclassSummary,
  LocalizedString,
} from "@/features/items/types";
import { blizzardClient } from "@/lib/blizzardClient";
import {
  cleanMarkup,
  localized,
  nameParam,
  namespace,
  optional404,
  sortByName,
} from "@/lib/blizzardHelpers";
import { env } from "@/lib/env";
import { getExternalLink } from "@/lib/externalLinks";
import { describeResultCount } from "@/lib/resultCount";
import type { ResultCount, SearchPageMeta } from "@/lib/resultCount";
import { isQualityKey } from "@/theme";

/* ------------------------------------------------------------------ */
/* Query keys                                                          */
/* ------------------------------------------------------------------ */

const ITEM_KEY_ROOT = ["items", env.region, env.locale] as const;

/** react-query key factory; every key is prefixed once with region + locale. */
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

type SearchHit<T> = {
  key: { href: string };
  data: T;
};

type SearchResponse<T> = SearchPageMeta & {
  page?: number;
  pageSize?: number;
  results?: Array<SearchHit<T>>;
};

type ItemSearchResult = {
  id: number;
  name: LocalizedString;
  level?: number;
  required_level?: number;
  media?: { id?: number };
  quality?: { name?: LocalizedString; type?: string };
  item_class?: { id: number; name?: LocalizedString };
  item_subclass?: { id: number; name?: LocalizedString };
  inventory_type?: { name?: LocalizedString };
};

type MediaAsset = {
  key: string;
  value: string;
};

type MediaResponse = {
  assets?: MediaAsset[];
};

export type ItemGalleryPage = ResultCount & {
  items: SearchResult[];
  page: number;
  pageCount: number;
};

export type ItemGalleryPageOptions = {
  itemClassId: number;
  page: number;
  itemSubclassId?: number;
  query?: string;
  pageSize?: number;
};

export const DEFAULT_ITEM_PAGE_SIZE = 24;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const joinParts = (parts: Array<string | undefined>): string | undefined => {
  const kept = parts.filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  );
  return kept.length > 0 ? kept.join(" · ") : undefined;
};

/** Prefers the `icon` asset, then the first asset of any kind. */
const pickIconAsset = (assets: MediaAsset[] | undefined): string | undefined =>
  assets?.find((asset) => asset.key === "icon")?.value ?? assets?.[0]?.value;

/** Search hit → card result. Quality is conveyed by colour only, never as text. */
export const toItemSearchResult = ({
  key,
  data,
}: SearchHit<ItemSearchResult>): SearchResult => {
  const name = localized(data.name);
  const itemClass = localized(data.item_class?.name);
  const itemSubclass = localized(data.item_subclass?.name);
  const inventoryType = localized(data.inventory_type?.name);
  const qualityType = data.quality?.type?.toLowerCase();
  const quality = isQualityKey(qualityType) ? qualityType : undefined;
  const level = typeof data.level === "number" ? data.level : undefined;
  const requiredLevel =
    typeof data.required_level === "number" ? data.required_level : undefined;
  const subclassLabel =
    itemSubclass && itemSubclass !== itemClass ? itemSubclass : undefined;
  const external = getExternalLink("item", data.id, name);

  const meta: SearchResultMeta[] = [];
  if (level !== undefined && level > 1) {
    meta.push({ label: "Item level", value: String(level) });
  }
  if (requiredLevel !== undefined && requiredLevel > 1) {
    meta.push({ label: "Requires", value: `Level ${requiredLevel}` });
  }

  return {
    id: data.id,
    name,
    href: key.href,
    kind: "item",
    quality,
    subtitle: joinParts([itemClass, subclassLabel]),
    summary: level !== undefined && level > 1 ? `Item level ${level}` : undefined,
    details: joinParts([
      subclassLabel,
      inventoryType,
      requiredLevel !== undefined && requiredLevel > 1
        ? `Requires level ${requiredLevel}`
        : undefined,
    ]),
    tag: inventoryType || undefined,
    typeLabel: undefined,
    meta: meta.length > 0 ? meta : undefined,
    externalUrl: external?.url,
    externalLabel: external?.label,
  };
};

/* ------------------------------------------------------------------ */
/* Fetchers                                                            */
/* ------------------------------------------------------------------ */

export const fetchItemClassIndex = async (
  signal?: AbortSignal,
): Promise<ItemClassIndexResponse> => {
  const response = await blizzardClient.get<ItemClassIndexResponse>(
    "/data/wow/item-class/index",
    { namespace: namespace("static") },
    { signal },
  );

  return {
    ...response,
    item_classes: sortByName(response.item_classes ?? []),
  };
};

export const fetchItemClassDetail = async (
  itemClassId: number,
  signal?: AbortSignal,
): Promise<ItemClassDetail> => {
  const response = await blizzardClient.get<{
    class_id: number;
    name: LocalizedString;
    item_subclasses?: Array<{
      id: number;
      name: LocalizedString;
      key: { href: string };
    }>;
  }>(
    `/data/wow/item-class/${itemClassId}`,
    { namespace: namespace("static") },
    { signal },
  );

  const subclasses: ItemSubclassSummary[] = sortByName(
    (response.item_subclasses ?? []).map((entry) => ({
      id: entry.id,
      name: localized(entry.name),
      key: entry.key,
    })),
  );

  return {
    class_id: response.class_id,
    name: localized(response.name),
    item_subclasses: subclasses,
  };
};

/**
 * One page of the item search for a class (and optional subclass / name).
 * Blizzard answers 404 for some empty filters; that becomes an empty page.
 */
export const fetchItemGalleryPage = async (
  {
    itemClassId,
    page,
    itemSubclassId,
    query,
    pageSize = DEFAULT_ITEM_PAGE_SIZE,
  }: ItemGalleryPageOptions,
  signal?: AbortSignal,
): Promise<ItemGalleryPage> => {
  const trimmedQuery = query?.trim() ?? "";

  const result = await optional404(async (): Promise<ItemGalleryPage> => {
    const response = await blizzardClient.get<SearchResponse<ItemSearchResult>>(
      "/data/wow/search/item",
      {
        namespace: namespace("static"),
        orderby: "level:desc,id:desc",
        _pageSize: pageSize,
        _page: page,
        "item_class.id": itemClassId,
        ...(itemSubclassId !== undefined
          ? { "item_subclass.id": itemSubclassId }
          : {}),
        ...(trimmedQuery ? nameParam(trimmedQuery) : {}),
      },
      { signal },
    );

    const items = (response.results ?? [])
      .map(toItemSearchResult)
      .filter((item) => item.name.length > 0);

    return {
      items,
      page: response.page ?? page,
      pageCount: response.pageCount ?? 1,
      ...describeResultCount(response, items.length),
    };
  });

  return result ?? { items: [], page, pageCount: 1, total: 0, capped: false };
};

export const fetchItemMediaUrl = async (
  itemId: number,
  signal?: AbortSignal,
): Promise<string | undefined> =>
  optional404(async () => {
    const response = await blizzardClient.get<MediaResponse>(
      `/data/wow/media/item/${itemId}`,
      { namespace: namespace("static") },
      { signal },
    );

    return pickIconAsset(response.assets);
  });

export const fetchItemDetail = async (
  itemId: number,
  signal?: AbortSignal,
): Promise<ItemDetail> => {
  const response = await blizzardClient.get<{
    _links: { self: { href: string } };
    id: number;
    name: LocalizedString;
    description?: LocalizedString;
    level?: number;
    required_level?: number;
    is_equippable?: boolean;
    max_count?: number;
    purchase_price?: number;
    sell_price?: number;
    quality?: { name?: LocalizedString };
    preview_item?: {
      item_class?: { name?: LocalizedString };
      item_subclass?: { name?: LocalizedString };
      inventory_type?: { name?: LocalizedString };
      binding?: { name?: LocalizedString };
    };
  }>(`/data/wow/item/${itemId}`, { namespace: namespace("static") }, { signal });

  return {
    id: response.id,
    name: localized(response.name),
    href: response._links.self.href,
    description: cleanMarkup(localized(response.description)) || undefined,
    quality: localized(response.quality?.name) || undefined,
    level: response.level,
    requiredLevel: response.required_level,
    itemClass: localized(response.preview_item?.item_class?.name) || undefined,
    itemSubclass:
      localized(response.preview_item?.item_subclass?.name) || undefined,
    inventoryType:
      localized(response.preview_item?.inventory_type?.name) || undefined,
    binding: localized(response.preview_item?.binding?.name) || undefined,
    isEquippable: response.is_equippable,
    maxCount: response.max_count,
    purchasePrice: response.purchase_price,
    sellPrice: response.sell_price,
  };
};
