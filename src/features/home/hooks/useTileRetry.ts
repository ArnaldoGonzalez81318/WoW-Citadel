import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

/** The parts of a `useQueries` result the retry reads. */
type TileQuery = {
  data: unknown;
  error: Error | null;
  isError: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
};

export type TileRetry = {
  /** Show the alert: some tiles failed, or a retry of them is still running. */
  visible: boolean;
  /** The failure to describe; kept while a retry runs. */
  error: Error | null;
  /** How many tiles the alert is about. */
  count: number;
  retry: () => void;
  /** "… details loaded" after a successful retry, for the panel's live region. */
  announcement: string;
  /** The tile list, which takes focus when the alert holding it goes away. */
  listRef: RefObject<HTMLUListElement>;
  /** Spread on the alert's wrapper, to know whether focus is inside it. */
  alertFocusProps: {
    onFocus: () => void;
    onBlur: (event: { relatedTarget: EventTarget | null; currentTarget: HTMLElement }) => void;
  };
};

const NONE: readonly number[] = [];

/**
 * One Retry for every tile of a panel whose details failed to load.
 *
 * A Button's `loading` or `disabled` prop would drop the focus the viewer
 * just put on it, and react-query resets a refetching query with no data to
 * "pending" with no error, which would unmount the alert mid-retry. So the
 * failed indexes are derived on every render, the ones being retried are
 * remembered, and the alert stays while any of them is still fetching; the
 * last error is kept in state (set during render, as useStickyError does)
 * for the alert to describe meanwhile. When a retry succeeds and the alert
 * goes away while it held focus, focus moves to the tile list rather than
 * falling back to the page.
 */
const useTileRetry = (
  results: readonly TileQuery[],
  successMessage: string,
): TileRetry => {
  const failed = results.flatMap((result, index) =>
    result.isError && result.data === undefined ? [index] : [],
  );
  const [retrying, setRetrying] = useState<readonly number[]>(NONE);
  const busy = retrying.some((index) => results[index]?.isFetching === true);
  const visible = failed.length > 0 || busy;

  const currentError = failed.length > 0 ? (results[failed[0]].error ?? null) : null;
  const [lastError, setLastError] = useState<Error | null>(null);
  if (currentError !== null && currentError !== lastError) {
    setLastError(currentError);
  } else if (!visible && lastError !== null) {
    setLastError(null);
  }
  const error = currentError ?? (busy ? lastError : null);

  const [announcement, setAnnouncement] = useState("");
  const listRef = useRef<HTMLUListElement>(null);
  const focusInAlertRef = useRef(false);

  const retry = (): void => {
    // Already retrying: the failed tiles are pending again, nothing to add.
    if (failed.length === 0) {
      return;
    }
    setAnnouncement("");
    setRetrying(failed);
    failed.forEach((index) => {
      void results[index].refetch();
    });
  };

  const wasVisibleRef = useRef(visible);
  useEffect(() => {
    const wasVisible = wasVisibleRef.current;
    wasVisibleRef.current = visible;
    if (!wasVisible || visible) {
      return;
    }
    if (retrying.length > 0) {
      setRetrying(NONE);
      setAnnouncement(successMessage);
    }
    if (focusInAlertRef.current) {
      focusInAlertRef.current = false;
      // Only if focus went down with the alert; never pull it from where the viewer moved it.
      const active = document.activeElement;
      if (active === null || active === document.body) {
        listRef.current?.focus({ preventScroll: true });
      }
    }
  }, [visible, retrying.length, successMessage]);

  const onFocus = useCallback(() => {
    focusInAlertRef.current = true;
  }, []);
  /*
   * A blur towards another element is the viewer moving on. A blur towards
   * nothing is the alert being removed under the focus (or the window losing
   * it), which is exactly the case to recover from, so it keeps the flag.
   */
  const onBlur = useCallback(
    (event: { relatedTarget: EventTarget | null; currentTarget: HTMLElement }) => {
      const next = event.relatedTarget;
      if (next instanceof Node && !event.currentTarget.contains(next)) {
        focusInAlertRef.current = false;
      }
    },
    [],
  );

  return {
    visible,
    error,
    count: failed.length > 0 ? failed.length : retrying.length,
    retry,
    announcement,
    listRef,
    alertFocusProps: { onFocus, onBlur },
  };
};

export default useTileRetry;
