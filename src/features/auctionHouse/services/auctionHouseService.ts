/**
 * Auction House data access.
 *
 * DOCUMENTED DECISION (F017): Blizzard's regional commodities dump is 10-40 MB
 * of JSON and a connected-realm dump is several MB. The right fix is a
 * server-side `/_derived/` aggregation inside `proxyBlizzardRequest`
 * (server/blizzardProxy.ts) with CDN cache headers; that route is deferred
 * to a server follow-up.
 *
 * Until it lands the client stream-parses a *bounded* slice of the dump:
 * the body is read with `ReadableStream` + `TextDecoder`, each listing object
 * is parsed as soon as it is complete, and the read is cancelled at
 * `maxListings` / `maxBytes` (or the closing `]`, in which case the snapshot
 * is `complete`). The whole payload is never held in memory and the main
 * thread never `JSON.parse`s tens of megabytes at once.
 *
 * In production the Netlify function (Functions 2.0) streams the upstream
 * body instead of buffering it, so the 6 MB buffered-response limit does not
 * apply; Netlify caps streamed responses at 20 MB and 60 s, which is why
 * `AUCTION_DUMP_BYTE_CAP` must stay well below 20 MB. Non-OK responses throw
 * `BlizzardRequestError` so the page shows an `ErrorState` with a Retry button.
 */
import {
  BlizzardRequestError,
  PROXY_RATE_LIMIT_HEADER,
  blizzardClient,
  parseRetryAfter,
} from "@/lib/blizzardClient";
import {
  fulfilledValues,
  localized,
  mapWithConcurrency,
  nameParam,
  nameParamFromTerms,
  namespace,
  optional404,
} from "@/lib/blizzardHelpers";
import type { LocalizedString } from "@/lib/blizzardHelpers";
import {
  env,
  getApiBaseUrl,
  hasStaticAccessToken,
  shouldUseBlizzardProxy,
} from "@/lib/env";
import { humanizeEnum } from "@/lib/format";
import {
  MAX_SEARCH_PAGE_SIZE,
  matchesTypedName,
  relaxedNameTerms,
} from "@/lib/nameSearch";
import { isQualityKey } from "@/theme";
import type {
  AuctionHouseResponse,
  AuctionIndex,
  AuctionItemMatches,
  AuctionItemSummary,
  AuctionListing,
  AuctionMarketView,
  AuctionRow,
  AuctionScanProgress,
  AuctionSnapshot,
  AuctionTimeLeft,
} from "@/features/auctionHouse/types";
import { TIME_LEFT_HINTS } from "@/features/auctionHouse/types";

/* ------------------------------------------------------------------ */
/* Limits                                                              */
/* ------------------------------------------------------------------ */

/** Listings scanned from the regional commodities dump before cancelling. */
export const COMMODITY_LISTING_CAP = 25_000;
/** Listings scanned from a connected-realm dump before cancelling. */
export const REALM_LISTING_CAP = 15_000;
/** Bytes read from either dump before cancelling. */
export const AUCTION_DUMP_BYTE_CAP = 6 * 1024 * 1024;
/** Rows the table shows after sorting (the snapshot keeps every priced row). */
export const AUCTION_ROW_LIMIT = 50;

/**
 * Bytes read when indexing a whole dump for search. Netlify ends streamed
 * function responses at 20 MB (the proxy itself ends them at 19.9 MB so the
 * cut is clean), and the cap is checked per chunk, so a read can run up to
 * one chunk past it. Measured on US data: the largest connected realm (Area
 * 52) is about 19.4 MB and fits; the regional commodities dump is about
 * 22.8 MB, so roughly the first 90% of it is searched.
 */
export const AUCTION_INDEX_BYTE_CAP = 19_500_000;
/**
 * Item-search pages (100 items each) a name is resolved against, newest
 * items first: current-expansion goods dominate the auction house, and a
 * broad word ("potion") can match well over a thousand items.
 */
