import {
  keepPreviousData,
  useInfiniteQuery,
  useQueries,
} from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";

import type { VisibleRange } from "@/components/common/VirtualizedCardGrid";
import {
  DEFAULT_SPELL_PAGE_SIZE,
  fetchSpellIcon,
  searchSpellsDetailed,
  spellKeys,
} from "@/features/spells/services/spellService";
import type { SpellGalleryPage } from "@/features/spells/services/spellService";
import type { SpellSummary } from "@/features/spells/types";
import useInfiniteScrollTrigger from "@/hooks/useInfiniteScrollTrigger";
import { useSearchParamState } from "@/hooks/useSearchParamState";

export const SPELL_PAGE_SIZE = DEFAULT_SPELL_PAGE_SIZE;
export const SPELL_MIN_QUERY_LENGTH = 2;

const SEARCH_STALE_TIME_MS = 1000 * 60 * 10;
const INITIAL_ENRICH_LIMIT = 12;
const ENRICH_LOOKAHEAD = 12;

/** `null` = Blizzard has no icon; `undefined` = not loaded (yet). */
export type SpellIconUrl = string | null | undefined;

type IconEnrichment = {
  data: SpellIconUrl[];
  failed: number;
  refetchFailed: () => void;
};

/** Module scope so useQueries only re-runs it when a result changes. */
const combineIcons = (
  results: UseQueryResult<string | null>[],
): IconEnrichment => ({
  data: results.map((result) => result.data),
  failed: results.filter((result) => result.isError).length,
  refetchFailed: () => {
    results.forEach((result) => {
      if (result.isError) {
        void result.refetch();
      }
    });
  },
});

const getNextPageParam = (lastPage: SpellGalleryPage): number | undefined =>
  lastPage.page < lastPage.pageCount ? lastPage.page + 1 : undefined;

type EnrichWindow = {
  key: string;
  limit: number;
};

export type UseSpellSearchResult = {
  q: string;
  setQuery: (text: string) => void;
  isSearchActive: boolean;
  spells: SpellSummary[];
  iconUrls: SpellIconUrl[];
  /** Exact result count when Blizzard's paging lets us know it. */
  total: number | undefined;
  /** Blizzard capped the result set (see SEARCH_RESULT_CAP). */
  capped: boolean;
  /**
   * Blizzard's page count for the current search, when a page has landed:
   * the only size a multi-page search response states.
   */
  pageCount: number | undefined;
  /** Pages rendered so far for the current search. */
  loadedPages: number;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  error: unknown;
  retry: () => void;
  sentinelRef: RefObject<HTMLDivElement>;
  onVisibleRangeChange: (range: VisibleRange) => void;
  failedIcons: number;
  retryFailedIcons: () => void;
};

/**
 * Data orchestration for the spell explorer: `?q` drives one paginated
 * search (no per-card detail requests); icons load for rendered cards only.
 */
const useSpellSearch = (): UseSpellSearchResult => {
  const [q, setQ] = useSearchParamState("q");
  const isSearchActive = q.trim().length >= SPELL_MIN_QUERY_LENGTH;

  const searchQuery = useInfiniteQuery({
    queryKey: spellKeys.search(q),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      searchSpellsDetailed(q, pageParam, SPELL_PAGE_SIZE, signal),
    enabled: isSearchActive,
    staleTime: SEARCH_STALE_TIME_MS,
    placeholderData: keepPreviousData,
    getNextPageParam,
  });

  const pages = searchQuery.data?.pages;
  const spells = useMemo(
    () => pages?.flatMap((page) => page.spells ?? []) ?? [],
    [pages],
  );
  const total = pages?.[0]?.total;
  const capped = pages?.[0]?.capped ?? false;
  const pageCount = pages?.[pages.length - 1]?.pageCount;
  const loadedPages = pages?.length ?? 0;

  /* ---------------- enrichment window (visible cards only) ---------- */

  const keyRef = useRef(q);
  keyRef.current = q;
  const lastRangeRef = useRef<VisibleRange>({ start: 0, end: 0 });
  const [enrichWindow, setEnrichWindow] = useState<EnrichWindow>({
    key: q,
    limit: INITIAL_ENRICH_LIMIT,
  });

  const enrichLimit =
    enrichWindow.key === q
      ? enrichWindow.limit
      : Math.max(INITIAL_ENRICH_LIMIT, lastRangeRef.current.end + ENRICH_LOOKAHEAD);

  const onVisibleRangeChange = useCallback((range: VisibleRange): void => {
    lastRangeRef.current = range;
    setEnrichWindow((previous) => {
      const key = keyRef.current;
      const base = previous.key === key ? previous.limit : INITIAL_ENRICH_LIMIT;
      const next = Math.max(base, range.end + ENRICH_LOOKAHEAD);
      return previous.key === key && previous.limit === next
        ? previous
        : { key, limit: next };
    });
  }, []);

  const icons = useQueries({
    queries: spells.map((spell, index) => ({
      queryKey: spellKeys.icon(spell.id),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchSpellIcon(spell.id, signal),
      enabled: index < enrichLimit,
      retry: false,
    })),
    combine: combineIcons,
  });

  /* ---------------- handlers ---------------------------------------- */

  const setQuery = useCallback(
    (text: string): void => {
      setQ(text.trim(), { replace: true });
    },
    [setQ],
  );

  const {
    fetchNextPage,
    hasNextPage: hasNextFetchedPage,
    isFetchingNextPage,
    isPlaceholderData,
    refetch,
  } = searchQuery;

  // While a refined search shows the previous pages as placeholder, react-query
  // reports `hasNextPage: false`; read it off the pages on display instead so
  // the status never claims the previous set was complete.
  const lastPage = pages?.[pages.length - 1];
  const hasNextPage = isPlaceholderData
    ? lastPage !== undefined && getNextPageParam(lastPage) !== undefined
    : hasNextFetchedPage;

  const loadMore = useCallback((): void => {
    if (!hasNextFetchedPage || isFetchingNextPage || isPlaceholderData) {
      return;
    }
    void fetchNextPage();
  }, [fetchNextPage, hasNextFetchedPage, isFetchingNextPage, isPlaceholderData]);

  const sentinelRef = useInfiniteScrollTrigger({
    enabled: isSearchActive && !searchQuery.isError && !isPlaceholderData,
    hasMore: hasNextPage,
    isLoading: isFetchingNextPage,
    onLoadMore: loadMore,
  });

  const retry = useCallback((): void => {
    void refetch();
  }, [refetch]);

  return {
    q,
    setQuery,
    isSearchActive,
    spells,
    iconUrls: icons.data,
    total,
    capped,
    pageCount,
    loadedPages,
    isInitialLoading: isSearchActive && searchQuery.isPending,
    isRefreshing: searchQuery.isFetching && !isFetchingNextPage,
    isFetchingNextPage,
    hasNextPage,
    error: searchQuery.error,
    retry,
    sentinelRef,
    onVisibleRangeChange,
    failedIcons: icons.failed,
    retryFailedIcons: icons.refetchFailed,
  };
};

export default useSpellSearch;
