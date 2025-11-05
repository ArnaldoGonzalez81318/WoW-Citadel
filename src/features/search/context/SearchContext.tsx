import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useState } from "react"

interface SearchState {
  query: string
  setQuery: (value: string) => void
}

const SearchContext = createContext<SearchState | undefined>(undefined)

export const SearchProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const [query, setQueryState] = useState<string>("")

  const setQuery = useCallback((value: string) => {
    setQueryState(value)
  }, [])

  const value = useMemo(
    () => ({
      query,
      setQuery,
    }),
    [query, setQuery]
  )

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}

export const useSearchState = (): SearchState => {
  const context = useContext(SearchContext)

  if (!context) {
    throw new Error("useSearchState must be used within a SearchProvider")
  }

  return context
}
