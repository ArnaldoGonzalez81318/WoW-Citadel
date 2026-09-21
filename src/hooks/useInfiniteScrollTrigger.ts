import { useEffect, useRef } from "react";
import type { RefObject } from "react";

export type UseInfiniteScrollTriggerOptions = {
  enabled?: boolean;
  hasMore?: boolean;
  isLoading?: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
};

/**
 * Returns a ref for a sentinel element; `onLoadMore` fires once each time the
 * sentinel scrolls into the root margin while more pages are available.
 *
 * The callback is read through a ref so a new `onLoadMore` identity on every
 * render does not tear down and recreate the IntersectionObserver.
 */
const useInfiniteScrollTrigger = ({
  enabled = true,
  hasMore = false,
  isLoading = false,
  onLoadMore,
  rootMargin = "900px 0px",
}: UseInfiniteScrollTriggerOptions): RefObject<HTMLDivElement> => {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const wasIntersectingRef = useRef(false);
  const onLoadMoreRef = useRef(onLoadMore);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    wasIntersectingRef.current = false;

    if (!enabled || !hasMore || isLoading) {
      return undefined;
    }

    const node = sentinelRef.current;

    if (!node || typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        const isIntersecting = Boolean(entry?.isIntersecting);

        if (!isIntersecting) {
          wasIntersectingRef.current = false;
          return;
        }

        if (wasIntersectingRef.current) {
          return;
        }

        wasIntersectingRef.current = true;
        onLoadMoreRef.current();
      },
      {
        rootMargin,
        threshold: 0.01,
      },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [enabled, hasMore, isLoading, rootMargin]);

  return sentinelRef;
};

export default useInfiniteScrollTrigger;
