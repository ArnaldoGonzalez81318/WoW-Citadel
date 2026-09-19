import { env } from "@/lib/env";

/* ------------------------------------------------------------------ */
/* Locale                                                              */
/* ------------------------------------------------------------------ */

const LOCALE_PATTERN = /^([A-Za-z]{2,3})[_-]?([A-Za-z]{2})$/;

/** Blizzard's `en_US` / `enUS` / `en-US` → BCP 47 `en-US`. */
export const toBcp47 = (locale: string | null | undefined): string => {
  const value = (locale ?? "").trim();
  const match = LOCALE_PATTERN.exec(value);

  if (match) {
    return `${match[1].toLowerCase()}-${match[2].toUpperCase()}`;
  }

  return value.length > 0 ? value.replace(/_/g, "-") : "en-US";
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  pt: "Portuguese",
  de: "German",
  fr: "French",
  it: "Italian",
  ru: "Russian",
  ko: "Korean",
  zh: "Chinese",
  ja: "Japanese",
};

const languageDisplayName = (language: string): string => {
  try {
    if (typeof Intl.DisplayNames === "function") {
      const name = new Intl.DisplayNames(["en"], { type: "language" }).of(
        language,
      );
      if (name && name.toLowerCase() !== language.toLowerCase()) {
        return name;
      }
    }
  } catch {
    /* fall through to the static map */
  }

  return LANGUAGE_NAMES[language.toLowerCase()] ?? language.toUpperCase();
};

/** `enUS` / `en_US` → "English (US)". Unknown shapes are returned as-is. */
export const formatLocale = (locale: string | null | undefined): string => {
  const value = (locale ?? "").trim();
  const match = LOCALE_PATTERN.exec(value);

  if (!match) {
    return value;
  }

  return `${languageDisplayName(match[1])} (${match[2].toUpperCase()})`;
};

/* ------------------------------------------------------------------ */
/* Numbers                                                             */
/* ------------------------------------------------------------------ */

const numberFormatters = new Map<string, Intl.NumberFormat>();

const getNumberFormatter = (
  options: Intl.NumberFormatOptions | undefined,
): Intl.NumberFormat => {
  const locale = toBcp47(env.locale);
  const key = `${locale}|${JSON.stringify(options ?? {})}`;
  let formatter = numberFormatters.get(key);

  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
      ...options,
    });
    numberFormatters.set(key, formatter);
  }

  return formatter;
};

/**
 * Grouped integer formatting in the app locale ("1,204"). Render inside
 * body text for tabular digits (the type scale sets `tabular-nums`).
 */
export const formatNumber = (
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions,
): string => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }

  return getNumberFormatter(options).format(value);
};

/* ------------------------------------------------------------------ */
/* Currency (copper)                                                   */
/* ------------------------------------------------------------------ */

export type CopperParts = {
  gold: number;
  silver: number;
  copper: number;
  negative: boolean;
};

export const COPPER_PER_SILVER = 100;
export const COPPER_PER_GOLD = 10_000;

/** 1234567 copper → { gold: 123, silver: 45, copper: 67 }. */
export const splitCopper = (copper: number | null | undefined): CopperParts => {
  const total =
    typeof copper === "number" && Number.isFinite(copper)
      ? Math.trunc(copper)
      : 0;
  const magnitude = Math.abs(total);

  return {
    gold: Math.floor(magnitude / COPPER_PER_GOLD),
    silver: Math.floor((magnitude % COPPER_PER_GOLD) / COPPER_PER_SILVER),
    copper: magnitude % COPPER_PER_SILVER,
    negative: total < 0,
  };
};

export type FormatCopperOptions = {
  /** "short" → "12g 34s 56c"; "long" → "12 gold 34 silver 56 copper". */
  style?: "short" | "long";
  /** Omit zero units (default). "0c" is kept when everything is zero. */
  trim?: boolean;
};

const UNIT_LABELS = {
  short: { gold: "g", silver: "s", copper: "c", separator: "" },
  long: { gold: " gold", silver: " silver", copper: " copper", separator: "" },
} as const;

export const formatCopper = (
  copper: number | null | undefined,
  { style = "short", trim = true }: FormatCopperOptions = {},
): string => {
  const parts = splitCopper(copper);
  const labels = UNIT_LABELS[style];
  const units: Array<[number, string]> = [
    [parts.gold, labels.gold],
    [parts.silver, labels.silver],
    [parts.copper, labels.copper],
  ];

  const kept = trim ? units.filter(([amount]) => amount > 0) : units;
  const segments =
    kept.length > 0
      ? kept.map(([amount, label]) => `${formatNumber(amount)}${label}`)
      : [`0${labels.copper}`];

  return `${parts.negative ? "-" : ""}${segments.join(" ")}`;
};

