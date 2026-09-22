import PetsRoundedIcon from "@mui/icons-material/PetsRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchOffRoundedIcon from "@mui/icons-material/SearchOffRounded";
import { Box, Button, Chip, Stack } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";

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
import { useTileMediaHeight } from "@/components/common/useTileMediaHeight";
import VirtualizedCardGrid from "@/components/common/VirtualizedCardGrid";
import { formatPageProgress } from "@/features/items/pageProgress";
import MountDetailDialog from "@/features/mounts/components/MountDetailDialog";
import useMountGallery, {
  MOUNT_MIN_QUERY_LENGTH,
  MOUNT_PAGE_SIZE,
  toMountResult,
} from "@/features/mounts/hooks/useMountGallery";
import type { MountMediaUrl } from "@/features/mounts/hooks/useMountGallery";
import type {
  MountDetail,
  MountGalleryResult,
  MountSummary,
} from "@/features/mounts/types";
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
const GRID_COLUMNS = GRID_PRESETS.tiles;
const GRID_GAP = 16;

const pluralize = (count: number, singular: string, plural: string): string =>
  count === 1 ? singular : plural;

type MountGalleryCardProps = {
  mount: MountSummary;
  detail: MountDetail | undefined;
  mediaUrl: MountMediaUrl;
  /** 16:9 artwork height for the current cell width (shared by every card). */
  mediaHeight: number;
  index: number;
  onSelect: (result: MountGalleryResult) => void;
};

/**
 * Memoised so artwork resolving for one card never re-renders the others:
 * `mount` and `detail` are structurally shared by react-query, `mediaUrl`
 * is a primitive and `onSelect` is stable. The card result is assembled
 * here, from those stable inputs, rather than rebuilt for every mount each
 * time any enrichment query settles.
 */
const MountGalleryCard = memo(
  ({
    mount,
    detail,
    mediaUrl,
    mediaHeight,
    index,
    onSelect,
  }: MountGalleryCardProps): JSX.Element => {
    const result = useMemo(
      () => toMountResult(mount, detail, mediaUrl),
      [mount, detail, mediaUrl],
    );

    const handleSelect = useCallback((): void => {
      onSelect(result);
    }, [onSelect, result]);

    return (
      <ResultCard
        result={result}
        layout={CARD_LAYOUT}
        mediaHeight={mediaHeight}
        onSelect={handleSelect}
        index={index}
      />
    );
  },
);
MountGalleryCard.displayName = "MountGalleryCard";

type MountSearchControlsProps = {
  /** The committed (URL) query. */
  q: string;
  onQueryChange: (text: string) => void;
  /** The search input; "Back to full index" hands focus to it before it unmounts. */
  inputRef: RefObject<HTMLInputElement>;
};

/**
 * Owns the search draft so keystrokes re-render only the filter row, never
 * the grid. The draft resyncs from `q` only when the URL changed somewhere
 * else (Back button, "Clear search"), never on the echo of its own commit,
 * so a keystroke typed while a debounced commit is in flight is kept.
 */
