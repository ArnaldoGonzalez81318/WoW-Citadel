import CancelRounded from "@mui/icons-material/CancelRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import { Chip, Stack } from "@mui/material";
import { useEffect, useMemo, useRef } from "react";
import type { SyntheticEvent } from "react";
import { Link as RouterLink } from "react-router-dom";

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
import SearchCategoryTabs from "@/features/search/components/SearchCategoryTabs";
import SearchResultGrid from "@/features/search/components/SearchResultGrid";
import { searchUrl, useSearchState } from "@/features/search/context/SearchContext";
import { useBlizzardSearch } from "@/features/search/hooks/useBlizzardSearch";
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

const PARAM_DEFAULTS = { cat: DEFAULT_SEARCH_CATEGORY, page: "" } as const;

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

/** "Showing 1–24 of 1,204 items" / "Page 2 of 34 · items" / "All 12 items loaded". */
const summarize = (
  state: SearchCategoryState | undefined,
  query: string,
): string => {
  if (!state || !query) {
    return "";
  }
  if (state.isLoading) {
    return `Searching ${state.category.plural}…`;
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
  const [params, setParams] = useSearchParamsRecord(PARAM_DEFAULTS);

  const cat = resolveCategoryId(params.cat, categoryIds);
  const page = parsePage(params.page);
  const singleCategory = Boolean(categoryIds && categoryIds.length === 1);

  const search = useBlizzardSearch(query, {
    categoryIds,
    pages: { [cat]: page },
  });
  const { categoryStates } = search;

  const activeState =
    categoryStates.find((state) => state.category.id === cat) ??
    categoryStates[0];

  // A new query starts at page 1 (a reload with q + page keeps both).
  const lastQueryRef = useRef<string | null>(null);
  useEffect(() => {
    const trimmed = query.trim();
    if (lastQueryRef.current === null) {
      lastQueryRef.current = trimmed;
      return;
    }
    if (lastQueryRef.current !== trimmed) {
      lastQueryRef.current = trimmed;
      if (page !== 1) {
        setParams({ page: null }, { replace: true });
      }
    }
  }, [query, page, setParams]);

  // Clamp a stale page once the page count is known.
  useEffect(() => {
    if (
      activeState &&
      !activeState.isLoading &&
      !activeState.isError &&
      !activeState.isPlaceholderData &&
      activeState.data.length === 0 &&
      page > activeState.pageCount
    ) {
      setParams(
        { page: activeState.pageCount > 1 ? String(activeState.pageCount) : null },
        { replace: true },
      );
    }
  }, [activeState, page, setParams]);

  // Record settled, successful searches (the debounce already throttles this).
  useEffect(() => {
    if (
      search.query.length >= MIN_QUERY_LENGTH &&
      !search.isAnyLoading &&
      search.hasAnyResults
    ) {
      pushRecentSearch(search.query);
    }
  }, [search.query, search.isAnyLoading, search.hasAnyResults, pushRecentSearch]);

  const summary = useMemo(
    () => summarize(activeState, search.query),
    [activeState, search.query],
  );

  const handleCategoryChange = (id: SearchCategoryId): void => {
    setParams({ cat: id === DEFAULT_SEARCH_CATEGORY ? null : id, page: null });
  };

  const handlePageChange = (next: number): void => {
    setParams({ page: next === 1 ? null : String(next) });
  };

  const renderBody = (): JSX.Element => {
    if (!search.query) {
      return (
        <Stack spacing={3}>
          <EmptyState
            icon={<SearchRounded />}
            title="Start with a name"
            description="Try Shadowmourne, Chaos Bolt or Onyxia."
            action={
              <Stack
                direction="row"
                spacing={1}
                useFlexGap
                flexWrap="wrap"
                justifyContent="center"
              >
                {EXAMPLE_TERMS.map((term) => (
                  <Chip
                    key={term}
                    component={RouterLink}
                    to={searchUrl(term)}
                    label={term}
                    clickable
                  />
                ))}
              </Stack>
            }
          />
          {recentSearches.length > 0 ? (
            <SectionCard title="Recent searches" titleAs="h2" padding="compact">
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {recentSearches.map((term) => (
                  <Chip
                    key={term}
                    component={RouterLink}
                    to={searchUrl(term)}
                    label={term}
                    clickable
                    onDelete={(event: SyntheticEvent) => {
                      // The chip is a link; removing must not follow it.
                      event.preventDefault();
                      removeRecentSearch(term);
                    }}
                    deleteIcon={<CancelRounded titleAccess={`Remove ${term}`} />}
                  />
                ))}
              </Stack>
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

  const title = search.query
    ? `Results for "${search.query}"`
    : "Search Azeroth";

  return (
    <Stack spacing={SECTION_GAP}>
      {hideHeader ? null : (
        <PageHeader
          eyebrow="Search"
          title={title}
          description="Items, spells, mounts and creatures from the Blizzard game-data API."
          documentTitle={search.query ? `${search.query} - Search` : "Search"}
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
          value={query}
          onChange={setQuery}
          onSubmit={submitQuery}
          onClear={() => setQuery("")}
          label="Search query"
          placeholder={
            singleCategory && activeState
              ? activeState.category.placeholder
              : "Search items, spells, mounts, creatures"
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
