import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ToysRoundedIcon from "@mui/icons-material/ToysRounded";
import {
  Button,
  Chip,
  CircularProgress,
  Pagination,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import PageHeader from "@/components/common/PageHeader";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import FocusGuard from "@/features/toys/components/FocusGuard";
import SourceScanStatus from "@/features/toys/components/SourceScanStatus";
import ToyDialog from "@/features/toys/components/ToyDialog";
import ToyFilters from "@/features/toys/components/ToyFilters";
import ToyGrid, { ToyGridSkeleton } from "@/features/toys/components/ToyGrid";
import ToySpotlight from "@/features/toys/components/ToySpotlight";
import { toyIndexQuery } from "@/features/toys/hooks/toyQueries";
import useHeldError from "@/features/toys/hooks/useHeldError";
import useToyResults from "@/features/toys/hooks/useToyResults";
import { TOY_PAGE_SIZE, pluralize, toSourceCode } from "@/features/toys/services/toyService";
import type { ToyRef, ToySort } from "@/features/toys/types";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import { formatNumber, humanizeEnum } from "@/lib/format";
import { MIN_FUZZY_QUERY_LENGTH, normalizeForSearch } from "@/lib/fuzzyMatch";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

/*
 * Everything that shapes the list, and the open toy, lives in the URL, so
 * any view can be shared. `sort` is left out while it is the default:
 * newest first when browsing, best match while a name is searched.
 */
const URL_DEFAULTS = {
  q: "",
  source: "",
  sort: "",
  page: "",
  toy: "",
};

const ORDER_NOTES: Readonly<Record<ToySort, string>> = {
  match: "Closest names first; half-typed and misspelled names count too.",
  newest: "Newest first: toy ids grow as Blizzard adds toys.",
  name: "A to Z.",
};

const parseId = (value: string): number | null => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const parseSort = (value: string): ToySort | null =>
  value === "newest" || value === "name" || value === "match" ? value : null;

/** Smooth unless the visitor asked for reduced motion. */
const scrollToTop = (node: Element | null): void => {
  let reduced = false;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    // No matchMedia: the default (smooth) is fine.
  }
  node?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
};

/** Clears the sticky app header when a section is scrolled to. */
const scrollMarginSx = (theme: Theme) => ({
  scrollMarginTop: {
    xs: `${theme.wc.layout.headerHeight.xs + 16}px`,
    md: `${theme.wc.layout.headerHeight.md + 16}px`,
  },
});

/**
 * Toys: Blizzard's toy box as an explorer. Every toy as an icon card with
 * where it comes from, searchable by name (ranked here, since Blizzard has
 * no toy search), newest first or A to Z, and filterable by source; a toy
 * opens with what it does in its tooltip's words, its cooldown, where to get
 * it and links out. A toy pulled at random sits on top.
 *
 * The index is one request; each card reads its toy record and icon as it
 * nears the viewport. The index has no sources, so a source filter reads
 * the listed toys' records a few a second in list order (with progress),
 * and every record read is kept in the browser for a day.
 */