const MountSearchControls = memo(
  ({ q, onQueryChange, inputRef }: MountSearchControlsProps): JSX.Element => {
    const [draft, setDraft] = useState(q);
    const committedRef = useRef(q);

    const commit = useCallback(
      (text: string): void => {
        committedRef.current = text.trim();
        onQueryChange(text);
      },
      [onQueryChange],
    );

    useEffect(() => {
      if (q !== committedRef.current) {
        committedRef.current = q;
        setDraft(q);
      }
    }, [q]);

    const clearSearch = useCallback((): void => {
      setDraft("");
      commit("");
    }, [commit]);

    // The button below only exists while a search is active, so it vanishes
    // on activation; focus goes to the search field first, never to <body>.
    const backToIndex = useCallback((): void => {
      inputRef.current?.focus();
      clearSearch();
    }, [clearSearch, inputRef]);

    const trimmedQuery = q.trim();

    return (
      <>
        <SearchField
          id="mounts-search"
          label="Search mounts by name"
          placeholder="Search mounts by name…"
          value={draft}
          onChange={setDraft}
          onDebouncedChange={commit}
          onSubmit={commit}
          onClear={clearSearch}
          debounceMs={350}
          minLength={MOUNT_MIN_QUERY_LENGTH}
          inputRef={inputRef}
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
                  commit(mountName);
                }}
              />
            );
          })}
        </Stack>

        {q ? (
          <Button variant="text" onClick={backToIndex}>
            Back to full index
          </Button>
        ) : null}
      </>
    );
  },
);
MountSearchControls.displayName = "MountSearchControls";

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
    details,
    mediaUrls,
    total,
    capped,
    pageCount,
    loadedPages,
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

  const [selectedMount, setSelectedMount] = useState<MountGalleryResult | null>(
    null,
  );
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Tiles are 16:9 at every width: the artwork height follows the measured
  // cell width, and the virtualiser's fixed row height follows the artwork.
  const { ref: gridAreaRef, mediaHeight } = useTileMediaHeight(GRID_COLUMNS, {
    gap: GRID_GAP,
  });
  const cardHeight = getResultCardHeight(CARD_LAYOUT, mediaHeight);

  const handleSelect = useCallback((mount: MountGalleryResult): void => {
    setSelectedMount(mount);
  }, []);

  const handleCloseDialog = useCallback((): void => {
    setSelectedMount(null);
  }, []);

  // The empty state's "Clear search" button is replaced by the grid, so
  // focus moves to the search field first instead of dropping to <body>.
  const clearSearch = useCallback((): void => {
    searchInputRef.current?.focus();
    setQuery("");
  }, [setQuery]);

  const trimmedQuery = q.trim();
  const hasPageError = error !== null && error !== undefined;
  const isEmpty =
    isSearchActive && !isInitialLoading && !hasPageError && mounts.length === 0;

  // The noun agrees with the number printed beside it: the footer counts
  // `loaded`, the summary and header chip the total (or `loaded` once
  // everything is in).
  const countNoun = (count: number): string =>
    isSearchActive
      ? pluralize(count, "match", "matches")
      : pluralize(count, "mount", "mounts");
  const knownTotal = typeof total === "number" ? total : loaded;
  const totalNoun = countNoun(knownTotal);

  const count = { loaded, total, capped, hasMore, noun: countNoun(loaded) };
  const totalLabel = formatResultTotal(count);
  const showTotalChip = totalLabel !== undefined && knownTotal > 0;

  // A multi-page search response carries no total, only a page count, so
  // "Showing 24 matches" becomes "Showing 24 matches · page 1 of 2".
  const pageProgress =
    totalLabel === undefined
      ? formatPageProgress(loadedPages, pageCount)
      : undefined;

  const summary = [`${formatResultSummary(count)} ${totalNoun}`, pageProgress]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  const footerText = isFetchingNextPage
    ? "Loading more mounts"
    : pageProgress
      ? `${formatNumber(loaded)} ${count.noun} loaded · ${pageProgress}`
      : formatLoadedStatus(count);

  const renderBody = (): JSX.Element => {
    if (hasPageError) {
      return <ErrorState error={error} context="mounts" onRetry={retry} />;
    }

    if (isInitialLoading) {
      return (
        <LoadingSkeleton
          variant="grid"
          columns={GRID_COLUMNS}
          itemHeight={cardHeight}
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
              {`Details or artwork for ${formatNumber(failedEnrichment)} ${pluralize(
                failedEnrichment,
                "mount",
                "mounts",
              )} could not be loaded`}
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
          itemHeight={cardHeight}
          columns={GRID_COLUMNS}
          gap={GRID_GAP}
          minItemsBeforeVirtualize={MOUNT_PAGE_SIZE}
          aria-label="Mount results"
          onVisibleRangeChange={onVisibleRangeChange}
          renderItem={(mount, index) => (
            <MountGalleryCard
              mount={mount}
              detail={details[index]}
              mediaUrl={mediaUrls[index]}
              mediaHeight={mediaHeight}
              index={index}
              onSelect={handleSelect}
            />
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
            {showTotalChip ? (
              <Chip size="small" label={`${totalLabel} ${totalNoun}`} />
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
        <MountSearchControls
          q={q}
          onQueryChange={setQuery}
          inputRef={searchInputRef}
        />
      </ExplorerFilterBar>

      {/* Measured for the tile artwork height; full content width, like the grid. */}
      <Box ref={gridAreaRef} sx={{ minWidth: 0 }}>
        {renderBody()}
      </Box>

      <MountDetailDialog
        mount={selectedMount}
        open={selectedMount !== null}
        onClose={handleCloseDialog}
      />
    </Stack>
  );
};

export default MountsPage;
