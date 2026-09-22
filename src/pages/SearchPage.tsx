import SearchRounded from "@mui/icons-material/SearchRounded";
import { Chip, Stack } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { To } from "react-router-dom";

import {
  ExplorerFilterBar,
  SearchField,
} from "@/components/common/ExplorerFilterBar";
import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import {
  DEFAULT_SEARCH_CATEGORY,
  SEARCH_CATEGORIES,
  findSearchCategory,
} from "@/features/search/categories";
import RecentSearchChips from "@/features/search/components/RecentSearchChips";
import SearchCategoryTabs from "@/features/search/components/SearchCategoryTabs";
import SearchResultGrid from "@/features/search/components/SearchResultGrid";
import { searchUrl } from "@/features/search/config/searchRoutes";
import { useSearchState } from "@/features/search/context/SearchContext";
import {
  SEARCH_DEBOUNCE_MS,
  useBlizzardSearch,
} from "@/features/search/hooks/useBlizzardSearch";
import type { SearchCategoryState } from "@/features/search/hooks/useBlizzardSearch";
import { SEARCH_PAGE_SIZE } from "@/features/search/services/searchService";
import type { SearchCategoryId } from "@/features/search/types";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import { tokens } from "@/theme";

const SECTION_GAP = tokens.wc.layout.sectionGap;
const MIN_QUERY_LENGTH = 2;

export interface SearchPageProps {
  /** Restrict the search to these categories (a category page passes one). */
  categoryIds?: SearchCategoryId[];
  /** The host route already renders the PageHeader (and owns document.title). */
  hideHeader?: boolean;
}

/** `cat` is canonical; `category` is accepted as an alias for inbound links. */
const PARAM_DEFAULTS: Record<"cat" | "category" | "page", string> = {
  cat: DEFAULT_SEARCH_CATEGORY,
  category: "",
  page: "",
};

const parsePage = (raw: string): number => {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
};

const resolveCategoryId = (
  raw: string,
  categoryIds: SearchCategoryId[] | undefined,
): SearchCategoryId => {
  if (categoryIds && categoryIds.length === 1) {
    return categoryIds[0];
  }
  const found = findSearchCategory(raw)?.id;
  if (found && (!categoryIds || categoryIds.includes(found))) {
    return found;
  }
  return categoryIds?.[0] ?? DEFAULT_SEARCH_CATEGORY;
};

type SummaryFlags = {
  /** One character typed: nothing was searched. */
  tooShort: boolean;
  /** Every category failed; the page shows one ErrorState. */
  allFailed: boolean;
};

/** "Showing 1–24 of 1,204 items" / "Page 2 of 34 · items" / "All 12 items loaded". */
const summarize = (
  state: SearchCategoryState | undefined,
  query: string,
  { tooShort, allFailed }: SummaryFlags,
): string => {
  if (!state || !query || tooShort) {
    return "";
  }
  if (state.isLoading || (state.isPlaceholderData && state.data.length === 0)) {
    return `Searching ${state.category.plural}…`;
  }
  if (allFailed) {
    return "Couldn't load results";
  }
  if (state.isError) {
    return `Couldn't load ${state.category.plural}`;
  }

  const { plural } = state.category;
  const count = state.data.length;

  if (state.pageCount <= 1) {
    return count === 0
      ? `No ${plural} matched`
      : `All ${formatNumber(count)} ${plural} loaded`;
  }

  if (typeof state.total === "number") {
    const first = (state.page - 1) * SEARCH_PAGE_SIZE + 1;
    const last = Math.min(first + count - 1, state.total);
    return `Showing ${formatNumber(first)}–${formatNumber(last)} of ${formatNumber(state.total)} ${plural}`;
  }

  return `Page ${formatNumber(state.page)} of ${formatNumber(state.pageCount)} · ${plural}`;
};

const EXAMPLE_TERMS = SEARCH_CATEGORIES.flatMap((category) => category.examples);

/** "Shadowmourne, Chaos Bolt or Onyxia" */
const joinExamples = (terms: string[]): string =>
  terms.length <= 1
    ? terms.join("")
    : `${terms.slice(0, -1).join(", ")} or ${terms[terms.length - 1]}`;

/**
 * `/search?q=…&cat=…&page=…`: the URL is the source of truth, so the header
 * search, back/forward and shared links all land on the same results.
 */
