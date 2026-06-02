import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import DnsRoundedIcon from "@mui/icons-material/DnsRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import ReportProblemRoundedIcon from "@mui/icons-material/ReportProblemRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  Link,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import SearchInput from "@/features/search/components/SearchInput";
import useInfiniteScrollTrigger from "@/hooks/useInfiniteScrollTrigger";
import useIdlePrefetchWindow from "@/hooks/useIdlePrefetchWindow";
import {
  fetchRealmDetail,
  fetchRealmIndex,
  searchRealmsDetailed,
} from "@/features/realms/services/realmService";
import { usePerformanceOverlayEntry } from "@/devtools/PerformanceOverlayContext";
import { env } from "@/lib/env";
import { BlizzardRequestError } from "@/lib/blizzardClient";

const QUICK_REALMS = ["Stormrage", "Illidan", "Area 52", "Tichondrius"];
const PAGE_SIZE = 24;
const REALM_ACCENT = "#38bdf8";

type RealmGalleryCard = {
  id: number;
  name: string;
  slug: string;
  href: string;
  regionName?: string;
  typeName?: string;
  category?: string;
  timezone?: string;
  locale?: string;
  isTournament?: boolean;
  connectedRealmHref?: string;
};

const formatCount = (value: number): string =>
  new Intl.NumberFormat("en-US").format(value);

const RealmInfoRow = ({
  icon,
  label,
  value,
}: {
  icon: JSX.Element;
  label: string;
  value?: string;
}): JSX.Element => (
  <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
    <Box
      sx={{
        width: 26,
        height: 26,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        borderRadius: 1.25,
        color: REALM_ACCENT,
        backgroundColor: "rgba(56, 189, 248, 0.1)",
      }}
    >
      {icon}
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" component="div">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 650,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value || "Pending detail"}
      </Typography>
    </Box>
  </Stack>
);

const RealmCard = ({ realm }: { realm: RealmGalleryCard }): JSX.Element => {
  const initials = realm.name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <Paper
      variant="outlined"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: 2,
        borderColor: "rgba(56, 189, 248, 0.22)",
        background:
          "linear-gradient(180deg, rgba(12, 18, 34, 0.96), rgba(8, 13, 25, 0.9))",
        transition:
          "transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
        "@media (hover: hover)": {
          "&:hover": {
            transform: "translateY(-3px)",
            borderColor: "rgba(56, 189, 248, 0.62)",
            boxShadow: "0 18px 38px rgba(8, 145, 178, 0.18)",
          },
        },
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.75,
          borderBottom: "1px solid rgba(56, 189, 248, 0.18)",
          background:
            "linear-gradient(135deg, rgba(56, 189, 248, 0.18), rgba(34, 197, 94, 0.08) 48%, rgba(15, 23, 42, 0.08))",
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 52,
              height: 52,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              borderRadius: 1.75,
              border: "1px solid rgba(125, 211, 252, 0.38)",
              background:
                "radial-gradient(circle at 28% 22%, rgba(255, 255, 255, 0.24), transparent 34%), linear-gradient(145deg, rgba(14, 165, 233, 0.52), rgba(22, 101, 52, 0.42))",
              color: "#e0f2fe",
              fontSize: "1.05rem",
              fontWeight: 900,
            }}
          >
            {initials || realm.name.slice(0, 1)}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 800,
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {realm.name}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 0.25 }}
            >
              {realm.slug}
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Stack spacing={1.5} sx={{ p: 2, flex: 1, minHeight: 0 }}>
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          <Chip
            label={realm.regionName || "Region pending"}
            size="small"
            sx={{
              borderRadius: 1.5,
              backgroundColor: "rgba(56, 189, 248, 0.14)",
              color: "#7dd3fc",
              fontWeight: 700,
            }}
          />
          <Chip
            label={realm.typeName || "Type pending"}
            size="small"
            variant="outlined"
            sx={{ borderRadius: 1.5 }}
          />
          {realm.isTournament ? (
            <Chip label="Tournament" size="small" color="warning" />
          ) : null}
        </Stack>

        <Stack spacing={1.1} sx={{ flex: 1 }}>
          <RealmInfoRow
            icon={<DnsRoundedIcon sx={{ fontSize: 16 }} />}
            label="Category"
            value={realm.category}
          />
          <RealmInfoRow
            icon={<AccessTimeRoundedIcon sx={{ fontSize: 16 }} />}
            label="Timezone"
            value={realm.timezone}
          />
          <RealmInfoRow
            icon={<LanguageRoundedIcon sx={{ fontSize: 16 }} />}
            label="Locale"
            value={realm.locale?.toUpperCase()}
          />
        </Stack>

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1.5}
          sx={{ pt: 0.75, borderTop: "1px solid rgba(148, 163, 184, 0.14)" }}
        >
          <Stack direction="row" spacing={0.75} alignItems="center">
            <HubRoundedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            <Typography variant="caption" color="text.secondary">
              {realm.connectedRealmHref ? "Connected realm" : "Realm record"}
            </Typography>
          </Stack>
          <Link
            href={realm.href}
            target="_blank"
            rel="noreferrer"
            underline="hover"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              fontSize: "0.74rem",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            Blizzard
            <LaunchRoundedIcon fontSize="inherit" />
          </Link>
        </Stack>
      </Stack>
    </Paper>
  );
};

