import { useEffect, useState } from "react"

type UseIdlePrefetchWindowOptions = {
  totalCount: number
  initialCount?: number
  batchSize?: number
  resetKey?: string
}

const useIdlePrefetchWindow = ({
  totalCount,
  initialCount = 12,
  batchSize = 6,
  resetKey = "",
}: UseIdlePrefetchWindowOptions): number => {
  const [activeCount, setActiveCount] = useState(() => Math.min(totalCount, initialCount))

  useEffect(() => {
    setActiveCount(Math.min(totalCount, initialCount))
  }, [initialCount, resetKey, totalCount])

  useEffect(() => {
    if (activeCount >= totalCount) {
      return
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let idleId: number | undefined
    let cancelled = false

    const expandWindow = () => {
      if (cancelled) {
        return
      }

      setActiveCount((current) => Math.min(totalCount, current + batchSize))
    }

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(expandWindow, { timeout: 450 })
    } else if (typeof globalThis !== "undefined") {
      timeoutId = globalThis.setTimeout(expandWindow, 150)
    }

    return () => {
      cancelled = true

      if (typeof idleId === "number" && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId)
      }

      if (timeoutId !== undefined) {
        globalThis.clearTimeout(timeoutId)
      }
    }
  }, [activeCount, batchSize, totalCount])

  return activeCount
}

export default useIdlePrefetchWindow