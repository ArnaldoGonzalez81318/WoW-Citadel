import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react"

export type PerformanceOverlayEntry = {
  id: string
  label: string
  renderedCount?: number
  totalCount?: number
  enrichmentCount?: number
  notes?: string
}

type PerformanceOverlayActions = {
  setEntry: (entry: PerformanceOverlayEntry) => void
  removeEntry: (id: string) => void
}

const PerformanceOverlayEntriesContext = createContext<PerformanceOverlayEntry[] | undefined>(undefined)
const PerformanceOverlayActionsContext = createContext<PerformanceOverlayActions | undefined>(undefined)

export const PerformanceOverlayProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const [entries, setEntries] = useState<PerformanceOverlayEntry[]>([])

  const setEntry = useCallback((entry: PerformanceOverlayEntry) => {
    setEntries((current) => {
      const existing = current.find((candidate) => candidate.id === entry.id)
      if (
        existing &&
        existing.label === entry.label &&
        existing.renderedCount === entry.renderedCount &&
        existing.totalCount === entry.totalCount &&
        existing.enrichmentCount === entry.enrichmentCount &&
        existing.notes === entry.notes
      ) {
        return current
      }

      const next = current.filter((candidate) => candidate.id !== entry.id)
      return [...next, entry]
    })
  }, [])

  const removeEntry = useCallback((id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id))
  }, [])

  const actions = useMemo(
    () => ({
      setEntry,
      removeEntry,
    }),
    [removeEntry, setEntry]
  )

  return (
    <PerformanceOverlayActionsContext.Provider value={actions}>
      <PerformanceOverlayEntriesContext.Provider value={entries}>{children}</PerformanceOverlayEntriesContext.Provider>
    </PerformanceOverlayActionsContext.Provider>
  )
}

const usePerformanceOverlayActions = (): PerformanceOverlayActions | null => {
  const context = useContext(PerformanceOverlayActionsContext)
  return context ?? null
}

export const usePerformanceOverlayEntry = (entry: PerformanceOverlayEntry | null): void => {
  const actions = usePerformanceOverlayActions()
  const entryId = entry?.id

  useEffect(() => {
    if (!actions || !entry) {
      return
    }

    actions.setEntry(entry)

    return undefined
  }, [actions, entry])

  useEffect(() => {
    if (!actions || !entryId) {
      return
    }

    return () => {
      actions.removeEntry(entryId)
    }
  }, [actions, entryId])
}

export const usePerformanceOverlayEntries = (): PerformanceOverlayEntry[] => {
  const entries = useContext(PerformanceOverlayEntriesContext)
  return entries ?? []
}