const RealmsPage = (): JSX.Element => {
  const [query, setQuery] = useState<string>("");
  const [visiblePages, setVisiblePages] = useState(1);

  const indexQuery = useQuery({
    queryKey: ["realm-gallery-index", env.region],
    queryFn: fetchRealmIndex,
    staleTime: 1000 * 60 * 30,
  });

  const searchQuery = useQuery({
    queryKey: ["realm-search-explorer", query, env.region, env.locale],
    queryFn: () => searchRealmsDetailed(query),
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60 * 10,
  });

  const indexedRealms = useMemo(() => indexQuery.data ?? [], [indexQuery.data]);
  const realms = useMemo(
    () =>
      query.trim().length >= 2
        ? (searchQuery.data ?? [])
        : indexedRealms.slice(0, visiblePages * PAGE_SIZE),
    [indexedRealms, query, searchQuery.data, visiblePages],
  );
  const activeDetailCount = useIdlePrefetchWindow({
    totalCount: realms.length,
    initialCount: 12,
    batchSize: 6,
    resetKey: `${query}-${visiblePages}-${realms.length}`,
  });

  const detailQueries = useQueries({
    queries: realms.map((realm, index) => ({
      queryKey: ["realm-detail-card", realm.slug, env.region],
      queryFn: () => fetchRealmDetail(realm.slug),
      enabled: index < activeDetailCount,
      staleTime: 300000,
      retry: false,
    })),
  });

  const friendlyError = useMemo(() => {
    const error =
      indexQuery.error ??
      searchQuery.error ??
      detailQueries.find((entry) => entry.error)?.error;
    if (!error) {
      return undefined;
    }

    if (error instanceof BlizzardRequestError) {
      if (error.status === 401 || error.status === 403) {
        return "We couldn’t authenticate with Blizzard’s Realm API. Update your Blizzard credentials in the .env file and refresh.";
      }

      if (error.status === 429) {
        return "The Blizzard API rate limit has been reached. Please wait a few minutes and try again.";
      }
    }

    return error instanceof Error
      ? error.message
      : "Unable to load realm data right now.";
  }, [detailQueries, indexQuery.error, searchQuery.error]);

  const isLoading = indexQuery.isLoading || searchQuery.isLoading;

  const galleryRealms = useMemo<RealmGalleryCard[]>(
    () =>
      realms.map((realm, index) => {
        const detail = detailQueries[index]?.data;

        return {
          id: realm.id,
          name: realm.name,
          slug: realm.slug,
          href: detail?.href ?? realm.href,
          regionName: detail?.regionName ?? realm.regionName,
          typeName: detail?.typeName ?? realm.typeName,
          category: detail?.category ?? realm.category,
          timezone: detail?.timezone ?? realm.timezone,
          locale: detail?.locale,
          isTournament: detail?.isTournament,
          connectedRealmHref: detail?.connectedRealmHref,
        };
      }),
    [detailQueries, realms],
  );

  const hasMoreRealms =
    query.trim().length < 2 && realms.length < indexedRealms.length;

  const loadMoreRealms = useCallback(() => {
    if (!hasMoreRealms) {
      return;
    }

    setVisiblePages((current) => current + 1);
  }, [hasMoreRealms]);

  const infiniteScrollRef = useInfiniteScrollTrigger({
    enabled: !friendlyError,
    hasMore: hasMoreRealms,
    isLoading,
    onLoadMore: loadMoreRealms,
  });

  useEffect(() => {
    setVisiblePages(1);
  }, [query]);

  usePerformanceOverlayEntry(
    import.meta.env.DEV
      ? {
          id: "realms",
          label: "Realms",
          renderedCount: galleryRealms.length,
          totalCount: galleryRealms.length,
          enrichmentCount: activeDetailCount,
          notes: query ? "Search results" : "Realm index",
        }
      : null,
  );

  return (
    <Stack spacing={{ xs: 3, md: 4 }}>
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2.25, md: 2.75 },
          borderRadius: 2.5,
          borderColor: "rgba(56, 189, 248, 0.2)",
          background:
            "linear-gradient(135deg, rgba(12, 18, 34, 0.92), rgba(8, 47, 73, 0.46) 58%, rgba(6, 78, 59, 0.28))",
          overflow: "hidden",
        }}
      >
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems={{ xs: "flex-start", md: "center" }}
            justifyContent="space-between"
          >
            <Stack spacing={1.25} sx={{ maxWidth: 720 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 2,
                    color: "#e0f2fe",
                    background:
                      "linear-gradient(145deg, rgba(14, 165, 233, 0.55), rgba(16, 185, 129, 0.28))",
                    border: "1px solid rgba(125, 211, 252, 0.32)",
                  }}
                >
                  <PublicRoundedIcon />
                </Box>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 800 }}>
                    Realm Atlas
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Live {env.region.toUpperCase()} realm index
                  </Typography>
                </Box>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Scan realms as operational cards with region, ruleset, timezone,
                locale, and connected-realm context surfaced up front.
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              <Chip
                icon={<DnsRoundedIcon />}
                label={query ? "Search mode" : "Index mode"}
                color="primary"
                variant="outlined"
                sx={{ borderRadius: 2, fontWeight: 700 }}
              />
              <Chip
                label={`${formatCount(indexedRealms.length)} indexed`}
                size="small"
                variant="outlined"
                sx={{ borderRadius: 2 }}
              />
              <Chip
                label={`${formatCount(galleryRealms.length)} displayed`}
                size="small"
                variant="outlined"
                sx={{ borderRadius: 2 }}
              />
              <Chip
                label={`${formatCount(activeDetailCount)} enriched`}
                size="small"
                variant="outlined"
                sx={{ borderRadius: 2 }}
              />
            </Stack>
          </Stack>

          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={1.25}
            alignItems={{ xs: "stretch", lg: "center" }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <SearchInput
                value={query}
                onChange={setQuery}
                onClear={() => setQuery("")}
                autoFocus={false}
                placeholder="Search realms by name..."
              />
            </Box>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              <Chip
                icon={<SearchRoundedIcon />}
                label="Quick realms"
                size="small"
                variant="outlined"
                sx={{ borderRadius: 2 }}
              />
              {QUICK_REALMS.map((realm) => (
                <Button
                  key={realm}
                  variant={query === realm ? "contained" : "outlined"}
                  color="primary"
                  size="small"
                  onClick={() => setQuery(realm)}
                  sx={{ borderRadius: 2 }}
                >
                  {realm}
                </Button>
              ))}
              {query ? (
                <Button
                  variant="outlined"
                  color="primary"
                  size="small"
                  onClick={() => setQuery("")}
                  sx={{ borderRadius: 2, px: 2.25 }}
                >
                  Back to index
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </Stack>
      </Paper>

      {query ? (
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Chip
            label={`Showing ${galleryRealms.length} matching realms`}
            color="primary"
            variant="outlined"
            sx={{ borderRadius: 2 }}
          />
        </Stack>
      ) : null}

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
      ) : null}

      {!isLoading && !friendlyError ? (
        <Stack spacing={2.5}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
                md: "repeat(3, minmax(0, 1fr))",
                lg: "repeat(4, minmax(0, 1fr))",
              },
              gap: 2,
              alignItems: "stretch",
            }}
          >
            {galleryRealms.map((realm) => (
              <RealmCard key={realm.id} realm={realm} />
            ))}
          </Box>

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
            {hasMoreRealms ? (
              <Box ref={infiniteScrollRef} sx={{ width: "100%", height: 1 }} />
            ) : null}
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
};

export default RealmsPage;