export const AUCTION_SEARCH_ITEM_PAGES = 5;

const PROGRESS_INTERVAL_MS = 200;
/** Parsing stretch before the browser gets to render and handle input. */
const PARSE_SLICE_MS = 12;
/** About 1.5 ms of scanning on a desktop: the unit a slice is made of. */
const PARSE_PIECE_BYTES = 64 * 1024;

/**
 * A task boundary. While the network keeps the body buffered, every
 * `reader.read()` resolves as a microtask, so a 20 MB index would otherwise
 * parse as one long task (about 300 ms on a desktop, far more on a phone).
 * MessageChannel, unlike setTimeout, is not throttled in background tabs.
 */
const yieldToBrowser = (): Promise<void> =>
  new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
const COMMODITIES_PATH = "/data/wow/auctions/commodities";
const AUCTIONS_KEY = '"auctions"';
/** Longest text that could hide a split `"auctions"` key across two chunks. */
const KEY_TAIL_LENGTH = AUCTIONS_KEY.length;

/* ------------------------------------------------------------------ */
/* Request plumbing (mirrors blizzardClient, which does not expose it)  */
/* ------------------------------------------------------------------ */

const trimTrailingSlash = (value: string): string =>
  value === "/" ? value : value.replace(/\/+$/, "");

/** Same URL rules as `blizzardClient`: proxy prefix, or the API host + bearer. */
const buildDumpUrl = (path: string): string => {
  const query = new URLSearchParams({
    namespace: namespace("dynamic"),
    locale: env.locale,
  }).toString();

  if (shouldUseBlizzardProxy()) {
    return `${trimTrailingSlash(env.proxyPath)}${path}?${query}`;
  }

  const url = new URL(path, getApiBaseUrl());
  url.search = query;
  return url.toString();
};

const buildDumpHeaders = (): HeadersInit =>
  hasStaticAccessToken()
    ? { Authorization: `Bearer ${env.staticAccessToken}` }
    : {};

/* ------------------------------------------------------------------ */
/* Streaming parser                                                    */
/* ------------------------------------------------------------------ */

export type AuctionDumpOptions = {
  signal?: AbortSignal;
  maxListings: number;
  maxBytes: number;
  onProgress?: (progress: AuctionScanProgress) => void;
  /**
   * Receives each listing instead of the result's `listings` array (which
   * then stays empty), so a whole-dump index never holds raw listings.
   */
  onListing?: (listing: AuctionListing) => void;
};

