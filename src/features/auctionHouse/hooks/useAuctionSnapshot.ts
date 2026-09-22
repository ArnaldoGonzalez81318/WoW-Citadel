import { useQueries, useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import {
  fetchAuctionItemSummary,
  fetchCommoditySnapshot,
  fetchConnectedRealmAuctionSnapshot,
} from "@/features/auctionHouse/services/auctionHouseService";
import type {
  AuctionItemSummary,
  AuctionMarketView,
  AuctionRow,
  AuctionScanProgress,
  AuctionSnapshot,
  AuctionSortKey,
  AuctionTableRow,
} from "@/features/auctionHouse/types";
import {
  fetchItemMediaUrl,
  itemKeys,
} from "@/features/items/services/itemService";
import useIdlePrefetchWindow from "@/hooks/useIdlePrefetchWindow";
import { env } from "@/lib/env";

/* ------------------------------------------------------------------ */
/* Timing (the page's caption quotes these; keep them in sync)          */
/* ------------------------------------------------------------------ */

export const COMMODITY_STALE_MS = 15 * 60_000;
export const REALM_STALE_MS = 5 * 60_000;

const ITEM_GC_MS = 24 * 60 * 60_000;
const ENRICH_INITIAL = 16;
const ENRICH_BATCH = 16;

const EMPTY_PROGRESS: AuctionScanProgress = { bytesRead: 0, scannedListings: 0 };
const EMPTY_ROWS: AuctionTableRow[] = [];
const EMPTY_IDS: number[] = [];

/* ------------------------------------------------------------------ */
/* Query keys                                                          */
/* ------------------------------------------------------------------ */

export const auctionKeys = {
  commodities: () => ["auction-commodities", env.region] as const,
  realmListings: (connectedRealmId: number | null) =>
    ["auction-realm-listings", connectedRealmId, env.region] as const,
  itemSummary: (itemId: number) =>
    ["auction-item-summary", itemId, env.region] as const,
};

/* ------------------------------------------------------------------ */
/* Sorting                                                             */
/* ------------------------------------------------------------------ */

const compareText = (left: string, right: string): number =>
  left.localeCompare(right, undefined, { sensitivity: "base" });

const rowName = (row: AuctionTableRow): string =>
  row.name ?? `Item #${row.itemId}`;

const byPriceDesc = (left: AuctionRow, right: AuctionRow): number =>
  right.priceCopper - left.priceCopper;

/** What each sort ranks, for the filter-bar summary ("Top 50 by …"). */
export const AUCTION_SORT_SCOPES: Record<AuctionSortKey, string> = {
  "price-desc": "highest price",
  "price-asc": "lowest price",
  "quantity-desc": "largest quantity",
  "quantity-asc": "smallest quantity",
  "name-asc": "highest price, sorted by name",
  "name-desc": "highest price, sorted by name",
};

/**
 * Price and quantity sorts rank the whole scan before the top `limit` rows
 * are kept. Names only exist for rows on screen, so a name sort orders the
 * `limit` most expensive rows (`rows` already arrive most expensive first).
 */
const selectRows = (
  rows: AuctionRow[],
  sort: AuctionSortKey,
  limit: number,
): AuctionRow[] => {
  switch (sort) {
    case "price-asc":
      return [...rows]
        .sort((left, right) => left.priceCopper - right.priceCopper)
        .slice(0, limit);
    case "quantity-desc":
      return [...rows]
        .sort(
          (left, right) =>
            right.quantity - left.quantity || byPriceDesc(left, right),
        )
        .slice(0, limit);
    case "quantity-asc":
      return [...rows]
        .sort(
          (left, right) =>
            left.quantity - right.quantity || byPriceDesc(left, right),
        )
        .slice(0, limit);
    default:
      return rows.slice(0, limit);
  }
};

const sortByName = (
  rows: AuctionTableRow[],
  sort: AuctionSortKey,
): AuctionTableRow[] => {
  if (sort !== "name-asc" && sort !== "name-desc") {
    return rows;
  }
  const direction = sort === "name-asc" ? 1 : -1;
  return [...rows].sort(
    (left, right) =>
      direction * compareText(rowName(left), rowName(right)) ||
      byPriceDesc(left, right),
  );
};

/* ------------------------------------------------------------------ */
/* Enrichment combiners (module-level so they are referentially stable)  */
/* ------------------------------------------------------------------ */

type SummaryResults = {
  /** Indexed by position in `itemIds`. */
  data: Array<AuctionItemSummary | undefined>;
  /** Success (including a 404 resolved to undefined) or error. */
  settled: boolean[];
};

const combineSummaries = (
  results: UseQueryResult<AuctionItemSummary | undefined>[],
): SummaryResults => ({
  data: results.map((result) => result.data),
  settled: results.map((result) => result.isSuccess || result.isError),
});

type IconResults = {
  /** Indexed by position in `itemIds`. */
  data: Array<string | undefined>;
};

const combineIcons = (
  results: UseQueryResult<string | null | undefined>[],
): IconResults => ({
  // `fetchItemMediaUrl` resolves `null` for "no icon"; the table wants undefined.
  data: results.map((result) => result.data ?? undefined),
});

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export type UseAuctionSnapshotResult = {
  snapshot: AuctionSnapshot | undefined;
  /** The `limit` rows to show, merged with item summaries and icons, sorted. */
  rows: AuctionTableRow[];
  /** Bytes / listings read so far while the dump downloads. */
  progress: AuctionScanProgress;
  query: UseQueryResult<AuctionSnapshot>;
  dataUpdatedAt: number;
};

/**
 * One bounded auction snapshot (commodities or a connected realm) plus
 * per-item enrichment of the rows on screen. Item lookups never gate the
 * table: a failed summary leaves the row as "Item #id" with the icon
 * fallback.
 */
export const useAuctionSnapshot = (
  view: AuctionMarketView,
  connectedRealmId: number | null,
  sort: AuctionSortKey = "price-desc",
): UseAuctionSnapshotResult => {
  const [progress, setProgress] = useState<AuctionScanProgress>(EMPTY_PROGRESS);

  const onProgress = useCallback((next: AuctionScanProgress): void => {
    setProgress(next);
  }, []);

  const isRealm = view === "realm";
  const enabled = isRealm ? connectedRealmId !== null : true;

  const queryKey = isRealm
    ? auctionKeys.realmListings(connectedRealmId)
    : auctionKeys.commodities();

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => {
      setProgress(EMPTY_PROGRESS);
      return isRealm && connectedRealmId !== null
        ? fetchConnectedRealmAuctionSnapshot(connectedRealmId, {
            signal,
            onProgress,
          })
        : fetchCommoditySnapshot({ signal, onProgress });
    },
    enabled,
    staleTime: isRealm ? REALM_STALE_MS : COMMODITY_STALE_MS,
    // Keep the previous rows visible while refetching or switching realms,
    // but never show commodity rows under a "Buyout" header (or vice versa).
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[0] === queryKey[0] ? previousData : undefined,
  });

  const snapshot = query.data;

  const baseRows = useMemo<AuctionRow[] | undefined>(
    () =>
      snapshot ? selectRows(snapshot.rows, sort, snapshot.limit) : undefined,
    [snapshot, sort],
  );

  // Realm snapshots list the same item several times: enrich each item once
  // (react-query warns about duplicate keys inside one `useQueries`).
  const itemIds = useMemo<number[]>(
    () =>
      baseRows
        ? Array.from(new Set(baseRows.map((row) => row.itemId)))
        : EMPTY_IDS,
    [baseRows],
  );

  const enrichWindow = useIdlePrefetchWindow({
    totalCount: itemIds.length,
    initialCount: ENRICH_INITIAL,
    batchSize: ENRICH_BATCH,
    resetKey: isRealm ? `realm:${connectedRealmId ?? ""}` : "commodities",
  });

  // `combine` with stable callbacks returns referentially stable results, so
  // the merge below only recomputes when a summary or icon actually settles.
  const summaries = useQueries({
    queries: itemIds.map((itemId, index) => ({
      queryKey: auctionKeys.itemSummary(itemId),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchAuctionItemSummary(itemId, signal),
      staleTime: Infinity,
      gcTime: ITEM_GC_MS,
      retry: false,
      enabled: index < enrichWindow,
    })),
    combine: combineSummaries,
  });

  const icons = useQueries({
    queries: itemIds.map((itemId, index) => ({
      queryKey: itemKeys.media(itemId),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchItemMediaUrl(itemId, signal),
      staleTime: Infinity,
      gcTime: ITEM_GC_MS,
      retry: false,
      enabled: index < enrichWindow,
    })),
    combine: combineIcons,
  });

  const rows = useMemo<AuctionTableRow[]>(() => {
    if (!baseRows || baseRows.length === 0) {
      return EMPTY_ROWS;
    }

    const indexById = new Map(itemIds.map((itemId, index) => [itemId, index]));
    const merged = baseRows.map((row): AuctionTableRow => {
      const index = indexById.get(row.itemId) ?? -1;
      const summary = summaries.data[index];
      return {
        ...row,
        name: summary?.name,
        quality: summary?.quality,
        qualityKey: summary?.qualityKey,
        itemClass: summary?.itemClass,
        itemSubclass: summary?.itemSubclass,
        mediaUrl: icons.data[index] ?? summary?.mediaUrl,
        summaryPending: !summaries.settled[index],
      };
    });

    return sortByName(merged, sort);
  }, [baseRows, icons.data, itemIds, sort, summaries.data, summaries.settled]);

  return {
    snapshot,
    rows,
    progress,
    query,
    dataUpdatedAt: query.dataUpdatedAt,
  };
};

export default useAuctionSnapshot;
