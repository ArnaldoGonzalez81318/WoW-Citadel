import MilitaryTechRoundedIcon from "@mui/icons-material/MilitaryTechRounded";
import { Box, Chip, Stack } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import { useCallback, useEffect, useMemo } from "react";

import {
  ExplorerFilterBar,
  SegmentedControl,
} from "@/components/common/ExplorerFilterBar";
import type { SegmentedOption } from "@/components/common/ExplorerFilterBar";
import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import PvpTierCard, {
  TIER_CARD_HEIGHT,
} from "@/features/pvpTiers/components/PvpTierCard";
import PvpTierMatrix, {
  MATRIX_HEAD_HEIGHT,
  MATRIX_ROW_HEIGHT,
} from "@/features/pvpTiers/components/PvpTierMatrix";
import { usePvpTierCatalog } from "@/features/pvpTiers/hooks/usePvpTierCatalog";
import { usePvpTierIcons } from "@/features/pvpTiers/hooks/usePvpTierIcons";
import {
  KNOWN_BRACKETS,
  bracketMeta,
  bracketTypeFromSlug,
  buildLadders,
  buildMatrix,
  rowIconTier,
} from "@/features/pvpTiers/services/tierLadder";
import type { PvpBracketLadder } from "@/features/pvpTiers/types";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

const URL_DEFAULTS = { bracket: "" };
/** A bracket has nine ranks: three even rows of three from `md`. */
const LADDER_COLS: GridColumns = { xs: 1, sm: 2, md: 3 };
/** Skeleton cells before the index says how many ranks there are. */
const FALLBACK_RANKS = 9;
const MATRIX_ID = "pvp-tier-matrix";
/** Space above and below each skeleton bar, inside its table-row slot. */
const MATRIX_SKELETON_INSET = 6;
/** The switcher's buttons before the tiers say which brackets exist. */
const KNOWN_OPTIONS: SegmentedOption[] = KNOWN_BRACKETS.map((bracket) => ({
  value: bracket.slug,
  label: bracket.label,
}));
const ignoreBracketChange = (): void => undefined;

/**
 * The bracket on screen: the URL's when it names one that exists, else the
 * first. Until every tier is in, an unknown URL value waits (it may name a
 * bracket not seen yet) and an empty one assumes 2v2, Blizzard's first
 * bracket, so that ladder can show while the other brackets still load.
 */
const resolveBracketType = (
  slug: string,
  ladders: readonly PvpBracketLadder[],
  settled: boolean,
): string | null => {
  const requested = bracketTypeFromSlug(slug, ladders);
  if (
    requested !== null &&
    (!settled || ladders.some((ladder) => ladder.meta.type === requested))
  ) {
    return requested;
  }
  if (!settled) {
    return slug === "" ? KNOWN_BRACKETS[0].type : null;
  }
  return ladders[0]?.meta.type ?? null;
};

/**
 * "9 ranks from Unranked to Elite, lowest first. Each bar …". When some of
 * the bracket did not load, it says so instead of naming a first and last
 * rank that may not be the bracket's.
 */
const describeLadder = (
  ladder: PvpBracketLadder,
  missing: number,
  ranks: number,
): string => {
  const first = ladder.tiers[0];
  const last = ladder.tiers[ladder.tiers.length - 1];
  const { scale, uniformOverlap } = ladder;
  // Words, not "0 – 2,300+": screen readers skip the dash and read "plus".
  const scaleText = `from ${formatNumber(scale.min)} to ${formatNumber(scale.top)}${
    scale.openEnded ? " and above" : ""
  }`;
  return [
    missing > 0
      ? `${formatNumber(missing)} of this bracket's ${formatNumber(ranks)} ranks ${
          missing === 1 ? "has" : "have"
        } not loaded, so this ladder is incomplete.`
      : ladder.tiers.length > 1
        ? `${formatNumber(ladder.tiers.length)} ranks from ${first.name} to ${last.name}, lowest first.`
        : undefined,
    `Each bar places a range on the bracket's scale, ${scaleText}.`,
    uniformOverlap !== null
      ? `Neighbouring ranges overlap by ${formatNumber(uniformOverlap)} rating.`
      : undefined,
  ]
    .filter(Boolean)
    .join(" ");
};

