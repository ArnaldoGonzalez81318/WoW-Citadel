import type {
  LocalizedString,
  MountDetail,
  MountIndexResponse,
  MountSummary,
} from "@/features/mounts/types";
import { blizzardClient } from "@/lib/blizzardClient";
import {
  cleanMarkup,
  localized,
  nameParam,
  namespace,
  optional404,
} from "@/lib/blizzardHelpers";
import { env } from "@/lib/env";
import { describeResultCount } from "@/lib/resultCount";
import type { ResultCount, SearchPageMeta } from "@/lib/resultCount";

/* ------------------------------------------------------------------ */
/* Query keys                                                          */
/* ------------------------------------------------------------------ */

const MOUNT_KEY_ROOT = ["mounts", env.region, env.locale] as const;

/** react-query key factory; every key is prefixed once with region + locale. */
export const mountKeys = {
  all: MOUNT_KEY_ROOT,
  index: () => [...MOUNT_KEY_ROOT, "index"] as const,
  search: (query: string) => [...MOUNT_KEY_ROOT, "search", query] as const,
  detail: (mountId: number) => [...MOUNT_KEY_ROOT, "detail", mountId] as const,
  displayMedia: (displayId: number | undefined) =>
    [...MOUNT_KEY_ROOT, "display-media", displayId] as const,
};

/* ------------------------------------------------------------------ */
/* Wire types                                                          */
/* ------------------------------------------------------------------ */

type SearchResponse<T> = SearchPageMeta & {
  results?: Array<{
    key: { href: string };
    data: T;
  }>;
  page?: number;
  pageSize?: number;
};

type MountSearchEntry = {
  id: number;
  name: LocalizedString;
  description?: LocalizedString;
  source?: { name?: LocalizedString };
  creature_displays?: Array<{ id: number }>;
};

type MediaAsset = {
  key: string;
  value: string;
};

export type MountSearchPage = ResultCount & {
  mounts: MountSummary[];
  page: number;
  pageCount: number;
};

export const DEFAULT_MOUNT_PAGE_SIZE = 24;

const EMPTY_SEARCH_PAGE: MountSearchPage = {
  mounts: [],
  page: 1,
  pageCount: 1,
  total: 0,
  capped: false,
};

/* ------------------------------------------------------------------ */
/* Fetchers                                                            */
/* ------------------------------------------------------------------ */

export const fetchMountIndex = async (
  signal?: AbortSignal,
): Promise<MountSummary[]> => {
  const response = await blizzardClient.get<MountIndexResponse>(
    "/data/wow/mount/index",
    { namespace: namespace("static") },
    { signal },
  );

  return (response.mounts ?? []).map((mount) => ({
    id: mount.id,
    name: mount.name,
    href: mount.key.href,
  }));
};

/**
 * One page of the mount name search. A blank query or a 404 (no matches)
 * yields an empty page rather than an error.
 */
export const searchMountsDetailed = async (
  query: string,
  page = 1,
  pageSize = DEFAULT_MOUNT_PAGE_SIZE,
  signal?: AbortSignal,
): Promise<MountSearchPage> => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return EMPTY_SEARCH_PAGE;
  }

  const result = await optional404(async (): Promise<MountSearchPage> => {
    const response = await blizzardClient.get<SearchResponse<MountSearchEntry>>(
      "/data/wow/search/mount",
      {
        namespace: namespace("static"),
        orderby: "id:desc",
        _pageSize: pageSize,
        _page: page,
        ...nameParam(trimmedQuery),
      },
      { signal },
    );

    const mounts: MountSummary[] = (response.results ?? []).map(
      ({ key, data }) => ({
        id: data.id,
        name: localized(data.name),
        description: cleanMarkup(localized(data.description)) || undefined,
        source: localized(data.source?.name) || undefined,
        href: key.href,
        displayId: data.creature_displays?.[0]?.id,
      }),
    );

    return {
      mounts,
      page: response.page ?? page,
      pageCount: response.pageCount ?? 1,
      ...describeResultCount(response, mounts.length),
    };
  });

  return result ?? EMPTY_SEARCH_PAGE;
};

export const fetchMountDetail = async (
  mountId: number,
  signal?: AbortSignal,
): Promise<MountDetail> => {
  const response = await blizzardClient.get<{
    _links: { self: { href: string } };
    id: number;
    name: string;
    description?: string;
    source?: { name?: string };
    creature_displays?: Array<{ id: number }>;
  }>(`/data/wow/mount/${mountId}`, { namespace: namespace("static") }, {
    signal,
  });

  return {
    id: response.id,
    name: response.name,
    description: cleanMarkup(response.description) || undefined,
    source: response.source?.name,
    href: response._links.self.href,
    displayId: response.creature_displays?.[0]?.id,
  };
};

export const fetchCreatureDisplayImage = async (
  displayId: number,
  signal?: AbortSignal,
): Promise<string | undefined> =>
  optional404(async () => {
    const response = await blizzardClient.get<{ assets?: MediaAsset[] }>(
      `/data/wow/media/creature-display/${displayId}`,
      { namespace: namespace("static") },
      { signal },
    );

    return (
      response.assets?.find((asset) => asset.key === "zoom")?.value ??
      response.assets?.[0]?.value
    );
  });