/* ------------------------------------------------------------------ */
/* Time                                                                */
/* ------------------------------------------------------------------ */

type RelativeUnit = {
  unit: Intl.RelativeTimeFormatUnit;
  ms: number;
  /** Switch to the next unit once the delta reaches this many ms. */
  limit: number;
};

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const RELATIVE_UNITS: RelativeUnit[] = [
  { unit: "second", ms: SECOND, limit: 45 * SECOND },
  { unit: "minute", ms: MINUTE, limit: 45 * MINUTE },
  { unit: "hour", ms: HOUR, limit: 22 * HOUR },
  { unit: "day", ms: DAY, limit: 7 * DAY },
  { unit: "week", ms: WEEK, limit: 26 * DAY },
  { unit: "month", ms: MONTH, limit: 11 * MONTH },
  { unit: "year", ms: YEAR, limit: Number.POSITIVE_INFINITY },
];

const toTimestamp = (value: Date | number | string): number =>
  value instanceof Date ? value.getTime() : new Date(value).getTime();

/**
 * "just now", "5 minutes ago", "in 2 hours", "yesterday" for a date
 * relative to `now` (defaults to the current time).
 */
export const formatRelativeTime = (
  date: Date | number | string | null | undefined,
  now: Date | number = Date.now(),
): string => {
  if (date === null || date === undefined) {
    return "—";
  }

  const target = toTimestamp(date);
  const reference = toTimestamp(now);
  if (Number.isNaN(target) || Number.isNaN(reference)) {
    return "—";
  }

  const delta = target - reference;
  const distance = Math.abs(delta);

  if (distance < 45 * SECOND) {
    return "just now";
  }

  const { unit, ms } =
    RELATIVE_UNITS.find((entry) => distance < entry.limit) ??
    RELATIVE_UNITS[RELATIVE_UNITS.length - 1];
  const amount = Math.round(delta / ms);

  try {
    return new Intl.RelativeTimeFormat(toBcp47(env.locale), {
      numeric: "auto",
    }).format(amount, unit);
  } catch {
    const magnitude = Math.abs(amount);
    const label = `${magnitude} ${unit}${magnitude === 1 ? "" : "s"}`;
    return delta < 0 ? `${label} ago` : `in ${label}`;
  }
};

const MINUS = "−";

const formatUtcOffset = (offsetMinutes: number): string => {
  const sign = offsetMinutes < 0 ? MINUS : "+";
  const magnitude = Math.abs(offsetMinutes);
  const hours = Math.floor(magnitude / 60);
  const minutes = magnitude % 60;

  if (magnitude === 0) {
    return "UTC+0";
  }

  return `UTC${sign}${hours}${
    minutes > 0 ? `:${String(minutes).padStart(2, "0")}` : ""
  }`;
};

const UTC_ALIASES: ReadonlySet<string> = new Set(["UTC", "GMT", "Zulu", "UCT"]);

/** Offset of `timeZone` from UTC at `at`, in minutes; undefined if unknown. */
const utcOffsetMinutes = (
  timeZone: string,
  at: Date,
): number | undefined => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(at);
    const read = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(parts.find((part) => part.type === type)?.value ?? "0");
    const asUtc = Date.UTC(
      read("year"),
      read("month") - 1,
      read("day"),
      read("hour") % 24,
      read("minute"),
      read("second"),
    );
    const truncated = Math.floor(at.getTime() / SECOND) * SECOND;

    return Math.round((asUtc - truncated) / MINUTE);
  } catch {
    return undefined;
  }
};

const timezoneCity = (iana: string): string => {
  const segment = iana.split("/").pop() ?? iana;
  return segment.replace(/_/g, " ");
};

/** "America/Los_Angeles" → "Los Angeles (UTC−7)" (offset as of `at`). */
export const formatTimezone = (
  iana: string | null | undefined,
  at: Date = new Date(),
): string => {
  const value = (iana ?? "").trim();
  if (value.length === 0) {
    return "—";
  }

  const city = timezoneCity(value);
  if (UTC_ALIASES.has(city)) {
    return "UTC";
  }

  const offset = utcOffsetMinutes(value, at);

  return offset === undefined ? city : `${city} (${formatUtcOffset(offset)})`;
};

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

/** "VERY_LONG" → "Very long", "item-class" → "Item class", "isPvp" → "Is pvp". */
export const humanizeEnum = (value: string | null | undefined): string => {
  const words = (value ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-\s]+/g, " ")
    .trim()
    .toLowerCase();

  return words.length > 0 ? `${words[0].toUpperCase()}${words.slice(1)}` : "";
};
