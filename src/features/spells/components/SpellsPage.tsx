import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
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
import type { SearchResult } from "@/features/search/types";
import SpellDetailDialog from "@/features/spells/components/SpellDetailDialog";
import useSpellSearch, {
  SPELL_MIN_QUERY_LENGTH,
  SPELL_PAGE_SIZE,
} from "@/features/spells/hooks/useSpellSearch";
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

/** One description only: the row meta line reads `details`. */
const toSpellResult = (
  spell: SpellSummary,
  iconUrl: string | undefined,
): SearchResult => ({
  id: spell.id,
  name: spell.name,
  href: spell.href,
  kind: "spell",
  summary: undefined,
  details: spell.description || undefined,
  mediaUrl: iconUrl,
  externalUrl: spell.externalUrl,
  externalLabel: spell.externalLabel,
});

type SpellGalleryCardProps = {
  spell: SpellSummary;
  iconUrl: string | undefined;
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

  // `q` (URL) is the committed query; `draft` is what the user is typing.
  const [draft, setDraft] = useState(q);
  useEffect(() => {
    setDraft((current) => (current.trim() === q ? current : q));
  }, [q]);

  const [selectedSpell, setSelectedSpell] = useState<SearchResult | null>(null);

  const handleSelect = useCallback((result: SearchResult): void => {
    setSelectedSpell(result);
  }, []);

  const handleCloseDialog = useCallback((): void => {
    setSelectedSpell(null);
  }, []);

  const clearSearch = (): void => {
    setDraft("");
    setQuery("");
  };

  const trimmedQuery = q.trim();
  const hasPageError = error !== null && error !== undefined;
  const isEmpty =
    isSearchActive && !isInitialLoading && !hasPageError && spells.length === 0;

  const count = {
    loaded: spells.length,
    total,
    capped,
    hasMore: hasNextPage,
    noun: "spells",
  };
  const totalLabel = formatResultTotal(count);

  const footerText = isFetchingNextPage
    ? "Loading more spells"
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
              {`Icons for ${formatNumber(failedIcons)} ${
                failedIcons === 1 ? "spell" : "spells"
              } could not be loaded`}
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
            {isSearchActive && totalLabel ? (
              <Chip size="small" label={`${totalLabel} matches`} />
            ) : null}
          </>
        }
      />

      <ExplorerFilterBar
        label="Spell search"
        summary={
          isSearchActive && !hasPageError
            ? formatResultSummary(count)
            : undefined
        }
        progress={isRefreshing}
      >
        <SearchField
          id="spells-search"
          label="Search spells by name"
          placeholder="Search spells by name…"
          value={draft}
          onChange={setDraft}
          onDebouncedChange={setQuery}
          onSubmit={setQuery}
          onClear={clearSearch}
          debounceMs={350}
          minLength={SPELL_MIN_QUERY_LENGTH}
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
                  setQuery(spellName);
                }}
              />
            );
          })}
        </Stack>
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