/**
 * Five brackets do not fit one joined row on a phone: below `sm` they wrap
 * as separate pills (the group's joined edges undone), like the keystone
 * dungeon tiles, instead of widening the page.
 */
const bracketControlSx = (theme: Theme) => ({
  flexShrink: 1,
  minWidth: 0,
  maxWidth: "100%",
  [theme.breakpoints.down("sm")]: {
    flexWrap: "wrap",
    gap: 1,
    "& .MuiToggleButtonGroup-grouped": {
      margin: 0,
      border: `1px solid ${theme.palette.border.default}`,
      borderRadius: `${theme.wc.radius.md}px !important`,
    },
    "& .MuiToggleButtonGroup-grouped.Mui-selected": {
      borderColor: alpha(theme.palette.primary.main, 0.6),
    },
  },
});

/**
 * Holds the switcher's place while tiers load. Five buttons wrap to two rows
 * on a narrow phone but fit one from about 450px, so no fixed height is
 * right everywhere: the real control, laid out with the known brackets and
 * hidden (from sight, focus and screen readers) under the skeleton, reserves
 * exactly the space the switcher will take, and the cards below stay put.
 */
const BracketSwitcherPlaceholder = (): JSX.Element => (
  <Box
    sx={{
      position: "relative",
      display: "flex",
      flexShrink: 1,
      minWidth: 0,
      maxWidth: "100%",
    }}
  >
    <SegmentedControl
      label="Bracket"
      options={KNOWN_OPTIONS}
      value={KNOWN_OPTIONS[0].value}
      onChange={ignoreBracketChange}
      size="small"
      sx={[bracketControlSx, { visibility: "hidden" }]}
    />
    <LoadingSkeleton
      variant="block"
      label="Loading brackets"
      sx={(theme) => ({
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        borderRadius: `${theme.wc.radius.md}px`,
      })}
    />
  </Box>
);

/**
 * PvP Tiers: Blizzard's rated ranks (Unranked … Elite) for one bracket at a
 * time as emblem cards on the bracket's rating scale, then every rank's
 * range across all brackets in one table. The tier index says nothing about
 * brackets, so every tier's record loads (six at a time, cached for a day);
 * the chosen bracket's ladder shows as soon as its ranks are in. The bracket
 * lives in the URL.
 */
