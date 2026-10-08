import HolidayVillageRoundedIcon from "@mui/icons-material/HolidayVillageRounded";
import LastPageRoundedIcon from "@mui/icons-material/LastPageRounded";
import {
  Box,
  Button,
  Pagination,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useId, useMemo, useRef, useState } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import SectionCard from "@/components/common/SectionCard";
import {
  EmptyState,
  ErrorState,
  LiveStatus,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import {
  scrollMarginSx,
  scrollToTop,
} from "@/features/neighborhoods/components/cardStyles";
import NeighborhoodCard, {
  NEIGHBORHOOD_CARD_HEIGHT,
} from "@/features/neighborhoods/components/NeighborhoodCard";
import NumberJumpField from "@/features/neighborhoods/components/NumberJumpField";
import PlotGrid, { PLOT_GRID_PX } from "@/features/neighborhoods/components/PlotGrid";
import { useRegisterPage } from "@/features/neighborhoods/hooks/useNeighborhoodRecords";
import {
  NUMBERS_PER_PAGE,
  pageRange,
} from "@/features/neighborhoods/services/neighborhoodService";
import type {
  Neighborhood,
  NeighborhoodMap,
} from "@/features/neighborhoods/types";
import { formatNumber } from "@/lib/format";

const CARD_COLS: GridColumns = { xs: 1, sm: 2, lg: 3 };
const CARD_GAP_PX = 12;
/** The maps share the numbers about evenly: what a page usually lists. */
const EXPECTED_PER_PAGE = 12;

const pluralize = (count: number, one: string, many: string): string =>
  `${formatNumber(count)} ${count === 1 ? one : many}`;

/** The newest-number search, as far as the register needs it. */
export type NewestSearchState = {
  /** The region's highest number; undefined while searching or after a failure. */
  value: number | undefined;
  /** The first search is still running. */
  searching: boolean;
  /**
   * The search failed and has found nothing since, even while a Retry runs
   * (the register keeps its fallback page and this banner up meanwhile).
   */
  failed: boolean;
  retrying: boolean;
  /** The last failure, kept while a Retry runs. */
  error: unknown;
  retry: () => void;
};

export type NeighborhoodRegisterProps = {
  map: NeighborhoodMap;
  /** Maps to suggest when this one has nothing on a page. */
  otherMaps: NeighborhoodMap[];
  /** 1-based; null while the newest search decides the opening page. */
  page: number | null;
  /** The newest page, when the search has found it. */
  lastPage: number | null;
  newest: NewestSearchState;
  onPageChange: (page: number) => void;
  onJump: (number: number) => void;
  onOpen: (neighborhood: Neighborhood) => void;
  onSelectMap: (mapId: number) => void;
};

/**
 * The selected map's neighborhoods, 25 numbers to a page. Blizzard can only
 * look a neighborhood up by number and numbers them across every map, so a
 * page asks this map for each of its 25 numbers and lists the ones it has;
 * the plot grid shows how the page's numbers split between the maps. Pages
 * count up from No. 1, so a shared link always shows the same numbers; the
 * register opens on the last one, the newest neighborhoods.
 */
const NeighborhoodRegister = ({
  map,
  otherMaps,
  page,
  lastPage,
  newest,
  onPageChange,
  onJump,
  onOpen,
  onSelectMap,
}: NeighborhoodRegisterProps): JSX.Element => {
  const theme = useTheme();
  // noSsr: a client-only app, so the pager never renders wide and then narrows.
  const narrow = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });
  const headingId = useId();
  const listTopRef = useRef<HTMLDivElement>(null);
  const registerPage = useRegisterPage(map.id, page);

  const neighborhoods = useMemo(
    () =>
      registerPage.slots
        .map((slot) => slot.record)
        .filter((record): record is Neighborhood => Boolean(record)),
    [registerPage.slots],
  );

  const range = page !== null ? pageRange(page) : null;
  const numbersLabel = range
    ? `${formatNumber(range.first)}–${formatNumber(range.last)}`
    : "";
  const rangeLabel = range ? `No. ${numbersLabel}` : "";
  const loading = page === null || registerPage.pending;
  const nothingLoaded = registerPage.slots.every((slot) => slot.record === undefined);
  // A retried number has no error until it fails again, so the banner keeps
  // showing the last one meanwhile instead of a generic message.
  const [lastPageError, setLastPageError] = useState<Error | null>(null);
  if (registerPage.error !== null && registerPage.error !== lastPageError) {
    setLastPageError(registerPage.error);
  }
  const pageError = registerPage.error ?? lastPageError;

  // A page is read from the top: a new one starts at its first neighborhood.
  // MUI's pager reports a click on the current page too; that one only
  // scrolls, since pushing the same address again would make Back a no-op.
  const goToPage = (next: number): void => {
    if (next !== page) {
      onPageChange(next);
    }
    scrollToTop(listTopRef.current);
  };
  const jump = (number: number): void => {
    onJump(number);
    scrollToTop(listTopRef.current);
  };

  /* ---------------- Labels ---------------- */

  let summary: string;
  if (page === null) {
    summary = "Finding the newest neighborhoods";
  } else if (registerPage.pending) {
    summary = `Checking ${rangeLabel}`;
  } else if (nothingLoaded && registerPage.failedCount > 0) {
    // The body shows the error; a count here would be a confident zero.
    summary = `Couldn't check ${rangeLabel}`;
  } else {
    const unchecked =
      registerPage.failedCount > 0
        ? `; ${pluralize(registerPage.failedCount, "number", "numbers")} could not be checked`
        : "";
    summary = `${rangeLabel}: ${pluralize(neighborhoods.length, "neighborhood", "neighborhoods")} in ${map.name}${unchecked}`;
  }

  /* ---------------- Render ---------------- */

  const renderBody = (): JSX.Element => {
    if (loading) {
      return (
        <LoadingSkeleton
          variant="grid"
          columns={CARD_COLS}
          itemHeight={NEIGHBORHOOD_CARD_HEIGHT}
          count={EXPECTED_PER_PAGE}
          gap={CARD_GAP_PX}
          label={page === null ? "Finding the newest neighborhoods" : `Loading ${rangeLabel}`}
        />
      );
    }
    if (nothingLoaded && registerPage.failedCount > 0) {
      return (
        <ErrorState
          compact
          error={pageError}
          context={`neighborhoods ${rangeLabel}`}
          onRetry={registerPage.retryFailed}
          retryLabel={registerPage.retrying ? "Retrying…" : "Retry"}
        />
      );
    }

    const failedBanner =
      registerPage.failedCount > 0 && pageError ? (
        <ErrorState
          compact
          error={pageError}
          title={`${pluralize(registerPage.failedCount, "number", "numbers")} on this page could not be checked`}
          context="these numbers"
          onRetry={registerPage.retryFailed}
          retryLabel={registerPage.retrying ? "Retrying…" : "Retry"}
        />
      ) : null;

    if (neighborhoods.length === 0) {
      if (failedBanner) {
        return failedBanner;
      }
      const unfounded =
        newest.value !== undefined && range !== null && range.first > newest.value;
      const suggestion = otherMaps[0];
      return (
        <EmptyState
          compact
          icon={<HolidayVillageRoundedIcon />}
          title={
            unfounded
              ? `No neighborhoods numbered ${numbersLabel} yet`
              : `None of ${rangeLabel} is in ${map.name}`
          }
          description={
            unfounded
              ? "Nobody has founded a neighborhood this far up yet. The newest ones are on the last page."
              : `Blizzard numbers neighborhoods across every map, and none of these ${NUMBERS_PER_PAGE} is on ${map.name}. Try another page${suggestion ? ` or ${suggestion.name}` : ""}.`
          }
          action={
            unfounded && lastPage !== null ? (
              <Button variant="outlined" size="small" onClick={() => goToPage(lastPage)}>
                Go to the newest
              </Button>
            ) : suggestion ? (
              <Button variant="outlined" size="small" onClick={() => onSelectMap(suggestion.id)}>
                {`Browse ${suggestion.name}`}
              </Button>
            ) : undefined
          }
        />
      );
    }

    return (
      <Stack spacing={2}>
        {failedBanner}
        <Box
          component="ul"
          // Safari drops the list role from a list-style:none list without it.
          role="list"
          aria-labelledby={headingId}
          sx={{
            display: "grid",
            gap: `${CARD_GAP_PX}px`,
            listStyle: "none",
            m: 0,
            p: 0,
            ...gridTemplateColumnsSx(CARD_COLS),
          }}
        >
          {neighborhoods.map((neighborhood) => (
            <Box component="li" key={neighborhood.id} sx={{ minWidth: 0 }}>
              <NeighborhoodCard neighborhood={neighborhood} onOpen={onOpen} />
            </Box>
          ))}
        </Box>
      </Stack>
    );
  };

  const renderPagination = (): JSX.Element | null => {
    if (page === null) {
      return null;
    }
    if (newest.searching && lastPage === null) {
      return (
        <Skeleton
          variant="rounded"
          width={240}
          height={32}
          sx={{ alignSelf: "center", maxWidth: "100%" }}
        />
      );
    }
    // Without the newest number the register cannot say how many pages
    // there are; it still pages forward one at a time.
    const count = lastPage ?? page + 1;
    if (count <= 1) {
      return null;
    }
    return (
      <Pagination
        count={count}
        page={Math.min(page, count)}
        onChange={(_event, next) => goToPage(next)}
        siblingCount={narrow ? 0 : 1}
        size={narrow ? "small" : "medium"}
        aria-label="Register pages"
        sx={{ alignSelf: "center", maxWidth: "100%" }}
      />
    );
  };

  if (newest.value === 0) {
    return (
      <SectionCard title={`Neighborhoods in ${map.name}`}>
        <EmptyState
          compact
          icon={<HolidayVillageRoundedIcon />}
          title="No neighborhoods founded yet"
          description="Blizzard has no neighborhood of any number in this region."
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={`Neighborhoods in ${map.name}`}
      description={`Blizzard looks neighborhoods up by number only, numbered across every map. Each page checks ${NUMBERS_PER_PAGE} numbers and lists the ones in ${map.name}; the last page holds the newest.`}
    >
      <Stack spacing={2.5}>
        <Stack direction="row" flexWrap="wrap" useFlexGap gap={1.5} alignItems="flex-start">
          <NumberJumpField onJump={jump} />
          {lastPage !== null && page !== lastPage ? (
            <Button
              variant="outlined"
              size="small"
              startIcon={<LastPageRoundedIcon />}
              onClick={() => goToPage(lastPage)}
              sx={{ minHeight: 40 }}
            >
              Newest
            </Button>
          ) : null}
          <LiveStatus visuallyHidden busy={loading}>
            {summary}
          </LiveStatus>
        </Stack>

        <Stack ref={listTopRef} spacing={2} sx={scrollMarginSx}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={{ xs: 1.5, sm: 3 }}
            alignItems={{ xs: "flex-start", sm: "center" }}
            sx={{ minWidth: 0, minHeight: { sm: PLOT_GRID_PX } }}
          >
            <Box sx={{ minWidth: 0 }}>
              {range ? (
                <Typography
                  id={headingId}
                  variant="h6"
                  component="h3"
                  sx={{ m: 0, fontVariantNumeric: "tabular-nums" }}
                >
                  {rangeLabel}
                </Typography>
              ) : (
                <Skeleton variant="text" width={180} sx={{ fontSize: "1.25rem" }} />
              )}
              <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
                {page !== null && lastPage !== null
                  ? `Page ${formatNumber(page)} of ${formatNumber(lastPage)}${page === lastPage ? " · the newest" : ""}`
                  : page !== null
                    ? `Page ${formatNumber(page)}`
                    : "Finding the newest page"}
              </Typography>
            </Box>
            <PlotGrid
              slots={loading ? null : registerPage.slots}
              mapId={map.id}
              mapName={map.name}
              newest={newest.value}
            />
          </Stack>

          {renderBody()}
        </Stack>

        {renderPagination()}

        {newest.failed ? (
          <ErrorState
            compact
            error={newest.error}
            title="Couldn't find the newest neighborhood"
            context="the newest neighborhood number"
            onRetry={newest.retry}
            retryLabel={newest.retrying ? "Retrying…" : "Retry"}
          />
        ) : null}
      </Stack>
    </SectionCard>
  );
};

export default NeighborhoodRegister;
