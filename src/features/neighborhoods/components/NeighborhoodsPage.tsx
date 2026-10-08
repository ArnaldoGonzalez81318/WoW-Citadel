import HolidayVillageRoundedIcon from "@mui/icons-material/HolidayVillageRounded";
import { Box, Chip, Stack } from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import NeighborhoodDialog from "@/features/neighborhoods/components/NeighborhoodDialog";
import NeighborhoodMapCard, {
  MAP_CARD_TEXT_HEIGHT,
} from "@/features/neighborhoods/components/NeighborhoodMapCard";
import NeighborhoodRegister from "@/features/neighborhoods/components/NeighborhoodRegister";
import type { NewestSearchState } from "@/features/neighborhoods/components/NeighborhoodRegister";
import {
  neighborhoodMapsQuery,
  newestNumberQuery,
} from "@/features/neighborhoods/hooks/neighborhoodQueries";
import { pageOf } from "@/features/neighborhoods/services/neighborhoodService";
import type {
  Neighborhood,
  NeighborhoodMap,
} from "@/features/neighborhoods/types";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

const URL_DEFAULTS = { map: "", page: "", neighborhood: "" };

/** Two maps today (Founder's Point, Razorwind Shores): side by side from sm up. */
const MAP_COLS: GridColumns = { xs: 1, sm: 2 };
const EXPECTED_MAP_COUNT = 2;
/** About the loaded register: controls, the plot grid, four rows of cards and the pager. */
const REGISTER_SKELETON_HEIGHT = 560;
const EMPTY_MAPS: NeighborhoodMap[] = [];

/**
 * Skeleton cells shaped like the map cards: the 3:1 banner is a third of
 * the cell's width, plus the card's text block, so nothing jumps when the
 * index lands at any breakpoint.
 */
const mapCellSx = {
  "& > .MuiSkeleton-root": { height: "auto" },
  "& > .MuiSkeleton-root::before": {
    content: '""',
    display: "block",
    paddingTop: `calc(100% / 3 + ${MAP_CARD_TEXT_HEIGHT}px)`,
  },
};

const parseId = (value: string): number | null => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/** "About 45,700": the numbers have a few gaps, so the count is not exact. */
const approximateCount = (newest: number): string =>
  formatNumber(newest >= 1000 ? Math.round(newest / 100) * 100 : newest);

/**
 * Neighborhoods: player housing's neighborhood maps as drawn cards, and the
 * picked map's neighborhoods in a register of numbered pages, newest last,
 * with a lookup by number and a detail dialog. Map, page and open
 * neighborhood live in the URL, so any view can be shared.
 *
 * Blizzard publishes no list of neighborhoods, only a lookup by number,
 * and no art, plots or residents: the page shows what the API holds
 * (number, name, map) and finds the newest number itself (see the service).
 */
