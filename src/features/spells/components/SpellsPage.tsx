import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchOffRoundedIcon from "@mui/icons-material/SearchOffRounded";
import { Box, Button, Chip, Stack } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { memo, useCallback, useEffect, useRef, useState } from "react";
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
import VirtualizedCardGrid from "@/components/common/VirtualizedCardGrid";
import { formatPageProgress } from "@/features/items/pageProgress";
import type { SearchResult } from "@/features/search/types";
import SpellDetailDialog from "@/features/spells/components/SpellDetailDialog";
import useSpellSearch, {
  SPELL_MIN_QUERY_LENGTH,
  SPELL_PAGE_SIZE,
} from "@/features/spells/hooks/useSpellSearch";
import type { SpellIconUrl } from "@/features/spells/hooks/useSpellSearch";
import type { SpellSummary } from "@/features/spells/types";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import {
  formatLoadedStatus,
  formatResultSummary,
  formatResultTotal,
} from "@/lib/resultCount";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

const DEFAULT_EYEBROW = "Character Progression";
const QUICK_SPELLS = ["Chaos Bolt", "Bloodlust", "Starfall", "Avenging Wrath"];
const CARD_LAYOUT = "row";
const CARD_HEIGHT = getResultCardHeight(CARD_LAYOUT);
const GRID_GAP = 16;

const pluralize = (count: number, singular: string, plural: string): string =>
  count === 1 ? singular : plural;

/** One description only: the row meta line reads `details`. */
const toSpellResult = (
  spell: SpellSummary,
  iconUrl: SpellIconUrl,
): SearchResult => ({
  id: spell.id,
  name: spell.name,
  href: spell.href,
  kind: "spell",
  summary: undefined,
  details: spell.description || undefined,
  mediaUrl: iconUrl ?? undefined,
  externalUrl: spell.externalUrl,
  externalLabel: spell.externalLabel,
});

type SpellGalleryCardProps = {
  spell: SpellSummary;
  iconUrl: SpellIconUrl;
  index: number;
  onSelect: (result: SearchResult) => void;
};

/**
 * Memoised so an icon resolving for one card never re-renders the others:
 * `spell` is structurally shared by react-query, `iconUrl` is a primitive
 * and `onSelect` is stable.
 */
const SpellGalleryCard = memo(
  ({ spell, iconUrl, index, onSelect }: SpellGalleryCardProps): JSX.Element => (
    <ResultCard
      result={toSpellResult(spell, iconUrl)}
      layout={CARD_LAYOUT}
      onSelect={onSelect}
      index={index}
    />
  ),
);
SpellGalleryCard.displayName = "SpellGalleryCard";

type SpellSearchControlsProps = {
  /** The committed (URL) query. */
  q: string;
  onQueryChange: (text: string) => void;
  /** The search input, so the page's "Clear search" can hand focus back to it. */
  inputRef: RefObject<HTMLInputElement>;
};

/**
 * Owns the search draft so keystrokes re-render only the filter row, never
 * the grid. The draft resyncs from `q` only when the URL changed somewhere
 * else (Back button, "Clear search"), never on the echo of its own commit,
 * so a keystroke typed while a debounced commit is in flight is kept.
 */
const SpellSearchControls = memo(
  ({ q, onQueryChange, inputRef }: SpellSearchControlsProps): JSX.Element => {
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

    const trimmedQuery = q.trim();

    return (
      <>
        <SearchField
          id="spells-search"
          label="Search spells by name"
          placeholder="Search spells by name…"
          value={draft}
          onChange={setDraft}
          onDebouncedChange={commit}
          onSubmit={commit}
          onClear={clearSearch}
          debounceMs={350}
          minLength={SPELL_MIN_QUERY_LENGTH}
          inputRef={inputRef}
        />

        <Stack
          role="group"
          aria-label="Featured spells"
          direction="row"
          flexWrap="wrap"
          useFlexGap
          gap={1}
          alignItems="center"
          sx={{ minWidth: 0 }}
        >
          {QUICK_SPELLS.map((spellName) => {
            const pressed = trimmedQuery === spellName;
            return (
              <Chip
                key={spellName}
                label={spellName}
                clickable
                variant="outlined"
                color={pressed ? "primary" : "default"}
                aria-pressed={pressed}
                onClick={() => {
                  setDraft(spellName);
                  commit(spellName);
                }}
              />
            );
          })}
        </Stack>
      </>
    );
  },
);
SpellSearchControls.displayName = "SpellSearchControls";

