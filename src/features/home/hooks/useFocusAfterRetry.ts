import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * Where focus goes when a successful Retry removes the alert that held it:
 * to `targetRef` (the content that took the alert's place) once `ready`.
 * Only when focus fell to the page with the alert, never away from where
 * the viewer has since moved it. Returns a wrapper for the Retry handler.
 *
 * `shownError` is the error the panel's alert shows (null when none).
 * useStickyError keeps that object while a retry runs and hands back a new
 * one only when the retry fails, so a new error drops the pending move: a
 * later success (another Retry, a background refetch) never pulls focus to
 * the tiles unprompted.
 */
const useFocusAfterRetry = (
  targetRef: RefObject<HTMLElement>,
  ready: boolean,
  shownError: unknown,
): ((retry: () => void) => () => void) => {
  /** The error on screen when Retry was pressed; null when no move is pending. */
  const pendingRef = useRef<{ error: unknown } | null>(null);

  useEffect(() => {
    const pending = pendingRef.current;
    if (pending !== null && shownError !== null && shownError !== pending.error) {
      pendingRef.current = null;
    }
  }, [shownError]);

  useEffect(() => {
    if (!ready || pendingRef.current === null) {
      return;
    }
    pendingRef.current = null;
    const active = document.activeElement;
    if (active === null || active === document.body) {
      targetRef.current?.focus({ preventScroll: true });
    }
  }, [ready, targetRef]);

  return useCallback(
    (retry: () => void) => () => {
      pendingRef.current = { error: shownError };
      retry();
    },
    [shownError],
  );
};

export default useFocusAfterRetry;
