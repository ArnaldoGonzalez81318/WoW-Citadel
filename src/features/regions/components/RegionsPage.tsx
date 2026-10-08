import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import { Box, Chip, Stack } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { SegmentedControl } from "@/components/common/ExplorerFilterBar";
import type { SegmentedOption } from "@/components/common/ExplorerFilterBar";
import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import { ErrorState } from "@/components/common/StateBlocks";
import RealmMakeup from "@/features/regions/components/RealmMakeup";
import RegionCard from "@/features/regions/components/RegionCard";
import RegionComparisonTable from "@/features/regions/components/RegionComparisonTable";
import { tokenIconQuery } from "@/features/regions/hooks/regionQueries";
import { useRegionOverview } from "@/features/regions/hooks/useRegionOverview";
import type { Region } from "@/features/regions/types";
import { useNow } from "@/features/search/hooks/useNow";
import useNearViewport from "@/hooks/useNearViewport";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import { isRegion } from "@/lib/region";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

/** Four regions: one row of four on large screens, two by two below. */
const CARD_COLS: GridColumns = { xs: 1, sm: 2, lg: 4 };
const URL_DEFAULTS = { region: "" };
/** Clears the sticky app bar when a card scrolls the makeup into view. */
const SCROLL_CLEARANCE = 16;

/** "EU", " eu " -> "eu"; anything else is not a region. */
const parseRegion = (value: string): Region | null => {
  const normalized = value.trim().toLowerCase();
  return isRegion(normalized) ? normalized : null;
};

/** `seq` makes a repeat request for the same region a new value. */
type FocusRequest = { region: Region; seq: number };

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** "US, EU and KR" */
const joinTags = (tags: string[]): string =>
  tags.length <= 1
    ? tags.join("")
    : `${tags.slice(0, -1).join(", ")} and ${tags[tags.length - 1]}`;

const scrollTargetSx = (theme: Theme) => ({
  minWidth: 0,
  scrollMarginTop: {
    xs: `${theme.wc.layout.headerHeight.xs + SCROLL_CLEARANCE}px`,
    md: `${theme.wc.layout.headerHeight.md + SCROLL_CLEARANCE}px`,
  },
});

/**
 * Regions: Blizzard's four API regions side by side. Each regional host
 * only knows itself, so the page asks all four (one namespace each) for
 * their record, WoW Token price and realm counts, then compares them in a
 * table and breaks one region's realms down by population, time zone,
 * language, category and ruleset. The region shown in that breakdown lives
 * in the URL, so a link opens on it.
 */
