import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { PropsWithChildren } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useRecentSearches } from "@/features/search/hooks/useRecentSearches";
import useDebouncedValue from "@/hooks/useDebouncedValue";
import { useSearchParamState } from "@/hooks/useSearchParamState";

/** Routes that render search results and therefore own `?q=` themselves. */
export const SEARCH_ROUTES = ["/search", "/category/creatures"] as const;

const SEARCH_RESULTS_PATH = "/search";
const MIN_QUERY_LENGTH = 2;
const DRAFT_DEBOUNCE_MS = 350;

export const searchUrl = (term: string): string =>
  `${SEARCH_RESULTS_PATH}?q=${encodeURIComponent(term)}`;

export interface SearchState {
  /** What the search inputs show: the URL `q` on a search route, else the header draft. */
  query: string;
  setQuery: (value: string) => void;
  /** Enter / search button: records the term and lands on results. */
  submitQuery: (value: string) => void;
  clearQuery: () => void;
  isSearchRoute: boolean;
  recentSearches: string[];
  /** Records a settled, successful search (the results page calls this). */
  pushRecentSearch: (term: string) => void;
  removeRecentSearch: (term: string) => void;
  clearRecentSearches: () => void;
}

const SearchContext = createContext<SearchState | undefined>(undefined);

/**
 * Global search state. Mounted under the router (RootLayout), so on a search
 * route the URL is the source of truth; elsewhere typing in the header
 * builds a draft that lands on `/search?q=` once it is long enough.
 */
export const SearchProvider = ({
  children,
}: PropsWithChildren): JSX.Element => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [urlQuery, setUrlQuery] = useSearchParamState("q");
  const {
    recent: recentSearches,
    push: pushRecent,
    remove: removeRecentSearch,
    clear: clearRecentSearches,
  } = useRecentSearches();

  const isSearchRoute = (SEARCH_ROUTES as readonly string[]).includes(pathname);
  const [draft, setDraft] = useState("");
  const debouncedDraft = useDebouncedValue(draft, DRAFT_DEBOUNCE_MS);

  const query = isSearchRoute ? urlQuery : draft;

  const setQuery = useCallback(
    (value: string) => {
      if (isSearchRoute) {
        setUrlQuery(value || null, { replace: true });
      } else {
        setDraft(value);
      }
    },
    [isSearchRoute, setUrlQuery],
  );

  // Typing in the header anywhere else lands on the results page.
  useEffect(() => {
    if (isSearchRoute) {
      return;
    }
    const term = debouncedDraft.trim();
    if (term.length < MIN_QUERY_LENGTH) {
      return;
    }
    navigate(searchUrl(term));
    setDraft("");
  }, [debouncedDraft, isSearchRoute, navigate]);

  const submitQuery = useCallback(
    (value: string) => {
      const term = value.trim();
      if (!term) {
        setQuery("");
        return;
      }

      pushRecent(term);

      if (pathname === SEARCH_RESULTS_PATH) {
        if (urlQuery.trim() !== term) {
          setUrlQuery(term);
        }
        return;
      }

      if (isSearchRoute) {
        // A category search page (creatures) keeps its own grid; never redirect it.
        setUrlQuery(term);
        return;
      }

      setDraft("");
      navigate(searchUrl(term));
    },
    [isSearchRoute, navigate, pathname, pushRecent, setQuery, setUrlQuery, urlQuery],
  );

  const clearQuery = useCallback(() => setQuery(""), [setQuery]);

  const value = useMemo<SearchState>(
    () => ({
      query,
      setQuery,
      submitQuery,
      clearQuery,
      isSearchRoute,
      recentSearches,
      pushRecentSearch: pushRecent,
      removeRecentSearch,
      clearRecentSearches,
    }),
    [
      query,
      setQuery,
      submitQuery,
      clearQuery,
      isSearchRoute,
      recentSearches,
      pushRecent,
      removeRecentSearch,
      clearRecentSearches,
    ],
  );

  return (
    <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
  );
};

export const useSearchState = (): SearchState => {
  const context = useContext(SearchContext);

  if (!context) {
    throw new Error("useSearchState must be used within a SearchProvider");
  }

  return context;
};
