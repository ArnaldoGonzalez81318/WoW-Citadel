import { useCallback, useEffect, useRef, useState } from "react";

const STATUS_MS = 2000;

export type ClipboardStatus = {
  /** Which value the last copy was for (a URL, a path). */
  key: string;
  ok: boolean;
};

/**
 * Copies text and reports, for two seconds, whether it worked: the buttons
 * read "Copied" or "Copy failed", and a live region says the same. A
 * refused write (no Clipboard API off HTTPS, a denied permission) is shown
 * rather than swallowed, so nobody pastes a stale value.
 */
const useClipboardCopy = (): {
  status: ClipboardStatus | null;
  copy: (value: string, key: string) => void;
} => {
  const [status, setStatus] = useState<ClipboardStatus | null>(null);
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const report = useCallback((key: string, ok: boolean): void => {
    if (!mountedRef.current) {
      return;
    }
    setStatus({ key, ok });
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setStatus(null);
    }, STATUS_MS);
  }, []);

  const copy = useCallback(
    (value: string, key: string): void => {
      if (!navigator.clipboard?.writeText) {
        report(key, false);
        return;
      }
      navigator.clipboard.writeText(value).then(
        () => report(key, true),
        () => report(key, false),
      );
    },
    [report],
  );

  return { status, copy };
};

export default useClipboardCopy;
