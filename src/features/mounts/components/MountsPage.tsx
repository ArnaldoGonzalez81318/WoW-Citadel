import PetsRoundedIcon from "@mui/icons-material/PetsRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchOffRoundedIcon from "@mui/icons-material/SearchOffRounded";
import { Box, Button, Chip, Stack } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { memo, useCallback, useEffect, useState } from "react";

import { ExplorerFilterBar, SearchField } from "@/components/common/ExplorerFilterBar";
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
import MountDetailDialog from "@/features/mounts/components/MountDetailDialog";
import useMountGallery, {
  MOUNT_MIN_QUERY_LENGTH,
  MOUNT_PAGE_SIZE,
} from "@/features/mounts/hooks/useMountGallery";
import type { MountGalleryResult } from "@/features/mounts/types";
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
const QUICK_MOUNTS = [
  "Invincible",
  "Ashes of Al'ar",
  "Swift Spectral Tiger",
  "Mimiron's Head",
];
const CARD_LAYOUT = "tile";
const MEDIA_HEIGHT = 160;
const CARD_HEIGHT = getResultCardHeight(CARD_LAYOUT, MEDIA_HEIGHT);
const GRID_GAP = 16;

type MountGalleryCardProps = {
  mount: MountGalleryResult;
  index: number;
  onSelect: (result: MountGalleryResult) => void;
};

/**
 * Memoised so artwork resolving for one card never re-renders the others:
 * the hook hands out structurally shared results and `onSelect` is stable.
 */
const MountGalleryCard = memo(
  ({ mount, index, onSelect }: MountGalleryCardProps): JSX.Element => {
    const handleSelect = useCallback(
      (_result: SearchResult): void => {
        onSelect(mount);
      },
      [mount, onSelect],
    );

    return (
      <ResultCard
        result={mount}
        layout={CARD_LAYOUT}
        mediaHeight={MEDIA_HEIGHT}
        onSelect={handleSelect}
        index={index}
      />
    );
  },
);
MountGalleryCard.displayName = "MountGalleryCard";

const MountsPage = ({
  eyebrow = DEFAULT_EYEBROW,
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const theme = useTheme();
  const {
    q,
    setQuery,
    isSearchActive,
    mounts,
    total,
    capped,
    loaded,
    isInitialLoading,
    isRefreshing,
    isFetchingNextPage,
    hasMore,
    error,
    retry,
    sentinelRef,
    onVisibleRangeChange,
    failedEnrichment,
    retryFailedEnrichment,
  } = useMountGallery();

  // `q` (URL) is the committed query; `draft` is what the user is typing.
  const [draft, setDraft] = useState(q);
  useEffect(() => {
    setDraft((current) => (current.trim() === q ? current : q));
  }, [q]);

  const [selectedMount, setSelectedMount] = useState<MountGalleryResult | null>(
    null,
  );

  const handleSelect = useCallback((mount: MountGalleryResult): void => {
    setSelectedMount(mount);
  }, []);

  const handleCloseDialog = useCallback((): void => {
    setSelectedMount(null);
  }, []);

  const clearSearch = (): void => {
    setDraft("");
    setQuery("");
  };

  const trimmedQuery = q.trim();
  const hasPageError = error !== null && error !== undefined;
  const isEmpty =
    isSearchActive && !isInitialLoading && !hasPageError && mounts.length === 0;
  const noun = isSearchActive ? "matches" : "mounts";

  const count = { loaded, total, capped, hasMore, noun };
  const totalLabel = formatResultTotal(count);

  const summary = `${formatResultSummary(count)} ${noun}`;

  const footerText = isFetchingNextPage
    ? "Loading more mounts"
    : formatLoadedStatus(count);

  const renderBody = (): JSX.Element => {
    if (hasPageError) {
      return <ErrorState error={error} context="mounts" onRetry={retry} />;
    }

    if (isInitialLoading) {
      return (
        <LoadingSkeleton
          variant="grid"
          columns={GRID_PRESETS.tiles}
          itemHeight={CARD_HEIGHT}
          count={MOUNT_PAGE_SIZE}
          gap={GRID_GAP}
          label="Loading mounts"
        />
      );
    }

    if (isEmpty) {
      return (
        <EmptyState
          icon={<SearchOffRoundedIcon />}
          title={`No mounts match "${trimmedQuery}"`}
          description="Try a broader term or a different spelling."
          action={
            <Button variant="outlined" onClick={clearSearch}>
              Clear search
            </Button>
          }
        />
      );
    }

    return (
      <Stack spacing={2}>
        {failedEnrichment > 0 ? (
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
          >
            <LiveStatus>
              {`Details or artwork for ${formatNumber(failedEnrichment)} ${
                failedEnrichment === 1 ? "mount" : "mounts"
              } could not be loaded`}
            </LiveStatus>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshRoundedIcon />}
              onClick={retryFailedEnrichment}
            >
              Retry
            </Button>
          </Stack>
        ) : null}

        <VirtualizedCardGrid
          items={mounts}
          getItemKey={(mount) => mount.id}
          itemHeight={CARD_HEIGHT}
          columns={GRID_PRESETS.tiles}
          gap={GRID_GAP}
          aria-label="Mount results"
          onVisibleRangeChange={onVisibleRangeChange}
          renderItem={(mount, index) => (
            <MountGalleryCard mount={mount} index={index} onSelect={handleSelect} />
          )}
        />

        <Stack spacing={1} alignItems="center">
          <LiveStatus busy={isFetchingNextPage}>{footerText}</LiveStatus>
          {hasMore ? (
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
        title="Mounts"
        eyebrow={eyebrow}
        breadcrumbs={breadcrumbs}
        icon={<PetsRoundedIcon />}
        description="Browse every mount in Blizzard's live index, or search by name."
        documentTitle="Mounts"
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {totalLabel ? (
              <Chip size="small" label={`${totalLabel} ${noun}`} />
            ) : null}
          </>
        }
      />

      <ExplorerFilterBar
        sticky
        label="Mount filters"
        summary={hasPageError ? undefined : summary}
        progress={isRefreshing}
      >
        <SearchField
          id="mounts-search"
          label="Search mounts by name"
          placeholder="Search mounts by name…"
          value={draft}
          onChange={setDraft}
          onDebouncedChange={setQuery}
          onSubmit={setQuery}
          onClear={clearSearch}
          debounceMs={350}
          minLength={MOUNT_MIN_QUERY_LENGTH}
        />

        <Stack
          role="group"
          aria-label="Featured mounts"
          direction="row"
          flexWrap="wrap"
          useFlexGap
          gap={1}
          alignItems="center"
          sx={{ minWidth: 0 }}
        >
          {QUICK_MOUNTS.map((mountName) => {
            const pressed = trimmedQuery === mountName;
            return (
              <Chip
                key={mountName}
                label={mountName}
                clickable
                variant="outlined"
                color={pressed ? "primary" : "default"}
                aria-pressed={pressed}
                onClick={() => {
                  setDraft(mountName);
                  setQuery(mountName);
                }}
              />
            );
          })}
        </Stack>

        {q ? (
          <Button variant="text" onClick={clearSearch}>
            Back to full index
          </Button>
        ) : null}
      </ExplorerFilterBar>

      {renderBody()}

      <MountDetailDialog
        mount={selectedMount}
        open={selectedMount !== null}
        onClose={handleCloseDialog}
      />
    </Stack>
  );
};

export default MountsPage;
