import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import PetsRoundedIcon from "@mui/icons-material/PetsRounded";
import ReportProblemRoundedIcon from "@mui/icons-material/ReportProblemRounded";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Link,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import SearchInput from "@/features/search/components/SearchInput";
import ResultCard from "@/components/common/ResultCard";
import VirtualizedCardGrid from "@/components/common/VirtualizedCardGrid";
import useInfiniteScrollTrigger from "@/hooks/useInfiniteScrollTrigger";
import useIdlePrefetchWindow from "@/hooks/useIdlePrefetchWindow";
import { SearchResult } from "@/features/search/types";
import {
  fetchCreatureDisplayImage,
  fetchMountDetail,
  fetchMountIndex,
  searchMountsDetailed,
} from "@/features/mounts/services/mountService";
import { usePerformanceOverlayEntry } from "@/devtools/PerformanceOverlayContext";
import { env } from "@/lib/env";
import { BlizzardRequestError } from "@/lib/blizzardClient";

const QUICK_MOUNTS = [
  "Invincible",
  "Ashes of Al'ar",
  "Swift Spectral Tiger",
  "Mimiron's Head",
];
const PAGE_SIZE = 24;

const MountsPage = (): JSX.Element => {
  const [query, setQuery] = useState<string>("");
  const [visiblePages, setVisiblePages] = useState(1);
  const [renderedCount, setRenderedCount] = useState(0);
  const [selectedMount, setSelectedMount] = useState<SearchResult | null>(null);

  const indexQuery = useQuery({
    queryKey: ["mount-gallery-index", env.region],
    queryFn: fetchMountIndex,
    staleTime: 1000 * 60 * 30,
  });

  const searchQuery = useQuery({
    queryKey: ["mount-search-explorer", query, env.region, env.locale],
    queryFn: () => searchMountsDetailed(query),
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60 * 10,
  });

  const indexedMounts = useMemo(() => indexQuery.data ?? [], [indexQuery.data]);
  const mounts = useMemo(
    () =>
      query.trim().length >= 2
        ? (searchQuery.data ?? [])
        : indexedMounts.slice(0, visiblePages * PAGE_SIZE),
    [indexedMounts, query, searchQuery.data, visiblePages],
  );
  const activeEnrichmentCount = useIdlePrefetchWindow({
    totalCount: mounts.length,
    initialCount: 10,
    batchSize: 6,
    resetKey: `${query}-${visiblePages}-${mounts.length}`,
  });

  const detailQueries = useQueries({
    queries: mounts.map((mount, index) => ({
      queryKey: ["mount-detail-card", mount.id, env.region],
      queryFn: () => fetchMountDetail(mount.id),
      enabled: index < activeEnrichmentCount,
      staleTime: 300000,
      retry: false,
    })),
  });

  const mediaQueries = useQueries({
    queries: detailQueries.map((detailQuery, index) => ({
      queryKey: [
        "mount-display-media",
        mounts[index]?.id,
        detailQuery.data?.displayId,
        env.region,
      ],
      queryFn: () =>
        fetchCreatureDisplayImage(Number(detailQuery.data?.displayId)),
      enabled:
        index < activeEnrichmentCount &&
        typeof detailQuery.data?.displayId === "number",
      staleTime: 300000,
      retry: false,
    })),
  });

  const galleryMounts = useMemo(
    () =>
      mounts.map((mount, index) => {
        const detail = detailQueries[index]?.data;

        return {
          id: mount.id,
          name: mount.name,
          href: detail?.href ?? mount.href,
          summary: detail?.source ?? mount.source,
          details:
            detail?.description ||
            mount.description ||
            "Live mount data pulled from Blizzard's mount catalogue.",
          typeLabel: "Mount",
          mediaUrl: mediaQueries[index]?.data,
        };
      }),
    [detailQueries, mediaQueries, mounts],
  );

  const selectedMountDetailQuery = useQuery({
    queryKey: ["mount-detail-card", selectedMount?.id, env.region],
    queryFn: () => fetchMountDetail(Number(selectedMount?.id)),
    enabled: selectedMount !== null,
    staleTime: 300000,
    retry: false,
  });

  const friendlyError = useMemo(() => {
    const error =
      indexQuery.error ??
      searchQuery.error ??
      detailQueries.find((entry) => entry.error)?.error ??
      mediaQueries.find((entry) => entry.error)?.error;
    if (!error) {
      return undefined;
    }

    if (error instanceof BlizzardRequestError) {
      if (error.status === 401 || error.status === 403) {
        return "We couldn’t authenticate with Blizzard’s Mount API. Update your Blizzard credentials in the .env file and refresh.";
      }

      if (error.status === 429) {
        return "The Blizzard API rate limit has been reached. Please wait a few minutes and try again.";
      }
    }

    return error instanceof Error
      ? error.message
      : "Unable to load mount data right now.";
  }, [detailQueries, indexQuery.error, mediaQueries, searchQuery.error]);

  const isLoading = indexQuery.isLoading || searchQuery.isLoading;
  const hasMoreIndexedMounts =
    query.trim().length < 2 && mounts.length < indexedMounts.length;

  const loadMoreMounts = useCallback(() => {
    if (!hasMoreIndexedMounts) {
      return;
    }

    setVisiblePages((current) => current + 1);
  }, [hasMoreIndexedMounts]);

  const infiniteScrollRef = useInfiniteScrollTrigger({
    enabled: !friendlyError,
    hasMore: hasMoreIndexedMounts,
    isLoading,
    onLoadMore: loadMoreMounts,
  });

  useEffect(() => {
    setVisiblePages(1);
  }, [query]);

  usePerformanceOverlayEntry(
    import.meta.env.DEV
      ? {
          id: "mounts",
          label: "Mounts",
          renderedCount,
          totalCount: galleryMounts.length,
          enrichmentCount: activeEnrichmentCount,
          notes: query ? "Search results" : "Index gallery",
        }
      : null,
  );

  return (
    <Stack spacing={{ xs: 4, md: 6 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <PetsRoundedIcon color="primary" fontSize="large" />
          <Typography variant="h3" sx={{ fontWeight: 700 }}>
            Mount Stable
          </Typography>
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Browse the mount collection as a gallery. The default view now keeps
          extending as you scroll, while search narrows the grid to matching
          mounts.
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
            placeholder="Search mounts by name..."
          />
          <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap">
            {QUICK_MOUNTS.map((mount) => (
              <Button
                key={mount}
                variant={query === mount ? "contained" : "outlined"}
                color="primary"
                size="small"
                onClick={() => setQuery(mount)}
                sx={{ borderRadius: 999 }}
              >
                {mount}
              </Button>
            ))}
            {query ? (
              <Button
                variant="text"
                color="primary"
                size="small"
                onClick={() => setQuery("")}
                sx={{ borderRadius: 999 }}
              >
                Back to featured list
              </Button>
            ) : null}
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
        <Stack spacing={3}>
          <Grid container spacing={2}>
            {Array.from({ length: 12 }).map((_, index) => (
              <Grid item xs={12} md={6} lg={4} key={index}>
                <Skeleton
                  variant="rounded"
                  height={280}
                  sx={{
                    borderRadius: 3,
                    backgroundColor: "rgba(12, 18, 34, 0.45)",
                  }}
                />
              </Grid>
            ))}
          </Grid>
        </Stack>
      ) : null}

      {!isLoading && !friendlyError ? (
        <Stack spacing={4}>
          <Stack spacing={2.5}>
            <Stack spacing={0.5}>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                {query ? "Search matches" : "Mount collection"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {query
                  ? `Showing ${galleryMounts.length} matching mounts.`
                  : `Loaded ${galleryMounts.length} of ${indexedMounts.length} mounts from the full live index.`}
              </Typography>
            </Stack>
            <Grid container spacing={3}>
              <VirtualizedCardGrid
                items={galleryMounts}
                getItemKey={(mount) => mount.id}
                itemHeight={500}
                columns={{ xs: 1, sm: 2, md: 3, lg: 4, xl: 6 }}
                onVisibleRangeChange={(range) =>
                  setRenderedCount(range.end - range.start)
                }
                renderItem={(mount) => (
                  <Box
                    sx={{
                      width: "100%",
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <ResultCard
                      result={mount}
                      accentColor="#6ee7b7"
                      mediaMode="framed"
                      mediaHeight={220}
                      width={220}
                      onClick={() => setSelectedMount(mount)}
                    />
                  </Box>
                )}
              />
            </Grid>

            <Stack spacing={1.5} alignItems="center">
              {hasMoreIndexedMounts ? (
                <Typography variant="body2" color="text.secondary">
                  Keep scrolling to load more mounts.
                </Typography>
              ) : !query && galleryMounts.length > 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Reached the end of the live mount collection.
                </Typography>
              ) : null}
              {activeEnrichmentCount < mounts.length ? (
                <Typography variant="caption" color="text.secondary">
                  Prefetching additional mount details and media during idle
                  time.
                </Typography>
              ) : null}
              {hasMoreIndexedMounts ? (
                <Box
                  ref={infiniteScrollRef}
                  sx={{ width: "100%", height: 1 }}
                />
              ) : null}
            </Stack>
          </Stack>
        </Stack>
      ) : null}

      <Dialog
        open={selectedMount !== null}
        onClose={() => setSelectedMount(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pr: 7 }}>
          {selectedMount?.name ?? "Mount details"}
          <IconButton
            aria-label="Close mount details"
            onClick={() => setSelectedMount(null)}
            sx={{ position: "absolute", right: 12, top: 12 }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={3}
            alignItems={{ xs: "stretch", md: "flex-start" }}
          >
            <Box sx={{ width: { xs: "100%", md: 300 }, flexShrink: 0 }}>
              <Box
                sx={{
                  width: "100%",
                  minHeight: { xs: 240, md: 300 },
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 3,
                  border: "1px solid rgba(110, 231, 183, 0.16)",
                  backgroundColor: "rgba(7, 12, 24, 0.72)",
                  p: 3,
                }}
              >
                {selectedMount?.mediaUrl ? (
                  <Box
                    component="img"
                    src={selectedMount.mediaUrl}
                    alt={selectedMount.name}
                    sx={{
                      width: "auto",
                      height: "auto",
                      maxWidth: "100%",
                      maxHeight: 240,
                      objectFit: "contain",
                    }}
                  />
                ) : (
                  <Typography
                    variant="h2"
                    sx={{ fontWeight: 700, color: "text.secondary" }}
                  >
                    {selectedMount?.name.slice(0, 1)}
                  </Typography>
                )}
              </Box>
            </Box>

            <Stack spacing={3} sx={{ minWidth: 0, flex: 1 }}>
              {selectedMountDetailQuery.isLoading ? (
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <CircularProgress size={22} />
                  <Typography variant="body2" color="text.secondary">
                    Loading live mount details...
                  </Typography>
                </Stack>
              ) : null}

              {selectedMountDetailQuery.isError ? (
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                  {selectedMountDetailQuery.error instanceof Error
                    ? selectedMountDetailQuery.error.message
                    : "Unable to load mount details right now."}
                </Alert>
              ) : null}

              {selectedMountDetailQuery.data?.source ||
              selectedMount?.summary ? (
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 700, mb: 0.75 }}
                  >
                    Source
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedMountDetailQuery.data?.source ||
                      selectedMount?.summary}
                  </Typography>
                </Box>
              ) : null}

              {selectedMountDetailQuery.data?.description ||
              selectedMount?.details ? (
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 700, mb: 0.75 }}
                  >
                    Description
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ whiteSpace: "pre-wrap" }}
                  >
                    {selectedMountDetailQuery.data?.description ||
                      selectedMount?.details}
                  </Typography>
                </Box>
              ) : null}

              <Link
                href={
                  selectedMountDetailQuery.data?.href ?? selectedMount?.href
                }
                target="_blank"
                rel="noreferrer"
                color="primary"
                underline="hover"
                sx={{ alignSelf: "flex-start" }}
              >
                View full record on Blizzard
              </Link>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>
    </Stack>
  );
};

export default MountsPage;
