import { useCallback, useEffect, useRef, useState } from "react";

export const COPIED_STATUS_MS = 2000;

export type CopyToClipboard<K extends string = "default"> = {
  /** Which value was copied in the last two seconds, or `null`. */
  copied: K | null;
  copy: (value: string, kind?: K) => void;
};

/**
 * Copies to the clipboard and reports which `kind` was copied for two
 * seconds. Silently no-ops when the Clipboard API is unavailable (insecure
 * context) or the write is refused.
 */
export const useCopyToClipboard = <K extends string = "default">(): CopyToClipboard<K> => {
  const [copied, setCopied] = useState<K | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    },
    [],
  );

  const copy = useCallback((value: string, kind?: K) => {
    navigator.clipboard
      ?.writeText(value)
      .then(() => {
        setCopied(kind ?? ("default" as K));
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
        }
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          setCopied(null);
        }, COPIED_STATUS_MS);
      })
      .catch(() => undefined);
  }, []);

  return { copied, copy };
};

export default useCopyToClipboard;