export type AuctionDumpResult = {
  listings: AuctionListing[];
  scannedListings: number;
  bytesRead: number;
  /** The closing `]` was reached (no cap was hit). */
  complete: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isListing = (value: unknown): value is AuctionListing => {
  if (!isRecord(value)) {
    return false;
  }
  const item = value.item;
  return (
    typeof value.id === "number" &&
    isRecord(item) &&
    typeof item.id === "number" &&
    typeof value.quantity === "number"
  );
};

type ScanPhase = "seek-key" | "seek-array" | "scan" | "done";

/**
 * Reads `{ "auctions": [ {...}, {...} ] }` incrementally: finds the
 * `"auctions"` key, then its `[`, then walks characters tracking string /
 * escape state and brace depth so every completed depth-1 object can be
 * `JSON.parse`d on its own. Consumed text is dropped from the buffer as it
 * goes, so memory stays proportional to one listing, not the dump.
 */
export const parseAuctionStream = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  {
    maxListings,
    maxBytes,
    onProgress,
    onListing,
  }: Omit<AuctionDumpOptions, "signal">,
): Promise<AuctionDumpResult> => {
  const decoder = new TextDecoder();
  const listings: AuctionListing[] = [];

  let phase: ScanPhase = "seek-key";
  let buffer = "";
  let bytesRead = 0;
  let scannedListings = 0;
  let complete = false;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let objectStart = -1;
  /** Where the next pass resumes; retained partial text is never re-walked. */
  let scanIndex = 0;
  let lastReport = 0;

  const report = (force: boolean): void => {
    if (!onProgress) {
      return;
    }
    const now = Date.now();
    if (force || now - lastReport >= PROGRESS_INTERVAL_MS) {
      lastReport = now;
      onProgress({ bytesRead, scannedListings });
    }
  };

  const pushListing = (text: string): void => {
    scannedListings += 1;
    try {
      const parsed: unknown = JSON.parse(text);
      if (isListing(parsed)) {
        if (onListing) {
          onListing(parsed);
        } else {
          listings.push(parsed);
        }
      }
    } catch {
      // A malformed object is skipped; the rest of the dump is still useful.
    }
  };

  /** Walks the buffered array body; returns true when scanning should stop. */
  const scanBuffer = (): boolean => {
    let index = scanIndex;
    while (index < buffer.length) {
      const char = buffer[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
      } else if (char === '"') {
        inString = true;
      } else if (char === "{") {
        if (depth === 0) {
          objectStart = index;
        }
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
        if (depth === 0 && objectStart >= 0) {
          pushListing(buffer.slice(objectStart, index + 1));
          objectStart = -1;
          if (scannedListings >= maxListings) {
            buffer = "";
            return true;
          }
        }
      } else if (char === "]" && depth === 0) {
        complete = true;
        buffer = "";
        return true;
      }

      index += 1;
    }

    // Keep only the unfinished object (if any); everything else is consumed.
    if (depth > 0 && objectStart >= 0) {
      buffer = buffer.slice(objectStart);
      objectStart = 0;
      scanIndex = buffer.length;
    } else {
      buffer = "";
      scanIndex = 0;
    }
    return false;
  };

  const locateArray = (): boolean => {
    if (phase === "seek-key") {
      const keyIndex = buffer.indexOf(AUCTIONS_KEY);
      if (keyIndex < 0) {
        buffer = buffer.slice(-KEY_TAIL_LENGTH);
        return false;
      }
      buffer = buffer.slice(keyIndex + AUCTIONS_KEY.length);
      phase = "seek-array";
    }

    if (phase === "seek-array") {
      const arrayIndex = buffer.indexOf("[");
      if (arrayIndex < 0) {
        return false;
      }
      buffer = buffer.slice(arrayIndex + 1);
      phase = "scan";
    }

    return true;
  };

  let sliceStart = performance.now();

  try {
    while (phase !== "done") {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (error) {
        // An index read that is cut late (a platform limit dropping the
        // stream rather than ending it) keeps what it already folded:
        // `complete` stays false, so the page says how much was searched.
        if (onListing && error instanceof TypeError && bytesRead >= maxBytes / 2) {
          break;
        }
        throw error;
      }
      const { done, value } = chunk;
      if (done) {
        break;
      }

      // A parser that fell behind is handed megabytes at once; working
      // through them in small pieces lets it yield inside one chunk too.
      for (
        let offset = 0;
        offset < value.byteLength && phase !== "done";
        offset += PARSE_PIECE_BYTES
      ) {
        const piece = value.subarray(offset, offset + PARSE_PIECE_BYTES);
        bytesRead += piece.byteLength;
        buffer += decoder.decode(piece, { stream: true });

        if (locateArray() && scanBuffer()) {
          phase = "done";
        } else if (bytesRead >= maxBytes) {
          phase = "done";
        }

        report(false);

        if (performance.now() - sliceStart >= PARSE_SLICE_MS) {
          await yieldToBrowser();
          sliceStart = performance.now();
        }
      }
    }
  } finally {
    // Stops the download when a cap was hit; harmless after a natural end.
    await reader.cancel().catch(() => undefined);
  }

  report(true);

  return { listings, scannedListings, bytesRead, complete };
};

/** Transport failure, typed like `blizzardClient`'s ("You appear to be offline"). */
const toNetworkError = (cause: TypeError): BlizzardRequestError => {
  const error = new BlizzardRequestError(
    "Network request failed",
    0,
    undefined,
    { reason: "network" },
  );
  error.cause = cause;
  return error;
};

