import { Box, Stack, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useId, useMemo, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

import GoldAmount from "@/components/common/GoldAmount";
import PriceChange from "@/features/wowToken/components/PriceChange";
import useElementWidth from "@/features/wowToken/hooks/useElementWidth";
import {
  DAY,
  HOUR,
  MINUTE,
  changeRatio,
  formatClock,
  formatDateTime,
  formatDay,
  formatSignedPercent,
  previousPoint,
  segmentsOf,
} from "@/features/wowToken/services/tokenStats";
import type { TokenHistoryPoint } from "@/features/wowToken/types";
import { COPPER_PER_GOLD, formatNumber } from "@/lib/format";
import { focusRing } from "@/theme";

export type PriceHistoryChartProps = {
  /** The prices to plot, oldest first; at least two. */
  points: readonly TokenHistoryPoint[];
  /** The region's whole history, for the change before the first plotted price. */
  history: readonly TokenHistoryPoint[];
  /** "EU", for the chart's accessible name. */
  regionLabel: string;
};

/** Plot height in CSS pixels; the readout above it is extra. */
export const CHART_HEIGHT = 240;
/** The readout line above the plot, reserved so hovering never shifts the page. */
export const READOUT_HEIGHT = 32;

const MARGIN = { top: 12, right: 14, bottom: 28 };
const TICK_FONT_PX = 11;
/** Rough advance of one tabular digit at 11px, to size the y-axis gutter. */
const CHAR_PX = 6.8;
/** Room each time label needs before another one is added. */
const MIN_X_TICK_SPACING = 92;
const Y_TICK_TARGET = 4;
/**
 * Below this spread (0.4% of the price, at least 10 gold) the axis is
 * widened around the prices, so a flat run reads as flat rather than as
 * wild swings across a few gold.
 */
const MIN_SPREAD_RATIO = 0.004;
const MIN_SPREAD_GOLD = 10;
const PAGE_STEP = 10;

const TIME_STEPS = [
  5 * MINUTE,
  10 * MINUTE,
  15 * MINUTE,
  30 * MINUTE,
  HOUR,
  2 * HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
  2 * DAY,
  7 * DAY,
  14 * DAY,
  30 * DAY,
];

/** 1, 2 or 5 times a power of ten, giving about `count` intervals over `span`. */
const niceStep = (span: number, count: number): number => {
  const raw = span / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return factor * magnitude;
};

/** Round gold values bracketing [low, high]; the first and last are the axis ends. */
const goldTicks = (low: number, high: number): number[] => {
  const step = niceStep(high - low, Y_TICK_TARGET);
  const start = Math.floor(low / step) * step;
  const end = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= end + step / 2; value += step) {
    ticks.push(Math.round(value));
  }
  return ticks;
};

