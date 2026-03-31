import PublicRoundedIcon from "@mui/icons-material/PublicRounded"
import ReportProblemRoundedIcon from "@mui/icons-material/ReportProblemRounded"
import {
  Alert,
  Box,
  Button,
  Grid,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material"
import { useQueries, useQuery } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useState } from "react"
import ResultCard from "@/components/common/ResultCard"
import VirtualizedCardGrid from "@/components/common/VirtualizedCardGrid"
import SearchInput from "@/features/search/components/SearchInput"
import useInfiniteScrollTrigger from "@/hooks/useInfiniteScrollTrigger"
import useIdlePrefetchWindow from "@/hooks/useIdlePrefetchWindow"
import { fetchRealmDetail, fetchRealmIndex, searchRealmsDetailed } from "@/features/realms/services/realmService"
import { usePerformanceOverlayEntry } from "@/devtools/PerformanceOverlayContext"
import { env } from "@/lib/env"
import { BlizzardRequestError } from "@/lib/blizzardClient"

const QUICK_REALMS = ["Stormrage", "Illidan", "Area 52", "Tichondrius"]
const PAGE_SIZE = 24

const RealmsPage = (): JSX.Element => {
  const [query, setQuery] = useState<string>("")
  const [visiblePages, setVisiblePages] = useState(1)
  const [renderedCount, setRenderedCount] = useState(0)

  const indexQuery = useQuery({
    queryKey: ["realm-gallery-index", env.region],
    queryFn: fetchRealmIndex,
  })

  const searchQuery = useQuery({
    queryKey: ["realm-search-explorer", query, env.region, env.locale],
    queryFn: () => searchRealmsDetailed(query),
    enabled: query.trim().length >= 2,
  })

  const indexedRealms = useMemo(() => indexQuery.data ?? [], [indexQuery.data])
  const realms = useMemo(
    () =>
      query.trim().length >= 2
        ? searchQuery.data ?? []
        : indexedRealms.slice(0, visiblePages * PAGE_SIZE),
    [indexedRealms, query, searchQuery.data, visiblePages]
  )
  const activeDetailCount = useIdlePrefetchWindow({
    totalCount: realms.length,
    initialCount: 12,
    batchSize: 6,
    resetKey: `${query}-${visiblePages}-${realms.length}`,
  })

  const detailQueries = useQueries({
    queries: realms.map((realm, index) => ({
      queryKey: ["realm-detail-card", realm.slug, env.region],
      queryFn: () => fetchRealmDetail(realm.slug),
      enabled: index < activeDetailCount,
      staleTime: 300000,
      retry: false,
    })),
  })

  const friendlyError = useMemo(() => {
    const error = indexQuery.error ?? searchQuery.error ?? detailQueries.find((entry) => entry.error)?.error
    if (!error) {
      return undefined
    }

    if (error instanceof BlizzardRequestError) {
      if (error.status === 401 || error.status === 403) {
        return "We couldn’t authenticate with Blizzard’s Realm API. Update your Blizzard credentials in the .env file and refresh."
      }

      if (error.status === 429) {
        return "The Blizzard API rate limit has been reached. Please wait a few minutes and try again."
      }
    }

    return error instanceof Error ? error.message : "Unable to load realm data right now."
  }, [detailQueries, indexQuery.error, searchQuery.error])

  const isLoading = indexQuery.isLoading || searchQuery.isLoading

  const galleryRealms = useMemo(
    () =>
      realms.map((realm, index) => {
        const detail = detailQueries[index]?.data

        return {
          id: realm.id,
          name: realm.name,
          href: detail?.href ?? realm.href,
          summary: [detail?.regionName ?? realm.regionName, detail?.typeName ?? realm.typeName]
            .filter(Boolean)
            .join(" • "),
          details: [detail?.category ?? realm.category, detail?.timezone ?? realm.timezone, detail?.isTournament ? "Tournament" : undefined]
            .filter(Boolean)
            .join(" • "),
          tag: detail?.locale?.toUpperCase(),
          typeLabel: "Realm",
        }
      }),
    [detailQueries, realms]
  )

  const hasMoreRealms = query.trim().length < 2 && realms.length < indexedRealms.length

  const loadMoreRealms = useCallback(() => {
    if (!hasMoreRealms) {
      return
    }

    setVisiblePages((current) => current + 1)
  }, [hasMoreRealms])

  const infiniteScrollRef = useInfiniteScrollTrigger({
    enabled: !friendlyError,
    hasMore: hasMoreRealms,
    isLoading,
    onLoadMore: loadMoreRealms,
  })

  useEffect(() => {
    setVisiblePages(1)
  }, [query])

  usePerformanceOverlayEntry(
    import.meta.env.DEV
      ? {
        id: "realms",
        label: "Realms",
        renderedCount,
        totalCount: galleryRealms.length,
        enrichmentCount: activeDetailCount,
        notes: query ? "Search results" : "Realm index",
      }
      : null
  )

  return (
    <Stack spacing={{ xs: 4, md: 6 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <PublicRoundedIcon color="primary" fontSize="large" />
          <Typography variant="h3" sx={{ fontWeight: 700 }}>
            Realm Atlas
          </Typography>
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Browse realms as cards instead of drilling into a single selected record. Search by name or keep scrolling through the live realm index.
        </Typography>
      </Stack>

      <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 }, borderRadius: 4, borderColor: "rgba(30, 155, 233, 0.22)", backgroundColor: "rgba(12, 18, 34, 0.72)" }}>
        <Stack spacing={2.5}>
          <SearchInput
            value={query}
            onChange={setQuery}
            onClear={() => setQuery("")}
            autoFocus={false}
            placeholder="Search realms by name..."
          />
          <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap">
            {QUICK_REALMS.map((realm) => (
              <Button key={realm} variant={query === realm ? "contained" : "outlined"} color="primary" size="small" onClick={() => setQuery(realm)} sx={{ borderRadius: 999 }}>
                {realm}
              </Button>
            ))}
            {query ? (
              <Button variant="text" color="primary" size="small" onClick={() => setQuery("")} sx={{ borderRadius: 999 }}>
                Back to realm index
              </Button>
            ) : null}
          </Stack>
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
              {query ? "Search matches" : "Realm gallery"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {query
                ? `Showing ${galleryRealms.length} matching realms.`
                : `Loaded ${galleryRealms.length} of ${indexedRealms.length} realms from the live realm index.`}
            </Typography>
          </Stack>

          <VirtualizedCardGrid
            items={galleryRealms}
            getItemKey={(realm) => realm.id}
            onVisibleRangeChange={(range) => setRenderedCount(range.end - range.start)}
            renderItem={(realm) => <ResultCard result={realm} accentColor="#38bdf8" />}
          />

          <Stack spacing={1.5} alignItems="center">
            {hasMoreRealms ? (
              <Typography variant="body2" color="text.secondary">
                Keep scrolling to load more realms.
              </Typography>
            ) : !query && galleryRealms.length > 0 ? (
              <Typography variant="body2" color="text.secondary">
                Reached the end of the realm index.
              </Typography>
            ) : null}
            {activeDetailCount < realms.length ? (
              <Typography variant="caption" color="text.secondary">
                Prefetching additional realm details during idle time.
              </Typography>
            ) : null}
            {hasMoreRealms ? <Box ref={infiniteScrollRef} sx={{ width: "100%", height: 1 }} /> : null}
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  )
}

export default RealmsPage