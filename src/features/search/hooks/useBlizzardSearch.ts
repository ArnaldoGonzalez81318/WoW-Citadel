import { keepPreviousData, useQueries } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";

import { SEARCH_CATEGORIES } from "@/features/search/categories";
import type { SearchCategoryConfig } from "@/features/search/categories";
import type { SearchPage } from "@/features/search/services/searchService";
import type { SearchCategoryId, SearchResult } from "@/features/search/types";
import useDebouncedValue from "@/hooks/useDebouncedValue";
import { BlizzardRequestError } from "@/lib/blizzardClient";

export const SEARCH_DEBOUNCE_MS = 350;
export const SEARCH_STALE_TIME_MS = 10 * 60_000;

/** Statuses that retrying cannot fix: credentials, not found, rate limit. */
const NON_RETRYABLE_STATUSES = new Set([401, 403, 404, 429]);

/**
 * Search/token retry policy: one retry for transient failures only. Lives
 * here because the global QueryClient belongs to another package.
 */
export const shouldRetrySearch = (
  failureCount: number,
  error: unknown,
): boolean =>
  !(
    error instanceof BlizzardRequestError &&
    NON_RETRYABLE_STATUSES.has(error.status)
  ) && failureCount < 1;

export interface SearchCategoryState {
  category: SearchCategoryConfig;
  data: SearchResult[];
  page: number;
  pageCount: number;
  total?: number;
  isLoading: boolean;
  isFetching: boolean;
  isPlaceholderData: boolean;
  isError: boolean;
  error?: unknown;
  refetch: () => void;
}

export interface UseBlizzardSearchOptions {
  categoryIds?: SearchCategoryId[];
  pages?: Partial<Record<SearchCategoryId, number>>;
  debounceMs?: number;
}

export interface BlizzardSearchState {
  /** Debounced, trimmed query the results belong to. */
  query: string;
  /** One character typed: below every category's minimum. */
  tooShort: boolean;
  categoryStates: SearchCategoryState[];
  isAnyLoading: boolean;
  isFetching: boolean;
  isAllError: boolean;
  hasAnyResults: boolean;
  firstError?: unknown;
}

type CombinedSearch = Omit<BlizzardSearchState, "query" | "tooShort">;

const combineSearch = (
  results: UseQueryResult<SearchPage>[],
  categories: SearchCategoryConfig[],
  pages: UseBlizzardSearchOptions["pages"],
): CombinedSearch => {
  const categoryStates: SearchCategoryState[] = results.map((result, index) => {
    const category = categories[index];
    return {
      category,
      data: result.data?.results ?? [],
      page: result.data?.page ?? pages?.[category.id] ?? 1,
      pageCount: result.data?.pageCount ?? 1,
      total: result.data?.total,
      isLoading: result.isLoading,
      isFetching: result.isFetching,
      isPlaceholderData: result.isPlaceholderData,
      isError: result.isError,
      error: result.error ?? undefined,
      refetch: result.refetch,
    };
  });

  return {
    categoryStates,
    isAnyLoading: results.some((result) => result.isLoading),
    isFetching: results.some((result) => result.isFetching),
    isAllError: results.length > 0 && results.every((result) => result.isError),
    hasAnyResults: results.some(
      (result) => (result.data?.results.length ?? 0) > 0,
    ),
    firstError: results.find((result) => result.isError)?.error ?? undefined,
  };
};

/**
 * Runs the global search across the given categories (all four by default),
 * one paginated query per category. Results are keyed by
 * `["search", categoryId, query, page]` so the header, home and category
 * pages share one cache.
 */
export const useBlizzardSearch = (
  query: string,
  options: UseBlizzardSearchOptions = {},
): BlizzardSearchState => {
  const { categoryIds, pages, debounceMs = SEARCH_DEBOUNCE_MS } = options;
  const debouncedQuery = useDebouncedValue(query, debounceMs);
  const normalizedQuery = debouncedQuery.trim();

  const categoryKey = categoryIds?.join(",") ?? "";
  const categories = useMemo(
    () =>
      categoryIds
        ? SEARCH_CATEGORIES.filter((category) =>
            categoryIds.includes(category.id),
          )
        : SEARCH_CATEGORIES,
    // categoryIds is usually an inline literal; compare by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categoryKey],
  );

  const tooShort = normalizedQuery.length > 0 && normalizedQuery.length < 2;

  const pagesKey = categories
    .map((category) => pages?.[category.id] ?? 1)
    .join(",");
  const combine = useMemo(
    () => (results: UseQueryResult<SearchPage>[]) =>
      combineSearch(results, categories, pages),
    // Re-create only when the category set or a requested page changes so
    // react-query keeps its structural memo of the combined value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, pagesKey],
  );

  const combined = useQueries({
    queries: categories.map((category) => {
      const page = pages?.[category.id] ?? 1;
      const enabled = normalizedQuery.length >= category.minQueryLength;
      return {
        queryKey: ["search", category.id, normalizedQuery, page] as const,
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          category.fetcher(normalizedQuery, { page, signal }),
        staleTime: SEARCH_STALE_TIME_MS,
        enabled,
        // Guarded on `enabled`: placeholder data also applies to disabled
        // queries, so a query shrinking below 2 chars would pin stale results.
        placeholderData: enabled ? keepPreviousData : undefined,
        retry: shouldRetrySearch,
      };
    }),
    combine,
  });

  return {
    query: normalizedQuery,
    tooShort,
    ...combined,
  };
};

export default useBlizzardSearch;