const SpellsPage = ({
  eyebrow = DEFAULT_EYEBROW,
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const theme = useTheme();
  const {
    q,
    setQuery,
    isSearchActive,
    spells,
    iconUrls,
    total,
    capped,
    pageCount,
    loadedPages,
    isInitialLoading,
    isRefreshing,
    isFetchingNextPage,
    hasNextPage,
    error,
    retry,
    sentinelRef,
    onVisibleRangeChange,
    failedIcons,
    retryFailedIcons,
  } = useSpellSearch();

  const [selectedSpell, setSelectedSpell] = useState<SearchResult | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSelect = useCallback((result: SearchResult): void => {
    setSelectedSpell(result);
  }, []);

  const handleCloseDialog = useCallback((): void => {
    setSelectedSpell(null);
  }, []);

  // The empty state's "Clear search" button is replaced by the search
  // prompt, so focus moves to the search field first instead of <body>.
  const clearSearch = useCallback((): void => {
    searchInputRef.current?.focus();
    setQuery("");
  }, [setQuery]);

  const trimmedQuery = q.trim();
  const hasPageError = error !== null && error !== undefined;
  const isEmpty =
    isSearchActive && !isInitialLoading && !hasPageError && spells.length === 0;

  // The noun agrees with the number printed beside it: the footer counts
  // `loaded`, the summary and header chip the total (or `loaded` once
  // everything is in).
  const loaded = spells.length;
  const knownTotal = typeof total === "number" ? total : loaded;

  const count = {
    loaded,
    total,
    capped,
    hasMore: hasNextPage,
    noun: pluralize(loaded, "spell", "spells"),
  };
  const totalLabel = formatResultTotal(count);
  const showTotalChip =
    isSearchActive && totalLabel !== undefined && knownTotal > 0;

  // A multi-page search response carries no total, only a page count, so
  // "Showing 24" becomes "Showing 24 · page 1 of 2" rather than a bare count.
  const pageProgress =
    totalLabel === undefined
      ? formatPageProgress(loadedPages, pageCount)
      : undefined;

  const summary = [formatResultSummary(count), pageProgress]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  const footerText = isFetchingNextPage
    ? "Loading more spells"
    : pageProgress
      ? `${formatNumber(loaded)} ${count.noun} loaded · ${pageProgress}`
      : formatLoadedStatus(count);

  const renderBody = (): JSX.Element => {
    if (hasPageError) {
      return <ErrorState error={error} context="spells" onRetry={retry} />;
    }

    if (!isSearchActive) {
      return (
        <EmptyState
          icon={<AutoAwesomeRoundedIcon />}
          title="Search the spell catalogue"
          description="Type at least two characters or pick a featured spell."
        />
      );
    }

    if (isInitialLoading) {
      return (
        <LoadingSkeleton
          variant="grid"
          columns={GRID_PRESETS.rows}
          itemHeight={CARD_HEIGHT}
          count={SPELL_PAGE_SIZE}
          gap={GRID_GAP}
          label="Loading spells"
        />
      );
    }

    if (isEmpty) {
      return (
        <EmptyState
          icon={<SearchOffRoundedIcon />}
          title={`No spells match "${trimmedQuery}"`}
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
        {failedIcons > 0 ? (
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
          >
            <LiveStatus>
              {`Icons for ${formatNumber(failedIcons)} ${pluralize(
                failedIcons,
                "spell",
                "spells",
              )} could not be loaded`}
            </LiveStatus>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshRoundedIcon />}
              onClick={retryFailedIcons}
            >
              Retry
            </Button>
          </Stack>
        ) : null}

        <VirtualizedCardGrid
          items={spells}
          getItemKey={(spell) => spell.id}
          itemHeight={CARD_HEIGHT}
          columns={GRID_PRESETS.rows}
          gap={GRID_GAP}
          minItemsBeforeVirtualize={SPELL_PAGE_SIZE}
          aria-label="Spell results"
          onVisibleRangeChange={onVisibleRangeChange}
          renderItem={(spell, index) => (
            <SpellGalleryCard
              spell={spell}
              iconUrl={iconUrls[index]}
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
        title="Spells"
        eyebrow={eyebrow}
        breadcrumbs={breadcrumbs}
        icon={<BoltRoundedIcon />}
        description="Search Blizzard's live spell catalogue by name."
        documentTitle="Spells"
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {showTotalChip ? (
              <Chip
                size="small"
                label={`${totalLabel} ${pluralize(knownTotal, "match", "matches")}`}
              />
            ) : null}
          </>
        }
      />

      <ExplorerFilterBar
        label="Spell search"
        summary={isSearchActive && !hasPageError ? summary : undefined}
        progress={isRefreshing}
      >
        <SpellSearchControls
          q={q}
          onQueryChange={setQuery}
          inputRef={searchInputRef}
        />
      </ExplorerFilterBar>

      {renderBody()}

      <SpellDetailDialog
        spell={selectedSpell}
        open={selectedSpell !== null}
        onClose={handleCloseDialog}
      />
    </Stack>
  );
};

export default SpellsPage;
