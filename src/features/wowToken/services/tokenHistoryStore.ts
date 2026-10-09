import { REGIONS } from "@/features/regions/hooks/regionQueries";
import {
  MAX_TOKEN_HISTORY_POINTS,
  TOKEN_HISTORY_KEY,
} from "@/features/search/hooks/useWowTokenHistory";
import type {
  Region,
  TokenHistories,
  TokenHistoryPoint,
} from "@/features/wowToken/types";
import { env } from "@/lib/env";

/*
 * Blizzard's API returns only the current token price, so the history is
 * whatever this browser has seen: one localStorage entry per region, in the
 * format the original token page wrote (a JSON array of `{ t, price }`,
 * oldest first, deduplicated on `t`, the newest 200 kept). The app's own
 * region keeps `TOKEN_HISTORY_KEY`, so prices collected before this page
 * existed carry straight over; the other three regions use the same key
 * pattern with their own suffix.
 *
 * A module-level store (read through `useSyncExternalStore`) rather than
 * per-component state: the hero, the region cards and the chart all read
 * the same arrays, and a write is made once, outside React's updaters, so
 * StrictMode's double-invoked updaters can never write twice.
 */

const KEY_PREFIX = "wc:token-history:";

export const historyKey = (region: Region): string =>
  region === env.region ? TOKEN_HISTORY_KEY : `${KEY_PREFIX}${region}`;

const EMPTY: readonly TokenHistoryPoint[] = [];

const isPoint = (value: unknown): value is TokenHistoryPoint => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { t, price } = value as Partial<TokenHistoryPoint>;
  return (
    typeof t === "number" &&
    Number.isFinite(t) &&
    typeof price === "number" &&
    Number.isFinite(price) &&
    price > 0
  );
};

/** Sorted, deduplicated on `t` (first seen wins), capped to the newest samples. */
const normalize = (value: unknown): TokenHistoryPoint[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const byTime = new Map<number, TokenHistoryPoint>();
  value.forEach((entry) => {
    if (isPoint(entry) && !byTime.has(entry.t)) {
      byTime.set(entry.t, { t: entry.t, price: entry.price });
    }
  });
  return [...byTime.values()]
    .sort((left, right) => left.t - right.t)
    .slice(-MAX_TOKEN_HISTORY_POINTS);
};

/** The stored prices, `[]` when none, `null` when storage cannot be read at all. */
const readStored = (region: Region): TokenHistoryPoint[] | null => {
  try {
    const raw = window.localStorage.getItem(historyKey(region));
    if (!raw) {
      return [];
    }
    try {
      return normalize(JSON.parse(raw) as unknown);
    } catch {
      // Corrupt JSON reads as empty; the next write replaces it.
      return [];
    }
  } catch {
    return null;
  }
};

const writeStored = (region: Region, points: readonly TokenHistoryPoint[]): void => {
  try {
    if (points.length === 0) {
      window.localStorage.removeItem(historyKey(region));
    } else {
      window.localStorage.setItem(historyKey(region), JSON.stringify(points));
    }
  } catch {
    // Storage may be unavailable (private mode, quota); memory still works.
  }
};

const samePoints = (
  left: readonly TokenHistoryPoint[],
  right: readonly TokenHistoryPoint[],
): boolean =>
  left.length === right.length &&
  left.every(
    (point, index) => point.t === right[index].t && point.price === right[index].price,
  );

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

let snapshot: TokenHistories | null = null;
const listeners = new Set<() => void>();

const load = (): TokenHistories =>
  Object.fromEntries(
    REGIONS.map((region) => [region, readStored(region) ?? EMPTY]),
  ) as Record<Region, readonly TokenHistoryPoint[]>;

export const getHistoriesSnapshot = (): TokenHistories => {
  if (snapshot === null) {
    snapshot = load();
  }
  return snapshot;
};

const setRegion = (region: Region, points: readonly TokenHistoryPoint[]): void => {
  const current = getHistoriesSnapshot();
  if (samePoints(current[region], points)) {
    return;
  }
  snapshot = { ...current, [region]: points };
  listeners.forEach((listener) => listener());
};

/** Another tab wrote (or cleared) a history: adopt what storage now holds. */
const handleStorage = (event: StorageEvent): void => {
  if (event.key === null) {
    REGIONS.forEach((region) => setRegion(region, readStored(region) ?? EMPTY));
    return;
  }
  const region = REGIONS.find((entry) => historyKey(entry) === event.key);
  if (region) {
    setRegion(region, readStored(region) ?? EMPTY);
  }
};

export const subscribeHistories = (listener: () => void): (() => void) => {
  if (listeners.size === 0) {
    window.addEventListener("storage", handleStorage);
    // Another tab may have written while nothing here was listening.
    REGIONS.forEach((region) => {
      const stored = readStored(region);
      if (stored) {
        setRegion(region, stored);
      }
    });
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", handleStorage);
    }
  };
};

/**
 * Adds one Blizzard sample to a region's history. The base is read from
 * storage at write time (falling back to memory when storage is
 * unavailable), so two open tabs append to each other's samples instead of
 * overwriting them.
 */
export const recordSample = (region: Region, sample: TokenHistoryPoint): void => {
  if (!isPoint(sample)) {
    return;
  }
  const stored = readStored(region);
  const base = stored ?? getHistoriesSnapshot()[region];
  if (base.some((point) => point.t === sample.t)) {
    setRegion(region, base);
    return;
  }
  const next = normalize([...base, sample]);
  writeStored(region, next);
  setRegion(region, next);
};

/**
 * Forgets a region's history except its newest price, which starts the new
 * one: that price is still the live one, and the next visit would record it
 * again anyway.
 */
export const clearHistory = (region: Region): void => {
  const current = readStored(region) ?? getHistoriesSnapshot()[region];
  const newest = current[current.length - 1];
  const next = newest ? [newest] : [];
  writeStored(region, next);
  setRegion(region, next);
};
