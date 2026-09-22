import PsychologyRoundedIcon from "@mui/icons-material/PsychologyRounded";
import { Box, Button, Chip } from "@mui/material";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import {
  ExplorerFilterBar,
  SearchField,
} from "@/components/common/ExplorerFilterBar";
import { GRID_PRESETS } from "@/components/common/gridColumns";
import PageHeader from "@/components/common/PageHeader";
import type { PageHeaderBreadcrumb } from "@/components/common/PageHeader";
import ResultCard, {
  getResultCardHeight,
} from "@/components/common/ResultCard";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import VirtualizedCardGrid from "@/components/common/VirtualizedCardGrid";
import EssenceDetailDialog from "@/features/azeriteEssences/components/EssenceDetailDialog";
import {
  fetchAzeriteEssenceCard,
  fetchAzeriteEssenceIndex,
} from "@/features/azeriteEssences/services/azeriteEssenceService";
import type {
  AzeriteEssenceCardData,
  AzeriteEssenceSummary,
} from "@/features/azeriteEssences/types";
import type { SearchResult } from "@/features/search/types";
import useIdlePrefetchWindow from "@/hooks/useIdlePrefetchWindow";
import { useSearchParamState } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";

export type AzeriteEssencePageProps = {
  /** Nav section shown as the gold eyebrow (CategoryPage passes it). */
  eyebrow?: string;
  /** Home › Section › Page trail (CategoryPage passes it). */
  breadcrumbs?: PageHeaderBreadcrumb[];
};

const ONE_HOUR = 3_600_000;
const ROW_HEIGHT = getResultCardHeight("row");
const GRID_GAP = 16;
/** Client-side filter over ~30 names: short debounce, single-character minimum. */
const SEARCH_DEBOUNCE_MS = 150;
const SEARCH_MIN_LENGTH = 1;
const EMPTY_ESSENCES: AzeriteEssenceSummary[] = [];

/** The slice of a card query the page reads; structurally shared by `combine`. */
type CardQueryState = {
  data: AzeriteEssenceCardData | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
};

// Module-level so react-query can `replaceEqualDeep` the combined array:
// entries keep their identity until their own query changes.
const combineCardQueries = (
  results: UseQueryResult<AzeriteEssenceCardData>[],
): CardQueryState[] =>
  results.map((result) => ({
    data: result.data,
    isPending: result.isPending,
    isError: result.isError,
    error: result.error,
    refetch: result.refetch,
  }));

const toGalleryItem = (
  essence: AzeriteEssenceSummary,
  data: AzeriteEssenceCardData | undefined,
): SearchResult => {
  const detail = data?.detail;
  const firstPower = detail?.powers[0];
  const major = firstPower?.mainPowerSpell?.name;
  const minor = firstPower?.passivePowerSpell?.name;
  const specs = detail?.allowedSpecializations ?? [];

  const meta = [
    { label: "Major", value: major },
    { label: "Minor", value: minor },
  ].filter(
    (entry): entry is { label: string; value: string } =>
      typeof entry.value === "string" && entry.value.length > 0,
  );

  // ResultCard's row layout shows a single meta line, so both powers go in
  // it; the major power usually repeats the essence name, so it is skipped
  // then and the minor power is what distinguishes the card.
  const subtitle =
    [
      major && major !== essence.name ? `Major: ${major}` : undefined,
      minor ? `Minor: ${minor}` : undefined,
    ]
      .filter(Boolean)
      .join(" · ") || undefined;

  return {
    id: essence.id,
    name: essence.name,
    href: essence.key.href,
    kind: "azerite-essence",
    subtitle,
    meta,
    tag: detail ? (specs.length ? `${specs.length} specs` : "All specs") : undefined,
    typeLabel: "Azerite Essence",
    mediaUrl: data?.iconUrl,
  };
};

type EssenceCardProps = {
  essence: AzeriteEssenceSummary;
  data: AzeriteEssenceCardData | undefined;
  onSelect: (id: number) => void;
};

/**
 * Memoised so one card's detail resolving never re-renders the others: the
 * result object is rebuilt only when this essence's own data changes.
 */
const EssenceCard = memo(
  ({ essence, data, onSelect }: EssenceCardProps): JSX.Element => {
    const result = useMemo(() => toGalleryItem(essence, data), [essence, data]);
    const handleSelect = useCallback((): void => {
      onSelect(essence.id);
    }, [essence.id, onSelect]);

    return <ResultCard result={result} layout="row" onSelect={handleSelect} />;
  },
);
EssenceCard.displayName = "EssenceCard";