const ToysPage = ({
  eyebrow = "Collectibles & Gear",
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const [params, setParams] = useSearchParamsRecord(URL_DEFAULTS);
  const navigate = useNavigate();

  const indexQuery = useQuery(toyIndexQuery());
  const index = indexQuery.data;
  const indexError = useHeldError(
    index === undefined ? indexQuery.error : null,
    indexQuery.isFetching,
    "index",
  );

  /* ---------------- Criteria (URL first; anything unusable falls back) ---------------- */

  const search = params.q.trim();
  const searching = search !== "";
  // One letter (or only punctuation) ranks nothing: say so, not "no match".
  const tooShort = searching && normalizeForSearch(search).length < MIN_FUZZY_QUERY_LENGTH;
  const defaultSort: ToySort = searching ? "match" : "newest";
  const requestedSort = parseSort(params.sort);
  const sort: ToySort =
    requestedSort !== null && (requestedSort !== "match" || searching) ? requestedSort : defaultSort;
  const requestedSource = params.source === "" ? null : toSourceCode(params.source);
  const requestedPage = Math.max(1, parseId(params.page) ?? 1);
  // A source filter reads records only as far as the page on screen needs
  // (one match more, to know whether another page follows) until "check
  // all" is pressed; that holds for the visit, whichever source is picked.
  const [readAll, setReadAll] = useState(false);
  const scanTarget = readAll ? Number.POSITIVE_INFINITY : requestedPage * TOY_PAGE_SIZE + 1;

  const results = useToyResults({ index, search, sort, requestedSource, scanTarget });
  const { source, sourceOptions, matches, settled, scan } = results;

  const knownPages = Math.max(1, Math.ceil(matches.length / TOY_PAGE_SIZE));
  // While the scan is still reading, one more page may yet fill: offer it
  // (and any page a link asked for) rather than clamping it away.
  const pageCount = settled
    ? knownPages
    : Math.max(requestedPage, Math.ceil((matches.length + 1) / TOY_PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const start = (page - 1) * TOY_PAGE_SIZE;
  const pageToys = useMemo(() => matches.slice(start, start + TOY_PAGE_SIZE), [matches, start]);

  // Drop what the page cannot use (a typo, an old link, a source no toy
  // has) so the address always describes the list on screen.
  useEffect(() => {
    const patch: Partial<Record<keyof typeof URL_DEFAULTS, string | null>> = {};
    if (
      params.sort !== "" &&
      (requestedSort === null || requestedSort === defaultSort || (requestedSort === "match" && !searching))
    ) {
      patch.sort = null;
    }
    // An unknown code waits for the index: a record read earlier may name it.
    if (params.source !== "" && index !== undefined) {
      if (source === null) {
        patch.source = null;
      } else if (params.source !== source) {
        // "vendor" reads as VENDOR; the address says so too.
        patch.source = source;
      }
    }
    if (params.page !== "" && (parseId(params.page) === null || params.page === "1")) {
      patch.page = null;
    } else if (index !== undefined && settled && !tooShort && requestedPage > knownPages) {
      // A page past the end (a narrower search, an old link) falls back to the last one.
      patch.page = knownPages > 1 ? String(knownPages) : null;
    }
    if (params.toy !== "" && parseId(params.toy) === null) {
      patch.toy = null;
    }
    if (Object.keys(patch).length > 0) {
      setParams(patch, { replace: true });
    }
  }, [
    params.sort,
    params.source,
    params.page,
    params.toy,
    requestedSort,
    defaultSort,
    searching,
    source,
    index,
    settled,
    tooShort,
    requestedPage,
    knownPages,
    setParams,
  ]);

  /* ---------------- Search field draft (keystrokes stay local; the URL gets the debounced value) ---------------- */

  const [draft, setDraft] = useState(params.q);
  const emittedRef = useRef(search);
  useEffect(() => {
    // The URL changed on its own (back button, a source shown from the dialog): adopt it.
    if (search !== emittedRef.current) {
      emittedRef.current = search;
      setDraft(search);
    }
  }, [search]);
  const handleSearch = useCallback(
    (value: string): void => {
      const next = value.trim();
      emittedRef.current = next;
      // A new search starts on best match; the order picked while browsing
      // would bury the closest names.
      setParams(
        { q: next || null, page: null, ...(next !== "" && !searching ? { sort: null } : {}) },
        { replace: true },
      );
    },
    [searching, setParams],
  );
  const searchInputRef = useRef<HTMLInputElement>(null);
  const clearSearch = useCallback((): void => {
    emittedRef.current = "";
    setDraft("");
    setParams({ q: null, page: null }, { replace: true });
  }, [setParams]);
  // The empty state's button disappears with the search it cleared.
  const clearSearchAndFocus = (): void => {
    clearSearch();
    searchInputRef.current?.focus();
  };

  /* ---------------- Order and source ---------------- */

  const handleSortChange = (next: ToySort): void =>
    setParams({ sort: next === defaultSort ? null : next, page: null }, { replace: true });
  const handleSourceChange = (next: string | null): void =>
    setParams({ source: next, page: null });
  const clearSourceAndFocus = (): void => {
    setParams({ source: null, page: null });
    searchInputRef.current?.focus();
  };

  /* ---------------- Paging ---------------- */

  // A grid is read from the top: a new page starts at its first card.
  const resultsRef = useRef<HTMLElement>(null);
  const handlePageChange = (next: number): void => {
    setParams({ page: next > 1 ? String(next) : null });
    resultsRef.current?.scrollIntoView({ block: "start" });
  };

  /* ---------------- Toy dialog ---------------- */

  const toyId = parseId(params.toy);
  // The id outlives the URL param so the dialog never blanks while closing.
  const [shownToyId, setShownToyId] = useState<number | null>(toyId);
  if (toyId !== null && toyId !== shownToyId) {
    setShownToyId(toyId);
  }
  // Opened by a click on this page (a history entry we pushed), not a shared link.
  const openedHereRef = useRef(false);
  useEffect(() => {
    if (toyId === null) {
      openedHereRef.current = false;
    }
  }, [toyId]);

  const openToy = useCallback(
    (toy: ToyRef): void => {
      openedHereRef.current = true;
      setParams({ toy: String(toy.id) });
    },
    [setParams],
  );
  // Closing a dialog this page opened steps back over its history entry, so
  // Back after closing leaves the page instead of reopening the toy.
  const closeToy = useCallback((): void => {
    if (openedHereRef.current) {
      openedHereRef.current = false;
      navigate(-1);
      return;
    }
    setParams({ toy: null }, { replace: true });
  }, [navigate, setParams]);

  // "Show Vendor toys" in the dialog: the dialog's entry becomes that list
  // (every toy of the source, so the search goes too), brought into view.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusPendingRef = useRef(false);
  const showSource = useCallback(
    (type: string): void => {
      openedHereRef.current = false;
      focusPendingRef.current = true;
      setParams(
        { toy: null, source: type, q: null, page: null, ...(searching ? { sort: null } : {}) },
        { replace: true },
      );
    },
    [searching, setParams],
  );
  // The dialog hands focus back to its opener as it closes (before this
  // effect runs), but the opener is the wrong place now: a card usually gone
  // from the new list, the spotlight's button, or a card the scroll below
  // leaves off screen. Focus goes to the new list's heading, so the next Tab
  // continues in what just appeared.
  useEffect(() => {
    if (!focusPendingRef.current || toyId !== null) {
      return;
    }
    focusPendingRef.current = false;
    scrollToTop(resultsRef.current);
    headingRef.current?.focus({ preventScroll: true });
  }, [source, toyId]);

  const nameById = useMemo(
    () => new Map((index ?? []).map((toy) => [toy.id, toy.name])),
    [index],
  );

  /* ---------------- Labels ---------------- */

  const sourceName =
    source !== null
      ? (sourceOptions.find((option) => option.type === source)?.name ?? humanizeEnum(source))
      : undefined;
  const total = index?.length ?? 0;
  const end = Math.min(start + TOY_PAGE_SIZE, matches.length);
  const range =
    pageCount > 1 && pageToys.length > 0
      ? ` · showing ${formatNumber(start + 1)}–${formatNumber(end)}`
      : "";

  let summary: string | undefined;
  if (index === undefined) {
    summary = indexQuery.isPending ? "Loading toys…" : undefined;
  } else if (tooShort) {
    summary = `Type at least ${MIN_FUZZY_QUERY_LENGTH} letters`;
  } else if (sourceName && !settled) {
    // Not the running count: a live region would read it out several times a second.
    const found = pluralize(matches.length, `${sourceName} toy`, `${sourceName} toys`);
    // A stop is announced by the status block's alert; this only adds the count.
    if (scan.error || scan.paused) {
      summary = `${found} so far · ${formatNumber(scan.checked)} of ${pluralize(scan.total, "toy", "toys")} checked`;
    } else {
      summary = "Checking toy sources…";
    }
  } else if (matches.length === 0) {
    summary = sourceName ? `No ${sourceName} toys` : "No matching toys";
  } else if (sourceName) {
    summary = `${pluralize(matches.length, `${sourceName} toy`, `${sourceName} toys`)}${searching ? " match" : ""}${range}`;
  } else if (searching) {
    summary = `${formatNumber(matches.length)} of ${pluralize(total, "toy", "toys")} match${range}`;
  } else {
    summary = `${pluralize(total, "toy", "toys")}${range}`;
  }

  let resultsTitle: string;
  if (sourceName) {
    resultsTitle = searching ? `${sourceName} toys matching “${search}”` : `${sourceName} toys`;
  } else {
    resultsTitle = searching ? `Toys matching “${search}”` : sort === "name" ? "Toys A to Z" : "Newest toys";
  }
  const resultsNote = [
    ORDER_NOTES[sort],
    sourceName ? `Only toys Blizzard files under ${sourceName}.` : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  const openToyName = toyId !== null ? nameById.get(toyId) : undefined;
  let documentTitle = "Toys";
  if (openToyName) {
    documentTitle = `${openToyName} · Toys`;
  } else if (searching) {
    documentTitle = "Search · Toys";
  } else if (sourceName) {
    documentTitle = `${sourceName} · Toys`;
  }

  /* ---------------- Render ---------------- */

  const resultsHeadingId = useId();
  const pageFilling = !settled && pageToys.length < TOY_PAGE_SIZE;

  const renderResults = (): JSX.Element | null => {
    if (index === undefined) {
      if (indexError) {
        return (
          <ErrorState
            error={indexError}
            context="the toy index"
            onRetry={() => {
              // A press while the retry is in flight is ignored rather than restarting it.
              if (!indexQuery.isFetching) {
                void indexQuery.refetch();
              }
            }}
            retryLabel={indexQuery.isFetching ? "Retrying…" : "Retry"}
          />
        );
      }
      return <ToyGridSkeleton label="Loading toys" />;
    }
    if (index.length === 0) {
      return (
        <EmptyState
          icon={<ToysRoundedIcon />}
          title="Blizzard lists no toys"
          description="Its toy index for this region came back empty."
        />
      );
    }
    if (tooShort) {
      return (
        <EmptyState
          compact
          icon={<SearchRoundedIcon />}
          title={`Type at least ${MIN_FUZZY_QUERY_LENGTH} letters`}
          description="One letter matches far too many toys to rank."
        />
      );
    }
    if (pageToys.length === 0 && settled) {
      return (
        <EmptyState
          icon={<ToysRoundedIcon />}
          title={
            sourceName
              ? searching
                ? `No ${sourceName} toys match “${search}”`
                : `No ${sourceName} toys`
              : `No toys match “${search}”`
          }
          description={
            searching
              ? "The search reads toy names, forgiving a typo or two; try a shorter word."
              : "Blizzard files no toy under this source."
          }
          action={
            searching ? (
              <Button variant="outlined" size="small" onClick={clearSearchAndFocus}>
                Clear search
              </Button>
            ) : (
              <Button variant="outlined" size="small" onClick={clearSourceAndFocus}>
                Show every source
              </Button>
            )
          }
        />
      );
    }
    // The pager keeps its slot whether the page shows cards or is still
    // filling, so a page picked before the scan reached it does not unmount
    // the focused page button. If that page turns out empty (the list ends
    // on the page before), the guard hands focus to the heading.
    let body: JSX.Element | null;
    if (pageToys.length > 0) {
      body = <ToyGrid toys={pageToys} label={resultsTitle} onOpen={openToy} />;
    } else {
      // The status above explains a stopped scan (and offers Resume).
      body = scan.error ? null : <ToyGridSkeleton label={`Looking for ${sourceName ?? ""} toys`} />;
    }
    return (
      <Stack spacing={2.5}>
        {body}
        {pageToys.length > 0 && pageFilling && !scan.error ? (
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
            <CircularProgress size={16} thickness={5} aria-hidden />
            <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
              {`Reading the rest of the list for more ${sourceName ?? ""} toys…`}
            </Typography>
          </Stack>
        ) : null}
        {pageCount > 1 ? (
          <FocusGuard fallbackRef={headingRef} sx={{ alignSelf: "center", maxWidth: "100%" }}>
            <Pagination
              count={pageCount}
              page={page}
              onChange={(_event, next) => handlePageChange(next)}
              siblingCount={1}
              aria-label="Toy pages"
            />
          </FocusGuard>
        ) : null}
      </Stack>
    );
  };

  return (
    <Stack
      sx={(theme) => ({
        gap: {
          xs: theme.spacing(theme.wc.layout.sectionGap.xs),
          md: theme.spacing(theme.wc.layout.sectionGap.md),
        },
      })}
    >
      <PageHeader
        eyebrow={eyebrow}
        breadcrumbs={breadcrumbs}
        title="Toys"
        documentTitle={documentTitle}
        icon={<ToysRoundedIcon />}
        description="Every toy in Blizzard's toy box with its icon and where it comes from: search by name, sort newest first or A to Z, filter by source, and open any toy for what it does, its cooldown and where to get it."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {total > 0 ? <Chip size="small" label={pluralize(total, "toy", "toys")} /> : null}
            {results.allChecked ? (
              <Chip
                size="small"
                variant="outlined"
                label={pluralize(sourceOptions.length, "source", "sources")}
              />
            ) : null}
          </>
        }
      />

      {/* A Retry puts the failed index back to pending; the held error keeps
          the spotlight's skeleton from pushing the focused Retry down. */}
      <ToySpotlight
        index={index}
        indexPending={indexQuery.isPending && indexError === null}
        onOpen={openToy}
      />

      <ToyFilters
        draft={draft}
        onDraftChange={setDraft}
        onSearch={handleSearch}
        onClearSearch={clearSearch}
        searchInputRef={searchInputRef}
        toyCount={total}
        disabled={index === undefined && indexError !== null}
        searching={searching}
        sort={sort}
        onSortChange={handleSortChange}
        sourceOptions={sourceOptions}
        source={source}
        onSourceChange={handleSourceChange}
        summary={summary}
        progress={scan.running}
      />

      <Paper
        ref={resultsRef}
        component="section"
        variant="outlined"
        aria-labelledby={resultsHeadingId}
        sx={(theme) => ({
          ...scrollMarginSx(theme),
          minWidth: 0,
          borderRadius: `${theme.wc.radius.lg}px`,
          borderColor: theme.palette.border.default,
        })}
      >
        <Stack spacing={2.5} sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack spacing={0.5} sx={{ minWidth: 0 }}>
            <Typography
              ref={headingRef}
              id={resultsHeadingId}
              variant="h5"
              component="h2"
              tabIndex={-1}
              // A script focus target only, never a Tab stop: no ring needed.
              sx={{ m: 0, overflowWrap: "anywhere", "&:focus": { outline: "none" } }}
            >
              {resultsTitle}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              component="p"
              sx={{ m: 0, maxWidth: "72ch" }}
            >
              {resultsNote}
            </Typography>
          </Stack>
          {sourceName && index !== undefined && !tooShort && (!scan.complete || scan.error) ? (
            <SourceScanStatus
              sourceName={sourceName}
              checked={scan.checked}
              total={scan.total}
              found={matches.length}
              running={scan.running}
              paused={scan.paused}
              readingAll={readAll}
              error={scan.error}
              onResume={scan.resume}
              onReadAll={() => setReadAll(true)}
              focusFallbackRef={headingRef}
            />
          ) : null}
          {renderResults()}
        </Stack>
      </Paper>

      <ToyDialog
        open={toyId !== null}
        toyId={shownToyId}
        fallbackName={shownToyId !== null ? nameById.get(shownToyId) : undefined}
        activeSource={source}
        onShowSource={showSource}
        onClose={closeToy}
      />
    </Stack>
  );
};

export default ToysPage;
