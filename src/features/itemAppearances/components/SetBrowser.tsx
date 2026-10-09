import CheckroomRoundedIcon from "@mui/icons-material/CheckroomRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { Box, Button, Pagination, Stack } from "@mui/material";
import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ExplorerFilterBar,
  FilterChipGroup,
  SearchField,
} from "@/components/common/ExplorerFilterBar";
import type { FilterOption } from "@/components/common/ExplorerFilterBar";
import SectionCard from "@/components/common/SectionCard";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import {
  parseId,
  scrollMarginSx,
} from "@/features/itemAppearances/components/appearanceLayout";
import CardList, { CardListSkeleton } from "@/features/itemAppearances/components/CardList";
import SetCard from "@/features/itemAppearances/components/SetCard";
import type {
  AppearanceParams,
  AppearanceParamsSetter,
} from "@/features/itemAppearances/components/urlState";
import { appearanceKeys } from "@/features/itemAppearances/hooks/appearanceQueries";
import useRetainedFailure from "@/features/itemAppearances/hooks/useRetainedFailure";
import {
  SET_PAGE_SIZE,
  matchesSetFilter,
  pluralize,
  setFiltersAvailable,
} from "@/features/itemAppearances/services/appearanceService";
import type {
  AppearanceSetRef,
  SetFilter,
  SetGroup,
} from "@/features/itemAppearances/types";
import { formatNumber } from "@/lib/format";
import { MIN_FUZZY_QUERY_LENGTH, normalizeForSearch, rankByName } from "@/lib/fuzzyMatch";

const FILTER_LABELS: Readonly<Record<SetFilter, string>> = {
  pvp: "PvP titles",
  other: "No PvP title",
  cloth: "Cloth",
  leather: "Leather",
  mail: "Mail",
  plate: "Plate",
};

/** Section titles for a filter on its own ("Sets named …plate"). */
const FILTER_TITLES: Readonly<Record<SetFilter, string>> = {
  pvp: "Sets with a PvP title",
  other: "Sets without a PvP title",
  cloth: "Sets named for cloth",
  leather: "Sets named for leather",
  mail: "Sets named for mail",
  plate: "Sets named for plate",
};

const FILTER_ORDER: readonly SetFilter[] = ["pvp", "other", "cloth", "leather", "mail", "plate"];

const isSetFilter = (value: string): value is SetFilter =>
  (FILTER_ORDER as readonly string[]).includes(value);

const EMPTY_RESULTS: SetGroup[] = [];

export type SetBrowserProps = {
  indexQuery: UseQueryResult<AppearanceSetRef[]>;
  /** The index folded by name, newest first. */
  groups: readonly SetGroup[];
  params: Pick<AppearanceParams, "q" | "type" | "page">;
  setParams: AppearanceParamsSetter;
  onOpenSet: (group: SetGroup) => void;
};

/**
 * The Sets view: every set name in Blizzard's index (several sets can share
 * one), newest first, searched by name on this device (the index is one
 * request) and, in English, narrowed by words in the name. Cards load their
 * own records as they near the viewport, 24 to a page.
 */
