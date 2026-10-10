import type {
  FactionFacet,
  LocalizedString,
  MountDetail,
  MountFacets,
  MountFactionType,
  MountFilterCriteria,
  MountIndexEntry,
  MountSearchPage,
  MountSummary,
  NamedRef,
  SourceFacet,
  TypedRef,
} from "@/features/mounts/types";
import { createConcurrencyLimiter } from "@/features/pvpTiers/services/concurrencyLimiter";
import { blizzardClient } from "@/lib/blizzardClient";
import type { QueryParams } from "@/lib/blizzardClient";
import {
  cleanMarkup,
  localized,
  mapWithConcurrency,
  namespace,
  optional404,
} from "@/lib/blizzardHelpers";
import { env } from "@/lib/env";
import { formatNumber, humanizeEnum } from "@/lib/format";
import { pickAssetUrl } from "@/lib/mediaAssets";
import type { MediaAsset } from "@/lib/mediaAssets";
import { MAX_SEARCH_PAGE_SIZE } from "@/lib/nameSearch";

/*
 * Blizzard's mount data, as the explorer uses it:
 *
 *   mount/index                     every mount, id + name (1,676 on US)
 *   search/mount                    whole records minus the description;
 *                                   filters on source.type and faction.type,
 *                                   orders by id or name, and takes an OR of
 *                                   ids (id=6||7||8)
 *   mount/{id}                      description and requirements
 *   media/creature-display/{id}     the 600×600 render (shared module)
 *
 * The search stops paging at 1,000 matches, which every filtered list stays
 * under (Vendor, the largest source, has 528) but the whole collection does
 * not. So the unfiltered list pages the index here and fetches each page's
 * 24 records with one OR-of-ids search; a name search ranks the index
 * locally (typos and half-typed words included) and fetches its matches the
 * same way.
 */

/** Cards per page: 2, 3 and 4 columns all end on a full row. */
export const MOUNT_PAGE_SIZE = 24;

/**
 * Every source code Blizzard's mount records use (all 1,676 US mounts
 * checked). The API publishes no index of them; a code that no longer has
 * mounts simply drops out of the filter, and the names shown are the
 * localized ones from the search hits.
 */
export const MOUNT_SOURCE_TYPES = [
  "VENDOR",
  "DROP",
  "ACHIEVEMENT",
  "TRADINGPOST",
  "QUEST",
  "PETSTORE",
  "PROMOTION",
  "WORLDEVENT",
  "PROFESSION",
  "TCG",
  "DISCOVERY",
] as const;

export const MOUNT_FACTION_TYPES: readonly MountFactionType[] = ["ALLIANCE", "HORDE"];

const SEARCH_PATH = "/data/wow/search/mount";

/** The proxy refuses a query value longer than this (server/blizzardProxy.ts). */
const MAX_QUERY_VALUE_LENGTH = 256;

/**
 * The filter strip counts every source with a one-hit search each (its
 * `pageCount` is the count). Eleven to thirteen of them at once would burst
 * through the proxy, which shares Blizzard's per-second quota with every
 * other visitor (and Netlify allows each IP 600 a minute), so they go six at
 * a time; the result pages never wait behind them.
 */
const limitCountFetch = createConcurrencyLimiter(6);

/** A name search fetches at most this many OR-of-ids batches at once. */
const MAX_RECORD_BATCHES_IN_FLIGHT = 3;

/**
 * Blizzard's unfinished records carry a tag in their name ("[PH] Brown Cat
 * Mount", "Green Rocket Mount [PH]", "(PH) Legion Remix Mount", "[DND] Test
 * Mount JZB"; 12 on US) and have no render. Lists that order the index here
 * sink them below every real mount, and the spotlight never draws one.
 */
export const isPlaceholderName = (name: string): boolean => /[[(](?:PH|DND)[\])]/i.test(name);

/* ------------------------------------------------------------------ */
/* Wire types                                                          */
/* ------------------------------------------------------------------ */

type TypedReference = { type?: string; name?: LocalizedString };

type Reference = { id?: number; name?: LocalizedString };

/** A search hit's data; names are locale maps there and strings in a record. */
type MountData = {
  id: number;
  name?: LocalizedString;
  creature_displays?: Array<{ id?: number }>;
  source?: TypedReference;
  faction?: TypedReference;
};

type MountResponse = MountData & {
  description?: LocalizedString | null;
  requirements?: {
    faction?: TypedReference;
    classes?: Reference[];
    races?: Reference[];
  };
  should_exclude_if_uncollected?: boolean;
};

type IndexResponse = {
  mounts?: Array<{ id: number; name?: LocalizedString }>;
};

type SearchResponse = {
  page?: number;
  pageCount?: number;
  resultCountCapped?: boolean;
  results?: Array<{ data: MountData }>;
};

/* ------------------------------------------------------------------ */
/* Mapping                                                             */
/* ------------------------------------------------------------------ */

const toTypedRef = (reference: TypedReference | undefined): TypedRef | undefined => {
  if (!reference?.type) {
    return undefined;
  }
  return {
    type: reference.type,
    name: localized(reference.name) || humanizeEnum(reference.type),
  };
};

