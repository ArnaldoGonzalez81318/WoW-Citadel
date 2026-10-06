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
  nameParamFromTerms,
  namespace,
  optional404,
} from "@/lib/blizzardHelpers";
import { env } from "@/lib/env";
import { getExternalLink } from "@/lib/externalLinks";
import {
  MAX_SEARCH_PAGE_SIZE,
  narrowByTypedName,
  relaxedNameTerms,
} from "@/lib/nameSearch";
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

  const toSpells = (
    response: SearchResponse<SpellSearchEntry>,
  ): SpellSummary[] =>
    (response.results ?? []).map(({ key, data }) => {
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
    });

  const fetchPage = (
    nameParams: Record<string, readonly string[]>,
    requestPage: number,
    requestPageSize: number,
    sort: string | undefined,
  ): Promise<SearchResponse<SpellSearchEntry> | undefined> =>
    optional404(() =>
      blizzardClient.get<SearchResponse<SpellSearchEntry>>(
        "/data/wow/search/spell",
        {
          namespace: namespace("static"),
          ...(sort ? { orderby: sort } : {}),
          _pageSize: requestPageSize,
          _page: requestPage,
          ...nameParams,
        },
        { signal },
      ),
    );

  const strict = await fetchPage(
    nameParam(trimmedQuery),
    page,
    pageSize,
    "id:desc",
  );
  const spells = strict ? toSpells(strict) : [];

  if (strict && spells.length > 0) {
    return {
      spells,
      page: strict.page ?? page,
      pageCount: strict.pageCount ?? 1,
      ...describeResultCount(strict, spells.length),
    };
  }

  // A half-typed last word matches no whole token, so retry on the completed
  // words ranked by relevance and narrow the candidates by what was typed.
  const relaxed = relaxedNameTerms(trimmedQuery);
  const candidates = relaxed
    ? await fetchPage(
        nameParamFromTerms(relaxed),
        1,
        MAX_SEARCH_PAGE_SIZE,
        undefined,
      )
    : undefined;
  if (!candidates) {
    return emptyPage(page);
  }

  const narrowed = narrowByTypedName(
    toSpells(candidates),
    trimmedQuery,
    (spell) => spell.name,
    { page, pageSize },
  );

  return narrowed.total > 0
    ? { spells: narrowed.results, ...narrowed, capped: false }
    : emptyPage(page);
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
