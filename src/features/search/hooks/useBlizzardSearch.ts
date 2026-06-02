import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { SEARCH_CATEGORIES } from "@/features/search/categories";
import { CategoryQueryState, SearchResult } from "@/features/search/types";
import useDebouncedValue from "@/hooks/useDebouncedValue";

export const useBlizzardSearch = (query: string) => {
  const debouncedQuery = useDebouncedValue(query, 500);
  const normalizedQuery = debouncedQuery.trim();

  const results = useQueries({
    queries: SEARCH_CATEGORIES.map((category) => ({
      queryKey: ["search", category.id, normalizedQuery],
      queryFn: () => category.fetcher(normalizedQuery),
      staleTime: 1000 * 60 * 10,
      enabled: normalizedQuery.length >= (category.minQueryLength ?? 1),
    })),
  }) as Array<UseQueryResult<SearchResult[]>>;

  const categoryStates: CategoryQueryState[] = useMemo(
    () =>
      results.map((result, index) => ({
        category: SEARCH_CATEGORIES[index],
        data: result.data,
        isLoading: result.isLoading,
        isError: result.isError,
        error: (result.error as Error | undefined) ?? undefined,
      })),
    [results],
  );

  const isFetching = categoryStates.some((state) => state.isLoading);
  const hasAnyResults = categoryStates.some(
    (state) => (state.data?.length ?? 0) > 0,
  );

  return {
    query: normalizedQuery,
    categoryStates,
    isFetching,
    hasAnyResults,
  };
};
