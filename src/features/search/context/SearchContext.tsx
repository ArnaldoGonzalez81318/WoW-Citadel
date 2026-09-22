import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { PropsWithChildren } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  SEARCH_RESULTS_PATH,
  isSearchRoutePath,
  searchUrl,
} from "@/features/search/config/searchRoutes";
import { useRecentSearches } from "@/features/search/hooks/useRecentSearches";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";

/**
 * `q` and `page` are written together: a new query always starts on page 1,
 * and doing it in one navigation keeps history entries intact on Back/Forward.
 */
const URL_DEFAULTS: Record<"q" | "page", string> = { q: "", page: "" };

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
 * route the URL is the source of truth; elsewhere `query` is a plain draft.
 *
 * Typing never navigates by itself: the header field is a combobox whose
 * suggestions cover discovery, and only Enter, the search button or a
 * chosen suggestion (`submitQuery`) lands on `/search?q=`. Moving the URL
 * on a debounce would fight the open listbox and rewrite history while the
 * user is still typing.
 */
export const SearchProvider = ({
  children,
}: PropsWithChildren): JSX.Element => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [urlParams, setUrlParams] = useSearchParamsRecord(URL_DEFAULTS);
  const urlQuery = urlParams.q;
  const {
    recent: recentSearches,
    push: pushRecent,
    remove: removeRecentSearch,
    clear: clearRecentSearches,
  } = useRecentSearches();

  const isSearchRoute = isSearchRoutePath(pathname);
  const [draft, setDraft] = useState("");

  const query = isSearchRoute ? urlQuery : draft;

  const setQuery = useCallback(
    (value: string) => {
      if (isSearchRoute) {
        // Editing the query resets the page in the same navigation.
        setUrlParams({ q: value || null, page: null }, { replace: true });
      } else {
        setDraft(value);
      }
    },
    [isSearchRoute, setUrlParams],
  );

  const submitQuery = useCallback(
    (value: string) => {
      const term = value.trim();
      if (!term) {
        setQuery("");
        return;
      }

      pushRecent(term);

      // A submitted term starts the results over, so it lands at the top
      // like a fresh navigation (filters refining a page keep their scroll).
      const startOver = { preventScrollReset: false };

      if (pathname === SEARCH_RESULTS_PATH) {
        if (urlQuery.trim() !== term) {
          setUrlParams({ q: term, page: null }, startOver);
        }
        return;
      }

      if (isSearchRoute) {
        // A category search page (creatures) keeps its own grid; never redirect it.
        setUrlParams({ q: term, page: null }, startOver);
        return;
      }

      setDraft("");
      navigate(searchUrl(term));
    },
    [isSearchRoute, navigate, pathname, pushRecent, setQuery, setUrlParams, urlQuery],
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