const AzeriteEssencePage = ({
  eyebrow = "Collectibles & Gear",
  breadcrumbs,
}: AzeriteEssencePageProps): JSX.Element => {
  const [q, setQ] = useSearchParamState("q");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // `q` (URL) is the committed query; `draft` is what the user is typing.
  // The input is never bound to router state directly: navigations run in a
  // transition, so a controlled input fed by `q` would drop keystrokes.
  const [draft, setDraft] = useState(q);
  const committedRef = useRef(q);

  useEffect(() => {
    // Only an external change (back/forward, a link) resets the draft;
    // echoes of our own commits leave whatever is being typed alone.
    if (q !== committedRef.current) {
      committedRef.current = q;
      setDraft(q);
    }
  }, [q]);

  const commitQuery = useCallback(
    (value: string): void => {
      const next = value.trim();
      committedRef.current = next;
      setQ(next || null, { replace: true });
    },
    [setQ],
  );

  const clearSearch = useCallback((): void => {
    setDraft("");
    commitQuery("");
  }, [commitQuery]);

  const indexQuery = useQuery({
    queryKey: ["azerite-essence-index", env.region],
    queryFn: ({ signal }) => fetchAzeriteEssenceIndex(signal),
    staleTime: ONE_HOUR,
  });

  const allEssences = indexQuery.data?.azerite_essences ?? EMPTY_ESSENCES;
  // Filtering follows the draft so results update as the user types; the
  // URL (and everything keyed on it) follows after the debounce.
  const normalizedDraft = draft.trim().toLowerCase();
  const normalizedQuery = q.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      normalizedDraft
        ? allEssences.filter((essence) =>
            essence.name.toLowerCase().includes(normalizedDraft),
          )
        : allEssences,
    [allEssences, normalizedDraft],
  );

  // Staggers the ~30 detail+icon requests instead of firing them all at once.
  const activeCount = useIdlePrefetchWindow({
    totalCount: filtered.length,
    initialCount: 12,
    batchSize: 6,
    resetKey: normalizedQuery,
  });

  const enabledIds = useMemo(
    () => new Set(filtered.slice(0, activeCount).map((essence) => essence.id)),
    [filtered, activeCount],
  );

  // Queries run over the whole index, not the filtered list, so typing never
  // drops an observer (which would abort its in-flight request) and cards
  // that already resolved stay resolved when the filter changes.
  const cardQueries = useQueries({
    queries: allEssences.map((essence) => ({
      queryKey: ["azerite-essence-card", essence.id, env.region],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchAzeriteEssenceCard(essence.id, signal),
      // An un-prefetched card still loads when its dialog opens.
      enabled: enabledIds.has(essence.id) || essence.id === selectedId,
      staleTime: ONE_HOUR,
      retry: false,
    })),
    combine: combineCardQueries,
  });

  const cardById = useMemo(
    () =>
      new Map(
        allEssences.map((essence, index) => [essence.id, cardQueries[index]]),
      ),
    [allEssences, cardQueries],
  );

  const handleSelect = useCallback((id: number): void => {
    setSelectedId(id);
  }, []);

  const selectedSummary =
    selectedId === null
      ? undefined
      : allEssences.find((essence) => essence.id === selectedId);
  const selectedEntry =
    selectedId === null ? undefined : cardById.get(selectedId);

  const showEmpty =
    indexQuery.isSuccess && normalizedDraft.length > 0 && filtered.length === 0;

  return (
    <Box
      sx={(theme) => ({
        display: "flex",
        flexDirection: "column",
        gap: {
          xs: theme.spacing(theme.wc.layout.sectionGap.xs),
          md: theme.spacing(theme.wc.layout.sectionGap.md),
        },
      })}
    >
      <PageHeader
        eyebrow={eyebrow}
        breadcrumbs={breadcrumbs}
        title="Azerite Essences"
        documentTitle="Azerite Essences"
        icon={<PsychologyRoundedIcon />}
        description="Every Heart of Azeroth essence with its major and minor powers by rank."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {indexQuery.isSuccess ? (
              <Chip size="small" label={`${allEssences.length} essences`} />
            ) : null}
          </>
        }
      />

      <ExplorerFilterBar
        label="Essence filters"
        summary={`Showing ${filtered.length} of ${allEssences.length} essences`}
        progress={indexQuery.isFetching}
      >
        <SearchField
          value={draft}
          onChange={setDraft}
          onDebouncedChange={commitQuery}
          onSubmit={commitQuery}
          onClear={clearSearch}
          label="Search Azerite essences"
          placeholder="Filter by name"
          minLength={SEARCH_MIN_LENGTH}
          debounceMs={SEARCH_DEBOUNCE_MS}
        />
      </ExplorerFilterBar>

      {indexQuery.isLoading ? (
        <LoadingSkeleton
          variant="grid"
          columns={GRID_PRESETS.rows}
          itemHeight={ROW_HEIGHT}
          count={12}
          gap={GRID_GAP}
          label="Loading Azerite essences"
        />
      ) : indexQuery.isError && !indexQuery.data ? (
        <ErrorState
          error={indexQuery.error}
          context="Azerite essences"
          onRetry={() => void indexQuery.refetch()}
        />
      ) : showEmpty ? (
        <EmptyState
          title="No essences match"
          description={`Nothing named "${draft.trim()}". Try Memory or Life.`}
          action={
            <Button variant="outlined" onClick={clearSearch}>
              Clear search
            </Button>
          }
        />
      ) : (
        <VirtualizedCardGrid
          items={filtered}
          getItemKey={(essence) => essence.id}
          columns={GRID_PRESETS.rows}
          itemHeight={ROW_HEIGHT}
          gap={GRID_GAP}
          aria-label="Azerite essences"
          renderItem={(essence) => (
            <EssenceCard
              essence={essence}
              data={cardById.get(essence.id)?.data}
              onSelect={handleSelect}
            />
          )}
        />
      )}

      <EssenceDetailDialog
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        essence={selectedSummary}
        data={selectedEntry?.data}
        loading={selectedEntry?.isPending}
        error={selectedEntry?.error ?? undefined}
        onRetry={() => void selectedEntry?.refetch()}
      />
    </Box>
  );
};

export default AzeriteEssencePage;
