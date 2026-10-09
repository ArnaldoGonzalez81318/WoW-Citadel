import ChairRoundedIcon from "@mui/icons-material/ChairRounded";
import SearchOffRoundedIcon from "@mui/icons-material/SearchOffRounded";
import { Button, Pagination, Stack, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";

import {
  ExplorerFilterBar,
  SegmentedControl,
} from "@/components/common/ExplorerFilterBar";
import type { SegmentedOption } from "@/components/common/ExplorerFilterBar";
import SectionCard from "@/components/common/SectionCard";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import DecorGrid, { DecorGridSkeleton } from "@/features/housingDecor/components/DecorGrid";
import HousingSearchField from "@/features/housingDecor/components/HousingSearchField";
import type { SearchBinding } from "@/features/housingDecor/components/HousingSearchField";
import { scrollMarginSx } from "@/features/housingDecor/components/housingStyles";
import {
  decorIndexQuery,
  decorItemLinksQuery,
  decorItemSummariesQuery,
} from "@/features/housingDecor/hooks/housingQueries";
import useHeldFailure from "@/features/housingDecor/hooks/useHeldFailure";
import {
  DECOR_PAGE_SIZE,
  pluralize,
  searchDecor,
  sortDecor,
} from "@/features/housingDecor/services/housingCatalog";
import type {
  DecorEntry,
  DecorSort,
  HousingParams,
} from "@/features/housingDecor/types";
import type { SearchParamsRecordSetter } from "@/hooks/useSearchParamState";
import { formatNumber } from "@/lib/format";
import { MIN_FUZZY_QUERY_LENGTH } from "@/lib/fuzzyMatch";

const SORT_OPTIONS: ReadonlyArray<SegmentedOption<DecorSort>> = [
  { value: "newest", label: "Newest" },
  { value: "name", label: "A to Z" },
];

const EMPTY_ENTRIES: DecorEntry[] = [];
const EMPTY_IDS: number[] = [];

export type DecorBrowserProps = {
  /** The URL's search, trimmed. */
  search: string;
  sort: DecorSort;
  /** From the URL, 1-based (may be past the end until the effect below fixes it). */
  page: number;
  /** The raw `page` parameter, to tell a default from a stale value. */
  pageParam: string;
  setParams: SearchParamsRecordSetter<HousingParams>;
  searchBinding: SearchBinding;
  onOpen: (entry: DecorEntry) => void;
};

/**
 * Every decor in Blizzard's index, 24 to a page: newest first, A to Z, or
 * best match for a name (the search runs here, over the index, so typos and
 * half-typed words still find things). The index has names only, so each
 * page asks Blizzard's decor search which items its decor come from and the
 * item search for their quality (a request each), and every card loads its
 * icon as it nears the viewport.
 */
const DecorBrowser = ({
  search,
  sort,
  page,
  pageParam,
  setParams,
  searchBinding,
  onOpen,
}: DecorBrowserProps): JSX.Element => {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"));

  const indexQuery = useQuery(decorIndexQuery());
  const indexFailure = useHeldFailure(indexQuery);
  const entries = indexQuery.data ?? EMPTY_ENTRIES;
  const loaded = indexQuery.data !== undefined;

  /* ---------------- Order, search and page ---------------- */

  const searching = search !== "";
  const numeric = /^#?\d+$/.test(search);
  const tooShort = searching && !numeric && search.length < MIN_FUZZY_QUERY_LENGTH;
  const ordered = useMemo(() => {
    if (!searching) {
      return sortDecor(entries, sort);
    }
    return tooShort ? EMPTY_ENTRIES : searchDecor(entries, search);
  }, [entries, search, searching, tooShort, sort]);
  const pageCount = Math.max(1, Math.ceil(ordered.length / DECOR_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * DECOR_PAGE_SIZE;
  const pageEntries = useMemo(
    () => ordered.slice(start, start + DECOR_PAGE_SIZE),
    [ordered, start],
  );

  // A page past the end (a narrower search, an old link) or a malformed one
  // falls back to what is on screen, once the index says how many there are.
  useEffect(() => {
    if (!loaded || pageParam === "") {
      return;
    }
    const next = currentPage > 1 ? String(currentPage) : null;
    if ((next ?? "") !== pageParam) {
      setParams({ page: next }, { replace: true });
    }
  }, [loaded, pageParam, currentPage, setParams]);

  /* ---------------- The page's items (two searches) ---------------- */

  const pageIds = useMemo(
    () => (pageEntries.length > 0 ? pageEntries.map((entry) => entry.id) : EMPTY_IDS),
    [pageEntries],
  );
  const linksQuery = useQuery({
    ...decorItemLinksQuery(pageIds),
    enabled: pageIds.length > 0,
  });
  const linksFailure = useHeldFailure(linksQuery);
  const links = linksQuery.data;
  const itemIdByDecor = useMemo(
    () => (links ? new Map(links.map((link) => [link.decorId, link.itemId])) : undefined),
    [links],
  );
  const itemIds = useMemo(() => {
    const ids = (links ?? [])
      .map((link) => link.itemId)
      .filter((id): id is number => id !== undefined);
    return ids.length > 0 ? [...new Set(ids)] : EMPTY_IDS;
  }, [links]);
  const summariesQuery = useQuery({
    ...decorItemSummariesQuery(itemIds),
    enabled: itemIds.length > 0,
  });
  const summariesFailure = useHeldFailure(summariesQuery);
  const summaries = summariesQuery.data;
  const summaryByItem = useMemo(
    () => (summaries ? new Map(summaries.map((summary) => [summary.itemId, summary])) : undefined),
    [summaries],
  );
  // A failed batch leaves the cards on their letters rather than skeletons
  // that would never resolve; its banner offers the Retry.
  const linkPending = pageIds.length > 0 && linksQuery.isPending && !linksFailure.failed;

  /* ---------------- Paging ---------------- */

  // A grid is read from the top: a new page starts at its first card.
  const listTopRef = useRef<HTMLDivElement>(null);
  const handlePageChange = (next: number): void => {
    setParams({ page: next > 1 ? String(next) : null });
    listTopRef.current?.scrollIntoView({ block: "start" });
  };

  /* ---------------- Labels ---------------- */

  const shownRange = `${formatNumber(start + 1)}–${formatNumber(start + pageEntries.length)}`;
  const summary = ((): string => {
    if (!loaded) {
      return indexFailure.failed ? "Couldn't load decor" : "Loading decor…";
    }
    if (tooShort) {
      return "Type at least two letters";
    }
    if (searching) {
      if (ordered.length === 0) {
        return "No matching decor";
      }
      return `${formatNumber(ordered.length)} of ${pluralize(entries.length, "decor", "decor")} match${
        pageCount > 1 ? ` · showing ${shownRange}` : ""
      }`;
    }
    return entries.length > 0
      ? `Showing ${shownRange} of ${pluralize(entries.length, "decor", "decor")}`
      : "No decor listed";
  })();

  let title = "Decor A to Z";
  // The page header already says why the cards show item icons.
  let description = "Alphabetical, reading past the quotes around a painting's title.";
  if (searching) {
    title = `Decor matching “${search}”`;
    description =
      "Best match first: the search forgives typos and half-typed words, and a number finds that decor id.";
  } else if (sort === "newest") {
    title = "Newest decor";
    description = "Highest decor id first, which tends to put Blizzard's latest additions up front.";
  }

  /* ---------------- Render ---------------- */

  const renderBody = (): JSX.Element => {
    if (indexFailure.failed) {
      return (
        <ErrorState
          error={indexFailure.error}
          context="the decor catalogue"
          onRetry={indexFailure.retry}
          retryLabel={indexFailure.retrying ? "Retrying…" : "Retry"}
        />
      );
    }
    if (!loaded) {
      return <DecorGridSkeleton label="Loading decor" />;
    }
    if (entries.length === 0) {
      return (
        <EmptyState
          icon={<ChairRoundedIcon />}
          title="No decor listed"
          description="Blizzard returned an empty decor index for this region."
        />
      );
    }
    if (tooShort || ordered.length === 0) {
      return (
        <EmptyState
          compact
          icon={<SearchOffRoundedIcon />}
          title={tooShort ? "Type at least two letters" : `No decor matches “${search}”`}
          description={
            tooShort
              ? "One letter matches nearly every decor; add another to narrow it down."
              : "Try fewer letters or a single word, or clear the search to browse every decor."
          }
          action={
            <Button variant="outlined" size="small" onClick={searchBinding.onClear}>
              Clear search
            </Button>
          }
        />
      );
    }
    return (
      <Stack spacing={2.5} ref={listTopRef} sx={scrollMarginSx}>
        {linksFailure.failed ? (
          <ErrorState
            compact
            error={linksFailure.error}
            title="Couldn't find this page's items"
            context="the items behind these decor"
            onRetry={linksFailure.retry}
            retryLabel={linksFailure.retrying ? "Retrying…" : "Retry"}
          />
        ) : null}
        {summariesFailure.failed ? (
          <ErrorState
            compact
            error={summariesFailure.error}
            title="Couldn't load these items' qualities"
            context="the items' qualities"
            onRetry={summariesFailure.retry}
            retryLabel={summariesFailure.retrying ? "Retrying…" : "Retry"}
          />
        ) : null}
        <DecorGrid
          entries={pageEntries}
          label={title}
          itemIds={itemIdByDecor}
          linkPending={linkPending}
          summaries={summaryByItem}
          onSelect={onOpen}
        />
        {pageCount > 1 ? (
          <Pagination
            count={pageCount}
            page={currentPage}
            onChange={(_event, next) => handlePageChange(next)}
            siblingCount={isPhone ? 0 : 1}
            size={isPhone ? "small" : "medium"}
            aria-label="Decor pages"
            sx={{ alignSelf: "center" }}
          />
        ) : null}
      </Stack>
    );
  };

  return (
    <Stack spacing={2.5}>
      <ExplorerFilterBar
        label="Decor search"
        summary={summary}
        progress={linksQuery.isFetching || summariesQuery.isFetching}
      >
        <HousingSearchField
          binding={searchBinding}
          label="Search decor by name or id"
          placeholder={
            entries.length > 0 ? `Search ${formatNumber(entries.length)} decor` : "Search decor"
          }
          disabled={indexFailure.failed}
        />
        {/* A search is ranked by match, so the order only applies without one. */}
        {!searching ? (
          <SegmentedControl
            size="small"
            label="Order decor"
            options={SORT_OPTIONS}
            value={sort}
            onChange={(next) =>
              setParams({ sort: next === "name" ? "name" : null, page: null })
            }
          />
        ) : null}
      </ExplorerFilterBar>

      <SectionCard title={title} description={description}>
        {renderBody()}
      </SectionCard>
    </Stack>
  );
};

export default DecorBrowser;
