import { searchNameTerms } from "@/lib/blizzardHelpers";

/**
 * Blizzard's search analyser only matches whole tokens: `name.en_US=Azz`
 * finds nothing at all, and because repeated keys are ANDed, one half-typed
 * word empties an otherwise good query — "Warglaive of Azz" returns no
 * matches even though "Warglaive of Azzinoth" exists.
 *
 * A search therefore retries without that trailing fragment, asking for the
 * words the person has finished, and narrows the candidates here where
 * prefix matching is possible.
 */

/** The largest `_pageSize` the search endpoints accept. */
export const MAX_SEARCH_PAGE_SIZE = 100;

/**
 * Terms to retry `query` with: the required words minus the trailing one,
 * or `undefined` when there is no completed word left to search on.
 */
export const relaxedNameTerms = (
  query: string,
): readonly string[] | undefined => {
  const terms = searchNameTerms(query);
  return terms.length > 1 ? terms.slice(0, -1) : undefined;
};

const nameTokens = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^\p{L}\p{N}']+/u)
    .filter(Boolean);

/**
 * Either string starting the other counts as a hit: the typed word is still
 * being finished ("azz" against "azzinoth"), and Blizzard's analyser stems,
 * so it answers "warglaives" with names holding "warglaive".
 */
const wordMatchesToken = (word: string, token: string): boolean =>
  token.startsWith(word) || word.startsWith(token);

/** True when every required word of `query` matches a word of `name`. */
export const matchesTypedName = (name: string, query: string): boolean => {
  const tokens = nameTokens(name);
  return searchNameTerms(query).every((term) => {
    const needle = term.toLowerCase();
    return tokens.some((token) => wordMatchesToken(needle, token));
  });
};

export type NarrowedPage<T> = {
  results: T[];
  page: number;
  pageCount: number;
  total: number;
};

/**
 * Keeps the candidates whose name still matches everything typed and cuts the
 * requested page out of them. Candidates that only matched the completed words
 * are dropped, not offered as near misses: searching "Ashes of Al" would
 * otherwise answer with every creature called "Ash ...".
 *
 * Candidates come from one relevance-ranked request, so `total` counts the
 * matches among those; it is the number of results actually offered.
 */
export const narrowByTypedName = <T>(
  candidates: readonly T[],
  query: string,
  getName: (item: T) => string,
  { page, pageSize }: { page: number; pageSize: number },
): NarrowedPage<T> => {
  const matching = candidates.filter((item) =>
    matchesTypedName(getName(item), query),
  );
  const start = (page - 1) * pageSize;

  return {
    results: matching.slice(start, start + pageSize),
    page,
    pageCount: Math.max(1, Math.ceil(matching.length / pageSize)),
    total: matching.length,
  };
};
