import { useMemo } from "react";

import { findSearchCategory } from "@/features/search/categories";
import type {
  CatalogEntry,
  CatalogKind,
} from "@/features/search/catalog/catalogSources";
import { useCatalogIndex } from "@/features/search/catalog/useCatalogIndex";
import type { SearchCategoryId } from "@/features/search/types";
import { MIN_FUZZY_QUERY_LENGTH, rankByName } from "@/lib/fuzzyMatch";

/**
 * The half of the suggestion list that can answer a half-typed or misspelled
 * name. Blizzard's search endpoints match whole, correctly spelled words only,
 * so the names that can be enumerated cheaply are held locally
 * (`useCatalogIndex`) and ranked here on every keystroke; the live search then
 * fills in everything the catalogue cannot hold.
 */

export type CatalogSuggestion = {
  /** Unique across the whole listbox, live rows included. */
  id: string;
  entryId: number;
  /** The full catalogue name, which is what makes the follow-up search work. */
  name: string;
  kind: CatalogKind;
  /** Category whose results the suggestion opens. */
  categoryId: SearchCategoryId;
  categoryLabel: string;
};

export type CatalogSuggestionsOptions = {
  /**
   * Whether to hold the catalogue at all. `false` also keeps `ready` false:
   * there is no index to be ready.
   */
  enabled?: boolean;
  /** Across every category, not per category. */
  limit?: number;
};

export type CatalogSuggestionsState = {
  suggestions: CatalogSuggestion[];
  /** The index has settled, so an empty `suggestions` really means no match. */
  ready: boolean;
};

/** Enough to fill the panel without crowding the live results out of it. */
const DEFAULT_LIMIT = 8;

type CatalogRoute = {
  categoryId: SearchCategoryId;
  categoryLabel: string;
};

const routeTo = (categoryId: SearchCategoryId): CatalogRoute => ({
  categoryId,
  // The label belongs to the category, not to this list: a suggestion has to
  // sit under the same group header as the live results it joins.
  categoryLabel: findSearchCategory(categoryId)?.label ?? categoryId,
});

/**
 * Where a catalogue kind's suggestion routes, resolved once. Toys have no
 * category of their own — they are items on Blizzard's side — and battle pets
 * are reached through the creature search.
 */
const ROUTE_BY_KIND: Record<CatalogKind, CatalogRoute> = {
  item: routeTo("items"),
  toy: routeTo("items"),
  mount: routeTo("mounts"),
  pet: routeTo("creatures"),
};

/** Shared so a query too short to rank never allocates a new array. */
const NO_SUGGESTIONS: CatalogSuggestion[] = [];

const nameOf = (entry: CatalogEntry): string => entry.name;

/**
 * The local catalogue's best matches for what has been typed so far, ready for
 * the suggestion listbox. The returned value is stable while the query and the
 * index are, so it is safe to feed straight into a memo the listbox renders
 * from.
 */
export const useCatalogSuggestions = (
  query: string,
  options: CatalogSuggestionsOptions = {},
): CatalogSuggestionsState => {
  const { enabled = true, limit = DEFAULT_LIMIT } = options;
  const { entries, ready } = useCatalogIndex(enabled);

  const suggestions = useMemo(() => {
    // The cheapest rejection there is: `normalizeForSearch` can only shorten
    // what it is given, so a trimmed query this short can never reach the
    // minimum and the six thousand names are not touched at all.
    if (query.trim().length < MIN_FUZZY_QUERY_LENGTH) {
      return NO_SUGGESTIONS;
    }

    return rankByName(entries, query, nameOf, limit).map(
      (entry): CatalogSuggestion => ({
        id: `catalog-${entry.kind}-${entry.id}`,
        entryId: entry.id,
        name: entry.name,
        kind: entry.kind,
        ...ROUTE_BY_KIND[entry.kind],
      }),
    );
  }, [entries, query, limit]);

  return useMemo(() => ({ suggestions, ready }), [suggestions, ready]);
};

export default useCatalogSuggestions;
