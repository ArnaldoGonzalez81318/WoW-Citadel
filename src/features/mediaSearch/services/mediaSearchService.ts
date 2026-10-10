import { blizzardClient } from "@/lib/blizzardClient";
import type { QueryParams } from "@/lib/blizzardClient";
import {
  cleanMarkup,
  localized,
  namespace,
  optional404,
} from "@/lib/blizzardHelpers";
import type { LocalizedString } from "@/lib/blizzardHelpers";
import { pickAssetUrl } from "@/lib/mediaAssets";
import {
  MEDIA_TAG_IDS,
  isMediaTag,
  kindConfig,
  tagConfig,
} from "@/features/mediaSearch/config/mediaKinds";
import type {
  AssetVariant,
  MediaAsset,
  MediaOrder,
  MediaPage,
  MediaRecord,
  MediaScope,
  MediaTagId,
  MediaTagSummary,
} from "@/features/mediaSearch/types";

/*
 * Blizzard's media search (`/data/wow/search/media`) is an index of every
 * media record the game data API serves, probed on US:
 *
 *   - `tags` narrows it to one kind (19 tags answer; see MEDIA_TAGS).
 *   - `orderby=id` / `id:desc` and `id=[a,b]` ranges (either end open) read
 *     the record's own `id` field, which journal instances, covenants and
 *     tech talents lack, which an Azerite essence sets to its first major
 *     power's spell (essence 37 sits at 312725) and which a talent tree's
 *     specialization art sets to the tree.
 *   - `_pageSize` goes up to 1,000, but no search returns more than 1,000
 *     results (`resultCountCapped`): past that, a new search starting after
 *     the last id seen is the only way further.
 *   - `pageCount` is the result count divided by the page size, so a
 *     one-result page counts the matches (up to that cap).
 *
 * The media endpoints (`/data/wow/media/{kind}/{id}`) answer for most
 * kinds, but 404 for glyphs and talent tree art, which only the search
 * finds.
 */

/** Grid page size; see LAYOUTS for why 96. */
export const MEDIA_PAGE_SIZE = 96;
/** Blizzard's maximum page, and its cap on any one search. */
export const SEARCH_RESULT_CAP = 1000;
/** Every kind sharing one id (id 62 has four records on US) fits easily. */
const LOOKUP_PAGE_SIZE = 100;

type RawAsset = {
  key?: string;
  value?: string;
  file_data_id?: number;
};

type RawMediaData = {
  id?: number;
  assets?: RawAsset[];
};

type SearchResponse = {
  page?: number;
  pageCount?: number;
  resultCountCapped?: boolean;
  results?: Array<{ key?: { href?: string }; data?: RawMediaData }>;
};

type MediaEndpointResponse = RawMediaData & {
  _links?: { self?: { href?: string } };
};

type OwnerResponse = {
  name?: LocalizedString;
};

/* ------------------------------------------------------------------ */
/* Paths and records                                                   */
/* ------------------------------------------------------------------ */

/**
 * A media path: lowercase kind segments and numeric ids, ending in an id
 * ("item/19019", "talent-tree/795/hero-talent/18"). Also the shape the
 * `media` URL parameter must have before it is ever sent to the proxy.
 */