const NeighborhoodsPage = ({
  eyebrow = "World & Factions",
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const [params, setParams] = useSearchParamsRecord(URL_DEFAULTS);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  /* ---------------- Maps (URL first, then the first map) ---------------- */

  const mapsQuery = useQuery(neighborhoodMapsQuery());
  const maps = mapsQuery.data ?? EMPTY_MAPS;
  const mapIds = useMemo(() => maps.map((map) => map.id), [maps]);

  const requestedMap = parseId(params.map);
  const selectedMap = maps.find((map) => map.id === requestedMap) ?? maps[0] ?? null;
  const mapId = selectedMap?.id ?? null;
  const otherMaps = useMemo(
    () => maps.filter((map) => map.id !== mapId),
    [maps, mapId],
  );

  // Write the resolved map into the URL once the index is in, so the
  // address always names the map on screen (and a stale or foreign id
  // falls back to the first map).
  useEffect(() => {
    if (!mapsQuery.isSuccess) {
      return;
    }
    const resolved = mapId === null ? "" : String(mapId);
    if (params.map !== resolved) {
      setParams({ map: resolved || null }, { replace: true });
    }
  }, [mapsQuery.isSuccess, mapId, params.map, setParams]);

  /* ---------------- The newest number ---------------- */

  const newestQuery = useQuery({
    ...newestNumberQuery(queryClient, mapIds),
    enabled: mapIds.length > 0,
  });
  const newestValue = newestQuery.data;
  // A Retry puts a query with no data back to pending and clears its error
  // (query-core's fetchState); errorUpdateCount survives, so the fallback
  // page and the banner stay up while it runs.
  const newestFailed = newestValue === undefined && newestQuery.errorUpdateCount > 0;
  const [lastNewestError, setLastNewestError] = useState<unknown>(null);
  if (newestQuery.error !== null && newestQuery.error !== lastNewestError) {
    setLastNewestError(newestQuery.error);
  }
  const newest: NewestSearchState = {
    value: newestValue,
    searching: newestValue === undefined && !newestFailed && mapIds.length > 0,
    failed: newestFailed,
    retrying: newestFailed && newestQuery.fetchStatus !== "idle",
    error: newestQuery.error ?? lastNewestError,
    retry: () => {
      // Already asking again: refetch() would cancel that attempt and start over.
      if (newestQuery.fetchStatus === "idle") {
        void newestQuery.refetch();
      }
    },
  };
  const lastPage = newestValue !== undefined && newestValue > 0 ? pageOf(newestValue) : null;

  /* ---------------- Page (URL first, then the newest) ---------------- */

  const requestedPage = parseId(params.page);
  // A shared link names its page; otherwise the register opens on the
  // newest one, or on the first when the newest cannot be found.
  const page =
    requestedPage !== null
      ? lastPage !== null
        ? Math.min(requestedPage, lastPage)
        : requestedPage
      : (lastPage ?? (newestFailed ? 1 : null));

  useEffect(() => {
    // Not a page number at all ("abc", "0"): drop it so the default applies.
    if (params.page !== "" && requestedPage === null) {
      setParams({ page: null }, { replace: true });
      return;
    }
    if (lastPage === null) {
      return;
    }
    // Write the newest page in once it is known, so the address names the
    // numbers on screen and they do not shift when newer neighborhoods are
    // founded; a page past the newest falls back to it.
    if (requestedPage === null || requestedPage > lastPage) {
      setParams({ page: String(lastPage) }, { replace: true });
    }
  }, [params.page, requestedPage, lastPage, setParams]);

  /* ---------------- Neighborhood dialog ---------------- */

  const neighborhoodNumber = parseId(params.neighborhood);
  // The number outlives the URL param so the dialog never blanks while closing.
  const [shownNumber, setShownNumber] = useState<number | null>(neighborhoodNumber);
  if (neighborhoodNumber !== null && neighborhoodNumber !== shownNumber) {
    setShownNumber(neighborhoodNumber);
  }
  // Opened by a click on this page (a history entry we pushed), not a shared link.
  const openedHereRef = useRef(false);
  useEffect(() => {
    if (neighborhoodNumber === null) {
      openedHereRef.current = false;
    }
    if (params.neighborhood !== "" && neighborhoodNumber === null) {
      setParams({ neighborhood: null }, { replace: true });
    }
  }, [neighborhoodNumber, params.neighborhood, setParams]);

  const openNeighborhood = useCallback(
    (neighborhood: Neighborhood): void => {
      openedHereRef.current = true;
      setParams({ neighborhood: String(neighborhood.id) });
    },
    [setParams],
  );
  // Closing a dialog this page opened steps back over its history entry, so
  // Back after closing leaves the page instead of reopening the neighborhood.
  const closeNeighborhood = useCallback((): void => {
    if (openedHereRef.current) {
      openedHereRef.current = false;
      navigate(-1);
      return;
    }
    setParams({ neighborhood: null }, { replace: true });
  }, [navigate, setParams]);

  /* ---------------- Handlers ---------------- */

  // The page stays: every map shares the numbers, so the same page of
  // another map lists the neighborhoods founded alongside these. Pressing
  // the pressed card again changes nothing, so it pushes no history entry
  // (Back would otherwise seem to do nothing).
  const selectMap = useCallback(
    (id: number): void => {
      if (id === mapId) {
        return;
      }
      setParams({ map: String(id) });
    },
    [mapId, setParams],
  );
  const changePage = useCallback(
    (next: number): void => {
      setParams({ page: String(next) });
    },
    [setParams],
  );
  // One history entry for the page and the dialog; closing the dialog keeps
  // the page (a replace), and Back returns to where the lookup started.
  const jumpTo = useCallback(
    (number: number): void => {
      openedHereRef.current = false;
      setParams({ page: String(pageOf(number)), neighborhood: String(number) });
    },
    [setParams],
  );
  // Replaces the dialog's entry, so Back returns to the view it opened over.
  const showOnRegister = useCallback(
    (targetMapId: number, number: number): void => {
      openedHereRef.current = false;
      setParams(
        { map: String(targetMapId), page: String(pageOf(number)), neighborhood: null },
        { replace: true },
      );
    },
    [setParams],
  );

  /* ---------------- Render ---------------- */

  const renderMaps = (): JSX.Element => {
    if (mapsQuery.isPending) {
      return (
        <LoadingSkeleton
          variant="grid"
          columns={MAP_COLS}
          count={EXPECTED_MAP_COUNT}
          label="Loading neighborhood maps"
          sx={mapCellSx}
        />
      );
    }
    // A failed background refetch keeps the maps it already has on screen.
    if (mapsQuery.isError && mapsQuery.data === undefined) {
      return (
        <ErrorState
          compact
          error={mapsQuery.error}
          context="neighborhood maps"
          onRetry={() => void mapsQuery.refetch()}
        />
      );
    }
    if (maps.length === 0) {
      return (
        <EmptyState
          compact
          icon={<HolidayVillageRoundedIcon />}
          title="No neighborhood maps listed"
          description="Blizzard returned no neighborhood maps for this region, so there are no neighborhoods to browse."
        />
      );
    }
    return (
      <Box
        component="ul"
        // Safari drops the list role from a list-style:none list without it.
        role="list"
        aria-label="Neighborhood maps"
        sx={{
          display: "grid",
          gap: 2,
          listStyle: "none",
          m: 0,
          p: 0,
          ...gridTemplateColumnsSx(MAP_COLS),
        }}
      >
        {maps.map((map) => (
          <Box component="li" key={map.id} sx={{ minWidth: 0 }}>
            <NeighborhoodMapCard
              map={map}
              selected={map.id === mapId}
              newestNumber={newestValue}
              newestFailed={newestFailed}
              onSelect={selectMap}
            />
          </Box>
        ))}
      </Box>
    );
  };

  // Without a map index there is nothing to browse; the maps section
  // already says why (with its Retry), so the register is simply absent.
  const renderRegister = (): JSX.Element | null => {
    if (mapsQuery.isPending) {
      return (
        <LoadingSkeleton
          variant="block"
          height={REGISTER_SKELETON_HEIGHT}
          label="Loading neighborhoods"
        />
      );
    }
    if (!selectedMap) {
      return null;
    }
    return (
      <NeighborhoodRegister
        map={selectedMap}
        otherMaps={otherMaps}
        page={page}
        lastPage={lastPage}
        newest={newest}
        onPageChange={changePage}
        onJump={jumpTo}
        onOpen={openNeighborhood}
        onSelectMap={selectMap}
      />
    );
  };

  return (
    <Stack
      sx={(theme) => ({
        gap: {
          xs: theme.spacing(theme.wc.layout.sectionGap.xs),
          md: theme.spacing(theme.wc.layout.sectionGap.md),
        },
      })}
    >
      <PageHeader
        eyebrow={eyebrow}
        breadcrumbs={breadcrumbs}
        title="Neighborhoods"
        documentTitle={selectedMap ? `${selectedMap.name} · Neighborhoods` : "Neighborhoods"}
        icon={<HolidayVillageRoundedIcon />}
        description="Player housing's neighborhood maps and every neighborhood founded on them, numbered across the region. Blizzard's API gives each neighborhood its number, name and map, and nothing about its plots, houses or residents."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {maps.length > 0 ? (
              <Chip
                size="small"
                label={`${formatNumber(maps.length)} neighborhood ${maps.length === 1 ? "map" : "maps"}`}
              />
            ) : null}
            {newestValue !== undefined && newestValue > 0 ? (
              <Chip size="small" label={`About ${approximateCount(newestValue)} neighborhoods`} />
            ) : null}
          </>
        }
      />

      <SectionCard
        title="Neighborhood maps"
        description="Pick a map to browse its neighborhoods. Blizzard's records have no art or faction; the drawings are this page's, and the Alliance and Horde tags come from the game."
      >
        {renderMaps()}
      </SectionCard>

      {renderRegister()}

      <NeighborhoodDialog
        open={neighborhoodNumber !== null}
        number={shownNumber}
        maps={maps}
        mapsStatus={mapsQuery.data !== undefined ? "success" : mapsQuery.status}
        mapsError={mapsQuery.error}
        onRetryMaps={() => void mapsQuery.refetch()}
        currentMapId={mapId}
        currentPage={page}
        onClose={closeNeighborhood}
        onShowOnRegister={showOnRegister}
      />
    </Stack>
  );
};

export default NeighborhoodsPage;
