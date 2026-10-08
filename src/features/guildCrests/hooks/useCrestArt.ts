import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { crestMediaQuery } from "@/features/guildCrests/hooks/guildCrestQueries";
import { crestPartUrl } from "@/features/guildCrests/services/guildCrestService";
import type { CrestPart, CrestPartKind } from "@/features/guildCrests/types";

export type CrestArt = {
  /** The URL to draw; undefined while the fallback loads, or when there is none. */
  src: string | undefined;
  /** The derived URL failed and the media record is on its way. */
  loading: boolean;
  /** Neither the derived URL nor the media record gave a drawable image. */
  missing: boolean;
  /** Wire to the image's onError. */
  onError: () => void;
  /** Forget the failed URLs (and refetch a failed media record) and try again. */
  retry: () => void;
};

const NO_FAILURES: ReadonlySet<string> = new Set();

/**
 * An emblem's or border's art: the derived URL first (no request), then,
 * only if that image fails to load, the URL from its media record. Failures
 * are remembered per URL, so switching parts never inherits another part's
 * failure, and a media record pointing at the same broken file ends in
 * `missing` instead of a loop.
 */
const useCrestArt = (
  kind: CrestPartKind,
  part: CrestPart | undefined,
): CrestArt => {
  const derived = part ? crestPartUrl(kind, part.mediaId) : undefined;
  const [failed, setFailed] = useState<ReadonlySet<string>>(NO_FAILURES);
  const derivedFailed = derived !== undefined && failed.has(derived);

  const media = useQuery({
    ...crestMediaQuery(kind, part?.mediaId ?? 0),
    enabled: derivedFailed,
  });
  const fallback = media.data ?? undefined;

  let src: string | undefined;
  if (derived !== undefined && !derivedFailed) {
    src = derived;
  } else if (fallback !== undefined && !failed.has(fallback)) {
    src = fallback;
  }
  const loading = src === undefined && derivedFailed && media.isPending;

  const onError = useCallback(() => {
    if (src === undefined) {
      return;
    }
    setFailed((previous) =>
      previous.has(src) ? previous : new Set(previous).add(src),
    );
  }, [src]);

  // Re-enabling an errored media query refetches it on its own.
  const retry = useCallback(() => setFailed(NO_FAILURES), []);

  return {
    src,
    loading,
    missing: src === undefined && !loading,
    onError,
    retry,
  };
};

export default useCrestArt;