/**
 * Fetches an auction dump with `fetch` (not `blizzardClient`, whose `json()`
 * would buffer the whole body) and hands the stream to `parseAuctionStream`.
 */
export const fetchAuctionDump = async (
  path: string,
  { signal, ...parseOptions }: AuctionDumpOptions,
): Promise<AuctionDumpResult> => {
  // Built outside the try, as in blizzardClient: a malformed URL is a
  // programming error, not a network failure.
  const url = buildDumpUrl(path);
  const headers = buildDumpHeaders();
  let response: Response;
  try {
    response = await fetch(url, { method: "GET", headers, signal });
  } catch (error) {
    // Aborts propagate untouched so react-query cancels silently.
    if (error instanceof TypeError) {
      throw toNetworkError(error);
    }
    throw error;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new BlizzardRequestError(
      `Blizzard API request failed with status ${response.status}`,
      response.status,
      body,
      {
        // Same as blizzardClient: a 429 honours Retry-After and names the
        // proxy's own limiter instead of blaming Blizzard.
        retryAfterMs: parseRetryAfter(response.headers.get("retry-after")),
        proxyRateLimited: response.headers.get(PROXY_RATE_LIMIT_HEADER) === "1",
      },
    );
  }

  if (response.status === 204 || !response.body) {
    const text = response.body ? await response.text() : "";
    const parsed: unknown = text.length > 0 ? JSON.parse(text) : undefined;
    const auctions = isRecord(parsed)
      ? (parsed as AuctionHouseResponse).auctions ?? []
      : [];
    const listings = auctions.filter(isListing);
    parseOptions.onProgress?.({
      bytesRead: text.length,
      scannedListings: listings.length,
    });
    return {
      listings,
      scannedListings: listings.length,
      bytesRead: text.length,
      complete: true,
    };
  }

  try {
    return await parseAuctionStream(response.body.getReader(), parseOptions);
  } catch (error) {
    // Body cut mid-stream (dropped connection): typed as a network failure so
    // react-query retries instead of caching a truncated snapshot.
    if (error instanceof TypeError && !signal?.aborted) {
      throw toNetworkError(error);
    }
    throw error;
  }
};

/* ------------------------------------------------------------------ */
/* Rows                                                                */
/* ------------------------------------------------------------------ */

const isTimeLeft = (value: unknown): value is AuctionTimeLeft =>
  typeof value === "string" && value in TIME_LEFT_HINTS;

const toRow = (
  key: string,
  itemId: number,
  quantity: number,
  priceCopper: number,
  listingCount: number,
  timeLeft: AuctionTimeLeft,
): AuctionRow => ({
  key,
  itemId,
  quantity,
  priceCopper,
  listingCount,
  timeLeft,
  timeLeftLabel: humanizeEnum(timeLeft) || "Unknown",
  timeLeftHint: isTimeLeft(timeLeft) ? TIME_LEFT_HINTS[timeLeft] : "",
});

const isPrice = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

export type AuctionSnapshotOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: AuctionScanProgress) => void;
  /** Rows the table shows after sorting (default 50). */
  limit?: number;
};

type CommodityAccumulator = {
  quantity: number;
  unitPrice: number;
  listingCount: number;
  timeLeft: AuctionTimeLeft;
};

/** Folds one commodity listing into its item: lowest unit price, summed quantity, SHORT wins. */
const foldCommodity = (
  byItem: Map<number, CommodityAccumulator>,
  listing: AuctionListing,
): void => {
  if (!isPrice(listing.unit_price)) {
    return;
  }
  const current = byItem.get(listing.item.id);
  if (!current) {
    byItem.set(listing.item.id, {
      quantity: listing.quantity,
      unitPrice: listing.unit_price,
      listingCount: 1,
      timeLeft: listing.time_left,
    });
    return;
  }
  current.quantity += listing.quantity;
  current.unitPrice = Math.min(current.unitPrice, listing.unit_price);
  current.listingCount += 1;
  if (listing.time_left === "SHORT") {
    current.timeLeft = "SHORT";
  }
};