const SearchPage = ({
  categoryIds,
  hideHeader = false,
}: SearchPageProps): JSX.Element => {
  const {
    query,
    setQuery,
    submitQuery,
    recentSearches,
    removeRecentSearch,
    pushRecentSearch,
  } = useSearchState();
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParamsRecord(PARAM_DEFAULTS);

  const rawCat =
    params.cat === DEFAULT_SEARCH_CATEGORY && params.category
      ? params.category
      : params.cat;
  const cat = resolveCategoryId(rawCat, categoryIds);
  const page = parsePage(params.page);
  const singleCategory = Boolean(categoryIds && categoryIds.length === 1);
  const singleCategoryConfig = singleCategory
    ? findSearchCategory(categoryIds?.[0])
    : undefined;

  // The field keeps a local draft and commits through its own debounce, so
  // the URL (and everything that re-renders on it) changes once per settled
  // term instead of once per keystroke; the hook then needs no second debounce.
  const [draft, setDraft] = useState(query);
  const lastQueryRef = useRef(query);
  useEffect(() => {
    if (query !== lastQueryRef.current) {
      // URL navigation (header search, back/forward, a chip): adopt it.
      lastQueryRef.current = query;
      setDraft(query);
    }
  }, [query]);

  const search = useBlizzardSearch(query, {
    categoryIds,
    pages: { [cat]: page },
    debounceMs: 0,
  });
  const { categoryStates } = search;

  const activeState =
    categoryStates.find((state) => state.category.id === cat) ??
    categoryStates[0];

  // Clamp a stale page once the page count is known (Blizzard reports
  // pageCount 0 for an empty search, so page 1 is never rewritten).
  useEffect(() => {
    if (!activeState || page <= 1) {
      return;
    }
    const maxPage = Math.max(1, activeState.pageCount);
    if (
      !activeState.isLoading &&
      !activeState.isError &&
      !activeState.isPlaceholderData &&
      activeState.data.length === 0 &&
      page > maxPage
    ) {
      setParams(
        { page: maxPage > 1 ? String(maxPage) : null },
        { replace: true },
      );
    }
  }, [activeState, page, setParams]);

  // Record settled, successful searches: never from placeholder data, and
  // never while a request for the current term is still in flight.
  const hasPlaceholder = categoryStates.some((state) => state.isPlaceholderData);
  useEffect(() => {
    if (
      search.query.length >= MIN_QUERY_LENGTH &&
      !search.isAnyLoading &&
      !search.isFetching &&
      !hasPlaceholder &&
      search.hasAnyResults
    ) {
      pushRecentSearch(search.query);
    }
  }, [
    search.query,
    search.isAnyLoading,
    search.isFetching,
    hasPlaceholder,
    search.hasAnyResults,
    pushRecentSearch,
  ]);

  const summary = useMemo(
    () =>
      summarize(activeState, search.query, {
        tooShort: search.tooShort,
        allFailed: search.isAllError && !search.isAnyLoading,
      }),
    [
      activeState,
      search.query,
      search.tooShort,
      search.isAllError,
      search.isAnyLoading,
    ],
  );

  const handleCategoryChange = (id: SearchCategoryId): void => {
    setParams({
      cat: id === DEFAULT_SEARCH_CATEGORY ? null : id,
      category: null,
      page: null,
    });
  };

  const handlePageChange = (next: number): void => {
    setParams({ page: next === 1 ? null : String(next) });
  };

  const handleClear = (): void => {
    setDraft("");
    setQuery("");
  };

  // A single-category page (creatures) searches in place; the global page
  // links to /search.
  const buildTermTo = useCallback(
    (term: string): To =>
      singleCategory
        ? { pathname, search: `?q=${encodeURIComponent(term)}` }
        : searchUrl(term),
    [pathname, singleCategory],
  );
  const exampleTerms = singleCategoryConfig?.examples ?? EXAMPLE_TERMS;
  const exampleCopy = singleCategoryConfig
    ? `Try ${joinExamples(singleCategoryConfig.examples)}.`
    : "Try Shadowmourne, Chaos Bolt or Onyxia.";

  const renderBody = (): JSX.Element => {
    if (!search.query) {
      return (
        <Stack spacing={3}>
          <EmptyState
            icon={<SearchRounded />}
            title="Start with a name"
            description={exampleCopy}
          />
          <RecentSearchChips
            terms={exampleTerms}
            buildTo={buildTermTo}
            label="Example searches"
          />
          {recentSearches.length > 0 ? (
            <SectionCard title="Recent searches" titleAs="h2" padding="compact">
              <RecentSearchChips
                terms={recentSearches}
                buildTo={buildTermTo}
                onRemove={removeRecentSearch}
                label="Recent searches"
              />
            </SectionCard>
          ) : null}
        </Stack>
      );
    }

    if (search.tooShort) {
      return (
        <EmptyState
          compact
          title={`Type at least ${MIN_QUERY_LENGTH} characters`}
        />
      );
    }

    if (search.isAllError && !search.isAnyLoading) {
      return (
        <ErrorState
          error={search.firstError}
          context="search results"
          onRetry={() => categoryStates.forEach((state) => state.refetch())}
        />
      );
    }

    return (
      <Stack spacing={3}>
        {singleCategory ? null : (
          <SearchCategoryTabs
            states={categoryStates}
            value={cat}
            onChange={handleCategoryChange}
          />
        )}
        {activeState ? (
          <SearchResultGrid
            state={activeState}
            query={search.query}
            onPageChange={handlePageChange}
          />
        ) : null}
      </Stack>
    );
  };

  // A too-short query searched nothing, so the header and tab title stay neutral.
  const hasResultsQuery = Boolean(search.query) && !search.tooShort;
  const title = hasResultsQuery
    ? `Results for "${search.query}"`
    : "Search Azeroth";

  return (
    <Stack spacing={SECTION_GAP}>
      {hideHeader ? null : (
        <PageHeader
          eyebrow="Search"
          title={title}
          description="Items, spells, mounts and creatures from the Blizzard game-data API."
          documentTitle={hasResultsQuery ? `${search.query} - Search` : "Search"}
          icon={<SearchRounded />}
          meta={
            <>
              <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
              {activeState && typeof activeState.total === "number" ? (
                <Chip
                  size="small"
                  label={`${formatNumber(activeState.total)} ${activeState.category.plural}`}
                />
              ) : null}
            </>
          }
        />
      )}

      <ExplorerFilterBar
        label="Search"
        summary={summary}
        progress={search.isFetching && !search.isAnyLoading}
      >
        <SearchField
          value={draft}
          onChange={setDraft}
          onDebouncedChange={setQuery}
          debounceMs={SEARCH_DEBOUNCE_MS}
          onSubmit={submitQuery}
          onClear={handleClear}
          label="Search query"
          placeholder={
            singleCategoryConfig
              ? singleCategoryConfig.placeholder
              : "Search by name"
          }
          autoFocus={false}
          minLength={MIN_QUERY_LENGTH}
          loading={search.isFetching}
        />
      </ExplorerFilterBar>

      {renderBody()}
    </Stack>
  );
};

export default SearchPage;