const RegionsPage = ({
  eyebrow = "World & Factions",
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const [params, setParams] = useSearchParamsRecord(URL_DEFAULTS);
  const selectedRegion = parseRegion(params.region) ?? env.region;
  const captionId = `region-table-caption-${useId()}`;
  // One clock for every card, cell and zone, ticking so "Updated …" and
  // the local times keep moving.
  const now = useNow();

  // The realm makeup is the one heavy request (about 350 KB on US and EU),
  // so the four searches wait until the table or the breakdown nears the
  // viewport. One sentinel wraps both: a jump straight to the bottom still
  // lands inside it.
  const [tablesRef, tablesNear] = useNearViewport<HTMLDivElement>();
  const columns = useRegionOverview(tablesNear);
  const iconQuery = useQuery(tokenIconQuery());

  // The address bar always names the region on screen: an empty, unknown
  // or differently cased value is replaced, without a history entry.
  useEffect(() => {
    if (params.region !== selectedRegion) {
      setParams({ region: selectedRegion }, { replace: true });
    }
  }, [params.region, selectedRegion, setParams]);

  const makeupRef = useRef<HTMLDivElement | null>(null);
  // A card's "Realm makeup" picks its region, then scrolls there and puts
  // focus on that region's toggle once the pick has rendered.
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  useEffect(() => {
    const section = makeupRef.current;
    if (!focusRequest || !section) {
      return;
    }
    section.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
    section
      .querySelector<HTMLElement>(`button[value="${focusRequest.region}"]`)
      ?.focus({ preventScroll: true });
  }, [focusRequest]);

  const handleRegionChange = useCallback(
    (next: Region) => setParams({ region: next }),
    [setParams],
  );
  const showMakeup = useCallback(
    (region: Region) => {
      // Re-picking the region on screen only scrolls; it adds no history entry.
      if (region !== selectedRegion) {
        handleRegionChange(region);
      }
      setFocusRequest((previous) => ({ region, seq: (previous?.seq ?? 0) + 1 }));
    },
    [handleRegionChange, selectedRegion],
  );

  const selectedColumn =
    columns.find((column) => column.region === selectedRegion) ?? columns[0];

  const options: SegmentedOption<Region>[] = columns.map((column) => ({
    value: column.region,
    label: column.tag,
  }));

  const patches = [
    ...new Set(
      columns
        .map((column) => column.record.data?.patch)
        .filter((patch): patch is string => Boolean(patch)),
    ),
  ].sort();
  const allRecordsIn = columns.every((column) => column.record.isSuccess);

  // Each card names its own failures; makeup failures have no card to show
  // on, so they are gathered once above the table. The region on screen in
  // the breakdown is left out: its own alert and Retry sit just below, and a
  // second alert would announce the same failure twice.
  const makeupFailures = columns.filter(
    (column) =>
      column.region !== selectedColumn.region &&
      column.makeup.isError &&
      column.makeup.data === undefined,
  );

  const patchChip = (() => {
    if (patches.length === 1 && allRecordsIn) {
      return `Patch ${patches[0]}`;
    }
    if (patches.length > 1) {
      return `Patches ${patches.join(" / ")}`;
    }
    return null;
  })();

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
        title="Regions"
        documentTitle="Regions"
        icon={<PublicRoundedIcon />}
        description="Blizzard's four API regions side by side: the live patch, the WoW Token price, how many realms each runs, and how those realms split by population, time zone, language and ruleset."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            <Chip size="small" label={`${columns.length} API regions`} />
            {patchChip ? <Chip size="small" label={patchChip} /> : null}
          </>
        }
      />

      <SectionCard
        title="The four regions"
        description="Blizzard's API has no global region list: each regional host (us, eu, kr and tw.api.blizzard.com) lists only itself, so every figure here comes from asking all four, one namespace each. Realms, guilds and characters never cross between them."
      >
        <Box
          component="ul"
          // Safari drops the list role from a list-style:none list without it.
          role="list"
          aria-label="API regions"
          sx={{
            display: "grid",
            gap: 2,
            listStyle: "none",
            m: 0,
            p: 0,
            ...gridTemplateColumnsSx(CARD_COLS),
          }}
        >
          {columns.map((column) => (
            <Box component="li" key={column.region} sx={{ minWidth: 0 }}>
              <RegionCard
                column={column}
                now={now}
                tokenIconUrl={iconQuery.data}
                tokenIconLoading={iconQuery.isPending}
                onShowMakeup={showMakeup}
              />
            </Box>
          ))}
        </Box>
      </SectionCard>

      <Stack
        ref={tablesRef}
        sx={(theme) => ({
          minWidth: 0,
          gap: {
            xs: theme.spacing(theme.wc.layout.sectionGap.xs),
            md: theme.spacing(theme.wc.layout.sectionGap.md),
          },
        })}
      >
        <SectionCard
          title="Side by side"
          description="Records, token prices and realm counts load with the page; everything else comes from each region's connected-realm search, fetched as this table nears the screen."
          padding="none"
        >
          {makeupFailures.length > 0 ? (
            <Box sx={{ p: 2 }}>
              <ErrorState
                compact
                error={makeupFailures[0].makeup.error}
                context={`the realm makeup for ${joinTags(makeupFailures.map((column) => column.tag))}`}
                onRetry={() =>
                  makeupFailures.forEach((column) => void column.makeup.refetch())
                }
              />
            </Box>
          ) : null}
          <RegionComparisonTable columns={columns} now={now} captionId={captionId} />
        </SectionCard>

        <Box ref={makeupRef} sx={scrollTargetSx}>
          <SectionCard
            title="Realm makeup"
            description="One region's realms by population tier, server time zone, language, category and ruleset."
          >
            <Stack spacing={2} useFlexGap sx={{ minWidth: 0 }}>
              <SegmentedControl<Region>
                label="Region"
                options={options}
                value={selectedRegion}
                onChange={handleRegionChange}
                size="small"
                sx={{ alignSelf: "flex-start" }}
              />
              <RealmMakeup column={selectedColumn} now={now} />
            </Stack>
          </SectionCard>
        </Box>
      </Stack>
    </Stack>
  );
};

export default RegionsPage;