const SetBrowser = ({
  indexQuery,
  groups,
  params,
  setParams,
  onOpenSet,
}: SetBrowserProps): JSX.Element => {
  const index = indexQuery.data;
  const failure = useRetainedFailure(appearanceKeys.setIndex(), indexQuery);
  const filtersAvailable = setFiltersAvailable();

  /* ---------------- Filter (URL first; unknown values fall back to none) ---------------- */

  const filter: SetFilter | null =
    filtersAvailable && isSetFilter(params.type) ? params.type : null;
  useEffect(() => {
    if (params.type !== "" && filter === null) {
      setParams({ type: null }, { replace: true });
    }
  }, [params.type, filter, setParams]);

  const counts = useMemo(() => {
    const result = new Map<SetFilter, number>();
    FILTER_ORDER.forEach((option) =>
      result.set(option, groups.filter((group) => matchesSetFilter(group, option)).length),
    );
    return result;
  }, [groups]);
  // Until the index lands the chips are up but uncounted and off, so the
  // filter bar never grows (and pushes the grid down) as it arrives.
  const counted = index !== undefined;
  const filterOptions = useMemo<ReadonlyArray<FilterOption<SetFilter>>>(
    () =>
      FILTER_ORDER.map((option) => ({
        value: option,
        label: FILTER_LABELS[option],
        count: counted ? counts.get(option) : undefined,
        // The pressed one stays pressable, so it can always be cleared.
        disabled: option !== filter && (!counted || (counts.get(option) ?? 0) === 0),
      })),
    [counted, counts, filter],
  );

  /* ---------------- Search (keystrokes stay local; the URL gets it debounced) ---------------- */

  const search = params.q.trim();
  const searching = search !== "";
  const tooShort = searching && normalizeForSearch(search).length < MIN_FUZZY_QUERY_LENGTH;
  const [draft, setDraft] = useState(params.q);
  const emittedRef = useRef(search);
  useEffect(() => {
    // The URL changed on its own (back button, a mode switch): adopt it.
    if (search !== emittedRef.current) {
      emittedRef.current = search;
      setDraft(search);
    }
  }, [search]);
  const handleSearch = useCallback(
    (value: string): void => {
      const next = value.trim();
      emittedRef.current = next;
      setParams({ q: next || null, page: null }, { replace: true });
    },
    [setParams],
  );

  // Every Clear button disappears with what it cleared; focus moves to the
  // search field rather than falling back to the top of the document.
  const searchInputRef = useRef<HTMLInputElement>(null);
  const clearSearch = useCallback((): void => {
    emittedRef.current = "";
    setDraft("");
    setParams({ q: null, page: null }, { replace: true });
  }, [setParams]);
  const clearAll = (): void => {
    emittedRef.current = "";
    setDraft("");
    setParams({ q: null, type: null, page: null });
    searchInputRef.current?.focus();
  };
  const changeFilter = (next: SetFilter | null): void => {
    setParams({ type: next, page: null });
  };

  /* ---------------- Results and paging ---------------- */

  const results = useMemo(() => {
    const filtered =
      filter === null ? groups : groups.filter((group) => matchesSetFilter(group, filter));
    if (!searching) {
      return filtered;
    }
    return tooShort
      ? EMPTY_RESULTS
      : rankByName(filtered, search, (group) => group.name, filtered.length);
  }, [groups, filter, searching, tooShort, search]);

  const pageCount = Math.max(1, Math.ceil(results.length / SET_PAGE_SIZE));
  const requestedPage = Math.max(1, parseId(params.page) ?? 1);
  const page = Math.min(requestedPage, pageCount);
  const start = (page - 1) * SET_PAGE_SIZE;
  const pageGroups = useMemo(() => results.slice(start, start + SET_PAGE_SIZE), [results, start]);

  // A page past the end (a narrower search, an old link) or a malformed one
  // falls back to what is on screen, once the index says how many there are.
  useEffect(() => {
    if (params.page === "" || index === undefined) {
      return;
    }
    const next = page > 1 ? String(page) : null;
    if ((next ?? "") !== params.page) {
      setParams({ page: next }, { replace: true });
    }
  }, [index, params.page, page, setParams]);

  // A grid is read from the top: a new page starts at its first card.
  const listTopRef = useRef<HTMLDivElement>(null);
  const changePage = (next: number): void => {
    setParams({ page: next > 1 ? String(next) : null });
    listTopRef.current?.scrollIntoView({ block: "start" });
  };

  /* ---------------- Labels ---------------- */

  const end = Math.min(start + SET_PAGE_SIZE, results.length);
  const range = `${formatNumber(start + 1)}–${formatNumber(end)}`;
  let summary: string | undefined;
  if (failure.failed) {
    summary = "Couldn't load appearance sets";
  } else if (index === undefined) {
    summary = "Loading appearance sets…";
  } else if (tooShort) {
    // One letter ranks nothing, but that is "too short", not "no match".
    summary = "Type at least two letters";
  } else if (results.length === 0) {
    summary = "No matching sets";
  } else if (searching || filter !== null) {
    const of = pluralize(groups.length, "set name", "set names");
    summary = `${formatNumber(results.length)} of ${of} match${pageCount > 1 ? ` · showing ${range}` : ""}`;
  } else {
    const names = pluralize(groups.length, "set name", "set names");
    summary = `${names}, newest first${pageCount > 1 ? ` · showing ${range}` : ""}`;
  }

  let title = "Newest appearance sets";
  if (searching) {
    title = `Sets matching “${search}”`;
  } else if (filter !== null) {
    title = FILTER_TITLES[filter];
  }

  /* ---------------- Render ---------------- */

  let clearLabel = "Clear search";
  if (filter !== null) {
    clearLabel = searching ? "Clear search and filter" : "Clear filter";
  }

  const renderBody = (): JSX.Element => {
    if (failure.failed && failure.error) {
      return (
        <ErrorState
          error={failure.error}
          context="appearance sets"
          onRetry={failure.retry}
          retryLabel={failure.retrying ? "Retrying…" : "Retry"}
        />
      );
    }
    if (index === undefined) {
      return <CardListSkeleton count={SET_PAGE_SIZE} label="Loading appearance sets" />;
    }
    if (groups.length === 0) {
      return (
        <EmptyState
          icon={<CheckroomRoundedIcon />}
          title="No appearance sets listed"
          description="Blizzard returned an empty appearance set index for this region. The Appearances view browses looks by slot instead."
        />
      );
    }
    if (tooShort) {
      return (
        <EmptyState
          compact
          icon={<SearchRoundedIcon />}
          title={`Type at least ${MIN_FUZZY_QUERY_LENGTH} letters`}
          description="A single letter starts too many set names to rank."
        />
      );
    }
    if (results.length === 0) {
      return (
        <EmptyState
          compact
          icon={<CheckroomRoundedIcon />}
          title={searching ? `No sets match “${search}”` : "No sets with this name filter"}
          description={
            filter !== null
              ? "The name filters read set names only, and most names never say their armor; try without the filter, or another spelling."
              : "The search reads set names, forgiving a letter or two; try a shorter word or another spelling."
          }
          action={
            <Button variant="outlined" size="small" onClick={clearAll}>
              {clearLabel}
            </Button>
          }
        />
      );
    }
    return (
      <Stack spacing={2.5} ref={listTopRef} sx={scrollMarginSx}>
        <CardList
          label={title}
          items={pageGroups}
          // By name (unique per group), so a re-ranked search keeps each
          // card's instance and its in-flight records.
          getKey={(group) => group.name}
          renderItem={(group) => <SetCard group={group} onSelect={onOpenSet} />}
        />
        {pageCount > 1 ? (
          <Pagination
            count={pageCount}
            page={page}
            onChange={(_event, next) => changePage(next)}
            siblingCount={1}
            aria-label="Set pages"
            sx={{ alignSelf: "center" }}
          />
        ) : null}
      </Stack>
    );
  };

  const indexBroken = failure.failed || (index !== undefined && groups.length === 0);

  return (
    <>
      <ExplorerFilterBar label="Find appearance sets" summary={summary}>
        <SearchField
          size="small"
          label="Search appearance sets by name"
          placeholder={
            groups.length > 0
              ? `Search ${formatNumber(groups.length)} set names`
              : "Search set names"
          }
          value={draft}
          onChange={setDraft}
          onDebouncedChange={handleSearch}
          onClear={clearSearch}
          inputRef={searchInputRef}
          disabled={indexBroken}
          // Shrinks at phone width (its 240px floor would widen the page there).
          sx={{ minWidth: { xs: 0, sm: 240 }, maxWidth: { md: 420 } }}
        />
        {filtersAvailable && (index === undefined || groups.length > 0) ? (
          <Box sx={{ flex: "1 1 100%", minWidth: 0 }}>
            <FilterChipGroup
              label="Filter sets by words in their name"
              options={filterOptions}
              value={filter}
              onChange={changeFilter}
              allLabel="Any name"
              size="small"
            />
          </Box>
        ) : null}
      </ExplorerFilterBar>

      <SectionCard
        title={title}
        // Short, so the first cards are on a phone's first screen; what a
        // card shows is in About this data, and the filters explain
        // themselves only while one is pressed.
        description={[
          searching ? "Closest names first." : "Newest first by set id.",
          filter !== null
            ? "The name filters read names only: PvP titles are Gladiator, Combatant, Aspirant and Warmonger, and an armor word counts inside other words (Battleplate is plate)."
            : undefined,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {renderBody()}
      </SectionCard>
    </>
  );
};

export default SetBrowser;
