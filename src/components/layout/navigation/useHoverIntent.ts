import { useTheme } from "@mui/material/styles";
import { useCallback, useEffect, useMemo, useRef } from "react";

export type UseHoverIntentOptions = {
  /** Delay before a hover opens a panel (defaults to `theme.wc.motion.fast`). */
  openDelay?: number;
  /** Grace period before the panel closes after the pointer leaves. */
  closeDelay?: number;
  onOpen: (id: string) => void;
  onClose: () => void;
};

export type HoverIntent = {
  scheduleOpen: (id: string) => void;
  cancelOpen: () => void;
  scheduleClose: () => void;
  cancelClose: () => void;
  clearAll: () => void;
};

const hoverIsUnavailable = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(hover: none)").matches;

/**
 * Two timers (open intent / close grace) so sweeping the pointer across a
 * row of triggers does not flash panels, and moving from a trigger into its
 * panel does not close it. On touch-only devices both delays are skipped.
 */
export const useHoverIntent = ({
  openDelay,
  closeDelay = 220,
  onOpen,
  onClose,
}: UseHoverIntentOptions): HoverIntent => {
  const theme = useTheme();
  const resolvedOpenDelay = openDelay ?? theme.wc.motion.fast;

  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  onOpenRef.current = onOpen;
  onCloseRef.current = onClose;

  const cancelOpen = useCallback((): void => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  }, []);

  const cancelClose = useCallback((): void => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleOpen = useCallback(
    (id: string): void => {
      cancelClose();
      cancelOpen();
      if (hoverIsUnavailable()) {
        onOpenRef.current(id);
        return;
      }
      openTimer.current = window.setTimeout(() => {
        openTimer.current = null;
        onOpenRef.current(id);
      }, resolvedOpenDelay);
    },
    [cancelClose, cancelOpen, resolvedOpenDelay],
  );

  const scheduleClose = useCallback((): void => {
    cancelOpen();
    cancelClose();
    if (hoverIsUnavailable()) {
      onCloseRef.current();
      return;
    }
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      onCloseRef.current();
    }, closeDelay);
  }, [cancelClose, cancelOpen, closeDelay]);

  const clearAll = useCallback((): void => {
    cancelOpen();
    cancelClose();
  }, [cancelClose, cancelOpen]);

  useEffect(() => clearAll, [clearAll]);

  return useMemo(
    () => ({ scheduleOpen, cancelOpen, scheduleClose, cancelClose, clearAll }),
    [scheduleOpen, cancelOpen, scheduleClose, cancelClose, clearAll],
  );
};

export default useHoverIntent;
