import { Box, Button, Stack } from "@mui/material";
import { memo, useCallback } from "react";

import { GRID_PRESETS } from "@/components/common/gridColumns";
import ResultCard, {
  getResultCardHeight,
} from "@/components/common/ResultCard";
import type {
  ResultCardResult,
  ResultCardTone,
} from "@/components/common/ResultCard";
import SectionCard from "@/components/common/SectionCard";
import {
  ErrorState,
  LiveStatus,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import VirtualizedCardGrid from "@/components/common/VirtualizedCardGrid";
import type { VisibleRange } from "@/components/common/VirtualizedCardGrid";
import {
  gallerySectionDomId,
  sectionLabelForEndpoint,
} from "@/features/apiExplorer/gallery/normalizeRecords";
import type { GalleryCard } from "@/features/apiExplorer/gallery/normalizeRecords";
import { GALLERY_PAGINATE_ABOVE } from "@/features/apiExplorer/gallery/useGallerySections";
import type { VisibleGallerySection } from "@/features/apiExplorer/gallery/useGallerySections";
import type { ApiEndpointDefinition } from "@/features/apiExplorer/types";
import useInfiniteScrollTrigger from "@/hooks/useInfiniteScrollTrigger";
import { formatNumber } from "@/lib/format";
import { formatLoadedStatus } from "@/lib/resultCount";

export type GallerySectionLayout = "compact" | "row";

export type GallerySectionProps = {
  section: VisibleGallerySection;
  tone: ResultCardTone;
  layout: GallerySectionLayout;
  onSelect: (card: GalleryCard) => void;
  onVisibleRangeChange: (sectionId: string, range: VisibleRange) => void;
  /** Reveals the section's next page (large sections only). */
  onLoadMore: (sectionId: string) => void;
  filterActive: boolean;
  /**
   * Render the section's own h2 title and record count. Off for
   * single-section datasets, where the page h1 already names the dataset and
   * the filter bar's live summary states the same number.
   */
  headed?: boolean;
  /**
   * Measured height of the sticky filter bar (md+ only), so a jump lands the
   * title below it instead of under it.
   */
  stickyOffset?: number;
};

const getCardKey = (card: GalleryCard): string => card.key;

/** The grid only ever receives GalleryCards, so a selected result is one. */
const isGalleryCard = (result: ResultCardResult): result is GalleryCard =>
  typeof (result as Partial<GalleryCard>).key === "string" &&
  typeof (result as Partial<GalleryCard>).sectionId === "string";

const SCROLL_MARGIN_PX = 16;
const GRID_GAP_PX = 16;
const SKELETON_COUNT = 24;

/**
 * One dataset section: an h2 SectionCard around a virtualised ResultCard grid.
 * While its index request is pending, the grid is a skeleton with the same
 * columns, item height and gap, so the swap causes no layout shift.
 */
const GallerySection = ({
  section,
  tone,
  layout,
  onSelect,
  onVisibleRangeChange,
  onLoadMore,
  filterActive,
  headed = true,
  stickyOffset = 0,
}: GallerySectionProps): JSX.Element => {
  const handleVisibleRangeChange = useCallback(
    (range: VisibleRange) => onVisibleRangeChange(section.id, range),
    [onVisibleRangeChange, section.id],
  );

  const handleLoadMore = useCallback(
    () => onLoadMore(section.id),
    [onLoadMore, section.id],
  );

  // The next page is already in memory, so there is never a loading state:
  // the sentinel reveals it as it scrolls near, the button is the fallback.
  const sentinelRef = useInfiniteScrollTrigger({
    enabled: section.hasMore,
    hasMore: section.hasMore,
    onLoadMore: handleLoadMore,
  });

  const handleSelect = useCallback(
    (result: ResultCardResult): void => {
      if (isGalleryCard(result)) {
        onSelect(result);
      }
    },
    [onSelect],
  );

  const renderItem = useCallback(
    (item: GalleryCard): JSX.Element => (
      <ResultCard
        result={item}
        layout={layout}
        tone={tone}
        onSelect={handleSelect}
        showExternalLink={Boolean(item.externalUrl)}
      />
    ),
    [layout, tone, handleSelect],
  );

  const columns = layout === "row" ? GRID_PRESETS.rows : GRID_PRESETS.compact;
  const itemHeight = getResultCardHeight(layout);

  // Plain text, not a live region: the filter bar's LiveStatus announces
  // the overall count, so per-section counts stay quiet for screen readers.
  const count = filterActive
    ? `${formatNumber(section.matchCount)} of ${formatNumber(section.totalEntries)} match`
    : `${formatNumber(section.totalEntries)} records`;

  // Paged sections announce their own progress; the population is the match
  // count while filtering, the whole section otherwise. The wording follows
  // the other explorers' footers ("96 of 2,179 pets loaded") rather than
  // repeating the filter bar's "Showing 96 of 2,179" in a second live region.
  const paged = section.matchCount > GALLERY_PAGINATE_ABOVE;
  const population = filterActive ? section.matchCount : section.totalEntries;
  const loadedStatus = formatLoadedStatus({
    loaded: section.cards.length,
    total: population,
    hasMore: section.hasMore,
    noun: section.label.toLowerCase(),
  });

  return (
    <SectionCard
      title={headed ? section.label : undefined}
      titleAs="h2"
      id={gallerySectionDomId(section.id)}
      padding="compact"
      description={headed && !section.pending ? count : undefined}
      sx={(theme) => ({
        scrollMarginTop: {
          xs: theme.wc.layout.headerHeight.xs + SCROLL_MARGIN_PX,
          md: theme.wc.layout.headerHeight.md + stickyOffset + SCROLL_MARGIN_PX,
        },
      })}
    >
      {section.pending ? (
        <LoadingSkeleton
          variant="grid"
          columns={columns}
          itemHeight={itemHeight}
          count={SKELETON_COUNT}
          gap={GRID_GAP_PX}
          label={`Loading ${section.label}`}
        />
      ) : (
        <Stack spacing={2}>
          <VirtualizedCardGrid
            items={section.cards}
            getItemKey={getCardKey}
            columns={columns}
            itemHeight={itemHeight}
            gap={GRID_GAP_PX}
            overscanRows={1}
            aria-label={section.label}
            renderItem={renderItem}
            onVisibleRangeChange={handleVisibleRangeChange}
          />
          {paged ? (
            <Stack
              direction="row"
              flexWrap="wrap"
              useFlexGap
              gap={1.5}
              alignItems="center"
              justifyContent="center"
            >
              <LiveStatus>{loadedStatus}</LiveStatus>
              {section.hasMore ? (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleLoadMore}
                >
                  Load more
                </Button>
              ) : null}
            </Stack>
          ) : null}
          {section.hasMore ? (
            <Box
              ref={sentinelRef}
              aria-hidden="true"
              sx={{ width: "100%", height: "1px", flexShrink: 0 }}
            />
          ) : null}
        </Stack>
      )}
    </SectionCard>
  );
};

export type GallerySectionErrorProps = {
  endpoint: ApiEndpointDefinition;
  error: unknown;
  onRetry: () => void;
};

/** A section whose index request failed: same heading, ErrorState body. */
export const GallerySectionError = ({
  endpoint,
  error,
  onRetry,
}: GallerySectionErrorProps): JSX.Element => (
  <SectionCard
    title={sectionLabelForEndpoint(endpoint)}
    titleAs="h2"
    id={gallerySectionDomId(endpoint.id)}
    padding="compact"
  >
    <ErrorState
      error={error}
      context={endpoint.label.toLowerCase()}
      onRetry={onRetry}
      compact
    />
  </SectionCard>
);

/** Memoised: untouched sections bail out during filter keystrokes and scroll. */
export default memo(GallerySection);
