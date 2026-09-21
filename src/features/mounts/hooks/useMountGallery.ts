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
  DEFAULT_MOUNT_PAGE_SIZE,
  fetchCreatureDisplayImage,
  fetchMountDetail,
  fetchMountIndex,
  mountKeys,
  searchMountsDetailed,
} from "@/features/mounts/services/mountService";
import type { MountSearchPage } from "@/features/mounts/services/mountService";
import type { MountDetail, MountGalleryResult } from "@/features/mounts/types";
import useInfiniteScrollTrigger from "@/hooks/useInfiniteScrollTrigger";
import { useSearchParamState } from "@/hooks/useSearchParamState";
import { getExternalLink } from "@/lib/externalLinks";

export const MOUNT_PAGE_SIZE = DEFAULT_MOUNT_PAGE_SIZE;
export const MOUNT_MIN_QUERY_LENGTH = 2;

const INDEX_STALE_TIME_MS = 1000 * 60 * 30;
const SEARCH_STALE_TIME_MS = 1000 * 60 * 10;
const INITIAL_ENRICH_LIMIT = 12;
const ENRICH_LOOKAHEAD = 12;

type Enrichment<T> = {
  data: Array<T | undefined>;
  failed: number;
  refetchFailed: () => void;
};

const combine = <T,>(results: UseQueryResult<T>[]): Enrichment<T> => ({
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

/** Module scope so useQueries only re-runs them when a result changes. */
const combineDetails = (
  results: UseQueryResult<MountDetail>[],
): Enrichment<MountDetail> => combine(results);

const combineMedia = (
  results: UseQueryResult<string | undefined>[],
): Enrichment<string | undefined> => combine(results);

const getNextPageParam = (lastPage: MountSearchPage): number | undefined =>
  lastPage.page < lastPage.pageCount ? lastPage.page + 1 : undefined;

type KeyedCount = {
  key: string;
  value: number;
};

export type UseMountGalleryResult = {
  q: string;
  setQuery: (text: string) => void;
  isSearchActive: boolean;
  mounts: MountGalleryResult[];
  /** Exact result count: the index length, or a search total when known. */
  total: number | undefined;
  /** Blizzard capped the search result set (see SEARCH_RESULT_CAP). */
  capped: boolean;
  loaded: number;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  isFetchingNextPage: boolean;
  hasMore: boolean;
  error: unknown;
  retry: () => void;
  sentinelRef: RefObject<HTMLDivElement>;
  onVisibleRangeChange: (range: VisibleRange) => void;
  failedEnrichment: number;
  retryFailedEnrichment: () => void;
};

/**
 * Data orchestration for the mount explorer. Without a query the full
 * index is paged locally; with one, Blizzard's search paginates. Search
 * rows already carry a display id, so their artwork skips the detail hop.
 */
const useMountGallery = (): UseMountGalleryResult => {
  const [q, setQ] = useSearchParamState("q");
  const isSearchActive = q.trim().length >= MOUNT_MIN_QUERY_LENGTH;

  const indexQuery = useQuery({
    queryKey: mountKeys.index(),
    queryFn: ({ signal }) => fetchMountIndex(signal),
    staleTime: INDEX_STALE_TIME_MS,
  });

  const searchQuery = useInfiniteQuery({
    queryKey: mountKeys.search(q),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      searchMountsDetailed(q, pageParam, MOUNT_PAGE_SIZE, signal),
    enabled: isSearchActive,
    staleTime: SEARCH_STALE_TIME_MS,
    placeholderData: keepPreviousData,
    getNextPageParam,
  });

  const index = useMemo(() => indexQuery.data ?? [], [indexQuery.data]);
  const searchPages = searchQuery.data?.pages;

  /* ---------------- local paging of the index ----------------------- */

  const modeKey = `${isSearchActive ? "search" : "index"}|${q}`;
  const modeKeyRef = useRef(modeKey);
  modeKeyRef.current = modeKey;
  const [visibleWindow, setVisibleWindow] = useState<KeyedCount>({
    key: modeKey,
    value: 1,
  });
  const visiblePages = visibleWindow.key === modeKey ? visibleWindow.value : 1;

  const sourceMounts = useMemo(
    () =>
      isSearchActive
        ? searchPages?.flatMap((page) => page.mounts ?? []) ?? []
        : index.slice(0, visiblePages * MOUNT_PAGE_SIZE),
    [index, isSearchActive, searchPages, visiblePages],
  );

  const total = isSearchActive ? searchPages?.[0]?.total : index.length;
  const capped = isSearchActive ? (searchPages?.[0]?.capped ?? false) : false;

  /* ---------------- enrichment window (visible cards only) ---------- */

  const lastRangeRef = useRef<VisibleRange>({ start: 0, end: 0 });
  const [enrichWindow, setEnrichWindow] = useState<KeyedCount>({
    key: modeKey,
    value: INITIAL_ENRICH_LIMIT,
  });

  const enrichLimit =
    enrichWindow.key === modeKey
      ? enrichWindow.value
      : Math.max(INITIAL_ENRICH_LIMIT, lastRangeRef.current.end + ENRICH_LOOKAHEAD);

  const onVisibleRangeChange = useCallback((range: VisibleRange): void => {
    lastRangeRef.current = range;
    setEnrichWindow((previous) => {
      const key = modeKeyRef.current;
      const base = previous.key === key ? previous.value : INITIAL_ENRICH_LIMIT;
      const next = Math.max(base, range.end + ENRICH_LOOKAHEAD);
      return previous.key === key && previous.value === next
        ? previous
        : { key, value: next };
    });
  }, []);

  // Index rows know nothing but id/name; search rows already have everything.
  const details = useQueries({
    queries: sourceMounts.map((mount, position) => ({
      queryKey: mountKeys.detail(mount.id),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchMountDetail(mount.id, signal),
      enabled: position < enrichLimit && mount.displayId === undefined,
      retry: false,
    })),
    combine: combineDetails,
  });

  const detailData = details.data;

  const media = useQueries({
    queries: sourceMounts.map((mount, position) => {
      const displayId = mount.displayId ?? detailData[position]?.displayId;
      return {
        queryKey: mountKeys.displayMedia(displayId),
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          fetchCreatureDisplayImage(displayId as number, signal),
        enabled: position < enrichLimit && typeof displayId === "number",
        retry: false,
      };
    }),
    combine: combineMedia,
  });

  const mediaData = media.data;

  const mounts = useMemo<MountGalleryResult[]>(
    () =>
      sourceMounts.map((mount, position) => {
        const detail = detailData[position];
        const external = getExternalLink("mount", mount.id, mount.name);
        const description = detail?.description ?? mount.description;

        return {
          id: mount.id,
          name: mount.name,
          href: detail?.href ?? mount.href,
          kind: "mount",
          summary: detail?.source ?? mount.source,
          details: description || undefined,
          mediaUrl: mediaData[position],
          displayId: mount.displayId ?? detail?.displayId,
          externalUrl: external?.url,
          externalLabel: external?.label,
        };
      }),
    [detailData, mediaData, sourceMounts],
  );

  /* ---------------- handlers ---------------------------------------- */

  const setQuery = useCallback(
    (text: string): void => {
      setQ(text.trim(), { replace: true });
    },
    [setQ],
  );

  const {
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPlaceholderData,
    refetch: refetchSearch,
  } = searchQuery;
  const { isError: isIndexError, refetch: refetchIndex } = indexQuery;

  const hasMore = isSearchActive
    ? hasNextPage
    : sourceMounts.length < index.length;

  const loadMore = useCallback((): void => {
    if (isSearchActive) {
      if (!hasNextPage || isFetchingNextPage || isPlaceholderData) {
        return;
      }
      void fetchNextPage();
      return;
    }

    setVisibleWindow((previous) => {
      const key = modeKeyRef.current;
      return previous.key === key
        ? { key, value: previous.value + 1 }
        : { key, value: 2 };
    });
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPlaceholderData,
    isSearchActive,
  ]);

  const error = indexQuery.error ?? searchQuery.error;

  const sentinelRef = useInfiniteScrollTrigger({
    enabled: !error && !isPlaceholderData,
    hasMore,
    isLoading: isFetchingNextPage,
    onLoadMore: loadMore,
  });

  const retry = useCallback((): void => {
    if (isIndexError) {
      void refetchIndex();
      return;
    }
    void refetchSearch();
  }, [isIndexError, refetchIndex, refetchSearch]);

  const retryFailedEnrichment = useCallback((): void => {
    details.refetchFailed();
    media.refetchFailed();
  }, [details, media]);

  return {
    q,
    setQuery,
    isSearchActive,
    mounts,
    total,
    capped,
    loaded: mounts.length,
    isInitialLoading:
      indexQuery.isPending || (isSearchActive && searchQuery.isPending),
    isRefreshing:
      (isSearchActive && searchQuery.isFetching && !isFetchingNextPage) ||
      (!isSearchActive && indexQuery.isFetching && !indexQuery.isPending),
    isFetchingNextPage,
    hasMore,
    error,
    retry,
    sentinelRef,
    onVisibleRangeChange,
    failedEnrichment: details.failed + media.failed,
    retryFailedEnrichment,
  };
};

export default useMountGallery;
