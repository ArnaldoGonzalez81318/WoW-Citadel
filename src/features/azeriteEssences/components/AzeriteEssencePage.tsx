import PsychologyRoundedIcon from "@mui/icons-material/PsychologyRounded"
import ReportProblemRoundedIcon from "@mui/icons-material/ReportProblemRounded"
import CloseRoundedIcon from "@mui/icons-material/CloseRounded"
import SearchInput from "@/features/search/components/SearchInput"
import {
  Alert,
  Box,
  Chip,
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
} from "@mui/material"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useQueries, useQuery } from "@tanstack/react-query"
import ResultCard from "@/components/common/ResultCard"
import VirtualizedCardGrid from "@/components/common/VirtualizedCardGrid"
import useInfiniteScrollTrigger from "@/hooks/useInfiniteScrollTrigger"
import useIdlePrefetchWindow from "@/hooks/useIdlePrefetchWindow"
import { SearchResult } from "@/features/search/types"
import {
  fetchAzeriteEssenceDetail,
  fetchAzeriteEssenceIcon,
  fetchAzeriteEssenceIndex,
  searchAzeriteEssences,
} from "@/features/azeriteEssences/services/azeriteEssenceService"
import { usePerformanceOverlayEntry } from "@/devtools/PerformanceOverlayContext"
import { env } from "@/lib/env"
import { BlizzardRequestError } from "@/lib/blizzardClient"

const AZERITE_SEARCH_MIN_LENGTH = 2
const PAGE_SIZE = 18

