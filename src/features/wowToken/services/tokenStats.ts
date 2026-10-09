import type {
  HistoryRange,
  RangeStats,
  TokenHistoryPoint,
} from "@/features/wowToken/types";
import { HISTORY_RANGES } from "@/features/wowToken/types";
import { env } from "@/lib/env";
import { formatNumber, toBcp47 } from "@/lib/format";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/**
 * Blizzard does not document how often it republishes the price; roughly
 * every 20 minutes is what the API has shown for years (and what the
 * stored samples usually confirm). Only a fallback: `publishCadence`
 * prefers the gaps this browser actually saw.
 */
export const DEFAULT_PUBLISH_MS = 20 * MINUTE;
/**
 * Past this without a new price, the shown one is flagged as stale. Two
 * publications, not one and a half: a new price reaches the screen up to
 * one poll plus the proxy's cache window (and the CDN's, in production)
 * after Blizzard publishes it, so a healthy price is routinely 30 minutes
 * old just before the next one shows.
 */
export const STALE_AFTER_MS = 2 * DEFAULT_PUBLISH_MS;
/**
 * Two stored prices further apart than this were not consecutive
 * publications (the page was closed in between): the chart breaks its line
 * there instead of drawing a slope nobody observed.
 */
export const GAP_BREAK_MS = 90 * MINUTE;

const RANGE_MS: Record<Exclude<HistoryRange, "all">, number> = {
  "6h": 6 * HOUR,
  "24h": DAY,
  "7d": 7 * DAY,
  "30d": 30 * DAY,
};

export const RANGE_LABELS: Record<HistoryRange, { short: string; long: string }> = {
  "6h": { short: "6H", long: "Last 6 hours" },
  "24h": { short: "24H", long: "Last 24 hours" },
  "7d": { short: "7D", long: "Last 7 days" },
  "30d": { short: "30D", long: "Last 30 days" },
  all: { short: "All", long: "Every stored price" },
};

export const isHistoryRange = (value: string): value is HistoryRange =>
  (HISTORY_RANGES as readonly string[]).includes(value);

/** The stored prices inside `range`, measured back from `now`. */
export const pointsInRange = (
  points: readonly TokenHistoryPoint[],
  range: HistoryRange,
  now: number,
): readonly TokenHistoryPoint[] => {
  if (range === "all") {
    return points;
  }
  const since = now - RANGE_MS[range];
  return points.filter((point) => point.t >= since);
};

export const summarize = (points: readonly TokenHistoryPoint[]): RangeStats | null => {
  if (points.length === 0) {
    return null;
  }
  let low = points[0];
  let high = points[0];
  let total = 0;
  points.forEach((point) => {
    if (point.price < low.price) {
      low = point;
    }
    if (point.price > high.price) {
      high = point;
    }
    total += point.price;
  });
  return {
    count: points.length,
    first: points[0],
    last: points[points.length - 1],
    low,
    high,
    average: total / points.length,
  };
};

/** The newest stored price older than `t`, if any. */
export const previousPoint = (
  points: readonly TokenHistoryPoint[],
  t: number,
): TokenHistoryPoint | undefined => {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index].t < t) {
      return points[index];
    }
  }
  return undefined;
};

/** Runs of consecutive prices with no gap over `GAP_BREAK_MS`. */
export const segmentsOf = (
  points: readonly TokenHistoryPoint[],
): TokenHistoryPoint[][] => {
  const segments: TokenHistoryPoint[][] = [];
  points.forEach((point, index) => {
    if (index === 0 || point.t - points[index - 1].t > GAP_BREAK_MS) {
      segments.push([point]);
    } else {
      segments[segments.length - 1].push(point);
    }
  });
  return segments;
};

/** Fewer consecutive gaps than this and the observed cadence is a guess. */
const MIN_CADENCE_GAPS = 3;
/**
 * Stored prices are Blizzard's publication times, so a gap where the tab
 * was hidden is a whole multiple of the cadence: one missed publication
 * makes a 40-minute gap. Half a cadence over separates the two; longer
 * gaps say nothing about how often Blizzard publishes.
 */
const MAX_CADENCE_GAP_MS = 1.5 * DEFAULT_PUBLISH_MS;

/**
 * How often Blizzard republished in the samples stored here: the median
 * gap between consecutive publications, ignoring gaps that skipped one
 * (the page was closed or hidden). `null` until enough consecutive
 * samples exist.
 */
export const publishCadence = (points: readonly TokenHistoryPoint[]): number | null => {
  const gaps: number[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const gap = points[index].t - points[index - 1].t;
    if (gap > 0 && gap <= MAX_CADENCE_GAP_MS) {
      gaps.push(gap);
    }
  }
  if (gaps.length < MIN_CADENCE_GAPS) {
    return null;
  }
  gaps.sort((left, right) => left - right);
  const middle = Math.floor(gaps.length / 2);
  return gaps.length % 2 === 1 ? gaps[middle] : (gaps[middle - 1] + gaps[middle]) / 2;
};

/** `to / from - 1`, or null when there is nothing to divide by. */
export const changeRatio = (from: number, to: number): number | null =>
  from > 0 ? to / from - 1 : null;

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** "+1.25%", "−0.4%", "0%" in the app locale. */
export const formatSignedPercent = (ratio: number): string =>
  formatNumber(ratio, {
    style: "percent",
    signDisplay: "exceptZero",
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.abs(ratio) < 0.1 ? 2 : 1,
  });

/** "1.82×" */
export const formatMultiple = (ratio: number): string =>
  `${formatNumber(ratio, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×`;

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

const dateFormatter = (options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => {
  const key = JSON.stringify(options);
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat(toBcp47(env.locale), options);
    } catch {
      formatter = new Intl.DateTimeFormat(undefined, options);
    }
    dateFormatters.set(key, formatter);
  }
  return formatter;
};

/** "7:09 PM" */
export const formatClock = (t: number): string =>
  dateFormatter({ hour: "numeric", minute: "2-digit" }).format(t);

/** "Oct 8" */
export const formatDay = (t: number): string =>
  dateFormatter({ month: "short", day: "numeric" }).format(t);

/** "Oct 8, 7:09 PM" */
export const formatDateTime = (t: number): string =>
  dateFormatter({ month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(t);

/** "40 minutes", "12 hours", "3 days" (rounded to the largest whole unit). */
export const formatDuration = (ms: number): string => {
  const magnitude = Math.max(0, ms);
  if (magnitude < 2 * HOUR) {
    return formatNumber(Math.max(1, Math.round(magnitude / MINUTE)), {
      style: "unit",
      unit: "minute",
      unitDisplay: "long",
    });
  }
  if (magnitude < 2 * DAY) {
    return formatNumber(Math.round(magnitude / HOUR), {
      style: "unit",
      unit: "hour",
      unitDisplay: "long",
    });
  }
  return formatNumber(Math.round(magnitude / DAY), {
    style: "unit",
    unit: "day",
    unitDisplay: "long",
  });
};

/** "3 prices", "1 price" */
export const pluralize = (count: number, singular: string, plural: string): string =>
  `${formatNumber(count)} ${count === 1 ? singular : plural}`;
