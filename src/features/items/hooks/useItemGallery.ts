import {
  keepPreviousData,
  useInfiniteQuery,
  useQueries,
  useQuery,
} from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";

import type { VisibleRange } from "@/components/common/VirtualizedCardGrid";
import {
  DEFAULT_ITEM_PAGE_SIZE,
  fetchItemClassDetail,
  fetchItemClassIndex,
  fetchItemGalleryPage,
  fetchItemMediaUrl,
  itemKeys,
} from "@/features/items/services/itemService";
import type { ItemGalleryPage } from "@/features/items/services/itemService";
import type {
  ItemClassSummary,
  ItemSubclassSummary,
} from "@/features/items/types";
import type { SearchResult } from "@/features/search/types";
import useInfiniteScrollTrigger from "@/hooks/useInfiniteScrollTrigger";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";

export const ITEM_PAGE_SIZE = DEFAULT_ITEM_PAGE_SIZE;

const CLASS_INDEX_STALE_TIME_MS = 1000 * 60 * 60;
const INITIAL_ENRICH_LIMIT = 12;
const ENRICH_LOOKAHEAD = 12;

const URL_DEFAULTS = { class: "", subclass: "", q: "" } as const;

type UrlDefaults = { class: string; subclass: string; q: string };

/** "4" → 4; "" / "abc" / "1.5" → null. */
const parseId = (value: string): number | null => {
  if (value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

type MediaEnrichment = {
  data: Array<string | undefined>;
  failed: number;
  refetchFailed: () => void;
};

/** Module scope so useQueries only re-runs it when a result changes. */
const combineMedia = (
  results: UseQueryResult<string | undefined>[],
): MediaEnrichment => ({
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

const getNextPageParam = (lastPage: ItemGalleryPage): number | undefined =>
  lastPage.page < lastPage.pageCount ? lastPage.page + 1 : undefined;

type EnrichWindow = {
  key: string;
  limit: number;
};

export type UseItemGalleryResult = {
  itemClasses: ItemClassSummary[];
  activeClassId: number | null;
  subclasses: ItemSubclassSummary[];
  activeSubclassId: number | null;
  q: string;
  setClass: (id: number) => void;
  setSubclass: (id: number | null) => void;
  setQuery: (text: string) => void;
  items: SearchResult[];
  mediaUrls: Array<string | undefined>;
  /** Exact result count when Blizzard's paging lets us know it. */
  total: number | undefined;
  /** Blizzard capped the result set (see SEARCH_RESULT_CAP). */
  capped: boolean;
  className: string | undefined;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  isClassDetailLoading: boolean;
  error: unknown;
  retry: () => void;
  sentinelRef: RefObject<HTMLDivElement>;
  onVisibleRangeChange: (range: VisibleRange) => void;
  failedMedia: number;
  retryFailedMedia: () => void;
};

/**
 * Data orchestration for the item explorer. The URL (`?class`, `?subclass`,
 * `?q`) is the source of truth; icons are fetched only for cards the grid
 * has rendered (plus a small look-ahead) and never gate the grid.
 */
const useItemGallery = (): UseItemGalleryResult => {
  const [params, setParams] = useSearchParamsRecord<UrlDefaults>(URL_DEFAULTS);
  const parsedClass = parseId(params.class);
  const parsedSubclass = parseId(params.subclass);
  const q = params.q;

  const classIndexQuery = useQuery({
    queryKey: itemKeys.classIndex(),
    queryFn: ({ signal }) => fetchItemClassIndex(signal),
    staleTime: CLASS_INDEX_STALE_TIME_MS,
  });

  const itemClasses = useMemo(
    () => classIndexQuery.data?.item_classes ?? [],
    [classIndexQuery.data],
  );

  // Derived, not set in an effect: the gallery starts as soon as the index lands.
  const activeClassId = parsedClass ?? itemClasses[0]?.id ?? null;

  const classDetailQuery = useQuery({
    queryKey: itemKeys.classDetail(activeClassId),
    queryFn: ({ signal }) =>
      fetchItemClassDetail(activeClassId as number, signal),
    enabled: activeClassId !== null,
    staleTime: CLASS_INDEX_STALE_TIME_MS,
  });

  const subclasses = useMemo(
    () => classDetailQuery.data?.item_subclasses ?? [],
    [classDetailQuery.data],
  );

  // Validate by derivation so a deep-linked subclass survives while loading.
  const activeSubclassId = classDetailQuery.isSuccess
    ? subclasses.some((entry) => entry.id === parsedSubclass)
      ? parsedSubclass
      : null
    : parsedSubclass;

  const galleryQuery = useInfiniteQuery({
    queryKey: itemKeys.gallery(activeClassId, activeSubclassId, q),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      fetchItemGalleryPage(
        {
          itemClassId: activeClassId as number,
          page: pageParam,
          itemSubclassId: activeSubclassId ?? undefined,
          query: q,
          pageSize: ITEM_PAGE_SIZE,
        },
        signal,
      ),
    enabled: activeClassId !== null,
    placeholderData: keepPreviousData,
    getNextPageParam,
  });

  const pages = galleryQuery.data?.pages;
  const items = useMemo(
    () => pages?.flatMap((page) => page.items ?? []) ?? [],
    [pages],
  );
  const total = pages?.[0]?.total;
  const capped = pages?.[0]?.capped ?? false;

  /* ---------------- enrichment window (visible cards only) ---------- */

  const galleryKey = `${activeClassId}|${activeSubclassId}|${q}`;
  const galleryKeyRef = useRef(galleryKey);
  galleryKeyRef.current = galleryKey;
  const lastRangeRef = useRef<VisibleRange>({ start: 0, end: 0 });
  const [enrichWindow, setEnrichWindow] = useState<EnrichWindow>({
    key: galleryKey,
    limit: INITIAL_ENRICH_LIMIT,
  });

  // A new filter resets the window; the grid's current range seeds it so
  // every already-visible card of the new list still gets its icon.
  const enrichLimit =
    enrichWindow.key === galleryKey
      ? enrichWindow.limit
      : Math.max(INITIAL_ENRICH_LIMIT, lastRangeRef.current.end + ENRICH_LOOKAHEAD);

  const onVisibleRangeChange = useCallback((range: VisibleRange): void => {
    lastRangeRef.current = range;
    setEnrichWindow((previous) => {
      const key = galleryKeyRef.current;
      const base = previous.key === key ? previous.limit : INITIAL_ENRICH_LIMIT;
      const next = Math.max(base, range.end + ENRICH_LOOKAHEAD);
      return previous.key === key && previous.limit === next
        ? previous
        : { key, limit: next };
    });
  }, []);

  const media = useQueries({
    queries: items.map((item, index) => ({
      queryKey: itemKeys.media(item.id),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchItemMediaUrl(item.id, signal),
      enabled: index < enrichLimit,
      retry: false,
    })),
    combine: combineMedia,
  });

  /* ---------------- handlers ---------------------------------------- */

  const setClass = useCallback(
    (id: number): void => {
      setParams({ class: String(id), subclass: null });
    },
    [setParams],
  );

  const setSubclass = useCallback(
    (id: number | null): void => {
      setParams({ subclass: id === null ? null : String(id) });
    },
    [setParams],
  );

  const setQuery = useCallback(
    (text: string): void => {
      setParams({ q: text.trim() }, { replace: true });
    },
    [setParams],
  );

  const { fetchNextPage, hasNextPage, isFetchingNextPage, isPlaceholderData } =
    galleryQuery;

  const loadMore = useCallback((): void => {
    if (!hasNextPage || isFetchingNextPage || isPlaceholderData) {
      return;
    }
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isPlaceholderData]);

  const error =
    classIndexQuery.error ?? classDetailQuery.error ?? galleryQuery.error;

  const sentinelRef = useInfiniteScrollTrigger({
    enabled: activeClassId !== null && !galleryQuery.isError && !isPlaceholderData,
    hasMore: hasNextPage,
    isLoading: isFetchingNextPage,
    onLoadMore: loadMore,
  });

  const {
    isError: isClassIndexError,
    refetch: refetchClassIndex,
  } = classIndexQuery;
  const {
    isError: isClassDetailError,
    refetch: refetchClassDetail,
  } = classDetailQuery;
  const { refetch: refetchGallery } = galleryQuery;

  const retry = useCallback((): void => {
    if (isClassIndexError) {
      void refetchClassIndex();
      return;
    }
    if (isClassDetailError) {
      void refetchClassDetail();
    }
    void refetchGallery();
  }, [
    isClassDetailError,
    isClassIndexError,
    refetchClassDetail,
    refetchClassIndex,
    refetchGallery,
  ]);

  const className =
    classDetailQuery.data?.name ??
    itemClasses.find((entry) => entry.id === activeClassId)?.name;

  return {
    itemClasses,
    activeClassId,
    subclasses,
    activeSubclassId,
    q,
    setClass,
    setSubclass,
    setQuery,
    items,
    mediaUrls: media.data,
    total,
    capped,
    className,
    isInitialLoading:
      classIndexQuery.isPending ||
      (activeClassId !== null && galleryQuery.isPending),
    isRefreshing: galleryQuery.isFetching && !isFetchingNextPage,
    isFetchingNextPage,
    hasNextPage,
    isClassDetailLoading: classDetailQuery.isPending && activeClassId !== null,
    error,
    retry,
    sentinelRef,
    onVisibleRangeChange,
    failedMedia: media.failed,
    retryFailedMedia: media.refetchFailed,
  };
};

export default useItemGallery;
