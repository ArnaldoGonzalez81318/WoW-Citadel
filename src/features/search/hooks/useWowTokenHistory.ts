import { useCallback, useEffect, useState } from "react";

import type { WowTokenPrice } from "@/features/search/services/tokenService";
import { env } from "@/lib/env";

export const TOKEN_HISTORY_KEY = `wc:token-history:${env.region}`;
export const MAX_TOKEN_HISTORY_POINTS = 200;

export type TokenHistoryPoint = {
  /** Blizzard's `last_updated_timestamp` in ms. */
  t: number;
  /** Price in copper. */
  price: number;
};

export interface WowTokenHistory {
  /** Oldest first, deduplicated on `t`. */
  points: TokenHistoryPoint[];
  clear: () => void;
}

const isPoint = (value: unknown): value is TokenHistoryPoint =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as TokenHistoryPoint).t === "number" &&
  Number.isFinite((value as TokenHistoryPoint).t) &&
  typeof (value as TokenHistoryPoint).price === "number" &&
  Number.isFinite((value as TokenHistoryPoint).price);

/** Sorted, deduplicated on `t`, capped to the newest samples. */
const normalize = (value: unknown): TokenHistoryPoint[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const byTime = new Map<number, TokenHistoryPoint>();
  value.forEach((entry) => {
    if (isPoint(entry)) {
      byTime.set(entry.t, { t: entry.t, price: entry.price });
    }
  });
  return [...byTime.values()]
    .sort((left, right) => left.t - right.t)
    .slice(-MAX_TOKEN_HISTORY_POINTS);
};

const readStorage = (): TokenHistoryPoint[] => {
  try {
    const raw = window.localStorage.getItem(TOKEN_HISTORY_KEY);
    return raw ? normalize(JSON.parse(raw) as unknown) : [];
  } catch {
    return [];
  }
};

const writeStorage = (points: TokenHistoryPoint[]): void => {
  try {
    if (points.length === 0) {
      window.localStorage.removeItem(TOKEN_HISTORY_KEY);
    } else {
      window.localStorage.setItem(TOKEN_HISTORY_KEY, JSON.stringify(points));
    }
  } catch {
    // Storage may be unavailable (private mode, quota); memory still works.
  }
};

const samePoints = (
  left: TokenHistoryPoint[],
  right: TokenHistoryPoint[],
): boolean =>
  left.length === right.length &&
  left.every(
    (point, index) =>
      point.t === right[index].t && point.price === right[index].price,
  );

/**
 * Session price history for the WoW Token: every distinct Blizzard
 * "last updated" sample seen while the app is open, persisted per region in
 * localStorage and synced across tabs via the `storage` event.
 */
export const useWowTokenHistory = (data?: WowTokenPrice): WowTokenHistory => {
  const [points, setPoints] = useState<TokenHistoryPoint[]>(readStorage);

  useEffect(() => {
    const handleStorage = (event: StorageEvent): void => {
      if (event.key !== null && event.key !== TOKEN_HISTORY_KEY) {
        return;
      }
      const next = readStorage();
      setPoints((current) => (samePoints(current, next) ? current : next));
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const sampleTime = data?.lastUpdated.getTime();
  const samplePrice = data?.price;

  useEffect(() => {
    if (
      typeof sampleTime !== "number" ||
      !Number.isFinite(sampleTime) ||
      typeof samplePrice !== "number" ||
      !Number.isFinite(samplePrice)
    ) {
      return;
    }
    setPoints((current) => {
      if (current.some((point) => point.t === sampleTime)) {
        return current;
      }
      const next = normalize([...current, { t: sampleTime, price: samplePrice }]);
      writeStorage(next);
      return next;
    });
  }, [sampleTime, samplePrice]);

  const clear = useCallback(() => {
    writeStorage([]);
    setPoints([]);
  }, []);

  return { points, clear };
};

export default useWowTokenHistory;
