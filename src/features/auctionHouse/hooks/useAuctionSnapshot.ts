import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import {
  AUCTION_ROW_LIMIT,
  fetchAuctionIndex,
  fetchAuctionItemSummary,
  fetchCommoditySnapshot,
  fetchConnectedRealmAuctionSnapshot,
  searchAuctionItems,
  selectIndexRows,
} from "@/features/auctionHouse/services/auctionHouseService";
import type {
  AuctionIndex,
  AuctionItemMatches,
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
/** Item names change with patches, not hours; a resolved name stays an hour. */
const ITEM_MATCH_STALE_MS = 60 * 60_000;
/** Same floor as the site search: one letter matches far too much. */
export const AUCTION_SEARCH_MIN_LENGTH = 2;
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
  index: (view: AuctionMarketView, connectedRealmId: number | null) =>
    ["auction-index", view, connectedRealmId, env.region] as const,
  itemMatches: (term: string) =>
    ["auction-item-matches", term, env.region, env.locale] as const,
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

/** The parts of a query the page and filter bar read; search composes two queries into one. */
export type AuctionQueryState = {
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
};

export type AuctionSearchState = {
  /** A qualifying term is being searched (rows come from the index). */
  active: boolean;
  term: string;
  /** Items whose name matched, once resolved. */
  matches: AuctionItemMatches | undefined;
  /** Resolving the name to item ids. */
  resolving: boolean;
};

export type UseAuctionSnapshotResult = {
  /** The snapshot, or while searching, the index filtered to the matched items. */
  snapshot: AuctionSnapshot | undefined;
  /** The `limit` rows to show, merged with item summaries and icons, sorted. */
  rows: AuctionTableRow[];
  /** Bytes / listings read so far while a dump downloads. */
  progress: AuctionScanProgress;
  query: AuctionQueryState;
  dataUpdatedAt: number;
  search: AuctionSearchState;
};

/**
 * One bounded auction snapshot (commodities or a connected realm) plus
 * per-item enrichment of the rows on screen. Item lookups never gate the
 * table: a failed summary leaves the row as "Item #id" with the icon
 * fallback.
 *
 * With a search term the snapshot is set aside: the name is resolved to item
 * ids (Blizzard's item search), the whole dump is indexed once per view
 * (`fetchAuctionIndex`, only when some item matched), and the rows are that
 * index filtered to those ids, through the same sort and enrichment.
 */
export const useAuctionSnapshot = (
  view: AuctionMarketView,
  connectedRealmId: number | null,
  sort: AuctionSortKey = "price-desc",
  searchTerm = "",
): UseAuctionSnapshotResult => {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<AuctionScanProgress>(EMPTY_PROGRESS);
  /** Its own line: an index read can outlive a cleared search beside a snapshot read. */
  const [indexProgress, setIndexProgress] =
    useState<AuctionScanProgress>(EMPTY_PROGRESS);

  const onProgress = useCallback((next: AuctionScanProgress): void => {
    setProgress(next);
  }, []);

  const isRealm = view === "realm";
  const enabled = isRealm ? connectedRealmId !== null : true;
  const staleTime = isRealm ? REALM_STALE_MS : COMMODITY_STALE_MS;

  const term = searchTerm.trim();
  const searching = enabled && term.length >= AUCTION_SEARCH_MIN_LENGTH;

  const queryKey = isRealm
    ? auctionKeys.realmListings(connectedRealmId)
    : auctionKeys.commodities();

  const snapshotQuery = useQuery({
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
    // A search reads the index instead; the snapshot loads when it is cleared.
    enabled: enabled && !searching,
    staleTime,
    // Keep the previous rows visible while refetching or switching realms,
    // but never show commodity rows under a "Buyout" header (or vice versa).
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[0] === queryKey[0] ? previousData : undefined,
  });

  // Case only changes how a name is typed, not which items it finds.
  const matchKey = term.toLowerCase();
  const matchesQuery = useQuery({
    queryKey: auctionKeys.itemMatches(matchKey),
    queryFn: async ({ signal }) => {
      const matches = await searchAuctionItems(term, signal);
      // The search already returned each item's name, quality and class:
      // seed the per-row summaries so matched rows need no lookup of their own.
      matches.items.forEach((item) => {
        if (queryClient.getQueryData(auctionKeys.itemSummary(item.id)) === undefined) {
          queryClient.setQueryData(auctionKeys.itemSummary(item.id), item);
        }
      });
      return matches;
    },
    enabled: searching,
    staleTime: ITEM_MATCH_STALE_MS,
    // Keep the last answer on screen while the next term resolves.
    placeholderData: (previousData) => previousData,
  });

  const matches = searching ? matchesQuery.data : undefined;
  const matchesSettled = searching && matchesQuery.isSuccess && !matchesQuery.isPlaceholderData;
  const matchedIds = useMemo<number[]>(
    () => (matches ? matches.items.map((item) => item.id) : EMPTY_IDS),
    [matches],
  );

  // Commodities are regional: a realm left in the URL must not split the cache.
  const indexRealmId = isRealm ? connectedRealmId : null;
  const indexQuery = useQuery({
    queryKey: auctionKeys.index(view, indexRealmId),
    queryFn: ({ signal }) => {
      setIndexProgress(EMPTY_PROGRESS);
      return fetchAuctionIndex(view, indexRealmId, {
        signal,
        onProgress: setIndexProgress,
      });
    },
    // Nothing to look for, nothing to download: a name with no items never
    // costs the 20 MB read.
    enabled: searching && matchesSettled && matchedIds.length > 0,
    staleTime,
  });

  const index: AuctionIndex | undefined = searching ? indexQuery.data : undefined;

  const searchSnapshot = useMemo<AuctionSnapshot | undefined>(
    () =>
      index && matches
        ? {
            rows: selectIndexRows(index, matchedIds),
            scannedListings: index.scannedListings,
            bytesRead: index.bytesRead,
            complete: index.complete,
            limit: AUCTION_ROW_LIMIT,
          }
        : undefined,
    [index, matches, matchedIds],
  );

  const snapshot = searching ? searchSnapshot : snapshotQuery.data;

  /** Every matched item's name is already known, so a name sort can cover them all. */
  const matchNames = useMemo(
    () => new Map((matches?.items ?? []).map((item) => [item.id, item.name])),
    [matches],
  );

  const baseRows = useMemo<AuctionRow[] | undefined>(() => {
    if (!snapshot) {
      return undefined;
    }
    if (searching && (sort === "name-asc" || sort === "name-desc")) {
      const direction = sort === "name-asc" ? 1 : -1;
      return [...snapshot.rows]
        .sort(
          (left, right) =>
            direction *
              compareText(
                matchNames.get(left.itemId) ?? "",
                matchNames.get(right.itemId) ?? "",
              ) || byPriceDesc(left, right),
        )
        .slice(0, snapshot.limit);
    }
    return selectRows(snapshot.rows, sort, snapshot.limit);
  }, [matchNames, searching, snapshot, sort]);

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
    resetKey: `${isRealm ? `realm:${connectedRealmId ?? ""}` : "commodities"}|${
      searching ? matchKey : ""
    }`,
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

  /*
   * One state for the page: while searching, resolving the name comes first
   * (its error or pending wins), then the index. A name with no matching
   * items is settled, not pending, though the index never ran.
   */
  const query = useMemo<AuctionQueryState>(() => {
    if (!searching) {
      return snapshotQuery;
    }
    if (matchesQuery.isError || !matchesSettled || matchedIds.length === 0) {
      return {
        isPending: !matchesQuery.isError && !matchesSettled,
        isFetching: matchesQuery.isFetching,
        isError: matchesQuery.isError,
        error: matchesQuery.error,
        refetch: matchesQuery.refetch,
      };
    }
    return indexQuery;
  }, [searching, snapshotQuery, matchesQuery, matchesSettled, matchedIds.length, indexQuery]);

  return {
    snapshot,
    rows,
    progress: searching ? indexProgress : progress,
    query,
    dataUpdatedAt: searching ? indexQuery.dataUpdatedAt : snapshotQuery.dataUpdatedAt,
    search: {
      active: searching,
      term,
      matches: matchesSettled ? matches : undefined,
      resolving: searching && !matchesSettled && !matchesQuery.isError,
    },
  };
};

export default useAuctionSnapshot;
