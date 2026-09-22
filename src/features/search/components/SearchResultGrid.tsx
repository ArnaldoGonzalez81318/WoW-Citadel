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
import {
  fetchItemMediaUrl,
  itemKeys,
} from "@/features/items/services/itemService";
import type { SearchCategoryState } from "@/features/search/hooks/useBlizzardSearch";
import { SEARCH_PAGE_SIZE } from "@/features/search/services/searchService";
import type { SearchResult } from "@/features/search/types";
import {
  fetchSpellIcon,
  spellKeys,
} from "@/features/spells/services/spellService";
import useIdlePrefetchWindow from "@/hooks/useIdlePrefetchWindow";

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
const GRID_GAP_PX = 16;

const needsMedia = (result: SearchResult): boolean =>
  !result.mediaUrl && (result.kind === "item" || result.kind === "spell");

/**
 * Module-level so react-query only re-runs it when a result changes, and a
 * plain array so `replaceEqualDeep` keeps the previous identity (a Map is
 * never structurally shared), which lets `enrichedData` memoise.
 */
const combineMedia = <T,>(results: UseQueryResult<T>[]): (T | undefined)[] =>
  results.map((result) => result.data);

/**
 * One category's results as row cards, with the media fan-out staggered
 * through the idle window and keyed exactly like the explorers
 * (`itemKeys.media(id)` / `spellKeys.icon(id)`) so both share one cache.
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

  const mediaUrls = useQueries({
    queries: mediaTargets.map((result, index) => ({
      queryKey:
        result.kind === "item"
          ? itemKeys.media(result.id)
          : spellKeys.icon(result.id),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        result.kind === "item"
          ? fetchItemMediaUrl(result.id, signal)
          : fetchSpellIcon(result.id, signal),
      enabled: index < active,
      retry: false,
      staleTime: Infinity,
      gcTime: MEDIA_GC_TIME_MS,
    })),
    combine: combineMedia,
  });

  const enrichedData = useMemo(() => {
    const byId = new Map(
      mediaTargets.map((target, index) => [target.id, mediaUrls[index]] as const),
    );
    return data.map((result) => {
      if (result.mediaUrl) {
        return result;
      }
      const mediaUrl = byId.get(result.id);
      return mediaUrl ? { ...result, mediaUrl } : result;
    });
  }, [data, mediaTargets, mediaUrls]);

  // A first load, or a new key whose placeholder is an empty previous page:
  // never show "No matches" for a query that is still in flight.
  const isPending =
    isLoading || (state.isPlaceholderData && data.length === 0);

  if (isPending) {
    return (
      <LoadingSkeleton
        variant="grid"
        columns={GRID_PRESETS.rows}
        itemHeight={getResultCardHeight(layout)}
        count={SEARCH_PAGE_SIZE}
        gap={GRID_GAP_PX}
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
