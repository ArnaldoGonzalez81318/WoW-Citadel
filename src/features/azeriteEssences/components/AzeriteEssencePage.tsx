import PsychologyRoundedIcon from "@mui/icons-material/PsychologyRounded";
import { Box, Button, Chip } from "@mui/material";
import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";

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

  return {
    id: essence.id,
    name: essence.name,
    href: essence.key.href,
    kind: "azerite-essence",
    summary: major ?? undefined,
    details: minor ?? undefined,
    subtitle: major,
    meta,
    tag: detail ? (specs.length ? `${specs.length} specs` : "All specs") : undefined,
    typeLabel: "Azerite Essence",
    mediaUrl: data?.iconUrl,
  };
};

const AzeriteEssencePage = ({
  eyebrow = "Collectibles & Gear",
  breadcrumbs,
}: AzeriteEssencePageProps): JSX.Element => {
  const [q, setQ] = useSearchParamState("q");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const indexQuery = useQuery({
    queryKey: ["azerite-essence-index", env.region],
    queryFn: ({ signal }) => fetchAzeriteEssenceIndex(signal),
    staleTime: ONE_HOUR,
  });

  const allEssences = useMemo(
    () => indexQuery.data?.azerite_essences ?? [],
    [indexQuery.data],
  );
  const normalizedQuery = q.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      normalizedQuery
        ? allEssences.filter((essence) =>
            essence.name.toLowerCase().includes(normalizedQuery),
          )
        : allEssences,
    [allEssences, normalizedQuery],
  );

  // Staggers the ~30 detail+icon requests instead of firing them all at once.
  const activeCount = useIdlePrefetchWindow({
    totalCount: filtered.length,
    initialCount: 12,
    batchSize: 6,
    resetKey: normalizedQuery,
  });

  const cardQueries = useQueries({
    queries: filtered.map((essence, index) => ({
      queryKey: ["azerite-essence-card", essence.id, env.region],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchAzeriteEssenceCard(essence.id, signal),
      // An un-prefetched card still loads when its dialog opens.
      enabled: index < activeCount || essence.id === selectedId,
      staleTime: ONE_HOUR,
      retry: false,
    })),
  });

  const galleryItems = useMemo<SearchResult[]>(
    () =>
      filtered.map((essence, index) =>
        toGalleryItem(essence, cardQueries[index]?.data),
      ),
    [filtered, cardQueries],
  );

  const selectedIndex = filtered.findIndex(
    (essence) => essence.id === selectedId,
  );
  const selectedSummary =
    selectedIndex >= 0
      ? filtered[selectedIndex]
      : allEssences.find((essence) => essence.id === selectedId);
  const selectedEntry =
    selectedIndex >= 0 ? cardQueries[selectedIndex] : undefined;

  const showEmpty =
    indexQuery.isSuccess && normalizedQuery.length > 0 && filtered.length === 0;

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
          value={q}
          onChange={(value) => setQ(value, { replace: true })}
          onClear={() => setQ(null, { replace: true })}
          label="Search Azerite essences"
          placeholder="Filter by name"
          minLength={1}
          debounceMs={150}
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
      ) : indexQuery.isError ? (
        <ErrorState
          error={indexQuery.error}
          context="Azerite essences"
          onRetry={() => void indexQuery.refetch()}
        />
      ) : showEmpty ? (
        <EmptyState
          title="No essences match"
          description={`Nothing named "${q.trim()}". Try Memory or Life.`}
          action={
            <Button
              variant="outlined"
              onClick={() => setQ(null, { replace: true })}
            >
              Clear search
            </Button>
          }
        />
      ) : (
        <VirtualizedCardGrid
          items={galleryItems}
          getItemKey={(item) => item.id}
          columns={GRID_PRESETS.rows}
          itemHeight={ROW_HEIGHT}
          gap={GRID_GAP}
          aria-label="Azerite essences"
          renderItem={(item) => (
            <ResultCard
              result={item}
              layout="row"
              onSelect={() => setSelectedId(item.id)}
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
