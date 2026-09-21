/**
 * Auction House data access.
 *
 * DOCUMENTED DECISION (F017): Blizzard's regional commodities dump is 10-40 MB
 * of JSON and a connected-realm dump is several MB. The right fix is a
 * server-side `/_derived/` aggregation inside `proxyBlizzardRequest`
 * (server/blizzardProxy.ts) with a Netlify function timeout of 26 s and CDN
 * cache headers; those files are outside this package's ownership, so that
 * route is deferred to a server follow-up.
 *
 * Until it lands the client stream-parses a *bounded* slice of the dump:
 * the body is read with `ReadableStream` + `TextDecoder`, each listing object
 * is parsed as soon as it is complete, and the read is cancelled at
 * `maxListings` / `maxBytes` (or the closing `]`, in which case the snapshot
 * is `complete`). The whole payload is never held in memory and the main
 * thread never `JSON.parse`s tens of megabytes at once.
 *
 * In production the Netlify proxy still buffers the upstream body and caps
 * synchronous responses at 6 MB, so a 502 is possible there until the server
 * follow-up ships; non-OK responses throw `BlizzardRequestError` so the page
 * shows an `ErrorState` with a Retry button.
 */
import { BlizzardRequestError, blizzardClient } from "@/lib/blizzardClient";
import { localized, namespace, optional404 } from "@/lib/blizzardHelpers";
import type { LocalizedString } from "@/lib/blizzardHelpers";
import {
  env,
  getApiBaseUrl,
  hasStaticAccessToken,
  shouldUseBlizzardProxy,
} from "@/lib/env";
import { humanizeEnum } from "@/lib/format";
import { isQualityKey } from "@/theme";
import type {
  AuctionHouseResponse,
  AuctionItemSummary,
  AuctionListing,
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
/** Rows kept after sorting. */
export const AUCTION_ROW_LIMIT = 50;

const PROGRESS_INTERVAL_MS = 200;
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
  { maxListings, maxBytes, onProgress }: Omit<AuctionDumpOptions, "signal">,
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
        listings.push(parsed);
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

  try {
    while (phase !== "done") {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      bytesRead += value.byteLength;
      buffer += decoder.decode(value, { stream: true });

      if (locateArray() && scanBuffer()) {
        phase = "done";
      } else if (bytesRead >= maxBytes) {
        phase = "done";
      }

      report(false);
    }
  } finally {
    // Stops the download when a cap was hit; harmless after a natural end.
    await reader.cancel().catch(() => undefined);
  }

  report(true);

  return { listings, scannedListings, bytesRead, complete };
};

/**
 * Fetches an auction dump with `fetch` (not `blizzardClient`, whose `json()`
 * would buffer the whole body) and hands the stream to `parseAuctionStream`.
 */
export const fetchAuctionDump = async (
  path: string,
  { signal, ...parseOptions }: AuctionDumpOptions,
): Promise<AuctionDumpResult> => {
  const response = await fetch(buildDumpUrl(path), {
    method: "GET",
    headers: buildDumpHeaders(),
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new BlizzardRequestError(
      `Blizzard API request failed with status ${response.status}`,
      response.status,
      body,
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

  return parseAuctionStream(response.body.getReader(), parseOptions);
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
  /** Rows kept after sorting (default 50). */
  limit?: number;
};

type CommodityAccumulator = {
  quantity: number;
  unitPrice: number;
  listingCount: number;
  timeLeft: AuctionTimeLeft;
};

/**
 * Regional commodities: every scanned listing is folded by item id (lowest
 * unit price, summed quantity, listing count, SHORT wins), then the most
 * expensive `limit` items are kept. No item metadata is fetched here.
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
  dump.listings.forEach((listing) => {
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
  });

  const rows = Array.from(byItem.entries())
    .map(([itemId, entry]) =>
      toRow(
        `commodity-${itemId}`,
        itemId,
        entry.quantity,
        entry.unitPrice,
        entry.listingCount,
        entry.timeLeft,
      ),
    )
    .sort((left, right) => right.priceCopper - left.priceCopper)
    .slice(0, limit);

  return {
    rows,
    scannedListings: dump.scannedListings,
    bytesRead: dump.bytesRead,
    complete: dump.complete,
    limit,
  };
};

/**
 * Connected-realm auctions: listings with a buyout, most expensive first,
 * capped at `limit`. No item metadata is fetched here.
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
    .slice(0, limit)
    .map((listing) =>
      toRow(
        `listing-${listing.id}`,
        listing.item.id,
        listing.quantity,
        listing.buyout ?? 0,
        1,
        listing.time_left,
      ),
    );

  return {
    rows,
    scannedListings: dump.scannedListings,
    bytesRead: dump.bytesRead,
    complete: dump.complete,
    limit,
  };
};

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

    const qualityType = response.quality?.type?.toLowerCase();

    return {
      id: response.id,
      href:
        response._links?.self?.href ??
        `${getApiBaseUrl()}/data/wow/item/${itemId}`,
      name: localized(response.name) || `Item #${itemId}`,
      quality: localized(response.quality?.name) || undefined,
      qualityKey: isQualityKey(qualityType) ? qualityType : undefined,
      itemClass: localized(response.item_class?.name) || undefined,
      itemSubclass: localized(response.item_subclass?.name) || undefined,
      inventoryType: localized(response.inventory_type?.name) || undefined,
    };
  });
