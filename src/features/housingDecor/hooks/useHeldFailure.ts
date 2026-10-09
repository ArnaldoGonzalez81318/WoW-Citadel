import { useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

export type HeldFailure = {
  /** The query has no data and its last attempt failed (or a Retry of it is running). */
  failed: boolean;
  /** A Retry is running. */
  retrying: boolean;
  /** The last error, kept through a Retry. */
  error: unknown;
  /** Refetches unless an attempt is already running (refetch() would restart it). */
  retry: () => void;
};

/**
 * A Retry puts a query with no data back to pending and clears its error
 * (query-core's fetchState), which would swap the error banner, and the
 * focused Retry button with it, for a skeleton. errorUpdateCount survives
 * it, so the banner stays up, saying "Retrying…", until the data lands.
 */
const useHeldFailure = (
  query: Pick<UseQueryResult<unknown>, "data" | "error" | "errorUpdateCount" | "fetchStatus" | "refetch">,
): HeldFailure => {
  const [heldError, setHeldError] = useState<unknown>(null);
  if (query.error !== null && query.error !== heldError) {
    setHeldError(query.error);
  }
  const failed = query.data === undefined && query.errorUpdateCount > 0;
  return {
    failed,
    retrying: failed && query.fetchStatus !== "idle",
    error: query.error ?? heldError,
    retry: () => {
      if (query.fetchStatus === "idle") {
        void query.refetch();
      }
    },
  };
};

export default useHeldFailure;