const MEDIA_PATH = /^[a-z][a-z-]*(?:\/(?:[a-z][a-z-]*|\d{1,10}))*\/\d{1,10}$/u;
const HREF_PATH = /\/data\/wow\/media\/([^?#]+)/u;

export const isMediaPath = (value: string): boolean =>
  value.length <= 120 && MEDIA_PATH.test(value);

export type ParsedMediaPath = {
  path: string;
  id: number;
  kind: string;
  parentIds: number[];
};

/** "talent-tree/795/hero-talent/18" -> kind "talent-tree/hero-talent", parents [795], id 18. */
export const parseMediaPath = (value: string): ParsedMediaPath | null => {
  if (!isMediaPath(value)) {
    return null;
  }
  const segments = value.split("/");
  const numbers = segments.filter((segment) => /^\d+$/u.test(segment)).map(Number);
  const id = numbers[numbers.length - 1];
  return {
    path: value,
    id,
    kind: segments.filter((segment) => !/^\d+$/u.test(segment)).join("/"),
    parentIds: numbers.slice(0, -1),
  };
};

/** Same key and URL listed twice (talent trees list one icon three times). */
const toAssets = (raw: RawAsset[] | undefined): MediaAsset[] => {
  const seen = new Set<string>();
  const assets: MediaAsset[] = [];
  (raw ?? []).forEach((asset) => {
    if (typeof asset.value !== "string" || asset.value.length === 0) {
      return;
    }
    const key = asset.key || "image";
    const identity = `${key}|${asset.value}`;
    if (seen.has(identity)) {
      return;
    }
    seen.add(identity);
    assets.push({
      key,
      url: asset.value,
      fileDataId:
        typeof asset.file_data_id === "number" ? asset.file_data_id : null,
    });
  });
  return assets;
};

const toRecord = (
  href: string | undefined,
  data: RawMediaData | undefined,
): MediaRecord | null => {
  const raw = HREF_PATH.exec(href ?? "")?.[1];
  const parsed = raw ? parseMediaPath(raw) : null;
  if (!parsed) {
    return null;
  }
  return {
    ...parsed,
    searchId: typeof data?.id === "number" ? data.id : null,
    assets: toAssets(data?.assets),
  };
};

const toRecords = (response: SearchResponse | undefined): MediaRecord[] =>
  (response?.results ?? [])
    .map((result) => toRecord(result.key?.href, result.data))
    .filter((record): record is MediaRecord => record !== null);

const search = (
  params: QueryParams,
  signal?: AbortSignal,
): Promise<SearchResponse> =>
  blizzardClient.get<SearchResponse>(
    "/data/wow/search/media",
    { namespace: namespace("static"), ...params },
    { signal },
  );

/** The `id` range a page starts from: inclusive, open towards the order's end. */
const idRange = (order: MediaOrder, from: number): string =>
  order === "newest" ? `[,${from}]` : `[${from},]`;

/* ------------------------------------------------------------------ */
/* Tag summaries                                                       */
/* ------------------------------------------------------------------ */

/**
 * How far a tag looks past an assetless newest record for one with art.
 * One more request, never a per-record fan-out.
 */
const SAMPLE_CANDIDATES = 10;

/**
 * The image a parsed record should be shown by: `pickAssetUrl`'s preference
 * over its assets (icon first, then the wider artwork keys), translated from
 * the record's `url` back to the wire's `value`.
 */
export const recordAssetUrl = (
  record: MediaRecord | null | undefined,
): string | undefined =>
  pickAssetUrl(
    record?.assets.map((asset) => ({ key: asset.key, value: asset.url })),
  );

/**
 * A tag's result count and a sample record (its newest, where the tag
 * sorts; whichever Blizzard returns first otherwise), from a one-result
 * page. Counts stop at 1,000 (`capped`).
 *
 * Blizzard lists some records in the media index with no asset at all — the
 * newest keystone affix (178) and most retired glyphs among them — and the
 * newest is exactly the one a sortable tag asks for. When that record has no
 * image, one further request looks a few records deeper, so the tag's tile
 * shows the kind's artwork instead of a letter. The count still comes from
 * the one-result page, where `pageCount` *is* the result count.
 *
 * Three tiles (achievements, creature renders, battle pets) nevertheless show
 * a letter, and `id:desc` is why: a kind's newest record is the one whose file
 * Blizzard has least often published, so the asset is advertised while the
 * image answers 403 AccessDenied until the patch ships. Dropping the sort is
 * NOT the fix — glyphs need it exactly the other way round (1 of Blizzard's
 * first 15 glyph records carries an asset, against 10 of the newest 10), and
 * sampling a deeper page for everyone would cost a second request per tag on
 * first paint to decorate a 40 px tile. An asset that 403s cannot be told from
 * a live one without fetching the image, so the letter stays: it is the same
 * unpublished-artwork case the record grid shows, correctly, further down.
 */
export const fetchMediaTagSummary = async (
  tag: MediaTagId,
  signal?: AbortSignal,
): Promise<MediaTagSummary> => {
  const orderby = tagConfig(tag).sortable ? "id:desc" : undefined;
  const response = await search(
    { tags: tag, orderby, _page: 1, _pageSize: 1 },
    signal,
  );
  const newest = toRecords(response)[0] ?? null;
  const summary: MediaTagSummary = {
    count: response.pageCount ?? 0,
    capped: response.resultCountCapped === true,
    sample: newest,
  };

  if (newest === null || recordAssetUrl(newest) !== undefined) {
    return summary;
  }

  const deeper = await search(
    { tags: tag, orderby, _page: 1, _pageSize: SAMPLE_CANDIDATES },
    signal,
  );
  const withArt = toRecords(deeper).find(
    (record) => recordAssetUrl(record) !== undefined,
  );
  return { ...summary, sample: withArt ?? newest };
};

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

export type MediaPageRequest = {
  scope: MediaScope;
  order: MediaOrder;
  /** The id this search starts at (inclusive), or null for the first id. */
  from: number | null;
  page: number;
};

/** One page of a sortable tag (or everything), sorted and windowed by Blizzard. */
export const fetchMediaPage = async (
  request: MediaPageRequest,
  signal?: AbortSignal,
): Promise<MediaPage> => {
  const response = await search(
    {
      tags: request.scope === "all" ? undefined : request.scope,
      orderby: request.order === "newest" ? "id:desc" : "id",
      id: request.from === null ? undefined : idRange(request.order, request.from),
      _page: request.page,
      _pageSize: MEDIA_PAGE_SIZE,
    },
    signal,
  );
  return {
    records: toRecords(response),
    page: response.page ?? request.page,
    pageCount: response.pageCount ?? 0,
    capped: response.resultCountCapped === true,
  };
};

/**
 * A whole unsortable tag (journal instances, covenants, tech talents, Azerite
 * essences, talent trees: 504 records at most), in one request. Blizzard
 * returns them in no useful order, so the page sorts them by the id in their
 * path, and looks ids up in this list too.
 */
export const fetchMediaTagList = async (
  tag: MediaTagId,
  signal?: AbortSignal,
): Promise<MediaRecord[]> =>
  toRecords(
    await search({ tags: tag, _page: 1, _pageSize: SEARCH_RESULT_CAP }, signal),
  );

/** A page of a list the browser sorted itself, in the same shape as Blizzard's pages. */
export const pageOfList = (
  records: readonly MediaRecord[],
  order: MediaOrder,
  page: number,
): MediaPage => {
  const sorted = [...records].sort((left, right) =>
    order === "newest" ? right.id - left.id : left.id - right.id,
  );
  return {
    records: sorted.slice((page - 1) * MEDIA_PAGE_SIZE, page * MEDIA_PAGE_SIZE),
    page,
    pageCount: Math.ceil(sorted.length / MEDIA_PAGE_SIZE),
    capped: false,
  };
};

/**
 * Where the next search starts once a capped one runs out of pages: at the
 * last record's indexed id. Everything mixes kinds that share ids, so it
 * starts at that id again (a record or two may repeat) rather than skip
 * ones the cap cut off; a single tag's ids are unique, so it steps past.
 */
export const nextWindowStart = (
  scope: MediaScope,
  order: MediaOrder,
  last: MediaRecord | undefined,
): number | null => {
  const id = last?.searchId;
  if (typeof id !== "number") {
    return null;
  }
  if (scope === "all") {
    return id;
  }
  const next = order === "newest" ? id - 1 : id + 1;
  return next >= 0 ? next : null;
};

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

const fetchMediaEndpoint = async (
  path: string,
  signal?: AbortSignal,
): Promise<MediaRecord | undefined> => {
  const response = await optional404(() =>
    blizzardClient.get<MediaEndpointResponse>(
      `/data/wow/media/${path}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  if (!response) {
    return undefined;
  }
  // The endpoint omits `id` for some kinds; the path always has it.
  return (
    toRecord(response._links?.self?.href ?? `/data/wow/media/${path}`, response) ??
    undefined
  );
};

const byKindThenPath = (left: MediaRecord, right: MediaRecord): number =>
  kindConfig(left.kind).label.localeCompare(kindConfig(right.kind).label) ||
  left.path.localeCompare(right.path);

/** The records whose own id (the last path segment) is `id`, by kind then path. */
export const recordsWithId = (
  records: readonly MediaRecord[],
  id: number,
): MediaRecord[] =>
  records.filter((record) => record.id === id).sort(byKindThenPath);

/** A whole tag, from wherever the caller keeps it (the grid's cached list query). */
export type MediaTagListLoader = (tag: MediaTagId) => Promise<readonly MediaRecord[]>;

/**
 * Every record whose own id is `id`, in a tag or in any kind. The search
 * filters on the indexed id, which only the sortable tags share with their
 * paths. An unsortable tag is looked up in its whole list (`loadList`, the
 * list the grid caches); Everything asks the unsortable kinds' media
 * endpoints instead (a 404 there just means none), save talent tree art,
 * which has none and comes from its list. Search matches indexed under
 * another id (Azerite essence 37 at 312725) are left out: the cards, and
 * the lookup's heading, read the record's own id.
 */
export const lookupMediaById = async (
  scope: MediaScope,
  id: number,
  loadList: MediaTagListLoader,
  signal?: AbortSignal,
): Promise<MediaRecord[]> => {
  if (scope !== "all" && !tagConfig(scope).sortable) {
    return recordsWithId(await loadList(scope), id);
  }

  const unsortable =
    scope === "all" ? MEDIA_TAG_IDS.filter((tag) => !tagConfig(tag).sortable) : [];
  const [response, ...direct] = await Promise.all([
    search(
      {
        tags: scope === "all" ? undefined : scope,
        id,
        _page: 1,
        _pageSize: LOOKUP_PAGE_SIZE,
      },
      signal,
    ),
    ...unsortable.map(
      async (tag): Promise<readonly (MediaRecord | undefined)[]> =>
        tagConfig(tag).searchOnly
          ? loadList(tag)
          : [await fetchMediaEndpoint(`${tag}/${id}`, signal)],
    ),
  ]);

  const records = new Map<string, MediaRecord>();
  [...toRecords(response), ...direct.flat()].forEach((record) => {
    if (record) {
      records.set(record.path, record);
    }
  });
  return recordsWithId([...records.values()], id);
};

/**
 * One record by path, for a shared link. The media endpoint answers for
 * most kinds; glyphs and talent tree art 404 there, so the search is asked
 * for the id and then the parent id before it (a talent tree's
 * specialization art is indexed under the tree's id, not the
 * specialization's). Null when neither knows it.
 */
export const fetchMediaRecord = async (
  path: string,
  signal?: AbortSignal,
): Promise<MediaRecord | null> => {
  const parsed = parseMediaPath(path);
  if (!parsed) {
    return null;
  }

  const root = parsed.kind.split("/")[0];
  const tag = isMediaTag(root) ? root : undefined;
  // No point asking an endpoint that 404s for every record of its kind.
  const direct =
    tag && tagConfig(tag).searchOnly ? undefined : await fetchMediaEndpoint(path, signal);
  if (direct) {
    return direct;
  }

  // Real paths have at most one parent id; a crafted link with dozens must
  // not turn into dozens of searches in a row.
  const candidates = Array.from(new Set([parsed.id, ...parsed.parentIds.slice(-1)]));
  for (const id of candidates) {
    const response = await search(
      {
        tags: tag,
        id,
        _page: 1,
        _pageSize: LOOKUP_PAGE_SIZE,
      },
      signal,
    );
    const match = toRecords(response).find((record) => record.path === path);
    if (match) {
      return match;
    }
  }
  return null;
};

/* ------------------------------------------------------------------ */
/* Owners                                                              */
/* ------------------------------------------------------------------ */

/** Recipe names end in a quality atlas tag: "Refine Duskshrouded Stone |A:Professions-…|a". */
const stripAtlasMarkup = (value: string): string =>
  value.replace(/\|A:[^|]*\|a/gu, "");

/**
 * The name of the record a media belongs to ("Thunderfury, Blessed Blade of
 * the Windseeker" for item/19019), or null when the kind has no such record
 * or Blizzard no longer has it (404).
 */
export const fetchMediaOwnerName = async (
  kind: string,
  id: number,
  signal?: AbortSignal,
): Promise<string | null> => {
  const ownerPath = kindConfig(kind).ownerPath;
  if (!ownerPath) {
    return null;
  }
  const owner = await optional404(() =>
    blizzardClient.get<OwnerResponse>(
      `/data/wow/${ownerPath}/${id}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  const name = cleanMarkup(stripAtlasMarkup(localized(owner?.name)));
  return name.length > 0 ? name : null;
};

/* ------------------------------------------------------------------ */
/* Sizes the render CDN serves                                         */
/* ------------------------------------------------------------------ */

/** `…/icons/56/5948061.jpg`: numbered icons also come at 36 and 18 px. */
const NUMBERED_ICON = /^(https:\/\/render\.worldofwarcraft\.com\/[a-z]+\/icons\/)56(\/\d+\.jpg)$/u;
/** `…/zones/the-stonecore-small.jpg` (600 × 300) has a 2400 × 1200 `-large` twin. */
const ZONE_TILE = /^(https:\/\/render\.worldofwarcraft\.com\/[a-z]+\/zones\/.+)-small\.jpg$/u;

const ICON_SIZES = [56, 36, 18] as const;

/**
 * Each size of an asset, largest first. Only the original URL comes from
 * Blizzard; the other sizes follow the CDN's naming (verified on sample
 * files), so the dialog previews each and says so when one is missing.
 */
export const assetVariants = (asset: MediaAsset): AssetVariant[] => {
  const icon = NUMBERED_ICON.exec(asset.url);
  if (icon) {
    return ICON_SIZES.map((size) => ({
      label: `${size} px`,
      url: `${icon[1]}${size}${icon[2]}`,
      nominalSize: `${size} × ${size}`,
      original: size === 56,
      natural: true,
    }));
  }

  const zone = ZONE_TILE.exec(asset.url);
  if (zone) {
    return [
      {
        label: "Large",
        url: `${zone[1]}-large.jpg`,
        nominalSize: "2400 × 1200",
        original: false,
        natural: false,
      },
      {
        label: "Small",
        url: asset.url,
        nominalSize: "600 × 300",
        original: true,
        natural: false,
      },
    ];
  }

  // Creature renders (600 × 600), hero talent atlases (140 × 140) and guild
  // crest pieces (PNG, about 125 px): one size each, measured on load.
  return [
    {
      label: "Original",
      url: asset.url,
      original: true,
      natural: asset.key !== "zoom",
    },
  ];
};
