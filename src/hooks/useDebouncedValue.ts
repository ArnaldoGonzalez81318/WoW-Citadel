import { useEffect, useRef, useState } from "react";

export type UseDebouncedValueOptions<T> = {
  /**
   * Values that bypass the delay and propagate on the same render. By default
   * empty / blank strings, null and undefined are immediate so clearing a
   * search field empties its results without waiting.
   */
  isImmediate?: (value: T) => boolean;
};

const defaultIsImmediate = (value: unknown): boolean =>
  value === "" ||
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.trim() === "");

/**
 * Returns `value` after it has been stable for `delay` ms, except for
 * "immediate" values (see options) which are returned right away.
 *
 * Unmount cleanup clears the pending timer; a state hook cannot flush after
 * unmount, so a value still inside its delay window is simply dropped.
 */
const useDebouncedValue = <T>(
  value: T,
  delay = 400,
  options?: UseDebouncedValueOptions<T>,
): T => {
  const isImmediate = options?.isImmediate ?? defaultIsImmediate;
  const [debounced, setDebounced] = useState<T>(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const immediate = delay <= 0 || isImmediate(value);

  // Flush synchronously: React permits setState of the component being
  // rendered (render-phase adjustment), so consumers never see a stale
  // debounced value once `value` becomes immediate.
  if (immediate && !Object.is(debounced, value)) {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setDebounced(value);
  }

  useEffect(() => {
    if (immediate) {
      return undefined;
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setDebounced(value);
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [value, delay, immediate]);

  return immediate ? value : debounced;
};

export default useDebouncedValue;
