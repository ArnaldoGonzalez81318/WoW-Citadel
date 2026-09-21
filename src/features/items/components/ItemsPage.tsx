import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchOffRoundedIcon from "@mui/icons-material/SearchOffRounded";
import { Box, Button, Chip, Stack } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { memo, useCallback, useState } from "react";

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
import type { SearchResult } from "@/features/search/types";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import {
  formatLoadedStatus,
  formatResultSummary,
  formatResultTotal,
} from "@/lib/resultCount";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

const DEFAULT_EYEBROW = "Collectibles & Gear";
const CARD_LAYOUT = "compact";
const CARD_HEIGHT = getResultCardHeight(CARD_LAYOUT);
const GRID_GAP = 16;

type ItemGalleryCardProps = {
  item: SearchResult;
  mediaUrl: string | undefined;
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
    items,
    mediaUrls,
    total,
    capped,
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

  const handleSelect = useCallback((item: SearchResult): void => {
    setSelectedItem(item);
  }, []);

  const handleCloseDialog = useCallback((): void => {
    setSelectedItem(null);
  }, []);

  const activeSubclassName =
    activeSubclassId === null
      ? undefined
      : subclasses.find((entry) => entry.id === activeSubclassId)?.name;

  const hasPageError = error !== null && error !== undefined;
  const isEmpty = !isInitialLoading && !hasPageError && items.length === 0;

  const count = {
    loaded: items.length,
    total,
    capped,
    hasMore: hasNextPage,
    noun: "items",
  };
  const totalLabel = formatResultTotal(count);

  const summary = `${formatResultSummary(count)}${
    activeSubclassName ? ` · ${activeSubclassName}` : ""
  }`;

  const footerText = isFetchingNextPage
    ? "Loading more items"
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
            <Button
              variant="outlined"
              onClick={() => {
                setQuery("");
                setSubclass(null);
              }}
            >
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
              {`Icons for ${formatNumber(failedMedia)} ${
                failedMedia === 1 ? "item" : "items"
              } could not be loaded`}
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
            {totalLabel ? (
              <Chip size="small" label={`${totalLabel} items`} />
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