const commodityRow = (itemId: number, entry: CommodityAccumulator): AuctionRow =>
  toRow(
    `commodity-${itemId}`,
    itemId,
    entry.quantity,
    entry.unitPrice,
    entry.listingCount,
    entry.timeLeft,
  );

const realmRow = (listing: AuctionListing): AuctionRow =>
  toRow(
    `listing-${listing.id}`,
    listing.item.id,
    listing.quantity,
    listing.buyout ?? 0,
    1,
    listing.time_left,
  );

const byPriceDesc = (left: AuctionRow, right: AuctionRow): number =>
  right.priceCopper - left.priceCopper;

/**
 * Regional commodities: every scanned listing is folded by item id (lowest
 * unit price, summed quantity, listing count, SHORT wins), most expensive
 * first. Every item is kept so the table can sort by quantity or price
 * across the whole scan before showing `limit` rows. No item metadata is
 * fetched here.
 */
export const fetchCommoditySnapshot = async ({
  signal,
  onProgress,
  limit = AUCTION_ROW_LIMIT,
}: AuctionSnapshotOptions = {}): Promise<AuctionSnapshot> => {
  const dump = await fetchAuctionDump(COMMODITIES_PATH, {
    signal,
    onProgress,
    maxListings: COMMODITY_LISTING_CAP,
    maxBytes: AUCTION_DUMP_BYTE_CAP,
  });

  const byItem = new Map<number, CommodityAccumulator>();
  dump.listings.forEach((listing) => foldCommodity(byItem, listing));

  const rows = Array.from(byItem.entries())
    .map(([itemId, entry]) => commodityRow(itemId, entry))
    .sort(byPriceDesc);

  return {
    rows,
    scannedListings: dump.scannedListings,
    bytesRead: dump.bytesRead,
    complete: dump.complete,
    limit,
  };
};

/**
 * Connected-realm auctions: every listing with a buyout, most expensive
 * first; the table sorts and shows `limit` rows. No item metadata is
 * fetched here.
 */
export const fetchConnectedRealmAuctionSnapshot = async (
  connectedRealmId: number,
  { signal, onProgress, limit = AUCTION_ROW_LIMIT }: AuctionSnapshotOptions = {},
): Promise<AuctionSnapshot> => {
  const dump = await fetchAuctionDump(
    `/data/wow/connected-realm/${connectedRealmId}/auctions`,
    {
      signal,
      onProgress,
      maxListings: REALM_LISTING_CAP,
      maxBytes: AUCTION_DUMP_BYTE_CAP,
    },
  );

  const rows = dump.listings
    .filter((listing) => isPrice(listing.buyout))
    .sort((left, right) => (right.buyout ?? 0) - (left.buyout ?? 0))
    .map(realmRow);

  return {
    rows,
    scannedListings: dump.scannedListings,
    bytesRead: dump.bytesRead,
    complete: dump.complete,
    limit,
  };
};

/* ------------------------------------------------------------------ */
/* Search index (a whole dump, folded once per view)                    */
/* ------------------------------------------------------------------ */

const TIME_LEFT_ORDER: readonly AuctionTimeLeft[] = [
  "SHORT",
  "MEDIUM",
  "LONG",
  "VERY_LONG",
];
/** Realm listings are kept as flat `[auctionId, quantity, buyout, timeLeft]` runs. */
const REALM_STRIDE = 4;

/**
 * Reads as much of a dump as Netlify can stream (`AUCTION_INDEX_BYTE_CAP`)
 * and folds it into a compact per-item index, so every later search in this
 * view filters memory instead of downloading again. Commodities fold to one
 * entry per item, as in the snapshot; realm listings are stored as flat
 * number runs (about a hundred thousand of them on a large realm) and only
 * become rows for the items a search asks for.
 */
