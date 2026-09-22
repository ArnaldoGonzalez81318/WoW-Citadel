import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import {
  fetchAchievementCategory,
  fetchAchievementGalleryPage,
  sortGalleryItems,
} from "@/features/achievements/services/achievementService";
import type {
  AchievementCategory,
  AchievementCategorySummary,
  AchievementGalleryItem,
  AchievementGalleryPage,
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
  const queryClient = useQueryClient();

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

  // While a freshly selected subcategory is still loading, its parent is
  // usually already cached (the user clicked one of its chips). Reading the
  // root from the cache keeps the tab highlighted and the chip row mounted
  // instead of collapsing both until the detail arrives.
  const cachedParentId = useMemo<number | undefined>(() => {
    if (id === null || category) {
      return undefined;
    }

    return queryClient
      .getQueriesData<AchievementCategory>({
        queryKey: ["achievement-category"],
      })
      .find(([, data]) =>
        data?.subcategories?.some((subcategory) => subcategory.id === id),
      )?.[1]?.id;
  }, [queryClient, id, category]);

  const rootId = category
    ? (category.parent_category?.id ?? id)
    : (cachedParentId ?? id);

  const rootQuery = useQuery({
    queryKey: ["achievement-category", rootId, env.region],
    queryFn: ({ signal }) => fetchAchievementCategory(rootId as number, signal),
    enabled: rootId !== null && rootId !== id,
    staleTime: ONE_HOUR,
  });

  const rootCategory = rootId === id ? category : rootQuery.data;
  const subcategories = rootCategory?.subcategories ?? EMPTY_SUBCATEGORIES;
  const showCategory = subcategories.length > 0 && rootId === id;

  const galleryKey = useMemo(
    () => ["achievement-gallery", id, env.region] as const,
    [id],
  );

  const galleryQuery = useInfiniteQuery({
    queryKey: galleryKey,
    initialPageParam: 1,
    enabled: Boolean(category),
    queryFn: ({ pageParam, signal }) =>
      fetchAchievementGalleryPage(refs, pageParam, pageSize, signal, {
        showCategory,
        browsedCategoryId: id ?? undefined,
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

  const failedRefs = useMemo<AchievementSummary[]>(
    () => pages?.flatMap((page) => page.failedRefs) ?? EMPTY_REFS,
    [pages],
  );
  const failedCount = failedRefs.length;

  // Retries only the achievements that failed and merges them back into the
  // pages that listed them; a full `refetch()` would re-issue every page.
  const retryFailed = useMutation({
    mutationFn: () =>
      fetchAchievementGalleryPage(failedRefs, 1, failedRefs.length, undefined, {
        showCategory,
        browsedCategoryId: id ?? undefined,
      }),
    onSuccess: (recovered) => {
      const stillFailing = new Set(recovered.failedRefs.map((ref) => ref.id));
      const recoveredById = new Map(
        recovered.items.map((item) => [item.achievement.id, item]),
      );

      queryClient.setQueryData<InfiniteData<AchievementGalleryPage, number>>(
        galleryKey,
        (old) => {
          if (!old) {
            return old;
          }

          return {
            ...old,
            pages: old.pages.map((page) => {
              if (page.failedRefs.length === 0) {
                return page;
              }

              const recoveredItems = page.failedRefs
                .map((ref) => recoveredById.get(ref.id))
                .filter(
                  (item): item is AchievementGalleryItem => item !== undefined,
                );
              const remaining = page.failedRefs.filter(
                (ref) => stillFailing.has(ref.id),
              );

              return {
                ...page,
                items: recoveredItems.length
                  ? sortGalleryItems([...page.items, ...recoveredItems])
                  : page.items,
                failedRefs: remaining,
                failedCount: remaining.length,
              };
            }),
          };
        },
      );
    },
  });

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
    failedRefs,
    retryFailed,
    loadMore,
  };
};

export type AchievementGalleryState = ReturnType<typeof useAchievementGallery>;

export default useAchievementGallery;