const toNamedRefs = (references: Reference[] | undefined, fallback: string): NamedRef[] =>
  (references ?? [])
    .filter((reference): reference is Reference & { id: number } => typeof reference.id === "number")
    .map((reference) => ({
      id: reference.id,
      name: localized(reference.name) || `${fallback} #${reference.id}`,
    }));

const uniqueDisplayIds = (displays: MountData["creature_displays"]): number[] => [
  ...new Set(
    (displays ?? [])
      .map((display) => display.id)
      .filter((id): id is number => typeof id === "number" && id > 0),
  ),
];

const toSummary = (raw: MountData): MountSummary => ({
  id: raw.id,
  name: localized(raw.name) || `Mount #${raw.id}`,
  displayIds: uniqueDisplayIds(raw.creature_displays),
  source: toTypedRef(raw.source),
  faction: toTypedRef(raw.faction),
});

/* ------------------------------------------------------------------ */
/* Requests                                                            */
/* ------------------------------------------------------------------ */

/** One search request; no matches (a 404 on some filters) is `undefined`. */
const searchMounts = (
  params: QueryParams,
  signal?: AbortSignal,
): Promise<SearchResponse | undefined> =>
  optional404(() =>
    blizzardClient.get<SearchResponse>(
      SEARCH_PATH,
      { namespace: namespace("static"), ...params },
      { signal },
    ),
  );

/** Every mount's id and localized name, in Blizzard's order. */
export const fetchMountIndex = async (signal?: AbortSignal): Promise<MountIndexEntry[]> => {
  const response = await blizzardClient.get<IndexResponse>(
    "/data/wow/mount/index",
    { namespace: namespace("static") },
    { signal },
  );
  return (response.mounts ?? []).map((mount) => ({
    id: mount.id,
    name: localized(mount.name) || `Mount #${mount.id}`,
  }));
};

/**
 * `id=6||7||8` terms for `ids`, each short enough for the proxy and at most
 * one full page of hits (four-digit ids fit about 40 to a term).
 */
const idTerms = (ids: readonly number[]): string[] => {
  const terms: string[] = [];
  let batch: string[] = [];
  let length = 0;
  ids.forEach((id) => {
    const text = String(id);
    const grown = batch.length === 0 ? text.length : length + 2 + text.length;
    if (
      batch.length > 0 &&
      (grown > MAX_QUERY_VALUE_LENGTH || batch.length >= MAX_SEARCH_PAGE_SIZE)
    ) {
      terms.push(batch.join("||"));
      batch = [];
    }
    length = batch.length === 0 ? text.length : length + 2 + text.length;
    batch.push(text);
  });
  if (batch.length > 0) {
    terms.push(batch.join("||"));
  }
  return terms;
};

/**
 * The search records for `entries`, in their order. A mount the search does
 * not list (none on US today) keeps its index name with no render rather
 * than vanishing from the page. Any failed batch fails the whole lot, so
 * react-query retries it instead of showing a page with holes.
 */
export const fetchMountRecords = async (
  entries: readonly MountIndexEntry[],
  signal?: AbortSignal,
): Promise<MountSummary[]> => {
  if (entries.length === 0) {
    return [];
  }
  const ids = [...new Set(entries.map((entry) => entry.id))];
  const settled = await mapWithConcurrency(
    idTerms(ids),
    MAX_RECORD_BATCHES_IN_FLIGHT,
    (term) => searchMounts({ id: term, _page: 1, _pageSize: MAX_SEARCH_PAGE_SIZE }, signal),
    signal,
  );
  const byId = new Map<number, MountSummary>();
  for (const result of settled) {
    if (result.status === "rejected") {
      throw result.reason;
    }
    (result.value?.results ?? []).forEach(({ data }) => {
      byId.set(data.id, toSummary(data));
    });
  }
  return entries.map(
    (entry) => byId.get(entry.id) ?? { id: entry.id, name: entry.name, displayIds: [] },
  );
};

/**
 * One page of mounts from a source and/or of a faction, newest (highest id)
 * or A to Z first; the id breaks ties between namesakes ("Whelpling" ×2).
 */
export const searchMountPage = async (
  criteria: MountFilterCriteria,
  page: number,
  signal?: AbortSignal,
): Promise<MountSearchPage> => {
  const response = await searchMounts(
    {
      orderby: criteria.sort === "name" ? `name.${env.locale},id` : "id:desc",
      _page: page,
      _pageSize: MOUNT_PAGE_SIZE,
      ...(criteria.source ? { "source.type": criteria.source } : {}),
      ...(criteria.faction ? { "faction.type": criteria.faction } : {}),
    },
    signal,
  );
  return {
    mounts: (response?.results ?? []).map((entry) => toSummary(entry.data)),
    page: response?.page ?? page,
    pageCount: response?.pageCount ?? 0,
  };
};

type Count = {
  count: number;
  /** The localized name of `pick` on the one hit ("" when none matched). */
  name: string;
};

