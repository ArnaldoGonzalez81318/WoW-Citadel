import ReportProblemRoundedIcon from "@mui/icons-material/ReportProblemRounded";
import ShieldMoonRoundedIcon from "@mui/icons-material/ShieldMoonRounded";
import { Alert, Grid, Paper, Skeleton, Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import ResultCard from "@/components/common/ResultCard";
import useIdlePrefetchWindow from "@/hooks/useIdlePrefetchWindow";
import {
  fetchCovenantDetail,
  fetchCovenantIcon,
  fetchCovenantIndex,
} from "@/features/covenants/services/covenantService";
import { usePerformanceOverlayEntry } from "@/devtools/PerformanceOverlayContext";
import { env } from "@/lib/env";
import { BlizzardRequestError } from "@/lib/blizzardClient";

const CovenantPage = (): JSX.Element => {
  const indexQuery = useQuery({
    queryKey: ["covenant-index", env.region],
    queryFn: fetchCovenantIndex,
    staleTime: 1000 * 60 * 60,
  });

  const covenants = useMemo(
    () => indexQuery.data?.covenants ?? [],
    [indexQuery.data],
  );
  const activeEnrichmentCount = useIdlePrefetchWindow({
    totalCount: covenants.length,
    initialCount: 2,
    batchSize: 1,
    resetKey: `${covenants.length}`,
  });

  const detailQueries = useQueries({
    queries: covenants.map((covenant, index) => ({
      queryKey: ["covenant-detail-card", covenant.id, env.region],
      queryFn: () => fetchCovenantDetail(covenant.id),
      enabled: index < activeEnrichmentCount,
      staleTime: 300000,
      retry: false,
    })),
  });

  const mediaQueries = useQueries({
    queries: covenants.map((covenant, index) => ({
      queryKey: ["covenant-media-card", covenant.id, env.region],
      queryFn: () => fetchCovenantIcon(covenant.id),
      enabled: index < activeEnrichmentCount,
      staleTime: 300000,
      retry: false,
    })),
  });

  const friendlyError = useMemo(() => {
    const error =
      indexQuery.error ??
      detailQueries.find((entry) => entry.error)?.error ??
      mediaQueries.find((entry) => entry.error)?.error;
    if (!error) {
      return undefined;
    }

    if (error instanceof BlizzardRequestError) {
      if (error.status === 401 || error.status === 403) {
        return "We couldn’t authenticate with Blizzard’s Covenant API. Update your Blizzard credentials in the .env file and refresh.";
      }

      if (error.status === 429) {
        return "The Blizzard API rate limit has been reached. Please wait a few minutes and try again.";
      }
    }

    return error instanceof Error
      ? error.message
      : "Unable to load covenant data right now.";
  }, [detailQueries, indexQuery.error, mediaQueries]);

  const isLoading = indexQuery.isLoading;

  const galleryItems = useMemo(
    () =>
      covenants.map((covenant, index) => {
        const detail = detailQueries[index]?.data;

        return {
          id: covenant.id,
          name: covenant.name,
          href: covenant.key.href,
          summary:
            detail?.signatureAbility?.spellTooltip?.spell?.name ??
            "Covenant overview",
          details: [
            detail?.description,
            detail
              ? `${detail.classAbilities.length} class abilities`
              : undefined,
            detail
              ? `${detail.renownRewards.length} renown rewards`
              : undefined,
          ]
            .filter(Boolean)
            .join(" • "),
          tag: detail?.signatureAbility ? "Signature" : undefined,
          typeLabel: "Covenant",
          mediaUrl: mediaQueries[index]?.data ?? undefined,
        };
      }),
    [covenants, detailQueries, mediaQueries],
  );

  usePerformanceOverlayEntry(
    import.meta.env.DEV
      ? {
          id: "covenants",
          label: "Covenants",
          renderedCount: galleryItems.length,
          totalCount: covenants.length,
          enrichmentCount: activeEnrichmentCount,
          notes: "Index gallery",
        }
      : null,
  );

  return (
    <Stack spacing={{ xs: 4, md: 6 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <ShieldMoonRoundedIcon color="primary" fontSize="large" />
          <Typography variant="h3" sx={{ fontWeight: 700 }}>
            Covenant Compendium
          </Typography>
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Browse covenants as a gallery. Each card is enriched with live
          covenant details, signature ability data, and media when Blizzard
          exposes it.
        </Typography>
      </Stack>

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
          {Array.from({ length: 4 }).map((_, index) => (
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
        <Stack spacing={2}>
          {activeEnrichmentCount < covenants.length ? (
            <Typography variant="caption" color="text.secondary">
              Prefetching additional covenant details and media during idle
              time.
            </Typography>
          ) : null}
          <Grid container spacing={3}>
            {galleryItems.map((item) => (
              <Grid item xs={12} md={6} lg={4} key={item.id}>
                <ResultCard result={item} accentColor="#a78bfa" />
              </Grid>
            ))}
          </Grid>
        </Stack>
      ) : null}
    </Stack>
  );
};

export default CovenantPage;
