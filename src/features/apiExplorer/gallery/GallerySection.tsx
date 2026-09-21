import { useCallback } from "react";

import { GRID_PRESETS } from "@/components/common/gridColumns";
import ResultCard, {
  getResultCardHeight,
} from "@/components/common/ResultCard";
import type {
  ResultCardResult,
  ResultCardTone,
} from "@/components/common/ResultCard";
import SectionCard from "@/components/common/SectionCard";
import { ErrorState } from "@/components/common/StateBlocks";
import VirtualizedCardGrid from "@/components/common/VirtualizedCardGrid";
import type { VisibleRange } from "@/components/common/VirtualizedCardGrid";
import { sectionLabelForEndpoint } from "@/features/apiExplorer/gallery/normalizeRecords";
import type { GalleryCard } from "@/features/apiExplorer/gallery/normalizeRecords";
import type { VisibleGallerySection } from "@/features/apiExplorer/gallery/useGallerySections";
import type { ApiEndpointDefinition } from "@/features/apiExplorer/types";
import { formatNumber } from "@/lib/format";

export type GallerySectionLayout = "compact" | "row";

export type GallerySectionProps = {
  section: VisibleGallerySection;
  tone: ResultCardTone;
  layout: GallerySectionLayout;
  onSelect: (card: GalleryCard) => void;
  onVisibleRangeChange: (sectionId: string, range: VisibleRange) => void;
  filterActive: boolean;
  /**
   * Show this section's own record count. Off for single-section datasets,
   * where the filter bar's live summary already states the same number.
   */
  showCount?: boolean;
};

export const gallerySectionDomId = (sectionId: string): string =>
  `gallery-section-${sectionId}`;

const getCardKey = (card: GalleryCard): string => card.key;

/** The grid only ever receives GalleryCards, so a selected result is one. */
const isGalleryCard = (result: ResultCardResult): result is GalleryCard =>
  typeof (result as Partial<GalleryCard>).key === "string" &&
  typeof (result as Partial<GalleryCard>).sectionId === "string";

/**
 * Space left above a section when a jump chip scrolls it into view: the
 * sticky app header plus, on md+, the sticky filter bar (search row, sort
 * control and jump chips) that sits under it.
 */
const SCROLL_MARGIN_PX = 16;
const STICKY_FILTER_BAR_ALLOWANCE_PX = 112;

/**
 * One dataset section: an h2 SectionCard around a virtualised ResultCard grid.
 */
const GallerySection = ({
  section,
  tone,
  layout,
  onSelect,
  onVisibleRangeChange,
  filterActive,
  showCount = true,
}: GallerySectionProps): JSX.Element => {
  const handleVisibleRangeChange = useCallback(
    (range: VisibleRange) => onVisibleRangeChange(section.id, range),
    [onVisibleRangeChange, section.id],
  );

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

  // Plain text, not a live region: the filter bar's LiveStatus announces
  // the overall count, so per-section counts stay quiet for screen readers.
  const count = filterActive
    ? `${formatNumber(section.matchCount)} of ${formatNumber(section.totalEntries)} match`
    : `${formatNumber(section.cards.length)} records`;

  return (
    <SectionCard
      title={section.label}
      titleAs="h2"
      id={gallerySectionDomId(section.id)}
      padding="compact"
      description={showCount ? count : undefined}
      sx={(theme) => ({
        scrollMarginTop: {
          xs: theme.wc.layout.headerHeight.xs + SCROLL_MARGIN_PX,
          md:
            theme.wc.layout.headerHeight.md +
            STICKY_FILTER_BAR_ALLOWANCE_PX +
            SCROLL_MARGIN_PX,
        },
      })}
    >
      <VirtualizedCardGrid
        items={section.cards}
        getItemKey={getCardKey}
        columns={layout === "row" ? GRID_PRESETS.rows : GRID_PRESETS.compact}
        itemHeight={getResultCardHeight(layout)}
        gap={16}
        overscanRows={1}
        aria-label={section.label}
        renderItem={renderItem}
        onVisibleRangeChange={handleVisibleRangeChange}
      />
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

export default GallerySection;