export const fetchAuctionIndex = async (
  view: AuctionMarketView,
  connectedRealmId: number | null,
  { signal, onProgress }: Omit<AuctionSnapshotOptions, "limit"> = {},
): Promise<AuctionIndex> => {
  const isRealm = view === "realm" && connectedRealmId !== null;
  const commodities = new Map<number, CommodityAccumulator>();
  const realm = new Map<number, number[]>();

  const indexRealmListing = (listing: AuctionListing): void => {
    if (!isPrice(listing.buyout)) {
      return;
    }
    let runs = realm.get(listing.item.id);
    if (!runs) {
      runs = [];
      realm.set(listing.item.id, runs);
    }
    runs.push(
      listing.id,
      listing.quantity,
      listing.buyout,
      TIME_LEFT_ORDER.indexOf(listing.time_left),
    );
  };

  const dump = await fetchAuctionDump(
    isRealm
      ? `/data/wow/connected-realm/${connectedRealmId}/auctions`
      : COMMODITIES_PATH,
    {
      signal,
      onProgress,
      maxListings: Number.POSITIVE_INFINITY,
      maxBytes: AUCTION_INDEX_BYTE_CAP,
      onListing: isRealm
        ? indexRealmListing
        : (listing) => foldCommodity(commodities, listing),
    },
  );

  const rowsFor = isRealm
    ? (itemId: number): AuctionRow[] => {
        const runs = realm.get(itemId);
        if (!runs) {
          return [];
        }
        const rows: AuctionRow[] = [];
        for (let at = 0; at < runs.length; at += REALM_STRIDE) {
          rows.push(
            toRow(
              `listing-${runs[at]}`,
              itemId,
              runs[at + 1],
              runs[at + 2],
              1,
              // An unrecognised value was stored as -1; toRow labels it "Unknown".
              TIME_LEFT_ORDER[runs[at + 3]] ?? ("" as AuctionTimeLeft),
            ),
          );
        }
        return rows;
      }
    : (itemId: number): AuctionRow[] => {
        const entry = commodities.get(itemId);
        return entry ? [commodityRow(itemId, entry)] : [];
      };

  return {
    view: isRealm ? "realm" : "commodities",
    rowsFor,
    itemCount: isRealm ? realm.size : commodities.size,
    scannedListings: dump.scannedListings,
    bytesRead: dump.bytesRead,
    complete: dump.complete,
  };
};

/** Every indexed row for `itemIds`, most expensive first (the snapshot's order). */
export const selectIndexRows = (
  index: AuctionIndex,
  itemIds: readonly number[],
): AuctionRow[] => itemIds.flatMap((id) => index.rowsFor(id)).sort(byPriceDesc);

/* ------------------------------------------------------------------ */
/* Item summary (per-row enrichment)                                   */
/* ------------------------------------------------------------------ */

type ItemDetailResponse = {
  _links?: { self?: { href?: string } };
  id: number;
  name?: LocalizedString;
  quality?: { type?: string; name?: LocalizedString };
  item_class?: { name?: LocalizedString };
  item_subclass?: { name?: LocalizedString };
  inventory_type?: { name?: LocalizedString };
};

/**
 * Static item record for one auction row. 404/204 resolve to `undefined`;
 * the icon is fetched separately (`fetchItemMediaUrl`) so it shares the
 * Items explorer's cache.
 */
const toAuctionItemSummary = (
  data: ItemDetailResponse,
  href: string | undefined,
): AuctionItemSummary => {
  const qualityType = data.quality?.type?.toLowerCase();

  return {
    id: data.id,
    href: href ?? `${getApiBaseUrl()}/data/wow/item/${data.id}`,
    name: localized(data.name) || `Item #${data.id}`,
    quality: localized(data.quality?.name) || undefined,
    qualityKey: isQualityKey(qualityType) ? qualityType : undefined,
    itemClass: localized(data.item_class?.name) || undefined,
    itemSubclass: localized(data.item_subclass?.name) || undefined,
    inventoryType: localized(data.inventory_type?.name) || undefined,
  };
};