/** How many mounts match `filters`: with one hit per page, the page count. */
const countMounts = async (
  filters: QueryParams,
  pick: (data: MountData) => TypedReference | undefined,
  signal?: AbortSignal,
): Promise<Count> => {
  const response = await limitCountFetch(
    () => searchMounts({ ...filters, _page: 1, _pageSize: 1 }, signal),
    signal,
  );
  const first = response?.results?.[0]?.data;
  return {
    count: first ? Math.max(1, response?.pageCount ?? 1) : 0,
    name: first ? localized(pick(first)?.name) : "",
  };
};

/**
 * Runs a batch of counts on a signal of its own that also follows `signal`.
 * Promise.all rejects on the first failure but leaves its siblings running;
 * cancelling them makes queued counts leave the limiter and in-flight ones
 * abort, so react-query's retry is not stacked on top of the failed
 * attempt's leftovers (on an endpoint that may be rate-limiting already).
 */
const cancelSiblingsOnFailure = async <T>(
  batch: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> => {
  const local = new AbortController();
  const onAbort = (): void => local.abort(signal?.reason);
  if (signal?.aborted) {
    onAbort();
  } else {
    signal?.addEventListener("abort", onAbort, { once: true });
  }
  try {
    return await batch(local.signal);
  } catch (error) {
    local.abort(error);
    throw error;
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
};

/**
 * Every source and faction with its mount count and localized name: 13
 * one-hit searches, six at a time. One failure fails the lot (react-query
 * retries it) rather than leaving the filter with a hole in it.
 */
export const fetchMountFacets = async (signal?: AbortSignal): Promise<MountFacets> => {
  const [sources, factions] = await cancelSiblingsOnFailure(
    (batchSignal) =>
      Promise.all([
        Promise.all(
          MOUNT_SOURCE_TYPES.map(async (type): Promise<SourceFacet> => {
            const { count, name } = await countMounts(
              { "source.type": type },
              (data) => data.source,
              batchSignal,
            );
            return { type, name: name || humanizeEnum(type), count };
          }),
        ),
        Promise.all(
          MOUNT_FACTION_TYPES.map(async (type): Promise<FactionFacet> => {
            const { count, name } = await countMounts(
              { "faction.type": type },
              (data) => data.faction,
              batchSignal,
            );
            return { type, name: name || humanizeEnum(type), count };
          }),
        ),
      ]),
    signal,
  );
  return {
    sources: sources
      .filter((source) => source.count > 0)
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name)),
    factions,
  };
};

/**
 * Per source, how many of one faction's mounts come from it (11 one-hit
 * searches), so the filter's counts describe what each source would show.
 */
export const fetchFactionSourceCounts = async (
  faction: MountFactionType,
  signal?: AbortSignal,
): Promise<Record<string, number>> => {
  const counts = await cancelSiblingsOnFailure(
    (batchSignal) =>
      Promise.all(
        MOUNT_SOURCE_TYPES.map(async (type) => {
          const { count } = await countMounts(
            { "faction.type": faction, "source.type": type },
            (data) => data.source,
            batchSignal,
          );
          return [type, count] as const;
        }),
      ),
    signal,
  );
  return Object.fromEntries(counts);
};

/** One mount's full record, or null when Blizzard has no such id (404). */
export const fetchMountDetail = async (
  mountId: number,
  signal?: AbortSignal,
): Promise<MountDetail | null> => {
  const raw = await optional404(() =>
    blizzardClient.get<MountResponse>(
      `/data/wow/mount/${mountId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  if (!raw) {
    return null;
  }
  return {
    ...toSummary(raw),
    description: cleanMarkup(localized(raw.description)) || undefined,
    classes: toNamedRefs(raw.requirements?.classes, "Class"),
    races: toNamedRefs(raw.requirements?.races, "Race"),
    hiddenUntilCollected: raw.should_exclude_if_uncollected === true,
  };
};

type MediaResponse = {
  assets?: MediaAsset[];
};

/** A playable class's icon (a required class in the dialog), or null when Blizzard has none (404). */
export const fetchClassIcon = async (
  classId: number,
  signal?: AbortSignal,
): Promise<string | null> => {
  const media = await optional404(() =>
    blizzardClient.get<MediaResponse>(
      `/data/wow/media/playable-class/${classId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  return pickAssetUrl(media?.assets) ?? null;
};

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** "1 mount", "1,676 mounts" with grouped digits. */
export const pluralize = (count: number, one: string, many: string): string =>
  `${formatNumber(count)} ${count === 1 ? one : many}`;

/** The faction code a URL value names ("alliance"), or null. */
export const parseFaction = (value: string): MountFactionType | null => {
  const upper = value.trim().toUpperCase();
  return (MOUNT_FACTION_TYPES as readonly string[]).includes(upper)
    ? (upper as MountFactionType)
    : null;
};

/** The source code a URL value names ("drop"), or null. */
export const parseSource = (value: string): string | null => {
  const upper = value.trim().toUpperCase();
  return (MOUNT_SOURCE_TYPES as readonly string[]).includes(upper) ? upper : null;
};
