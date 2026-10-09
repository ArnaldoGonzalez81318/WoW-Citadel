import { useState } from "react";

type QueryLike = {
  error: Error | null;
  isPending: boolean;
  isFetching: boolean;
};

/**
 * A query's error, kept while a Retry runs. With no data to show,
 * react-query resets a refetching query to "pending" with no error, which
 * would swap the alert (and the Retry button that has focus) for a
 * skeleton; this keeps the last error on screen until the retry settles.
 */
export const useStickyError = ({ error, isPending, isFetching }: QueryLike): Error | null => {
  const [last, setLast] = useState<Error | null>(null);
  if (error !== null && error !== last) {
    setLast(error);
  } else if (error === null && !isPending && last !== null) {
    setLast(null);
  }
  if (error !== null) {
    return error;
  }
  return isPending && isFetching ? last : null;
};

export default useStickyError;
