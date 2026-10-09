import { useState } from "react";

/**
 * The error to keep on screen. A Retry puts a query that has no data back to
 * pending (react-query clears its error), which would swap the error block,
 * and the Retry button that has focus, for a skeleton. The last error of the
 * same `scope` (a query key) stays up while the retry is in flight instead;
 * a fresh failure replaces it, a success clears it.
 */
const useHeldError = (
  error: Error | null,
  isFetching: boolean,
  scope: string,
): Error | null => {
  const [held, setHeld] = useState<{ scope: string; error: Error } | null>(null);
  if (error !== null && (held === null || held.error !== error || held.scope !== scope)) {
    setHeld({ scope, error });
  }
  if (error !== null) {
    return error;
  }
  return held !== null && held.scope === scope && isFetching ? held.error : null;
};

export default useHeldError;
