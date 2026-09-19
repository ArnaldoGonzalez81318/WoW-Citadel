import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import { Alert, Box, Button, Chip, Stack } from "@mui/material";
import { useMemo, useState } from "react";

import { GRID_PRESETS } from "@/components/common/gridColumns";
import PageHeader from "@/components/common/PageHeader";
import ResultCard, {
  getResultCardHeight,
} from "@/components/common/ResultCard";
import SectionCard from "@/components/common/SectionCard";
import {
  EmptyState,
  ErrorState,
  LiveStatus,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import VirtualizedCardGrid from "@/components/common/VirtualizedCardGrid";
import AchievementCategoryTree from "@/features/achievements/components/AchievementCategoryTree";
import AchievementDetailDialog from "@/features/achievements/components/AchievementDetailDialog";
import { useAchievementCategoryIndex } from "@/features/achievements/hooks/useAchievementCategoryIndex";
import { useAchievementGallery } from "@/features/achievements/hooks/useAchievementGallery";
import type {
  AchievementCategorySummary,
  AchievementGalleryItem,
} from "@/features/achievements/types";
import useInfiniteScrollTrigger from "@/hooks/useInfiniteScrollTrigger";
import { useSearchParamState } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";

const PAGE_SIZE = 18;
const ROW_HEIGHT = getResultCardHeight("row");
const GRID_GAP = 16;
const EMPTY_CATEGORIES: AchievementCategorySummary[] = [];

const AchievementsPage = (): JSX.Element => {
  const [categoryParam, setCategoryParam] = useSearchParamState("category");
  const [selected, setSelected] = useState<AchievementGalleryItem | null>(null);

  const indexQuery = useAchievementCategoryIndex();
  const rootCategories = indexQuery.data?.rootCategories ?? EMPTY_CATEGORIES;
  const allCategories = indexQuery.data?.categories ?? EMPTY_CATEGORIES;

  // The URL is the source of truth; the first root is the default selection.
  const parsedId = Number(categoryParam);
  const selectedCategoryId: number | null =
    Number.isInteger(parsedId) && parsedId > 0
      ? parsedId
      : (rootCategories[0]?.id ?? null);

  const {
    categoryQuery,
    rootId,
    parent,
    subcategories,
    refs,
    galleryQuery,
    items,
    failedCount,
    loadMore,
  } = useAchievementGallery(selectedCategoryId, PAGE_SIZE);

  const selectedName = useMemo(
    () =>
      categoryQuery.data?.name ??
      allCategories.find((category) => category.id === selectedCategoryId)?.name,
    [allCategories, categoryQuery.data?.name, selectedCategoryId],
  );

  const handleSelect = (id: number): void => {
    if (id !== selectedCategoryId) {
      setCategoryParam(String(id));
    }
  };

  const hasGalleryData = Boolean(galleryQuery.data);
  const isLoading =
    indexQuery.isLoading ||
    (categoryQuery.isLoading && !hasGalleryData) ||
    (galleryQuery.isLoading && !hasGalleryData);
  const isRefreshing =
    categoryQuery.isFetching ||
    (galleryQuery.isFetching && galleryQuery.isPlaceholderData);

  const infiniteScrollRef = useInfiniteScrollTrigger({
    enabled:
      Boolean(galleryQuery.hasNextPage) &&
      !galleryQuery.isError &&
      !galleryQuery.isPlaceholderData,
    hasMore: galleryQuery.hasNextPage,
    isLoading: galleryQuery.isFetchingNextPage,
    onLoadMore: loadMore,
  });

  const renderBody = (): JSX.Element => {
    if (indexQuery.isError) {
      return (
        <ErrorState
          error={indexQuery.error}
          context="achievement categories"
          onRetry={() => void indexQuery.refetch()}
        />
      );
    }

    if (categoryQuery.isError) {
      return (
        <ErrorState
          error={categoryQuery.error}
          context="this achievement category"
          onRetry={() => void categoryQuery.refetch()}
        />
      );
    }

    if (galleryQuery.isError) {
      return (
        <ErrorState
          error={galleryQuery.error}
          context="achievements"
          onRetry={() => void galleryQuery.refetch()}
        />
      );
    }

    if (isLoading) {
      return (
        <LoadingSkeleton
          variant="grid"
          columns={GRID_PRESETS.rows}
          itemHeight={ROW_HEIGHT}
          count={PAGE_SIZE}
          gap={GRID_GAP}
          label="Loading achievements"
        />
      );
    }

    if (categoryQuery.data && refs.length === 0) {
      return (
        <EmptyState
          title="No achievements in this category"
          description="Pick a subcategory above."
        />
      );
    }

    return (
      <Stack spacing={2}>
        {failedCount > 0 ? (
          <Alert
            severity="warning"
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => void galleryQuery.refetch()}
              >
                Retry
              </Button>
            }
          >
            {failedCount === 1
              ? "1 achievement could not be loaded."
              : `${formatNumber(failedCount)} achievements could not be loaded.`}
          </Alert>
        ) : null}

        <SectionCard
          title={selectedName ?? "Achievements"}
          titleAs="h2"
          description={
            parent && selectedName ? `${parent.name} › ${selectedName}` : undefined
          }
          padding="compact"
        >
          <VirtualizedCardGrid
            items={items}
            getItemKey={(item) => item.achievement.id}
            columns={GRID_PRESETS.rows}
            itemHeight={ROW_HEIGHT}
            gap={GRID_GAP}
            aria-label="Achievements"
            renderItem={(item) => (
              <ResultCard
                result={item.result}
                layout="row"
                onSelect={() => setSelected(item)}
              />
            )}
          />
        </SectionCard>

        <Stack spacing={1} alignItems="center">
          <LiveStatus busy={galleryQuery.isFetchingNextPage}>
            {galleryQuery.isFetchingNextPage
              ? "Loading more achievements"
              : galleryQuery.hasNextPage
                ? `${formatNumber(items.length)} of ${formatNumber(refs.length)} achievements loaded`
                : `All ${formatNumber(items.length)} achievements loaded`}
          </LiveStatus>
          {galleryQuery.hasNextPage ? (
            <Box
              ref={infiniteScrollRef}
              aria-hidden="true"
              sx={{ width: "100%", height: 1 }}
            />
          ) : null}
        </Stack>
      </Stack>
    );
  };

  return (
    <Box
      sx={(theme) => ({
        display: "flex",
        flexDirection: "column",
        gap: {
          xs: theme.spacing(theme.wc.layout.sectionGap.xs),
          md: theme.spacing(theme.wc.layout.sectionGap.md),
        },
      })}
    >
      <PageHeader
        eyebrow="Character Progression"
        title="Achievements"
        documentTitle="Achievements"
        icon={<EmojiEventsRoundedIcon />}
        description="Browse Blizzard's achievement categories and their achievements, points and rewards."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {categoryQuery.data ? (
              <Chip
                size="small"
                label={`${formatNumber(refs.length)} achievements`}
              />
            ) : null}
          </>
        }
      />

      {indexQuery.isSuccess ? (
        <AchievementCategoryTree
          rootCategories={rootCategories}
          rootId={rootId}
          subcategories={subcategories}
          selectedId={selectedCategoryId}
          onSelect={handleSelect}
          summary={
            categoryQuery.data
              ? `${formatNumber(refs.length)} achievements`
              : undefined
          }
          progress={isRefreshing}
        />
      ) : null}

      {renderBody()}

      <AchievementDetailDialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        item={selected}
      />
    </Box>
  );
};

export default AchievementsPage;
