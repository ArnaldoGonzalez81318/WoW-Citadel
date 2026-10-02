/** The global results page. */
export const SEARCH_RESULTS_PATH = "/search";

/** Routes that render search results and therefore own `?q=` themselves. */
export const SEARCH_ROUTES = [SEARCH_RESULTS_PATH, "/category/creatures"] as const;

export const isSearchRoutePath = (pathname: string): boolean =>
  (SEARCH_ROUTES as readonly string[]).includes(pathname);

/**
 * `/search?q=term`, plus `&cat=` when given. Callers omit the default
 * category (items) when they want canonical URLs.
 */
export const searchUrl = (term: string, cat?: string): string =>
  `${SEARCH_RESULTS_PATH}?q=${encodeURIComponent(term)}${
    cat ? `&cat=${encodeURIComponent(cat)}` : ""
  }`;
