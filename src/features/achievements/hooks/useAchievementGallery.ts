import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import {
  fetchAchievementCategory,
  fetchAchievementGalleryPage,
} from "@/features/achievements/services/achievementService";
import type {
  AchievementCategorySummary,
  AchievementGalleryItem,
  AchievementSummary,
} from "@/features/achievements/types";
import { env } from "@/lib/env";

const ONE_HOUR = 3_600_000;
const TEN_MINUTES = 600_000;
const EMPTY_REFS: AchievementSummary[] = [];
const EMPTY_SUBCATEGORIES: AchievementCategorySummary[] = [];

/**
 * Category detail (fetched once per category) plus the paged achievement
 * gallery for it. When a subcategory is selected, its root is fetched too so
 * the sibling subcategories stay listed.
 */
export const useAchievementGallery = (
  selectedCategoryId: number | null,
  pageSize = 18,
) => {
  const id = selectedCategoryId;

  const categoryQuery = useQuery({
    queryKey: ["achievement-category", id, env.region],
    queryFn: ({ signal }) => fetchAchievementCategory(id as number, signal),
    enabled: id !== null,
    staleTime: ONE_HOUR,
  });

  const category = categoryQuery.data;
  const refs = useMemo<AchievementSummary[]>(
    () => category?.achievements ?? category?.root_achievements ?? EMPTY_REFS,
    [category],
  );

  const rootId = category?.parent_category?.id ?? id;

  const rootQuery = useQuery({
    queryKey: ["achievement-category", rootId, env.region],
    queryFn: ({ signal }) => fetchAchievementCategory(rootId as number, signal),
    enabled: rootId !== null && rootId !== id,
    staleTime: ONE_HOUR,
  });

  const rootCategory = rootId === id ? category : rootQuery.data;
  const subcategories = rootCategory?.subcategories ?? EMPTY_SUBCATEGORIES;
  const showCategory = subcategories.length > 0 && rootId === id;

  const galleryQuery = useInfiniteQuery({
    queryKey: ["achievement-gallery", id, env.region],
    initialPageParam: 1,
    enabled: Boolean(category),
    queryFn: ({ pageParam, signal }) =>
      fetchAchievementGalleryPage(refs, pageParam, pageSize, signal, {
        showCategory,
      }),
    getNextPageParam: (last) =>
      last.page < last.pageCount ? last.page + 1 : undefined,
    placeholderData: keepPreviousData,
    staleTime: TEN_MINUTES,
  });

  const pages = galleryQuery.data?.pages;

  const items = useMemo<AchievementGalleryItem[]>(
    () => pages?.flatMap((page) => page.items) ?? [],
    [pages],
  );

  const failedCount = useMemo(
    () => pages?.reduce((sum, page) => sum + page.failedCount, 0) ?? 0,
    [pages],
  );

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = galleryQuery;

  const loadMore = useCallback((): void => {
    if (!hasNextPage || isFetchingNextPage) {
      return;
    }
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return {
    categoryQuery,
    rootQuery,
    rootId,
    rootCategory,
    parent: category?.parent_category,
    subcategories,
    refs,
    galleryQuery,
    items,
    failedCount,
    loadMore,
  };
};

export type AchievementGalleryState = ReturnType<typeof useAchievementGallery>;

export default useAchievementGallery;
