import CategoryRoundedIcon from "@mui/icons-material/CategoryRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import ResultCard from "@/components/common/ResultCard";
import VirtualizedCardGrid from "@/components/common/VirtualizedCardGrid";
import { useAchievementCategoryIndex } from "@/features/achievements/hooks/useAchievementCategoryIndex";
import { fetchAchievementGalleryPage } from "@/features/achievements/services/achievementService";
import useInfiniteScrollTrigger from "@/hooks/useInfiniteScrollTrigger";
import { usePerformanceOverlayEntry } from "@/devtools/PerformanceOverlayContext";

const PAGE_SIZE = 18;

const AchievementsPage = (): JSX.Element => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );
  const [renderedCount, setRenderedCount] = useState(0);
  const { data, isLoading, isError, error } = useAchievementCategoryIndex();

  const categories = useMemo(() => data?.categories ?? [], [data]);
  const groupedCategories = useMemo(() => {
    const groups: Record<string, typeof categories> = {};
    for (const cat of categories) {
      const letter = cat.name[0].toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(cat);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [categories]);
  const errorMessage = error instanceof Error ? error.message : undefined;

  useEffect(() => {
    if (categories.length > 0 && selectedCategoryId === null) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  const galleryQuery = useInfiniteQuery({
    queryKey: ["achievement-gallery", selectedCategoryId],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      fetchAchievementGalleryPage(
        Number(selectedCategoryId),
        pageParam,
        PAGE_SIZE,
      ),
    enabled: selectedCategoryId !== null,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.pageCount ? lastPage.page + 1 : undefined,
  });

  const friendlyError =
    galleryQuery.error instanceof Error
      ? galleryQuery.error.message
      : errorMessage;
  const galleryPages = galleryQuery.data?.pages ?? [];
  const galleryAchievements = useMemo(
    () => galleryPages.flatMap((pageEntry) => pageEntry.achievements),
    [galleryPages],
  );

  const loadMoreAchievements = useCallback(() => {
    if (!galleryQuery.hasNextPage || galleryQuery.isFetchingNextPage) {
      return;
    }

    void galleryQuery.fetchNextPage();
  }, [
    galleryQuery.fetchNextPage,
    galleryQuery.hasNextPage,
    galleryQuery.isFetchingNextPage,
  ]);

  const infiniteScrollRef = useInfiniteScrollTrigger({
    enabled: selectedCategoryId !== null && !friendlyError,
    hasMore: galleryQuery.hasNextPage,
    isLoading: galleryQuery.isFetchingNextPage,
    onLoadMore: loadMoreAchievements,
  });

  usePerformanceOverlayEntry(
    import.meta.env.DEV
      ? {
          id: "achievements",
          label: "Achievements",
          renderedCount,
          totalCount: galleryAchievements.length,
          notes: galleryPages[0]?.category.name ?? "Achievement gallery",
        }
      : null,
  );

  return (
    <Stack spacing={{ xs: 4, md: 6 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <EmojiEventsRoundedIcon color="primary" fontSize="large" />
          <Typography variant="h3" sx={{ fontWeight: 700 }}>
            Achievement Atlas
          </Typography>
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Browse achievements as a visual gallery. Filter by category and keep
          scrolling through live Blizzard records with points, rewards, and icon
          media.
        </Typography>
      </Stack>

      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, md: 2.5 },
          borderRadius: 3,
          borderColor: "rgba(30, 155, 233, 0.18)",
          backgroundColor: "rgba(12, 18, 34, 0.65)",
        }}
      >
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <CategoryRoundedIcon
              sx={{ fontSize: "0.9rem", color: "text.disabled" }}
            />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "text.disabled",
                fontSize: "0.68rem",
              }}
            >
              Achievement category
            </Typography>
          </Stack>
          <Box
            sx={{
              maxHeight: 220,
              overflowY: "auto",
              pr: 0.5,
              "&::-webkit-scrollbar": { width: 4 },
              "&::-webkit-scrollbar-thumb": {
                borderRadius: 2,
                backgroundColor: "rgba(30, 155, 233, 0.25)",
              },
              "&::-webkit-scrollbar-track": { background: "transparent" },
            }}
          >
            <Stack spacing={0.75}>
              {groupedCategories.map(([letter, cats]) => (
                <Stack
                  key={letter}
                  direction="row"
                  alignItems="flex-start"
                  spacing={1}
                >
                  <Typography
                    sx={{
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      color: "rgba(30, 155, 233, 0.5)",
                      letterSpacing: "0.06em",
                      lineHeight: "24px",
                      minWidth: 14,
                      textAlign: "right",
                      flexShrink: 0,
                      userSelect: "none",
                    }}
                  >
                    {letter}
                  </Typography>
                  <Stack
                    direction="row"
                    useFlexGap
                    flexWrap="wrap"
                    sx={{ gap: 0.75 }}
                  >
                    {cats.map((category) => {
                      const isSelected = selectedCategoryId === category.id;
                      return (
                        <Chip
                          key={category.id}
                          label={category.name}
                          clickable
                          size="small"
                          variant={isSelected ? "filled" : "outlined"}
                          onClick={() => setSelectedCategoryId(category.id)}
                          sx={{
                            borderRadius: 1.5,
                            height: 24,
                            fontSize: "0.72rem",
                            fontWeight: isSelected ? 700 : 400,
                            ...(isSelected
                              ? {
                                  backgroundColor: "rgba(30, 155, 233, 0.9)",
                                  color: "#fff",
                                  boxShadow: "0 0 8px rgba(30, 155, 233, 0.45)",
                                  "&:hover": {
                                    backgroundColor: "rgba(30, 155, 233, 1)",
                                  },
                                }
                              : {
                                  borderColor: "rgba(30, 155, 233, 0.2)",
                                  color: "text.secondary",
                                  "&:hover": {
                                    borderColor: "rgba(30, 155, 233, 0.5)",
                                    backgroundColor: "rgba(30, 155, 233, 0.08)",
                                  },
                                }),
                          }}
                        />
                      );
                    })}
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Stack>
      </Paper>

      {isError ? (
        <Alert severity="error" sx={{ borderRadius: 3 }}>
          {errorMessage ??
            "Unable to load the achievement index. Double-check your Blizzard API credentials and try again."}
        </Alert>
      ) : null}

      {galleryQuery.isError ? (
        <Alert severity="error" sx={{ borderRadius: 3 }}>
          {friendlyError ??
            "Unable to load achievement data for this category."}
        </Alert>
      ) : null}

      {isLoading || galleryQuery.isLoading ? (
        <Grid container spacing={3}>
          {Array.from({ length: 12 }).map((_, index) => (
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
      ) : (
        <Stack spacing={3}>
          <Stack spacing={0.75}>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              {galleryPages[0]?.category.name ?? "Achievements"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Loaded {galleryAchievements.length} achievements across{" "}
              {galleryPages.length || 1} page
              {galleryPages.length === 1 ? "" : "s"}.
            </Typography>
          </Stack>

          <VirtualizedCardGrid
            items={galleryAchievements}
            itemHeight={260}
            getItemKey={(achievement) => achievement.id}
            onVisibleRangeChange={(range) =>
              setRenderedCount(range.end - range.start)
            }
            renderItem={(achievement) => (
              <ResultCard result={achievement} accentColor="#f5c045" />
            )}
          />

          <Stack spacing={1.5} alignItems="center">
            {galleryQuery.hasNextPage ? (
              <Typography variant="body2" color="text.secondary">
                Keep scrolling to load more achievements.
              </Typography>
            ) : galleryAchievements.length > 0 ? (
              <Typography variant="body2" color="text.secondary">
                Reached the end of this achievement category.
              </Typography>
            ) : null}
            {galleryQuery.isFetchingNextPage ? (
              <CircularProgress color="primary" size={28} />
            ) : null}
            {galleryQuery.hasNextPage ? (
              <Box ref={infiniteScrollRef} sx={{ width: "100%", height: 1 }} />
            ) : null}
          </Stack>
        </Stack>
      )}
    </Stack>
  );
};

export default AchievementsPage;
