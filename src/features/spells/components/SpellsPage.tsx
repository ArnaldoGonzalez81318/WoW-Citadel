import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import ReportProblemRoundedIcon from "@mui/icons-material/ReportProblemRounded";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { useInfiniteQuery, useQueries } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import ResultCard from "@/components/common/ResultCard";
import VirtualizedCardGrid from "@/components/common/VirtualizedCardGrid";
import useIdlePrefetchWindow from "@/hooks/useIdlePrefetchWindow";
import useInfiniteScrollTrigger from "@/hooks/useInfiniteScrollTrigger";
import SearchInput from "@/features/search/components/SearchInput";
import {
  fetchSpellDetail,
  fetchSpellIcon,
  searchSpellsDetailed,
} from "@/features/spells/services/spellService";
import { usePerformanceOverlayEntry } from "@/devtools/PerformanceOverlayContext";
import { env } from "@/lib/env";
import { BlizzardRequestError } from "@/lib/blizzardClient";

const QUICK_SPELLS = ["Chaos Bolt", "Bloodlust", "Starfall", "Avenging Wrath"];

const SpellsPage = (): JSX.Element => {
  const [query, setQuery] = useState<string>(QUICK_SPELLS[0]);
  const [renderedCount, setRenderedCount] = useState(0);

  const searchQuery = useInfiniteQuery({
    queryKey: ["spell-search-explorer", query, env.region, env.locale],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => searchSpellsDetailed(query, pageParam),
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60 * 10,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.pageCount ? lastPage.page + 1 : undefined,
  });

  const spells = useMemo(
    () => searchQuery.data?.pages.flatMap((p) => p.spells) ?? [],
    [searchQuery.data],
  );
  const activeEnrichmentCount = useIdlePrefetchWindow({
    totalCount: spells.length,
    initialCount: 8,
    batchSize: 4,
    resetKey: query,
  });

  const detailQueries = useQueries({
    queries: spells.map((spell, index) => ({
      queryKey: ["spell-detail-card", spell.id, env.region],
      queryFn: () => fetchSpellDetail(spell.id),
      enabled: index < activeEnrichmentCount,
      staleTime: 300000,
      retry: false,
    })),
  });

  const mediaQueries = useQueries({
    queries: spells.map((spell, index) => ({
      queryKey: ["spell-media-card", spell.id, env.region],
      queryFn: () => fetchSpellIcon(spell.id),
      enabled: index < activeEnrichmentCount,
      staleTime: 300000,
      retry: false,
    })),
  });

  const friendlyError = useMemo(() => {
    const error =
      searchQuery.error ??
      detailQueries.find((entry) => entry.error)?.error ??
      mediaQueries.find((entry) => entry.error)?.error;
    if (!error) {
      return undefined;
    }

    if (error instanceof BlizzardRequestError) {
      if (error.status === 401 || error.status === 403) {
        return "We couldn’t authenticate with Blizzard’s Spell API. Update your Blizzard credentials in the .env file and refresh.";
      }

      if (error.status === 429) {
        return "The Blizzard API rate limit has been reached. Please wait a few minutes and try again.";
      }
    }

    return error instanceof Error
      ? error.message
      : "Unable to load spell data right now.";
  }, [detailQueries, mediaQueries, searchQuery.error]);

  const isLoading = searchQuery.isLoading;

  const gallerySpells = useMemo(
    () =>
      spells.map((spell, index) => {
        const detail = detailQueries[index]?.data;

        return {
          id: spell.id,
          name: spell.name,
          href: detail?.href ?? spell.href,
          summary: detail?.description ? undefined : spell.description,
          details: detail?.description || spell.description,
          typeLabel: "Spell",
          mediaUrl: mediaQueries[index]?.data,
        };
      }),
    [detailQueries, mediaQueries, spells],
  );

  const handleVisibleRangeChange = useCallback(
    (range: { start: number; end: number }) =>
      setRenderedCount(range.end - range.start),
    [],
  );

  const loadMore = useCallback(() => {
    if (!searchQuery.hasNextPage || searchQuery.isFetchingNextPage) return;
    void searchQuery.fetchNextPage();
  }, [searchQuery]);

  const infiniteScrollRef = useInfiniteScrollTrigger({
    enabled: query.trim().length >= 2 && !friendlyError,
    hasMore: searchQuery.hasNextPage ?? false,
    isLoading: searchQuery.isFetchingNextPage,
    onLoadMore: loadMore,
  });

  usePerformanceOverlayEntry(
    import.meta.env.DEV
      ? {
          id: "spells",
          label: "Spells",
          renderedCount,
          totalCount: spells.length,
          enrichmentCount: activeEnrichmentCount,
          notes: searchQuery.isFetching
            ? "Searching live spell index"
            : "Search-driven gallery",
        }
      : null,
  );

  return (
    <Stack spacing={{ xs: 4, md: 6 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <BoltRoundedIcon color="primary" fontSize="large" />
          <Typography variant="h3" sx={{ fontWeight: 700 }}>
            Spell Codex
          </Typography>
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Search the live spell catalogue and browse the results as icon cards
          instead of switching between a selector and a detail panel.
        </Typography>
      </Stack>

      <Paper
        variant="outlined"
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 4,
          borderColor: "rgba(30, 155, 233, 0.22)",
          backgroundColor: "rgba(12, 18, 34, 0.72)",
        }}
      >
        <Stack spacing={2.5}>
          <SearchInput
            value={query}
            onChange={setQuery}
            onClear={() => setQuery("")}
            autoFocus={false}
            placeholder="Search spells by name..."
          />
          <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap">
            {QUICK_SPELLS.map((spell) => (
              <Button
                key={spell}
                variant={query === spell ? "contained" : "outlined"}
                color="primary"
                size="small"
                onClick={() => setQuery(spell)}
                sx={{ borderRadius: 999 }}
              >
                {spell}
              </Button>
            ))}
          </Stack>
        </Stack>
      </Paper>

      {friendlyError ? (
        <Alert
          severity="error"
          icon={<ReportProblemRoundedIcon fontSize="small" />}
          sx={{ borderRadius: 3 }}
        >
          {friendlyError}
        </Alert>
      ) : null}

      {isLoading ? (
        <Grid container spacing={3}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Grid item xs={12} md={6} lg={4} key={index}>
              <Skeleton
                variant="rounded"
                height={320}
                sx={{
                  borderRadius: 3,
                  backgroundColor: "rgba(12, 18, 34, 0.45)",
                }}
              />
            </Grid>
          ))}
        </Grid>
      ) : null}

      {!isLoading && !friendlyError ? (
        <Stack spacing={3}>
          <Stack spacing={0.5}>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Search matches
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Showing {gallerySpells.length} spell
              {gallerySpells.length === 1 ? "" : "s"}
              {searchQuery.hasNextPage ? " · more available" : ""}.
            </Typography>
            {activeEnrichmentCount < spells.length ? (
              <Typography variant="caption" color="text.secondary">
                Prefetching additional spell details and media during idle time.
              </Typography>
            ) : null}
          </Stack>
          <VirtualizedCardGrid
            items={gallerySpells}
            itemHeight={260}
            getItemKey={(spell) => spell.id}
            onVisibleRangeChange={handleVisibleRangeChange}
            renderItem={(spell) => (
              <ResultCard result={spell} accentColor="#a78bfa" />
            )}
          />
          <Stack spacing={1.5} alignItems="center">
            {searchQuery.hasNextPage ? (
              <Typography variant="body2" color="text.secondary">
                Keep scrolling to load more spells.
              </Typography>
            ) : gallerySpells.length > 0 ? (
              <Typography variant="body2" color="text.secondary">
                Reached the end of the spell results.
              </Typography>
            ) : null}
            {searchQuery.isFetchingNextPage ? (
              <CircularProgress color="primary" size={28} />
            ) : null}
            {searchQuery.hasNextPage ? (
              <Box ref={infiniteScrollRef} sx={{ height: 1 }} />
            ) : null}
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
};

export default SpellsPage;
