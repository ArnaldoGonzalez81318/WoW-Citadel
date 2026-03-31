import { useEffect, useRef } from "react"

type UseInfiniteScrollTriggerOptions = {
  enabled?: boolean
  hasMore?: boolean
  isLoading?: boolean
  onLoadMore: () => void
  rootMargin?: string
}

const useInfiniteScrollTrigger = ({
  enabled = true,
  hasMore = false,
  isLoading = false,
  onLoadMore,
  rootMargin = "900px 0px",
}: UseInfiniteScrollTriggerOptions): React.RefObject<HTMLDivElement> => {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const wasIntersectingRef = useRef(false)

  useEffect(() => {
    wasIntersectingRef.current = false

    if (!enabled || !hasMore || isLoading) {
      return
    }

    const node = sentinelRef.current

    if (!node || typeof IntersectionObserver === "undefined") {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        const isIntersecting = Boolean(entry?.isIntersecting)

        if (!isIntersecting) {
          wasIntersectingRef.current = false
          return
        }

        if (wasIntersectingRef.current) {
          return
        }

        wasIntersectingRef.current = true
        onLoadMore()
      },
      {
        rootMargin,
        threshold: 0.01,
      }
    )

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [enabled, hasMore, isLoading, onLoadMore, rootMargin])

  return sentinelRef
}

export default useInfiniteScrollTrigger