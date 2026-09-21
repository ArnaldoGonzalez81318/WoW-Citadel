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

const sortRows = (
  rows: AuctionTableRow[],
  sort: AuctionSortKey,
): AuctionTableRow[] => {
  const sorted = [...rows];
  switch (sort) {
    case "price-asc":
      return sorted.sort((left, right) => left.priceCopper - right.priceCopper);
    case "quantity-desc":
      return sorted.sort(
        (left, right) =>
          right.quantity - left.quantity || right.priceCopper - left.priceCopper,
      );
    case "name-asc":
      return sorted.sort(
        (left, right) =>
          compareText(rowName(left), rowName(right)) ||
          right.priceCopper - left.priceCopper,
      );
    default:
      return sorted.sort((left, right) => right.priceCopper - left.priceCopper);
  }
};

/* ------------------------------------------------------------------ */
/* Enrichment combiners (module-level so they are referentially stable)  */
/* ------------------------------------------------------------------ */

type SummaryResults = {
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
  data: Array<string | undefined>;
};

const combineIcons = (
  results: UseQueryResult<string | undefined>[],
): IconResults => ({
  data: results.map((result) => result.data),
});

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export type UseAuctionSnapshotResult = {
  snapshot: AuctionSnapshot | undefined;
  /** Snapshot rows merged with item summaries and icons, sorted. */
  rows: AuctionTableRow[];
  /** Bytes / listings read so far while the dump downloads. */
  progress: AuctionScanProgress;
  query: UseQueryResult<AuctionSnapshot>;
  dataUpdatedAt: number;
};

/**
 * One bounded auction snapshot (commodities or a connected realm) plus
 * per-row item enrichment. Item lookups never gate the table: a failed
 * summary leaves the row as "Item #id" with the icon fallback.
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
  const baseRows = snapshot?.rows;
  const rowCount = baseRows?.length ?? 0;

  const enrichWindow = useIdlePrefetchWindow({
    totalCount: rowCount,
    initialCount: ENRICH_INITIAL,
    batchSize: ENRICH_BATCH,
    resetKey: isRealm ? `realm:${connectedRealmId ?? ""}` : "commodities",
  });

  // `combine` with stable callbacks returns referentially stable results, so
  // the merge below only recomputes when a summary or icon actually settles.
  const summaries = useQueries({
    queries: (baseRows ?? []).map((row, index) => ({
      queryKey: auctionKeys.itemSummary(row.itemId),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchAuctionItemSummary(row.itemId, signal),
      staleTime: Infinity,
      gcTime: ITEM_GC_MS,
      retry: false,
      enabled: index < enrichWindow,
    })),
    combine: combineSummaries,
  });

  const icons = useQueries({
    queries: (baseRows ?? []).map((row, index) => ({
      queryKey: itemKeys.media(row.itemId),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchItemMediaUrl(row.itemId, signal),
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

    const merged = baseRows.map((row, index): AuctionTableRow => {
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

    return sortRows(merged, sort);
  }, [baseRows, icons.data, sort, summaries.data, summaries.settled]);

  return {
    snapshot,
    rows,
    progress,
    query,
    dataUpdatedAt: query.dataUpdatedAt,
  };
};

export default useAuctionSnapshot;