const PvpTiersPage = ({
  eyebrow = "Competitive & Economy",
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const [params, setParams] = useSearchParamsRecord(URL_DEFAULTS);
  const catalog = usePvpTierCatalog();
  const {
    index,
    tiers,
    total,
    settled,
    complete,
    pendingCount,
    failedCount,
    expectedRanks,
  } = catalog;

  const ladders = useMemo(() => buildLadders(tiers), [tiers]);
  const matrix = useMemo(() => buildMatrix(ladders), [ladders]);
  const ranks = expectedRanks || FALLBACK_RANKS;

  const selectedType = resolveBracketType(params.bracket, ladders, settled);
  const ladder = ladders.find((entry) => entry.meta.type === selectedType);
  const selectedSlug = ladder?.meta.slug;
  // A bracket is complete once it has a tier for every rank name in the
  // index; until then (or until everything settles) its cards would shuffle
  // as each tier lands, so the skeleton stays.
  const ladderReady =
    ladder !== undefined && (settled || ladder.tiers.length >= ranks);
  // Short of a rank while some tiers are failed or being retried: one of
  // them may be this bracket's, so its cards cannot claim positions or a top
  // rank. (Short with everything loaded is simply a smaller bracket.)
  const missingRanks =
    ladder !== undefined && !complete && ladder.tiers.length < ranks
      ? Math.max(
          1,
          Math.min(ranks - ladder.tiers.length, failedCount + pendingCount),
        )
      : 0;

  // The bracket the table tints and takes its row icons from.
  const tableType = ladder?.meta.type ?? null;

  // Icons only for what is on screen: the ladder's tiers and, once the table
  // shows, each row's (the same tiers, unless the bracket lacks a rank).
  // Fetched on demand, nine per bracket, instead of all 45 up front.
  const iconTierIds = useMemo(() => {
    const ids = new Set<number>();
    if (ladderReady && ladder) {
      ladder.tiers.forEach((tier) => ids.add(tier.id));
    }
    if (settled) {
      matrix.rows.forEach((row) => {
        const tier = rowIconTier(row, tableType);
        if (tier) {
          ids.add(tier.id);
        }
      });
    }
    return Array.from(ids);
  }, [ladderReady, ladder, settled, matrix, tableType]);
  const icons = usePvpTierIcons(iconTierIds);

  // Write the bracket on screen into the URL once every tier is in, so the
  // address always names it (an empty or unknown value is replaced). Not
  // while some tiers failed or are being retried: the requested bracket may
  // be among them.
  useEffect(() => {
    if (complete && selectedSlug !== undefined && params.bracket !== selectedSlug) {
      setParams({ bracket: selectedSlug }, { replace: true });
    }
  }, [complete, selectedSlug, params.bracket, setParams]);

  const handleBracketChange = useCallback(
    (slug: string) => setParams({ bracket: slug }),
    [setParams],
  );

  const options = useMemo<SegmentedOption[]>(
    () =>
      ladders.map((entry) => ({ value: entry.meta.slug, label: entry.meta.label })),
    [ladders],
  );

  const hasOutliers = matrix.rows.some((row) => row.outliers.size > 0);
  const matrixDescription = !settled
    ? undefined
    : matrix.uniform
      ? `Each rank's rating range in all ${formatNumber(matrix.brackets.length)} brackets. Every bracket uses the same ranges.`
      : hasOutliers
        ? "Each rank's rating range in every bracket. Ranges that differ from the rest of their row are marked in gold."
        : "Each rank's rating range in every bracket.";

  const summary = index.isPending
    ? "Loading PvP tiers…"
    : !settled
      ? `Loading ${formatNumber(total)} tiers…`
      : ladder
        ? `${formatNumber(ladder.tiers.length)} ${
            ladder.tiers.length === 1 ? "tier" : "tiers"
          } in ${ladder.meta.title}`
        : undefined;

  /* ---------------- Render ---------------- */

  const renderLadder = (): JSX.Element => {
    if (ladderReady && ladder) {
      return (
        <Box
          component="ul"
          // Safari drops the list role from a list-style:none list without it.
          role="list"
          aria-label={`${ladder.meta.title} tiers`}
          sx={{
            display: "grid",
            gap: 2,
            listStyle: "none",
            margin: 0,
            padding: 0,
            ...gridTemplateColumnsSx(LADDER_COLS),
          }}
        >
          {ladder.tiers.map((tier, position) => (
            <Box component="li" key={tier.id} sx={{ minWidth: 0 }}>
              <PvpTierCard
                tier={tier}
                step={position + 1}
                ladder={ladder.tiers}
                scale={ladder.scale}
                partial={missingRanks > 0}
                icon={icons.get(tier.id)}
              />
            </Box>
          ))}
        </Box>
      );
    }
    // Only while tiers load: once everything settles there is always a
    // ladder, or the page shows its error / empty state instead.
    return (
      <LoadingSkeleton
        variant="grid"
        columns={LADDER_COLS}
        count={ranks}
        itemHeight={TIER_CARD_HEIGHT.sm}
        label="Loading tiers"
        sx={{ "& > .MuiSkeleton-root": { height: TIER_CARD_HEIGHT } }}
      />
    );
  };

  const renderBody = (): JSX.Element => {
    // A failed background refetch keeps the index it already had.
    if (index.isError && !index.data) {
      return (
        <ErrorState
          error={index.error}
          context="the PvP tier index"
          onRetry={() => void index.refetch()}
        />
      );
    }
    if (index.data !== undefined && total === 0) {
      return (
        <EmptyState
          icon={<MilitaryTechRoundedIcon />}
          title="No PvP tiers listed"
          description="Blizzard's tier index for this region is empty."
        />
      );
    }
    // Every tier failed (after react-query's retries): nothing to show. While
    // a Retry runs they are pending again, and the skeletons below take over.
    if (settled && tiers.length === 0 && pendingCount === 0) {
      return (
        <ErrorState
          error={catalog.firstError}
          context="PvP tiers"
          onRetry={catalog.retryFailed}
        />
      );
    }

    return (
      <>
        <Stack spacing={2}>
          <ExplorerFilterBar
            label="Choose a bracket"
            summary={summary}
            progress={index.data !== undefined && pendingCount > 0}
          >
            {settled && options.length > 0 ? (
              <SegmentedControl
                label="Bracket"
                options={options}
                value={selectedSlug ?? options[0].value}
                onChange={handleBracketChange}
                size="small"
                sx={bracketControlSx}
              />
            ) : (
              <BracketSwitcherPlaceholder />
            )}
          </ExplorerFilterBar>
          {settled && failedCount > 0 && pendingCount === 0 ? (
            <ErrorState
              compact
              error={catalog.firstError}
              context={`${formatNumber(failedCount)} of ${formatNumber(total)} PvP tiers`}
              onRetry={catalog.retryFailed}
            />
          ) : null}
        </Stack>

        <SectionCard
          title={
            selectedType ? `${bracketMeta(selectedType).title} ladder` : "Tier ladder"
          }
          description={
            ladderReady && ladder
              ? describeLadder(ladder, missingRanks, ranks)
              : undefined
          }
        >
          {renderLadder()}
        </SectionCard>

        <SectionCard
          id={MATRIX_ID}
          title="Tier × bracket"
          description={matrixDescription}
          padding="none"
        >
          {settled && matrix.rows.length > 0 ? (
            <PvpTierMatrix
              matrix={matrix}
              selectedType={tableType}
              incomplete={!complete}
              icons={icons}
              captionId={`${MATRIX_ID}-caption`}
            />
          ) : (
            // One bar per body row, each centred in a slot as tall as the
            // real row, under a gap the header's height: the table lands
            // without moving anything below it.
            <LoadingSkeleton
              variant="rows"
              count={ranks}
              itemHeight={MATRIX_ROW_HEIGHT - 2 * MATRIX_SKELETON_INSET}
              gap={2 * MATRIX_SKELETON_INSET}
              label="Loading the comparison table"
              sx={{
                px: 2,
                pt: `${MATRIX_HEAD_HEIGHT + MATRIX_SKELETON_INSET}px`,
                pb: `${MATRIX_SKELETON_INSET}px`,
              }}
            />
          )}
        </SectionCard>
      </>
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
        title="PvP Tiers"
        documentTitle="PvP Tiers"
        icon={<MilitaryTechRoundedIcon />}
        description="Blizzard's rated PvP ranks, from Unranked to Elite, with the rating range of each rank in every bracket: 2v2 and 3v3 arena, rated battlegrounds, Solo Shuffle and Blitz."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {total > 0 ? (
              <Chip size="small" label={`${formatNumber(total)} tiers`} />
            ) : null}
            {settled && ladders.length > 0 ? (
              <Chip
                size="small"
                label={`${formatNumber(ladders.length)} ${
                  ladders.length === 1 ? "bracket" : "brackets"
                }`}
              />
            ) : null}
            {settled && matrix.rows.length > 0 ? (
              <Chip
                size="small"
                label={`${formatNumber(matrix.rows.length)} ${
                  matrix.rows.length === 1 ? "rank" : "ranks"
                }`}
              />
            ) : null}
          </>
        }
      />

      {renderBody()}
    </Stack>
  );
};

export default PvpTiersPage;
