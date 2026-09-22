import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchOffRoundedIcon from "@mui/icons-material/SearchOffRounded";
import { Box, Button, Chip, Stack } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { memo, useCallback, useRef, useState } from "react";

import { ExplorerFilterBar } from "@/components/common/ExplorerFilterBar";
import { GRID_PRESETS } from "@/components/common/gridColumns";
import PageHeader from "@/components/common/PageHeader";
import ResultCard, { getResultCardHeight } from "@/components/common/ResultCard";
import {
  EmptyState,
  ErrorState,
  LiveStatus,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import VirtualizedCardGrid from "@/components/common/VirtualizedCardGrid";
import ItemDetailDialog from "@/features/items/components/ItemDetailDialog";
import ItemFilters from "@/features/items/components/ItemFilters";
import useItemGallery, {
  ITEM_PAGE_SIZE,
} from "@/features/items/hooks/useItemGallery";
import type { ItemMediaUrl } from "@/features/items/hooks/useItemGallery";
import type { SearchResult } from "@/features/search/types";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import {
  formatLoadedStatus,
  formatResultSummary,
  formatResultTotal,
} from "@/lib/resultCount";
import { formatPageProgress } from "@/features/items/pageProgress";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

const DEFAULT_EYEBROW = "Collectibles & Gear";
const CARD_LAYOUT = "compact";
const CARD_HEIGHT = getResultCardHeight(CARD_LAYOUT);
const GRID_GAP = 16;

const pluralize = (count: number, singular: string, plural: string): string =>
  count === 1 ? singular : plural;

type ItemGalleryCardProps = {
  item: SearchResult;
  mediaUrl: ItemMediaUrl;
  index: number;
  onSelect: (item: SearchResult) => void;
};

/**
 * Memoised so an icon resolving for one card never re-renders the others:
 * `item` is structurally shared by react-query, `mediaUrl` is a primitive
 * and `onSelect` is stable.
 */
const ItemGalleryCard = memo(
  ({ item, mediaUrl, index, onSelect }: ItemGalleryCardProps): JSX.Element => (
    <ResultCard
      result={mediaUrl ? { ...item, mediaUrl } : item}
      layout={CARD_LAYOUT}
      onSelect={onSelect}
      index={index}
    />
  ),
);
ItemGalleryCard.displayName = "ItemGalleryCard";

const ItemsPage = ({
  eyebrow = DEFAULT_EYEBROW,
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const theme = useTheme();
  const gallery = useItemGallery();
  const {
    itemClasses,
    activeClassId,
    subclasses,
    activeSubclassId,
    q,
    setClass,
    setSubclass,
    setQuery,
    clearFilters,
    items,
    mediaUrls,
    total,
    capped,
    pageCount,
    loadedPages,
    isInitialLoading,
    isRefreshing,
    isFetchingNextPage,
    hasNextPage,
    isClassDetailLoading,
    error,
    retry,
    sentinelRef,
    onVisibleRangeChange,
    failedMedia,
    retryFailedMedia,
  } = gallery;

  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSelect = useCallback((item: SearchResult): void => {
    setSelectedItem(item);
  }, []);

  // The empty state's "Clear filters" button is replaced by the grid, so
  // focus moves to the search field first instead of dropping to <body>.
  const handleClearFilters = useCallback((): void => {
    searchInputRef.current?.focus();
    clearFilters();
  }, [clearFilters]);

  const handleCloseDialog = useCallback((): void => {
    setSelectedItem(null);
  }, []);

  const activeSubclassName =
    activeSubclassId === null
      ? undefined
      : subclasses.find((entry) => entry.id === activeSubclassId)?.name;

  const hasPageError = error !== null && error !== undefined;
  const isEmpty = !isInitialLoading && !hasPageError && items.length === 0;

  // The noun agrees with the number printed beside it: the footer counts
  // `loaded`, the header chip the total (or `loaded` once everything is in).
  const loaded = items.length;
  const knownTotal = typeof total === "number" ? total : loaded;

  const count = {
    loaded,
    total,
    capped,
    hasMore: hasNextPage,
    noun: pluralize(loaded, "item", "items"),
  };
  const totalLabel = formatResultTotal(count);
  const showTotalChip = totalLabel !== undefined && knownTotal > 0;

  // A multi-page search response carries no total, only a page count, so
  // "Showing 24" becomes "Showing 24 · page 1 of 2" rather than a bare count.
  const pageProgress =
    totalLabel === undefined
      ? formatPageProgress(loadedPages, pageCount)
      : undefined;

  const summary = [
    formatResultSummary(count),
    pageProgress,
    activeSubclassName,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  const footerText = isFetchingNextPage
    ? "Loading more items"
    : pageProgress
      ? `${formatNumber(loaded)} ${count.noun} loaded · ${pageProgress}`
      : formatLoadedStatus(count);

  const renderBody = (): JSX.Element => {
    if (hasPageError) {
      return <ErrorState error={error} context="items" onRetry={retry} />;
    }

    if (isInitialLoading) {
      return (
        <LoadingSkeleton
          variant="grid"
          columns={GRID_PRESETS.compact}
          itemHeight={CARD_HEIGHT}
          count={ITEM_PAGE_SIZE}
          gap={GRID_GAP}
          label="Loading items"
        />
      );
    }

    if (isEmpty) {
      return (
        <EmptyState
          icon={<SearchOffRoundedIcon />}
          title={q ? `No items match "${q}"` : "No items in this subclass"}
          description="Try another subclass or a broader search."
          action={
            <Button variant="outlined" onClick={handleClearFilters}>
              Clear filters
            </Button>
          }
        />
      );
    }

    return (
      <Stack spacing={2}>
        {failedMedia > 0 ? (
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
          >
            <LiveStatus>
              {`Icons for ${formatNumber(failedMedia)} ${pluralize(
                failedMedia,
                "item",
                "items",
              )} could not be loaded`}
            </LiveStatus>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshRoundedIcon />}
              onClick={retryFailedMedia}
            >
              Retry
            </Button>
          </Stack>
        ) : null}

        <VirtualizedCardGrid
          items={items}
          getItemKey={(item) => item.id}
          itemHeight={CARD_HEIGHT}
          columns={GRID_PRESETS.compact}
          gap={GRID_GAP}
          minItemsBeforeVirtualize={ITEM_PAGE_SIZE}
          aria-label="Item results"
          onVisibleRangeChange={onVisibleRangeChange}
          renderItem={(item, index) => (
            <ItemGalleryCard
              item={item}
              mediaUrl={mediaUrls[index]}
              index={index}
              onSelect={handleSelect}
            />
          )}
        />

        <Stack spacing={1} alignItems="center">
          <LiveStatus busy={isFetchingNextPage}>{footerText}</LiveStatus>
          {hasNextPage ? (
            <Box ref={sentinelRef} sx={{ width: "100%", height: 1 }} />
          ) : null}
        </Stack>
      </Stack>
    );
  };

  return (
    <Stack
      spacing={{
        xs: theme.wc.layout.sectionGap.xs,
        md: theme.wc.layout.sectionGap.md,
      }}
    >
      <PageHeader
        title="Items"
        eyebrow={eyebrow}
        breadcrumbs={breadcrumbs}
        icon={<Inventory2RoundedIcon />}
        description="Browse Blizzard's live item catalogue by class, subclass and name."
        documentTitle="Items"
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {showTotalChip ? (
              <Chip
                size="small"
                label={`${totalLabel} ${pluralize(knownTotal, "item", "items")}`}
              />
            ) : null}
          </>
        }
      />

      <ExplorerFilterBar
        sticky
        label="Item filters"
        summary={hasPageError ? undefined : summary}
        progress={isRefreshing}
      >
        <ItemFilters
          itemClasses={itemClasses}
          activeClassId={activeClassId}
          subclasses={subclasses}
          activeSubclassId={activeSubclassId}
          isSubclassesLoading={isClassDetailLoading}
          q={q}
          onClassChange={setClass}
          onSubclassChange={setSubclass}
          onQueryChange={setQuery}
          searchInputRef={searchInputRef}
        />
      </ExplorerFilterBar>

      {renderBody()}

      <ItemDetailDialog
        item={selectedItem}
        open={selectedItem !== null}
        onClose={handleCloseDialog}
      />
    </Stack>
  );
};

export default ItemsPage;
