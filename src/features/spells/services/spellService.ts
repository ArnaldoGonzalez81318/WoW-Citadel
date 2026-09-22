import type {
  LocalizedString,
  SpellDetail,
  SpellMedia,
  SpellSummary,
} from "@/features/spells/types";
import { blizzardClient } from "@/lib/blizzardClient";
import {
  cleanMarkup,
  localized,
  nameParam,
  namespace,
  optional404,
} from "@/lib/blizzardHelpers";
import { env } from "@/lib/env";
import { getExternalLink } from "@/lib/externalLinks";
import { describeResultCount } from "@/lib/resultCount";
import type { ResultCount, SearchPageMeta } from "@/lib/resultCount";

/* ------------------------------------------------------------------ */
/* Query keys                                                          */
/* ------------------------------------------------------------------ */

const SPELL_KEY_ROOT = ["spells", env.region, env.locale] as const;

/** react-query key factory; every key is prefixed once with region + locale. */
export const spellKeys = {
  all: SPELL_KEY_ROOT,
  search: (query: string) => [...SPELL_KEY_ROOT, "search", query] as const,
  icon: (spellId: number) => [...SPELL_KEY_ROOT, "icon", spellId] as const,
  detail: (spellId: number) => [...SPELL_KEY_ROOT, "detail", spellId] as const,
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

type SpellSearchEntry = {
  id: number;
  name: LocalizedString;
  description?: LocalizedString;
};

export type SpellGalleryPage = ResultCount & {
  spells: SpellSummary[];
  page: number;
  pageCount: number;
};

export const DEFAULT_SPELL_PAGE_SIZE = 24;

const emptyPage = (page: number): SpellGalleryPage => ({
  spells: [],
  page,
  pageCount: 1,
  total: 0,
  capped: false,
});

/* ------------------------------------------------------------------ */
/* Fetchers                                                            */
/* ------------------------------------------------------------------ */

/**
 * One page of the spell name search. A blank query or a 404 (no matches)
 * yields an empty page rather than an error.
 */
export const searchSpellsDetailed = async (
  query: string,
  page = 1,
  pageSize = DEFAULT_SPELL_PAGE_SIZE,
  signal?: AbortSignal,
): Promise<SpellGalleryPage> => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return emptyPage(1);
  }

  const result = await optional404(async (): Promise<SpellGalleryPage> => {
    const response = await blizzardClient.get<SearchResponse<SpellSearchEntry>>(
      "/data/wow/search/spell",
      {
        namespace: namespace("static"),
        orderby: "id:desc",
        _pageSize: pageSize,
        _page: page,
        ...nameParam(trimmedQuery),
      },
      { signal },
    );

    const spells: SpellSummary[] = (response.results ?? []).map(
      ({ key, data }) => {
        const name = localized(data.name);
        const external = getExternalLink("spell", data.id, name);

        return {
          id: data.id,
          name,
          description: cleanMarkup(localized(data.description)),
          href: key.href,
          kind: "spell",
          externalUrl: external?.url,
          externalLabel: external?.label,
        };
      },
    );

    return {
      spells,
      page: response.page ?? page,
      pageCount: response.pageCount ?? 1,
      ...describeResultCount(response, spells.length),
    };
  });

  return result ?? emptyPage(page);
};

export const fetchSpellDetail = async (
  spellId: number,
  signal?: AbortSignal,
): Promise<SpellDetail> => {
  const response = await blizzardClient.get<{
    _links: { self: { href: string } };
    id: number;
    name: string;
    description?: string;
    media?: { key?: { href?: string } };
  }>(`/data/wow/spell/${spellId}`, { namespace: namespace("static") }, {
    signal,
  });

  return {
    id: response.id,
    name: response.name,
    description: cleanMarkup(response.description),
    mediaHref: response.media?.key?.href,
    href: response._links.self.href,
  };
};

/**
 * Icon URL for a spell, or `null` when Blizzard has no media for it (404 or
 * an empty asset list). Never `undefined`: react-query rejects a queryFn
 * that resolves to it.
 */
export const fetchSpellIcon = async (
  spellId: number,
  signal?: AbortSignal,
): Promise<string | null> => {
  const url = await optional404(async () => {
    const response = await blizzardClient.get<SpellMedia>(
      `/data/wow/media/spell/${spellId}`,
      { namespace: namespace("static") },
      { signal },
    );

    return (
      response.assets?.find((asset) => asset.key === "icon")?.value ??
      response.assets?.[0]?.value
    );
  });

  return url ?? null;
};
