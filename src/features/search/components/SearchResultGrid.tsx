import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import { Box, Button, Pagination, Stack, useTheme } from "@mui/material";
import { useQueries } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link as RouterLink } from "react-router-dom";

import { GRID_PRESETS, gridTemplateColumnsSx } from "@/components/common/gridColumns";
import ResultCard, { getResultCardHeight } from "@/components/common/ResultCard";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import { fetchItemMediaUrl } from "@/features/items/services/itemService";
import type { SearchCategoryState } from "@/features/search/hooks/useBlizzardSearch";
import { SEARCH_PAGE_SIZE } from "@/features/search/services/searchService";
import type { SearchResult } from "@/features/search/types";
import { fetchSpellIcon } from "@/features/spells/services/spellService";
import useIdlePrefetchWindow from "@/hooks/useIdlePrefetchWindow";
import { env } from "@/lib/env";

export type SearchResultGridLayout = "row" | "tile";

export interface SearchResultGridProps {
  state: SearchCategoryState;
  /** The settled query the results belong to (for copy and explorer links). */
  query: string;
  layout?: SearchResultGridLayout;
  onSelect?: (result: SearchResult) => void;
  onPageChange?: (page: number) => void;
}

const MEDIA_GC_TIME_MS = 24 * 60 * 60_000;
const MEDIA_INITIAL_COUNT = 6;
const MEDIA_BATCH_SIZE = 6;

const needsMedia = (result: SearchResult): boolean =>
  !result.mediaUrl && (result.kind === "item" || result.kind === "spell");

type MediaMap = Map<number, string | undefined>;

/**
 * One category's results as row cards, with the media fan-out staggered
 * through the idle window and shared with the explorers' caches
 * (`["item-media", id, region]` / `["spell-media-card", id, region]`).
 */
const SearchResultGrid = ({
  state,
  query,
  layout = "row",
  onSelect,
  onPageChange,
}: SearchResultGridProps): JSX.Element => {
  const theme = useTheme();
  const { category, data, page, pageCount, isLoading, isError, error } = state;

  const mediaTargets = useMemo(() => data.filter(needsMedia), [data]);

  const active = useIdlePrefetchWindow({
    totalCount: mediaTargets.length,
    initialCount: MEDIA_INITIAL_COUNT,
    batchSize: MEDIA_BATCH_SIZE,
    resetKey: `${category.id}:${query}:${page}`,
  });

  const mediaById = useQueries({
    queries: mediaTargets.map((result, index) => ({
      queryKey:
        result.kind === "item"
          ? (["item-media", result.id, env.region] as const)
          : (["spell-media-card", result.id, env.region] as const),
      queryFn: () =>
        result.kind === "item"
          ? fetchItemMediaUrl(result.id)
          : fetchSpellIcon(result.id),
      enabled: index < active,
      retry: false,
      staleTime: Infinity,
      gcTime: MEDIA_GC_TIME_MS,
    })),
    combine: (results: UseQueryResult<string | undefined>[]): MediaMap =>
      new Map(
        results.map((result, index) => [mediaTargets[index].id, result.data]),
      ),
  });

  const enrichedData = useMemo(
    () =>
      data.map((result) => {
        if (result.mediaUrl) {
          return result;
        }
        const mediaUrl = mediaById.get(result.id);
        return mediaUrl ? { ...result, mediaUrl } : result;
      }),
    [data, mediaById],
  );

  if (isLoading && data.length === 0) {
    return (
      <LoadingSkeleton
        variant="rows"
        columns={GRID_PRESETS.rows}
        itemHeight={getResultCardHeight(layout)}
        count={SEARCH_PAGE_SIZE}
        label={`Loading ${category.plural}`}
      />
    );
  }

  if (isError) {
    return (
      <ErrorState
        error={error}
        context={category.plural}
        onRetry={state.refetch}
      />
    );
  }

  if (data.length === 0) {
    const Icon = category.icon;
    return (
      <EmptyState
        icon={<Icon />}
        title={`No ${category.plural} matched "${query}"`}
        description="Check the spelling or try one of the example searches."
      />
    );
  }

  const explorerHref = category.explorerPath
    ? `${category.explorerPath}?q=${encodeURIComponent(query)}`
    : undefined;
  const showPagination = pageCount > 1 && Boolean(onPageChange);

  return (
    <Stack spacing={3}>
      <Box
        role="list"
        aria-label={`${category.label} results`}
        sx={{
          display: "grid",
          gap: 2,
          ...gridTemplateColumnsSx(GRID_PRESETS.rows),
          opacity: state.isPlaceholderData ? 0.6 : 1,
          transition: `opacity ${theme.wc.motion.base}ms ${theme.wc.motion.easing}`,
        }}
      >
        {enrichedData.map((result, index) => (
          <Box key={result.href || result.id} role="listitem">
            <ResultCard
              layout={layout}
              result={result}
              index={index}
              onSelect={onSelect}
            />
          </Box>
        ))}
      </Box>

      {showPagination || explorerHref ? (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          {showPagination ? (
            <Pagination
              count={pageCount}
              page={page}
              onChange={(_, next) => onPageChange?.(next)}
              siblingCount={1}
              aria-label={`${category.label} pages`}
            />
          ) : (
            <span />
          )}
          {explorerHref ? (
            <Button
              component={RouterLink}
              to={explorerHref}
              endIcon={<ArrowForwardRounded />}
            >
              Open in {category.label} explorer
            </Button>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
};

export default SearchResultGrid;
