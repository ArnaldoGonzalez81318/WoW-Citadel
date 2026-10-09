import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ShowChartRoundedIcon from "@mui/icons-material/ShowChartRounded";
import {
  Box,
  Button,
  Collapse,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import { useId, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";

import { SegmentedControl } from "@/components/common/ExplorerFilterBar";
import type { SegmentedOption } from "@/components/common/ExplorerFilterBar";
import GoldAmount from "@/components/common/GoldAmount";
import { EmptyState, LoadingSkeleton } from "@/components/common/StateBlocks";
import { MAX_TOKEN_HISTORY_POINTS } from "@/features/search/hooks/useWowTokenHistory";
import { Fact, FactList } from "@/features/wowToken/components/Facts";
import HistoryTable from "@/features/wowToken/components/HistoryTable";
import PriceChange from "@/features/wowToken/components/PriceChange";
import PriceHistoryChart, {
  CHART_HEIGHT,
  READOUT_HEIGHT,
} from "@/features/wowToken/components/PriceHistoryChart";
import { clearHistory } from "@/features/wowToken/services/tokenHistoryStore";
import {
  GAP_BREAK_MS,
  RANGE_LABELS,
  formatDateTime,
  formatDuration,
  pluralize,
  pointsInRange,
  summarize,
} from "@/features/wowToken/services/tokenStats";
import { HISTORY_RANGES } from "@/features/wowToken/types";
import type {
  HistoryRange,
  Region,
  RegionPrice,
  TokenHistoryPoint,
} from "@/features/wowToken/types";
import { formatNumber, formatRelativeTime } from "@/lib/format";
import { visuallyHidden } from "@/theme";

export type PriceHistorySectionProps = {
  /** The region on the chart. */
  price: RegionPrice;
  history: readonly TokenHistoryPoint[];
  range: HistoryRange;
  now: number;
  /** How often Blizzard republishes, for the "one price so far" copy. */
  cadenceMs: number;
  regionOptions: ReadonlyArray<SegmentedOption<Region>>;
  onRegionChange: (region: Region) => void;
  onRangeChange: (range: HistoryRange) => void;
  /** The h2, focusable from script: "Price history" buttons move focus here. */
  headingRef: RefObject<HTMLHeadingElement>;
};

/** Leaves the sticky app header clear when the section is scrolled to. */
const sectionSx = (theme: Theme) => ({
  minWidth: 0,
  borderRadius: `${theme.wc.radius.lg}px`,
  scrollMarginTop: {
    xs: `${theme.wc.layout.headerHeight.xs + 16}px`,
    md: `${theme.wc.layout.headerHeight.md + 16}px`,
  },
});

/** A script focus target only, never a Tab stop: no ring needed. */
const focusTargetSx = {
  m: 0,
  "&:focus": { outline: "none" },
} as const;

type RangeControlProps = {
  value: HistoryRange;
  onChange: (range: HistoryRange) => void;
};

/**
 * SegmentedControl reads its visible label aloud; "6H" is not a phrase, so
 * each range button adds the long form as hidden text after the short one.
 * The name still starts with what is shown ("6H, last 6 hours"), so voice
 * control can say "click 6H".
 */
const RangeControl = ({ value, onChange }: RangeControlProps): JSX.Element => (
  <ToggleButtonGroup
    exclusive
    size="small"
    value={value}
    aria-label="Range"
    onChange={(_event, next: HistoryRange | null) => {
      if (next !== null && next !== value) {
        onChange(next);
      }
    }}
    sx={{ flexShrink: 0 }}
  >
    {HISTORY_RANGES.map((range) => (
      <ToggleButton key={range} value={range}>
        {RANGE_LABELS[range].short}
        <Box component="span" sx={visuallyHidden}>
          {`, ${RANGE_LABELS[range].long.toLowerCase()}`}
        </Box>
      </ToggleButton>
    ))}
  </ToggleButtonGroup>
);

/**
 * The selected region's stored prices: a region and range picker, the
 * chart, the range's low, high, average and change, the same prices as a
 * table, and a way to forget them. Blizzard keeps no history, so every
 * state says plainly where these prices come from.
 */
const PriceHistorySection = ({
  price,
  history,
  range,
  now,
  cadenceMs,
  regionOptions,
  onRegionChange,
  onRangeChange,
  headingRef,
}: PriceHistorySectionProps): JSX.Element => {
  const titleId = useId();
  const tableId = useId();
  const { region, tag, token } = price;
  const [tableOpen, setTableOpen] = useState(false);
  const clearButtonRef = useRef<HTMLButtonElement | null>(null);

  const inRange = useMemo(() => pointsInRange(history, range, now), [history, range, now]);
  const stats = useMemo(() => summarize(inRange), [inRange]);
  const rangeLabel = RANGE_LABELS[range].long;
  const chartShown = history.length >= 2 && stats !== null && inRange.length >= 2;

  // The clear prompt belongs to the view it was opened on. A new region or
  // range, or a body without the chart, drops it for good: coming back must
  // not remount it, or its autofocused "Keep it" would pull focus from
  // wherever the user is now.
  const viewKey = `${region}|${range}`;
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  if (confirmFor !== null && (confirmFor !== viewKey || !chartShown)) {
    setConfirmFor(null);
  }
  const confirming = confirmFor === viewKey && chartShown;

  const focusHeading = (): void => {
    headingRef.current?.focus({ preventScroll: true });
  };

  const handleShowAll = (): void => {
    onRangeChange("all");
    // The button leaves with the empty state; the heading keeps the place.
    focusHeading();
  };

  const handleConfirmClear = (): void => {
    clearHistory(region);
    setConfirmFor(null);
    // One price is left, so the chart and this prompt both go.
    focusHeading();
  };

  const handleCancelClear = (): void => {
    setConfirmFor(null);
    clearButtonRef.current?.focus();
  };

  const renderBody = (): JSX.Element => {
    if (history.length === 0) {
      // A loaded price is recorded on the next effect; only a failed or
      // unusable one leaves nothing to wait for.
      if (token.isPending || (token.data && token.data.price > 0)) {
        return (
          <LoadingSkeleton
            variant="block"
            height={CHART_HEIGHT + READOUT_HEIGHT + 8}
            label={`Loading the ${tag} price`}
          />
        );
      }
      return (
        <EmptyState
          icon={<ShowChartRoundedIcon />}
          title={`No ${tag} prices stored yet`}
          description={
            token.data
              ? `Blizzard returned no usable ${tag} price to record.`
              : `The ${tag} price did not load, so there is nothing to record yet; retry from its card above.`
          }
        />
      );
    }

    if (history.length === 1) {
      const only = history[0];
      return (
        <EmptyState
          icon={<ShowChartRoundedIcon />}
          title={`One ${tag} price stored so far`}
          description={
            <>
              <GoldAmount copper={only.price} /> at{" "}
              <time dateTime={new Date(only.t).toISOString()}>{formatDateTime(only.t)}</time>.
              Blizzard publishes a new price about every {formatDuration(cadenceMs)}; with
              this page open, the line starts with the next one.
            </>
          }
        />
      );
    }

    if (!stats || inRange.length < 2) {
      const newest = history[history.length - 1];
      return (
        <EmptyState
          icon={<ShowChartRoundedIcon />}
          title={`Fewer than two ${tag} prices in the ${rangeLabel.toLowerCase()}`}
          description={`${pluralize(history.length, "price is", "prices are")} stored in all, the newest from ${formatRelativeTime(
            Math.min(newest.t, now),
            now,
          )}.`}
          action={
            <Button variant="outlined" size="small" onClick={handleShowAll}>
              Show every stored price
            </Button>
          }
        />
      );
    }

    const caption = `${tag} WoW Token prices stored in this browser, ${rangeLabel.toLowerCase()}, newest first`;

    return (
      <Stack spacing={2.5} sx={{ minWidth: 0 }}>
        <PriceHistoryChart points={inRange} history={history} regionLabel={tag} />

        <FactList columns={{ xs: 2, sm: 3, lg: 6 }}>
          <Fact
            label="Latest"
            value={<GoldAmount copper={stats.last.price} size="large" />}
            note={formatDateTime(stats.last.t)}
          />
          <Fact
            label="Low"
            value={<GoldAmount copper={stats.low.price} size="large" />}
            note={formatDateTime(stats.low.t)}
          />
          <Fact
            label="High"
            value={<GoldAmount copper={stats.high.price} size="large" />}
            note={formatDateTime(stats.high.t)}
          />
          <Fact
            label="Average"
            value={<GoldAmount copper={Math.round(stats.average)} size="large" />}
            note={`Mean of ${pluralize(stats.count, "price", "prices")}`}
          />
          <Fact
            label="Change"
            value={<PriceChange from={stats.first.price} to={stats.last.price} />}
            note={`Since ${formatDateTime(stats.first.t)}`}
          />
          <Fact
            label="Span"
            value={formatDuration(stats.last.t - stats.first.t)}
            note={pluralize(stats.count, "price", "prices")}
          />
        </FactList>

        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <Stack direction="row" flexWrap="wrap" useFlexGap gap={1} alignItems="center">
            <Button
              size="small"
              variant="outlined"
              aria-expanded={tableOpen}
              aria-controls={tableId}
              endIcon={tableOpen ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
              onClick={() => setTableOpen((open) => !open)}
            >
              Prices as a table
            </Button>
            <Button
              ref={clearButtonRef}
              size="small"
              variant="text"
              color="inherit"
              startIcon={<DeleteOutlineRoundedIcon />}
              aria-expanded={confirming}
              onClick={() => setConfirmFor(confirming ? null : viewKey)}
              sx={{ color: "text.secondary" }}
            >
              {`Clear ${tag} history`}
            </Button>
          </Stack>

          {confirming ? (
            <Box
              role="group"
              aria-labelledby={`${titleId}-confirm`}
              sx={(theme) => ({
                p: 2,
                borderRadius: `${theme.wc.radius.md}px`,
                border: `1px solid ${alpha(theme.palette.warning.main, 0.5)}`,
                backgroundColor: alpha(theme.palette.warning.main, 0.06),
              })}
            >
              <Typography id={`${titleId}-confirm`} variant="body2" component="p" sx={{ m: 0, maxWidth: "72ch" }}>
                {`Forget the ${pluralize(history.length, `${tag} price`, `${tag} prices`)} stored in this browser? The newest stays as the start of a new history. This cannot be undone.`}
              </Typography>
              <Stack direction="row" flexWrap="wrap" useFlexGap gap={1} sx={{ mt: 1.5 }}>
                <Button size="small" variant="contained" color="warning" onClick={handleConfirmClear}>
                  Clear history
                </Button>
                <Button size="small" variant="text" color="inherit" autoFocus onClick={handleCancelClear}>
                  Keep it
                </Button>
              </Stack>
            </Box>
          ) : null}

          <Collapse in={tableOpen} id={tableId} unmountOnExit>
            <HistoryTable points={inRange} history={history} caption={caption} />
          </Collapse>
        </Stack>
      </Stack>
    );
  };

  return (
    <Paper component="section" variant="outlined" aria-labelledby={titleId} sx={sectionSx}>
      <Stack spacing={2.5} sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Typography
            ref={headingRef}
            id={titleId}
            variant="h5"
            component="h2"
            tabIndex={-1}
            sx={focusTargetSx}
          >
            Price history
          </Typography>
          <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0, maxWidth: "72ch" }}>
            {`Blizzard's API returns only the current price, never a history. These prices were recorded by this browser: each new one it sees while this page is open is kept in its local storage (the newest ${formatNumber(
              MAX_TOKEN_HISTORY_POINTS,
            )} per region) and never sent anywhere. Where the page was closed for over ${formatDuration(
              GAP_BREAK_MS,
            )}, the line breaks.`}
          </Typography>
        </Stack>

        <Stack direction="row" flexWrap="wrap" useFlexGap gap={1.5} alignItems="center">
          <SegmentedControl<Region>
            label="Region"
            options={regionOptions}
            value={region}
            onChange={onRegionChange}
            size="small"
          />
          <RangeControl value={range} onChange={onRangeChange} />
        </Stack>

        {renderBody()}
      </Stack>
    </Paper>
  );
};

export default PriceHistorySection;