const startOfLocalDay = (t: number): number => {
  const date = new Date(t);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

/**
 * Time ticks on local clock boundaries (on the hour, at midnight), as few
 * as the width allows. Day steps walk the calendar so a daylight-saving
 * change cannot drift them off midnight.
 */
const timeTicks = (t0: number, t1: number, maxTicks: number): { step: number; ticks: number[] } => {
  const span = t1 - t0;
  const step =
    TIME_STEPS.find((candidate) => span / candidate <= maxTicks) ??
    TIME_STEPS[TIME_STEPS.length - 1];
  const ticks: number[] = [];
  if (step < DAY) {
    const origin = startOfLocalDay(t0);
    for (let t = origin + Math.ceil((t0 - origin) / step) * step; t <= t1; t += step) {
      ticks.push(t);
    }
  } else {
    const days = Math.round(step / DAY);
    const date = new Date(startOfLocalDay(t0));
    if (date.getTime() < t0) {
      date.setDate(date.getDate() + 1);
    }
    while (date.getTime() <= t1) {
      ticks.push(date.getTime());
      date.setDate(date.getDate() + days);
    }
  }
  return { step, ticks: ticks.length > 0 ? ticks : [t0] };
};

/** Clock times within a day; the date where a new day starts (or for day steps). */
const timeLabel = (t: number, index: number, ticks: number[], step: number, span: number): string => {
  if (step >= DAY) {
    return formatDay(t);
  }
  if (span <= 20 * HOUR) {
    return formatClock(t);
  }
  const newDay = index === 0 || startOfLocalDay(ticks[index - 1]) !== startOfLocalDay(t);
  return newDay ? formatDay(t) : formatClock(t);
};

/** Index of the price closest in time to `t` (points are sorted by time). */
const nearestIndex = (points: readonly TokenHistoryPoint[], t: number): number => {
  let low = 0;
  let high = points.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (points[middle].t <= t) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return Math.abs(points[low].t - t) <= Math.abs(points[high].t - t) ? low : high;
};

const toGold = (copper: number): number => copper / COPPER_PER_GOLD;

const describePoint = (
  point: TokenHistoryPoint,
  previous: TokenHistoryPoint | undefined,
): string => {
  const price = `${formatNumber(Math.round(toGold(point.price)))} gold`;
  const ratio = previous ? changeRatio(previous.price, point.price) : null;
  const change =
    ratio === null
      ? ""
      : ratio === 0
        ? ", unchanged from the price before"
        : `, ${formatSignedPercent(ratio)} from the price before`;
  return `${formatDateTime(point.t)}: ${price}${change}`;
};

/**
 * The stored prices as a line over time: gold on a rounded y-axis, local
 * clock times on x, a faint gold wash beneath, and a break wherever the
 * page was closed long enough to miss publications.
 *
 * A crosshair snaps to the nearest price under the pointer (or a tap).
 * From the keyboard the plot is a slider over the prices: one tab stop
 * whose arrow keys step through them, each announced through its value
 * text, which screen readers handle in browse mode too (a focusable group
 * would leave the arrows to the virtual cursor). The readout above shows
 * the same details, the latest price when nothing is picked, and the
 * table below the chart lists every value, so nothing needs a pointer.
 */
const PriceHistoryChart = ({
  points,
  history,
  regionLabel,
}: PriceHistoryChartProps): JSX.Element => {
  const theme = useTheme();
  const [boxRef, width] = useElementWidth<HTMLDivElement>();
  // The picked price by time, so switching region or range can never
  // leave the crosshair on whatever now sits at the old index.
  const [activeT, setActiveT] = useState<number | null>(null);
  const summaryId = useId();
  const hintId = useId();

  const geometry = useMemo(() => {
    if (width <= 0 || points.length < 2) {
      return null;
    }
    const golds = points.map((point) => toGold(point.price));
    let low = Math.min(...golds);
    let high = Math.max(...golds);
    const minSpread = Math.max(MIN_SPREAD_GOLD, high * MIN_SPREAD_RATIO);
    if (high - low < minSpread) {
      const middle = (low + high) / 2;
      low = middle - minSpread / 2;
      high = middle + minSpread / 2;
    }
    const yTicks = goldTicks(Math.max(0, low), high);
    const yMin = yTicks[0];
    const yMax = yTicks[yTicks.length - 1];
    const yLabels = yTicks.map((tick) => formatNumber(tick));
    const left = Math.ceil(Math.max(...yLabels.map((label) => label.length)) * CHAR_PX) + 10;
    const plotWidth = Math.max(40, width - left - MARGIN.right);
    const plotHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
    const bottom = MARGIN.top + plotHeight;

    const t0 = points[0].t;
    const t1 = points[points.length - 1].t;
    const span = Math.max(1, t1 - t0);
    const x = (t: number): number => left + ((t - t0) / span) * plotWidth;
    const y = (copper: number): number =>
      MARGIN.top + (1 - (toGold(copper) - yMin) / Math.max(1, yMax - yMin)) * plotHeight;

    const maxTicks = Math.max(2, Math.floor(plotWidth / MIN_X_TICK_SPACING));
    const { step, ticks } = timeTicks(t0, t1, maxTicks);
    const xTicks = ticks.map((t, index) => {
      const at = x(t);
      return {
        t,
        x: at,
        label: timeLabel(t, index, ticks, step, span),
        anchor: at < left + 28 ? "start" : at > left + plotWidth - 28 ? "end" : "middle",
      } as const;
    });

    const segments = segmentsOf(points).map((segment) => {
      const coordinates = segment.map((point) => ({ x: x(point.t), y: y(point.price) }));
      const line = coordinates
        .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
        .join(" ");
      const first = coordinates[0];
      const last = coordinates[coordinates.length - 1];
      const area =
        coordinates.length > 1
          ? `${line} L${last.x.toFixed(1)},${bottom} L${first.x.toFixed(1)},${bottom} Z`
          : "";
      return { line, area, single: coordinates.length === 1 ? first : null };
    });

    return {
      left,
      plotWidth,
      bottom,
      t0,
      span,
      x,
      y,
      yTicks: yTicks.map((tick, index) => ({
        y: MARGIN.top + (1 - (tick - yMin) / Math.max(1, yMax - yMin)) * plotHeight,
        label: yLabels[index],
      })),
      xTicks,
      segments,
    };
  }, [points, width]);

  const activeIndex =
    activeT === null ? -1 : points.findIndex((point) => point.t === activeT);
  const shownIndex = activeIndex >= 0 ? activeIndex : points.length - 1;
  const shown = points[shownIndex];
  const shownPrevious = previousPoint(history, shown.t);
  const latest = points[points.length - 1];

  const pick = (index: number): void => {
    const clamped = Math.min(points.length - 1, Math.max(0, index));
    setActiveT(points[clamped].t);
  };

  const handlePointer = (event: PointerEvent<SVGSVGElement>): void => {
    if (!geometry) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left - geometry.left) / geometry.plotWidth;
    const t = geometry.t0 + Math.min(1, Math.max(0, ratio)) * geometry.span;
    pick(nearestIndex(points, t));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const current = activeIndex >= 0 ? activeIndex : points.length - 1;
    const moves: Record<string, number> = {
      ArrowLeft: current - 1,
      ArrowDown: current - 1,
      ArrowRight: current + 1,
      ArrowUp: current + 1,
      PageDown: current - PAGE_STEP,
      PageUp: current + PAGE_STEP,
      Home: 0,
      End: points.length - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      pick(moves[event.key]);
    } else if (event.key === "Escape" && activeT !== null) {
      event.preventDefault();
      setActiveT(null);
    }
  };

  const low = points.reduce((best, point) => (point.price < best.price ? point : best));
  const high = points.reduce((best, point) => (point.price > best.price ? point : best));
  const summary = `${regionLabel} WoW Token price, ${formatNumber(points.length)} stored prices from ${formatDateTime(
    points[0].t,
  )} to ${formatDateTime(latest.t)}: low ${formatNumber(Math.round(toGold(low.price)))} gold, high ${formatNumber(
    Math.round(toGold(high.price)),
  )} gold, latest ${formatNumber(Math.round(toGold(latest.price)))} gold.`;

  const gold = theme.palette.secondary.main;
  const surface = theme.palette.background.paper;
  const active = activeIndex >= 0 && geometry ? points[activeIndex] : null;

  return (
    <Stack spacing={1} sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        flexWrap="wrap"
        alignItems="baseline"
        columnGap={1.25}
        rowGap={0.25}
        sx={{ minHeight: READOUT_HEIGHT, minWidth: 0 }}
      >
        <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
          {activeIndex >= 0 ? null : "Latest · "}
          <time dateTime={new Date(shown.t).toISOString()}>{formatDateTime(shown.t)}</time>
        </Typography>
        <GoldAmount copper={shown.price} size="large" component="p" sx={{ m: 0, fontWeight: 700 }} />
        {shownPrevious ? (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
            <PriceChange from={shownPrevious.price} to={shown.price} size="small" />{" "}
            vs the price before
          </Typography>
        ) : null}
      </Stack>

      {/* Description sources only: `hidden` keeps them out of the reading
          order (the slider reads them as its description), where visually
          hidden text would be heard twice. */}
      <Box component="span" id={summaryId} hidden>
        {summary}
      </Box>
      <Box component="span" id={hintId} hidden>
        Arrow keys step through the prices; Home and End jump to the first and the latest.
      </Box>
      <Box
        ref={boxRef}
        tabIndex={0}
        role="slider"
        aria-label={`${regionLabel} price chart`}
        aria-describedby={`${summaryId} ${hintId}`}
        aria-valuemin={1}
        aria-valuemax={points.length}
        aria-valuenow={shownIndex + 1}
        aria-valuetext={describePoint(shown, shownPrevious)}
        aria-orientation="horizontal"
        onKeyDown={handleKeyDown}
        onBlur={() => setActiveT(null)}
        sx={{
          position: "relative",
          height: CHART_HEIGHT,
          minWidth: 0,
          borderRadius: `${theme.wc.radius.sm}px`,
          // A click focuses the chart too; only keyboard focus shows the ring.
          "&:focus": { outline: "none" },
          "&:focus-visible": focusRing(theme),
        }}
      >
        {geometry ? (
          // A slider's contents are presentational; the summary describes it.
          <svg
            aria-hidden="true"
            focusable="false"
            width={width}
            height={CHART_HEIGHT}
            viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
            onPointerMove={handlePointer}
            onPointerDown={handlePointer}
            onPointerLeave={(event) => {
              // A tap keeps its pick; only a mouse leaving clears it.
              if (event.pointerType === "mouse") {
                setActiveT(null);
              }
            }}
            style={{ display: "block", touchAction: "pan-y", cursor: "crosshair" }}
          >
            {geometry.yTicks.map((tick, index) => (
              <g key={tick.label}>
                <line
                  x1={geometry.left}
                  x2={geometry.left + geometry.plotWidth}
                  y1={tick.y}
                  y2={tick.y}
                  stroke={index === 0 ? theme.palette.border.default : theme.palette.border.subtle}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text
                  x={geometry.left - 8}
                  y={tick.y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill={theme.palette.text.secondary}
                  style={{ fontSize: TICK_FONT_PX, fontVariantNumeric: "tabular-nums" }}
                >
                  {tick.label}
                </text>
              </g>
            ))}
            {geometry.xTicks.map((tick) => (
              <g key={tick.t}>
                <line
                  x1={tick.x}
                  x2={tick.x}
                  y1={geometry.bottom}
                  y2={geometry.bottom + 4}
                  stroke={theme.palette.border.strong}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text
                  x={tick.x}
                  y={geometry.bottom + 18}
                  textAnchor={tick.anchor}
                  fill={theme.palette.text.secondary}
                  style={{ fontSize: TICK_FONT_PX, fontVariantNumeric: "tabular-nums" }}
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {geometry.segments.map((segment, index) => (
              <g key={index}>
                {segment.area ? <path d={segment.area} fill={alpha(gold, 0.1)} /> : null}
                {segment.single ? (
                  <circle cx={segment.single.x} cy={segment.single.y} r={2.5} fill={gold} />
                ) : (
                  <path
                    d={segment.line}
                    fill="none"
                    stroke={gold}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
              </g>
            ))}

            {active ? (
              <g>
                <line
                  x1={geometry.x(active.t)}
                  x2={geometry.x(active.t)}
                  y1={MARGIN.top}
                  y2={geometry.bottom}
                  stroke={alpha(theme.palette.text.primary, 0.4)}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <circle
                  cx={geometry.x(active.t)}
                  cy={geometry.y(active.price)}
                  r={5}
                  fill={gold}
                  stroke={surface}
                  strokeWidth={2}
                />
              </g>
            ) : (
              <circle
                cx={geometry.x(latest.t)}
                cy={geometry.y(latest.price)}
                r={4}
                fill={gold}
                stroke={surface}
                strokeWidth={2}
              />
            )}
          </svg>
        ) : null}
      </Box>
    </Stack>
  );
};

export default PriceHistoryChart;
