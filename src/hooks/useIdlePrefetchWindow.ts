import { useEffect, useRef, useState } from "react";

export type UseIdlePrefetchWindowOptions = {
  totalCount: number;
  /** Window size when a new dataset arrives. */
  initialCount?: number;
  /** Minimum growth per idle tick. */
  batchSize?: number;
  /**
   * Identifies the dataset (filters, query, class/subclass), never its length
   * or page count: encoding page count re-ramps enrichment on every load-more.
   */
  resetKey?: string;
  /** Visible end index reported by the grid; the window jumps to cover it on the next tick. */
  targetCount?: number;
  /** Cap on growth per tick, default `batchSize * 4`. */
  maxBatchSize?: number;
};

const IDLE_TIMEOUT_MS = 450;
const FALLBACK_DELAY_MS = 150;

/**
 * Grows a "how many items may enrich themselves" window during idle time.
 *
 * - Starts at `initialCount` for each new `resetKey` (or when data first
 *   arrives, 0 -> N, under the same key) and never regresses when
 *   `totalCount` grows through load-more.
 * - Each idle tick grows geometrically (12, 18, 27, 41, 62, ...) bounded by
 *   `batchSize` and `maxBatchSize`, and always covers `targetCount` first so
 *   what is on screen enriches before what is not.
 *
 * `resetKey` must identify the dataset (filters, query, class/subclass), never
 * its length or page count — encoding page count re-ramps enrichment on every
 * load-more.
 */
const useIdlePrefetchWindow = ({
  totalCount,
  initialCount = 12,
  batchSize = 6,
  resetKey = "",
  targetCount,
  maxBatchSize = batchSize * 4,
}: UseIdlePrefetchWindowOptions): number => {
  const [activeCount, setActiveCount] = useState(() =>
    Math.min(totalCount, initialCount),
  );
  const lastResetKey = useRef(resetKey);
  // Read through a ref inside the tick so scroll-driven target updates do not
  // cancel and re-arm the pending idle callback (which would stall growth
  // during a sustained scroll). The effect only re-runs when the target
  // actually exceeds the current window.
  const targetRef = useRef(targetCount);
  targetRef.current = targetCount;
  const needsJump = Math.min(totalCount, targetCount ?? 0) > activeCount;

  useEffect(() => {
    const keyChanged = lastResetKey.current !== resetKey;
    lastResetKey.current = resetKey;
    setActiveCount((current) =>
      keyChanged
        ? // New dataset: start small.
          Math.min(totalCount, initialCount)
        : // Growth (load-more) never regresses the window; 0 -> N after a
          // filter change still gets initialCount.
          Math.min(totalCount, Math.max(current, initialCount)),
    );
  }, [initialCount, resetKey, totalCount]);

  useEffect(() => {
    if (activeCount >= totalCount) {
      return undefined;
    }

    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const expand = (): void => {
      if (cancelled) {
        return;
      }
      setActiveCount((current) => {
        const proportional = Math.ceil(current / 2);
        const step = Math.min(maxBatchSize, Math.max(batchSize, proportional));
        const target = Math.min(totalCount, targetRef.current ?? 0);
        return Math.min(totalCount, Math.max(current + step, target));
      });
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(expand, { timeout: IDLE_TIMEOUT_MS });
    } else {
      timeoutId = setTimeout(expand, FALLBACK_DELAY_MS);
    }

    return () => {
      cancelled = true;
      if (
        idleId !== undefined &&
        typeof window !== "undefined" &&
        "cancelIdleCallback" in window
      ) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [activeCount, batchSize, maxBatchSize, needsJump, totalCount]);

  return activeCount;
};

export default useIdlePrefetchWindow;