const AzeriteEssencePage = (): JSX.Element => {
  const [query, setQuery] = useState("")
  const [visiblePages, setVisiblePages] = useState(1)
  const [renderedCount, setRenderedCount] = useState(0)
  const [selectedEssence, setSelectedEssence] = useState<SearchResult | null>(null)

  const indexQuery = useQuery({
    queryKey: ["azerite-essence-index", env.region],
    queryFn: fetchAzeriteEssenceIndex,
  })

  const trimmedQuery = query.trim()
  const searchQuery = useQuery({
    queryKey: ["azerite-essence-search", trimmedQuery, env.region],
    queryFn: () => searchAzeriteEssences(trimmedQuery),
    enabled: trimmedQuery.length >= AZERITE_SEARCH_MIN_LENGTH,
  })

  const candidateEssences = useMemo(() => {
    if (trimmedQuery.length >= AZERITE_SEARCH_MIN_LENGTH) {
      return searchQuery.data ?? []
    }

    return indexQuery.data?.azerite_essences ?? []
  }, [indexQuery.data, searchQuery.data, trimmedQuery.length])

  const visibleEssences = useMemo(
    () =>
      trimmedQuery.length >= AZERITE_SEARCH_MIN_LENGTH
        ? candidateEssences
        : candidateEssences.slice(0, visiblePages * PAGE_SIZE),
    [candidateEssences, trimmedQuery.length, visiblePages]
  )
  const activeEnrichmentCount = useIdlePrefetchWindow({
    totalCount: visibleEssences.length,
    initialCount: 9,
    batchSize: 6,
    resetKey: `${trimmedQuery}-${visiblePages}-${visibleEssences.length}`,
  })

  const detailQueries = useQueries({
    queries: visibleEssences.map((essence, index) => ({
      queryKey: ["azerite-essence-detail-card", essence.id, env.region],
      queryFn: () => fetchAzeriteEssenceDetail(essence.id),
      enabled: index < activeEnrichmentCount,
      staleTime: 300000,
      retry: false,
    })),
  })

  const mediaQueries = useQueries({
    queries: visibleEssences.map((essence, index) => ({
      queryKey: ["azerite-essence-media-card", essence.id, env.region],
      queryFn: () => fetchAzeriteEssenceIcon(essence.id),
      enabled: index < activeEnrichmentCount,
      staleTime: 300000,
      retry: false,
    })),
  })

  const selectedEssenceDetailQuery = useQuery({
    queryKey: ["azerite-essence-detail-dialog", selectedEssence?.id, env.region],
    queryFn: () => fetchAzeriteEssenceDetail(Number(selectedEssence?.id)),
    enabled: selectedEssence !== null,
    staleTime: 300000,
    retry: false,
  })

  const selectedEssenceMediaQuery = useQuery({
    queryKey: ["azerite-essence-media-dialog", selectedEssence?.id, env.region],
    queryFn: () => fetchAzeriteEssenceIcon(Number(selectedEssence?.id)),
    enabled: selectedEssence !== null && !selectedEssence?.mediaUrl,
    staleTime: 300000,
    retry: false,
  })

  const friendlyError = useMemo(() => {
    const error = indexQuery.error ?? searchQuery.error ?? detailQueries.find((entry) => entry.error)?.error ?? mediaQueries.find((entry) => entry.error)?.error
    if (!error) {
      return undefined
    }

    if (error instanceof BlizzardRequestError) {
      if (error.status === 401 || error.status === 403) {
        return "We couldn’t authenticate with Blizzard’s Azerite Essence API. Update your Blizzard credentials in the .env file and refresh."
      }

      if (error.status === 429) {
        return "The Blizzard API rate limit has been reached. Please wait a few minutes and try again."
      }
    }

    return error instanceof Error ? error.message : "Unable to load Azerite essence data right now."
  }, [detailQueries, indexQuery.error, mediaQueries, searchQuery.error])

  const isLoading =
    indexQuery.isLoading ||
    (trimmedQuery.length >= AZERITE_SEARCH_MIN_LENGTH && searchQuery.isLoading)

  const galleryItems = useMemo(
    () =>
      visibleEssences.map((essence, index) => {
        const detail = detailQueries[index]?.data

        return {
          id: essence.id,
          name: essence.name,
          href: essence.key.href,
          summary: detail ? `${detail.powers.length} ranks` : undefined,
          details: detail
            ? [
              `${detail.allowedSpecializations.length} specializations`,
              detail.powers
                .slice(0, 2)
                .map((power) => power.mainPowerSpell?.name ?? power.passivePowerSpell?.name)
                .filter(Boolean)
                .join(", "),
            ]
              .filter(Boolean)
              .join(" • ")
            : "",
          tag: detail?.powers[0] ? `Rank ${detail.powers[0].rank}` : undefined,
          typeLabel: "Azerite Essence",
          mediaUrl: mediaQueries[index]?.data,
        }
      }),
    [detailQueries, mediaQueries, visibleEssences]
  )

  const selectedEssenceUsesIconAsset = Boolean(
    (selectedEssenceMediaQuery.data ?? selectedEssence?.mediaUrl) && /\/icons\/56\//.test(selectedEssenceMediaQuery.data ?? selectedEssence?.mediaUrl ?? "")
  )
  const selectedEssenceMediaUrl = selectedEssenceMediaQuery.data ?? selectedEssence?.mediaUrl

  const selectedEssenceDescription = useMemo(() => {
    const detail = selectedEssenceDetailQuery.data
    if (!detail) {
      return selectedEssence?.details
    }

    if (detail.allowedSpecializations.length === 0) {
      return selectedEssence?.details
    }

    return detail.allowedSpecializations.map((specialization) => specialization.name).join(", ")
  }, [selectedEssence?.details, selectedEssenceDetailQuery.data])

  const selectedEssencePowerRows = useMemo(() => {
    const detail = selectedEssenceDetailQuery.data
    if (!detail) {
      return []
    }

    return detail.powers.map((power) => {
      const powerNames = [
        power.mainPowerSpell?.name,
        power.passivePowerSpell?.name,
      ].filter(Boolean)

      return powerNames.length > 0
        ? `Rank ${power.rank}: ${powerNames.join(" • ")}`
        : `Rank ${power.rank}`
    })
  }, [selectedEssenceDetailQuery.data])

  const selectedEssenceChipLabels = useMemo(
    () =>
      [
        selectedEssence?.tag,
        selectedEssence?.typeLabel,
        selectedEssenceDetailQuery.data
          ? `${selectedEssenceDetailQuery.data.allowedSpecializations.length} specializations`
          : undefined,
        selectedEssenceDetailQuery.data
          ? `${selectedEssenceDetailQuery.data.powers.length} ranks`
          : selectedEssence?.summary,
      ].filter((value): value is string => Boolean(value)),
    [selectedEssence, selectedEssenceDetailQuery.data]
  )

  const hasMoreEssences = trimmedQuery.length < AZERITE_SEARCH_MIN_LENGTH && visibleEssences.length < candidateEssences.length

  const loadMoreEssences = useCallback(() => {
    if (!hasMoreEssences) {
      return
    }

    setVisiblePages((current) => current + 1)
  }, [hasMoreEssences])

  const infiniteScrollRef = useInfiniteScrollTrigger({
    enabled: !friendlyError,
    hasMore: hasMoreEssences,
    isLoading,
    onLoadMore: loadMoreEssences,
  })

  useEffect(() => {
    setVisiblePages(1)
  }, [query])

  usePerformanceOverlayEntry(
    import.meta.env.DEV
      ? {
        id: "azerite-essences",
        label: "Azerite Essences",
        renderedCount,
        totalCount: galleryItems.length,
        enrichmentCount: activeEnrichmentCount,
        notes: trimmedQuery.length >= AZERITE_SEARCH_MIN_LENGTH ? "Search results" : "Index gallery",
      }
      : null
  )

  return (
    <Stack spacing={{ xs: 4, md: 6 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <PsychologyRoundedIcon color="primary" fontSize="large" />
          <Typography variant="h3" sx={{ fontWeight: 700 }}>
            Azerite Essence Archive
          </Typography>
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Browse Azerite essences as cards with live icon media, specialization counts, and highlighted power names instead of drilling into one essence at a time.
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
            placeholder="Search Azerite essences by name..."
          />
          {trimmedQuery.length >= AZERITE_SEARCH_MIN_LENGTH && candidateEssences.length === 0 && !searchQuery.isLoading ? (
            <Typography variant="body2" color="text.secondary">
              No Azerite essences matched that search. Try a broader term like Memory or Life.
            </Typography>
          ) : null}
        </Stack>
      </Paper>

      {friendlyError ? (
        <Alert severity="error" icon={<ReportProblemRoundedIcon fontSize="small" />} sx={{ borderRadius: 3 }}>
          {friendlyError}
        </Alert>
      ) : null}

      {isLoading ? (
        <Grid container spacing={3}>
          {Array.from({ length: 12 }).map((_, index) => (
            <Grid item xs={12} md={6} lg={4} key={index}>
              <Skeleton variant="rounded" height={320} sx={{ borderRadius: 3, backgroundColor: "rgba(12, 18, 34, 0.45)" }} />
            </Grid>
          ))}
        </Grid>
      ) : null}

      {!isLoading && !friendlyError ? (
        <Stack spacing={3}>
          <Stack spacing={0.75}>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              {trimmedQuery.length >= AZERITE_SEARCH_MIN_LENGTH ? "Search matches" : "Azerite gallery"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {trimmedQuery.length >= AZERITE_SEARCH_MIN_LENGTH
                ? `Showing ${galleryItems.length} matching essences.`
                : `Loaded ${galleryItems.length} of ${candidateEssences.length} Azerite essences.`}
            </Typography>
          </Stack>

          <VirtualizedCardGrid
            items={galleryItems}
            getItemKey={(item) => item.id}
            itemHeight={244}
            gap={12}
            columns={{ xs: 1, sm: 2, md: 4, lg: 6, xl: 10 }}
            onVisibleRangeChange={(range) => setRenderedCount(range.end - range.start)}
            renderItem={(item) => <ResultCard result={item} accentColor="#7dd3fc" compact onClick={() => setSelectedEssence(item)} />}
          />

          <Stack spacing={1.5} alignItems="center">
            {hasMoreEssences ? (
              <Typography variant="body2" color="text.secondary">
                Keep scrolling to load more essences.
              </Typography>
            ) : trimmedQuery.length < AZERITE_SEARCH_MIN_LENGTH && galleryItems.length > 0 ? (
              <Typography variant="body2" color="text.secondary">
                Reached the end of the Azerite essence archive.
              </Typography>
            ) : null}
            {activeEnrichmentCount < visibleEssences.length ? (
              <Typography variant="caption" color="text.secondary">
                Prefetching additional essence details and media during idle time.
              </Typography>
            ) : null}
            {hasMoreEssences ? <Box ref={infiniteScrollRef} sx={{ width: "100%", height: 1 }} /> : null}
          </Stack>
        </Stack>
      ) : null}

      <Dialog
        open={selectedEssence !== null}
        onClose={() => setSelectedEssence(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pr: 7 }}>
          {selectedEssence?.name ?? "Azerite Essence details"}
          <IconButton
            aria-label="Close Azerite Essence details"
            onClick={() => setSelectedEssence(null)}
            sx={{ position: "absolute", right: 12, top: 12 }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems={{ xs: "stretch", md: "flex-start" }}>
            <Box
              sx={{
                width: selectedEssenceUsesIconAsset ? { xs: 56, md: 56 } : { xs: "100%", md: 220 },
                flexShrink: 0,
              }}
            >
              <Box
                sx={{
                  width: selectedEssenceUsesIconAsset ? 56 : "100%",
                  height: selectedEssenceUsesIconAsset ? 56 : "auto",
                  minHeight: selectedEssenceUsesIconAsset ? 56 : { xs: 180, md: 220 },
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: selectedEssenceUsesIconAsset ? 1 : 3,
                  border: selectedEssenceUsesIconAsset ? "none" : "1px solid rgba(125, 211, 252, 0.18)",
                  backgroundColor: selectedEssenceUsesIconAsset ? "transparent" : "rgba(7, 12, 24, 0.72)",
                  p: selectedEssenceUsesIconAsset ? 0 : 3,
                }}
              >
                {selectedEssence && selectedEssenceMediaUrl ? (
                  <Box
                    component="img"
                    src={selectedEssenceMediaUrl}
                    alt={selectedEssence.name}
                    sx={{
                      width: selectedEssenceUsesIconAsset ? 56 : "auto",
                      height: selectedEssenceUsesIconAsset ? 56 : "auto",
                      maxWidth: selectedEssenceUsesIconAsset ? 56 : 160,
                      maxHeight: selectedEssenceUsesIconAsset ? 56 : 160,
                      objectFit: "contain",
                    }}
                  />
                ) : selectedEssence ? (
                  <Typography variant="h2" sx={{ fontWeight: 700, color: "text.secondary" }}>
                    {selectedEssence.name.slice(0, 1)}
                  </Typography>
                ) : null}
              </Box>
            </Box>

            <Stack spacing={3} sx={{ minWidth: 0, flex: 1 }}>
              {selectedEssenceDetailQuery.isLoading ? (
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <CircularProgress size={22} />
                  <Typography variant="body2" color="text.secondary">
                    Loading live Azerite Essence details...
                  </Typography>
                </Stack>
              ) : null}

              {selectedEssenceDetailQuery.isError ? (
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                  {selectedEssenceDetailQuery.error instanceof Error
                    ? selectedEssenceDetailQuery.error.message
                    : "Unable to load Azerite Essence details right now."}
                </Alert>
              ) : null}

              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {selectedEssenceChipLabels.map((label) => (
                  <Chip key={label} label={label} size="small" />
                ))}
              </Stack>

              {selectedEssenceDescription ? (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                    Description
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
                    {selectedEssenceDescription}
                  </Typography>
                </Box>
              ) : null}

              {selectedEssencePowerRows.length > 0 ? (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                    Details
                  </Typography>
                  <Stack spacing={0.75}>
                    {selectedEssencePowerRows.map((row) => (
                      <Typography key={row} variant="body2" color="text.secondary">
                        {row}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              ) : selectedEssence?.details ? (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                    Details
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
                    {selectedEssence.details}
                  </Typography>
                </Box>
              ) : null}

              <Link
                href={selectedEssence?.href}
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
  )
}

export default AzeriteEssencePage