export const fetchAuctionItemSummary = async (
  itemId: number,
  signal?: AbortSignal,
): Promise<AuctionItemSummary | undefined> =>
  optional404(async () => {
    const response = await blizzardClient.get<ItemDetailResponse>(
      `/data/wow/item/${itemId}`,
      { namespace: namespace("static") },
      { signal },
    );
    return toAuctionItemSummary(response, response._links?.self?.href);
  });

/* ------------------------------------------------------------------ */
/* Item search (a typed name to the item ids a search filters on)       */
/* ------------------------------------------------------------------ */

const ITEM_SEARCH_PATH = "/data/wow/search/item";
/** Polite to the shared rate limit: five pages land in two round trips. */
const ITEM_SEARCH_CONCURRENCY = 3;

type ItemSearchPage = {
  pageCount?: number;
  results?: Array<{ key?: { href?: string }; data?: ItemDetailResponse }>;
};

const fetchItemSearchPage = (
  nameParams: Record<string, readonly string[]>,
  page: number,
  signal?: AbortSignal,
): Promise<ItemSearchPage | undefined> =>
  optional404(() =>
    blizzardClient.get<ItemSearchPage>(
      ITEM_SEARCH_PATH,
      {
        namespace: namespace("static"),
        orderby: "id:desc",
        _page: page,
        _pageSize: MAX_SEARCH_PAGE_SIZE,
        ...nameParams,
      },
      { signal },
    ),
  );

/**
 * The items a typed name stands for, newest first, up to
 * `AUCTION_SEARCH_ITEM_PAGES` pages. Like the site search, a half-typed last
 * word ("draconium o") is retried without it and the candidates are narrowed
 * here by prefix, because Blizzard only matches whole words.
 */
export const searchAuctionItems = async (
  query: string,
  signal?: AbortSignal,
): Promise<AuctionItemMatches> => {
  const trimmed = query.trim();
  if (!trimmed) {
    return { items: [], truncated: false };
  }

  const collect = async (
    nameParams: Record<string, readonly string[]>,
    narrow: boolean,
  ): Promise<AuctionItemMatches> => {
    const first = await fetchItemSearchPage(nameParams, 1, signal);
    if (!first) {
      return { items: [], truncated: false };
    }
    const pageCount = first.pageCount ?? 1;
    const lastPage = Math.min(pageCount, AUCTION_SEARCH_ITEM_PAGES);
    const laterPages = Array.from(
      { length: Math.max(0, lastPage - 1) },
      (_, offset) => offset + 2,
    );
    const settled = await mapWithConcurrency(
      laterPages,
      ITEM_SEARCH_CONCURRENCY,
      (page) => fetchItemSearchPage(nameParams, page, signal),
      signal,
    );
    const failed = settled.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failed) {
      // Let react-query retry rather than cache a list with a band missing.
      throw failed.reason;
    }
    const pages = [first, ...fulfilledValues(settled)];

    const seen = new Set<number>();
    const items: AuctionItemSummary[] = [];
    pages.forEach((page) => {
      page?.results?.forEach((result) => {
        const data = result.data;
        if (!data || typeof data.id !== "number" || seen.has(data.id)) {
          return;
        }
        const summary = toAuctionItemSummary(data, result.key?.href);
        if (narrow && !matchesTypedName(summary.name, trimmed)) {
          return;
        }
        seen.add(data.id);
        items.push(summary);
      });
    });

    return { items, truncated: pageCount > lastPage };
  };

  const strict = await collect(nameParam(trimmed), false);
  if (strict.items.length > 0) {
    return strict;
  }
  const relaxed = relaxedNameTerms(trimmed);
  return relaxed ? collect(nameParamFromTerms(relaxed), true) : strict;
};
