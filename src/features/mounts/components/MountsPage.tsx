import FlightRoundedIcon from "@mui/icons-material/FlightRounded";
import SearchOffRoundedIcon from "@mui/icons-material/SearchOffRounded";
import {
  Box,
  Button,
  Chip,
  Pagination,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { SegmentedOption } from "@/components/common/ExplorerFilterBar";
import PageHeader from "@/components/common/PageHeader";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import MountDialog from "@/features/mounts/components/MountDialog";
import MountFilters, { ANY_FACTION } from "@/features/mounts/components/MountFilters";
import type { SourceOption } from "@/features/mounts/components/MountFilters";
import MountGrid, { MountGridSkeleton } from "@/features/mounts/components/MountGrid";
import MountSpotlight from "@/features/mounts/components/MountSpotlight";
import {
  factionSourceCountsQuery,
  mountFacetsQuery,
} from "@/features/mounts/hooks/mountQueries";
import useHeldError from "@/features/mounts/hooks/useHeldError";
import useMountResults, { MATCH_LIMIT } from "@/features/mounts/hooks/useMountResults";
import {
  MOUNT_FACTION_TYPES,
  parseFaction,
  parseSource,
  pluralize,
} from "@/features/mounts/services/mountService";
import type {
  MountFacets,
  MountSort,
  MountSummary,
  TypedRef,
} from "@/features/mounts/types";
import { FACTION_LABELS } from "@/features/pvpSeasons/components/FactionTag";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import { formatNumber, humanizeEnum } from "@/lib/format";
import { MIN_FUZZY_QUERY_LENGTH } from "@/lib/fuzzyMatch";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

/*
 * `q` is also what the global search's "see all" link sets
 * (/category/mounts?q=…). Everything that shapes the list, and the open
 * mount, lives in the URL, so any view can be shared.
 */
const URL_DEFAULTS = {
  q: "",
  source: "",
  faction: "",
  sort: "",
  page: "",
  mount: "",
};

const SORT_LABELS: Readonly<Record<MountSort, string>> = {
  match: "Best match",
  newest: "Newest",
  name: "A–Z",
};

const parseId = (value: string): number | null => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const parseSort = (value: string): MountSort | null =>
  value === "newest" || value === "name" || value === "match" ? value : null;

/**
 * Blizzard's localized name for a source: from the facets, else from a
 * mount on screen, else the code made readable (the facets failed).
 */
const sourceNameIn = (
  facets: MountFacets | undefined,
  mounts: readonly MountSummary[],
  type: string,
): string =>
  facets?.sources.find((facet) => facet.type === type)?.name ??
  mounts.find((mount) => mount.source?.type === type)?.source?.name ??
  humanizeEnum(type);

/** Blizzard's localized faction name, likewise; FactionTag's English one as the last resort. */
const factionNameIn = (
  facets: MountFacets | undefined,
  mounts: readonly MountSummary[],
  type: string,
): string =>
  facets?.factions.find((facet) => facet.type === type)?.name ??
  mounts.find((mount) => mount.faction?.type === type)?.faction?.name ??
  FACTION_LABELS[type as keyof typeof FACTION_LABELS] ??
  humanizeEnum(type);

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

/** Clears the sticky app header when the results are scrolled to. */
const scrollMarginSx = (theme: Theme) => ({
  scrollMarginTop: {
    xs: `${theme.wc.layout.headerHeight.xs + 16}px`,
    md: `${theme.wc.layout.headerHeight.md + 16}px`,
  },
});

/**
 * Mounts: Blizzard's whole mount collection as a gallery of model renders,
 * newest first. Filter by source (each chip counts its mounts) and faction,
 * search names as you type (typos and half-typed words still match), sort
 * A to Z, and open any mount for its description, requirements and every
 * display variant. A random mount sits in the spotlight below the results
 * (above them it pushed the filters and a deep link's results off the first
 * screen). Search, filters, order, page and open mount all live in the URL.
 *
 * Landing costs the index (one request), the source counts (13 one-hit
 * searches, six at a time), one request for the page's 24 records, the
 * spotlight's record and render, and a render lookup per card (six at a
 * time) as it nears the viewport.
 */
const MountsPage = ({
  eyebrow = "Collectibles & Gear",
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const [params, setParams] = useSearchParamsRecord(URL_DEFAULTS);
  const navigate = useNavigate();

  /* ---------------- Criteria (URL first; anything unusable falls back) ---------------- */

  const typedQuery = params.q.trim();
  // Too short to rank names on: one letter prefix-matches most of the index.
  const query = typedQuery.length >= MIN_FUZZY_QUERY_LENGTH ? typedQuery : "";
  const searching = query !== "";
  const source = parseSource(params.source);
  const faction = parseFaction(params.faction);
  const requestedSort = parseSort(params.sort);
  const defaultSort: MountSort = searching ? "match" : "newest";
  const sort: MountSort =
    requestedSort !== null && (searching || requestedSort !== "match")
      ? requestedSort
      : defaultSort;
  const page = Math.max(1, parseId(params.page) ?? 1);

  // Drop what the page cannot use (a typo, an old link, an order that only
  // applies to a search) so the address always describes what is on screen.
  useEffect(() => {
    const patch: Partial<Record<keyof typeof URL_DEFAULTS, null>> = {};
    if (params.q !== "" && query === "") {
      patch.q = null;
    }
    if (params.source !== "" && source === null) {
      patch.source = null;
    }
    if (params.faction !== "" && faction === null) {
      patch.faction = null;
    }
    if (params.sort !== "" && sort === defaultSort) {
      patch.sort = null;
    }
    if (params.page !== "" && (parseId(params.page) ?? 1) <= 1) {
      patch.page = null;
    }
    if (params.mount !== "" && parseId(params.mount) === null) {
      patch.mount = null;
    }
    if (Object.keys(patch).length > 0) {
      setParams(patch, { replace: true });
    }
  }, [
    params.q,
    params.source,
    params.faction,
    params.sort,
    params.page,
    params.mount,
    query,
    source,
    faction,
    sort,
    defaultSort,
    setParams,
  ]);

  /* ---------------- Data ---------------- */

  const results = useMountResults({ query, source, faction, sort, page });
  const index = results.index.data;
  const facetsQuery = useQuery(mountFacetsQuery());
  const facets = facetsQuery.data;
  const facetsError = useHeldError(facetsQuery.error, facetsQuery.isFetching, "facets");
  // A name search counts its own matches; the faction's counts are only
  // needed while a faction narrows the whole collection.
  const factionCountsEnabled = faction !== null && !searching;
  const factionCountsQuery = useQuery({
    ...factionSourceCountsQuery(faction ?? "ALLIANCE"),
    enabled: factionCountsEnabled,
  });
  const factionCountsError = useHeldError(
    factionCountsEnabled ? factionCountsQuery.error : null,
    factionCountsQuery.isFetching,
    `faction-sources-${faction ?? ""}`,
  );

  // A page past the end (a narrower filter, an old link) falls back to the
  // last one, once the current criteria's page count is known.
  const { settledPageCount } = results;
  useEffect(() => {
    if (settledPageCount === undefined || page <= 1) {
      return;
    }
    const last = Math.max(1, settledPageCount);
    if (page > last) {
      setParams({ page: last > 1 ? String(last) : null }, { replace: true });
    }
  }, [settledPageCount, page, setParams]);

  /* ---------------- Search field draft (keystrokes stay local; the URL gets the debounced value) ---------------- */

  const [draft, setDraft] = useState(params.q);
  const emittedRef = useRef(params.q);
  useEffect(() => {
    // The URL changed on its own (back button, a global search link): adopt it.
    if (params.q !== emittedRef.current) {
      emittedRef.current = params.q;
      setDraft(params.q);
    }
  }, [params.q]);
  const handleSearch = useCallback(
    (value: string): void => {
      const next = value.trim();
      emittedRef.current = next;
      setParams({ q: next || null, page: null }, { replace: true });
    },
    [setParams],
  );

  /* ---------------- Filters ---------------- */

  const searchInputRef = useRef<HTMLInputElement>(null);
  const handleSourceChange = (next: string | null): void =>
    setParams({ source: next === null ? null : next.toLowerCase(), page: null });
  const handleFactionChange = (next: string): void =>
    setParams({ faction: next === ANY_FACTION ? null : next.toLowerCase(), page: null });
  const handleSortChange = (next: MountSort): void =>
    setParams({ sort: next === defaultSort ? null : next, page: null });
  // The Clear button disappears with what it cleared; focus moves to the
  // search field rather than falling back to the top of the document.
  const clearFilters = (): void => {
    setParams({ source: null, faction: null, page: null });
    searchInputRef.current?.focus();
  };
  const clearSearch = (): void => {
    emittedRef.current = "";
    setDraft("");
    setParams({ q: null, page: null }, { replace: true });
    searchInputRef.current?.focus();
  };

  const sourceName = (type: string): string => sourceNameIn(facets, results.mounts, type);
  const factionName = (type: string): string => factionNameIn(facets, results.mounts, type);

  // Counts follow what a chip would show: a search's own matches, the
  // chosen faction's mounts, or the whole collection.
  const sourceCounts = searching
    ? results.matchSourceCounts
    : faction !== null
      ? factionCountsQuery.data
      : undefined;
  const sourceOptions = useMemo((): SourceOption[] | undefined => {
    if (!facets) {
      return undefined;
    }
    const listed = facets.sources.map((facet): SourceOption => {
      // A search's tally lists only the sources its matches have.
      const count =
        searching || faction !== null
          ? sourceCounts
            ? (sourceCounts[facet.type] ?? 0)
            : undefined
          : facet.count;
      return {
        type: facet.type,
        value: facet.type,
        label: facet.name,
        count,
        // Kept (and enabled) when chosen, so it can always be turned off.
        disabled: count === 0 && facet.type !== source,
      };
    });
    // A source from a link that no longer has mounts still shows as chosen.
    if (source !== null && !listed.some((option) => option.value === source)) {
      listed.push({ type: source, value: source, label: sourceNameIn(facets, [], source), count: 0 });
    }
    return listed;
  }, [facets, searching, faction, sourceCounts, source]);

  const factionOptions = useMemo(
    (): SegmentedOption[] => [
      { value: ANY_FACTION, label: "All" },
      // Not from the mounts on screen: the labels would change with the page.
      ...MOUNT_FACTION_TYPES.map((type) => ({ value: type, label: factionNameIn(facets, [], type) })),
    ],
    [facets],
  );
  const sortOptions = useMemo(
    (): SegmentedOption<MountSort>[] =>
      (searching ? (["match", "newest", "name"] as const) : (["newest", "name"] as const)).map(
        (value) => ({ value, label: SORT_LABELS[value] }),
      ),
    [searching],
  );

  /* ---------------- Mount dialog ---------------- */

  const mountId = parseId(params.mount);
  // The id outlives the URL param so the dialog never blanks while closing.
  const [shownMountId, setShownMountId] = useState<number | null>(mountId);
  if (mountId !== null && mountId !== shownMountId) {
    setShownMountId(mountId);
  }
  // The card or spotlight that opened it: its record shows while the full one loads.
  const [openedFrom, setOpenedFrom] = useState<MountSummary | undefined>(undefined);
  // Opened by a click on this page (a history entry we pushed), not a shared link.
  const openedHereRef = useRef(false);
  useEffect(() => {
    if (mountId === null) {
      openedHereRef.current = false;
    }
  }, [mountId]);

  const openMount = useCallback(
    (mount: MountSummary): void => {
      openedHereRef.current = true;
      setOpenedFrom(mount);
      setParams({ mount: String(mount.id) });
    },
    [setParams],
  );
  // Closing a dialog this page opened steps back over its history entry, so
  // Back after closing leaves the page instead of reopening the mount.
  const closeMount = useCallback((): void => {
    if (openedHereRef.current) {
      openedHereRef.current = false;
      navigate(-1);
      return;
    }
    setParams({ mount: null }, { replace: true });
  }, [navigate, setParams]);

  // "More Vendor mounts" starts a fresh list of that source (a search or
  // faction from before would most likely narrow it away), then brings the
  // results into view with focus on their heading, so the next Tab continues
  // in what just appeared.
  const resultsRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusPendingRef = useRef(false);
  useEffect(() => {
    if (!focusPendingRef.current || mountId !== null) {
      return;
    }
    focusPendingRef.current = false;
    scrollToTop(resultsRef.current);
    headingRef.current?.focus({ preventScroll: true });
  }, [source, mountId]);
  const showSource = useCallback(
    (picked: TypedRef): void => {
      openedHereRef.current = false;
      focusPendingRef.current = true;
      setParams(
        {
          mount: null,
          source: picked.type.toLowerCase(),
          q: null,
          faction: null,
          sort: null,
          page: null,
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const dialogSeed =
    openedFrom?.id === shownMountId
      ? openedFrom
      : results.mounts.find((mount) => mount.id === shownMountId);

  /* ---------------- Paging ---------------- */

  // A grid is read from the top: a new page starts at its first card.
  const handlePageChange = (next: number): void => {
    setParams({ page: next > 1 ? String(next) : null });
    resultsRef.current?.scrollIntoView({ block: "start" });
  };

  /* ---------------- Labels ---------------- */

  const { mounts, pageCount, placeholder, mode } = results;
  const shownPage = results.page;
  const filtered = source !== null || faction !== null;

  // Exact wherever Blizzard (or the index) says so; a filtered page states
  // only its page count, so the counts behind the chips fill in the rest.
  let total = results.total;
  if (mode === "filtered") {
    if (source !== null) {
      total =
        faction !== null
          ? factionCountsQuery.data?.[source]
          : facets?.sources.find((facet) => facet.type === source)?.count;
    } else if (faction !== null) {
      total = facets?.factions.find((facet) => facet.type === faction)?.count;
    }
  }

  const resultsTitle = ((): string => {
    if (searching) {
      return `Mounts matching “${query}”`;
    }
    if (source !== null && faction !== null) {
      return `${sourceName(source)} mounts · ${factionName(faction)}`;
    }
    if (source !== null) {
      return `${sourceName(source)} mounts`;
    }
    if (faction !== null) {
      return `${factionName(faction)} mounts`;
    }
    return "All mounts";
  })();

  const orderNote: Record<MountSort, string> = {
    match: "Closest names first; typos and half-typed words still match.",
    newest:
      "Newest first by mount ID. Game knowledge, not API data: higher IDs are generally newer mounts; the API lists no release dates.",
    name: "A to Z by name.",
  };
  // Only where the order is made here: Blizzard orders a filtered list.
  const placeholderNote =
    mode !== "filtered" && sort !== "match"
      ? "Records named with a [PH] or [DND] placeholder tag come last."
      : null;
  const searchNote = [
    searching && faction !== null ? `${factionName(faction)} only.` : null,
    searching && source !== null ? `From ${sourceName(source)} only.` : null,
    searching && results.truncated
      ? `Showing the ${formatNumber(MATCH_LIMIT)} closest names; add a word to narrow the search.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  const pagePart =
    pageCount > 1 ? ` · page ${formatNumber(shownPage)} of ${formatNumber(pageCount)}` : "";
  const summary = ((): string => {
    if (results.error) {
      return "Couldn't load mounts";
    }
    if (results.loading || placeholder) {
      return "Loading mounts…";
    }
    if (mounts.length === 0) {
      // A page past the end is being stepped back (see above), not empty.
      return page > Math.max(1, pageCount) ? "Loading mounts…" : "No mounts match";
    }
    if (total !== undefined) {
      // A capped search says so here too: this line is the one announced.
      const capPart =
        searching && results.truncated
          ? ` among the ${formatNumber(MATCH_LIMIT)} closest names`
          : "";
      return `${pluralize(total, searching ? "match" : "mount", searching ? "matches" : "mounts")}${capPart}${pagePart}`;
    }
    return `Page ${formatNumber(shownPage)} of ${formatNumber(pageCount)}`;
  })();

  const documentTitle = searching ? `${query} · Mounts` : filtered ? resultsTitle : "Mounts";

  /* ---------------- Render ---------------- */

  const resultsHeadingId = useId();

  const renderResults = (): JSX.Element => {
    if (results.error) {
      return (
        <ErrorState
          error={results.error}
          context={results.index.data === undefined && mode !== "filtered" ? "the mount index" : "mounts"}
          onRetry={results.retry}
        />
      );
    }
    // Loading, or a page past the end that the effect above is stepping back from.
    if (
      results.loading ||
      (mounts.length === 0 && (placeholder || page > Math.max(1, pageCount)))
    ) {
      return <MountGridSkeleton />;
    }
    if (mounts.length === 0) {
      const filterAction = filtered ? (
        <Button variant="outlined" size="small" onClick={clearFilters}>
          Clear filters
        </Button>
      ) : undefined;
      if (searching) {
        return (
          <EmptyState
            icon={<SearchOffRoundedIcon />}
            // The query is typed text: one long word must wrap, not widen the page.
            sx={{ overflowWrap: "anywhere" }}
            title={
              filtered
                ? `No mounts named like “${query}” with these filters`
                : `No mounts named like “${query}”`
            }
            description="Names match as you type and forgive a typo or two; try one distinctive word of the name."
            action={
              filtered ? (
                filterAction
              ) : (
                <Button variant="outlined" size="small" onClick={clearSearch}>
                  Clear search
                </Button>
              )
            }
          />
        );
      }
      return (
        <EmptyState
          icon={<FlightRoundedIcon />}
          title={filtered ? "No mounts match these filters" : "No mounts listed"}
          description={((): string => {
            if (source !== null && faction !== null) {
              return `Blizzard lists no ${factionName(faction)} mounts from ${sourceName(source)} in this region.`;
            }
            if (source !== null) {
              return `Blizzard lists no mounts from ${sourceName(source)} in this region.`;
            }
            if (faction !== null) {
              return `Blizzard lists no ${factionName(faction)} mounts in this region.`;
            }
            return "Blizzard returned an empty mount index for this region.";
          })()}
          action={filterAction}
        />
      );
    }
    return (
      <Stack spacing={2.5}>
        <Box
          aria-busy={placeholder || undefined}
          sx={(theme) => ({
            opacity: placeholder ? 0.6 : 1,
            transition: theme.transitions.create("opacity", {
              duration: theme.wc.motion.base,
            }),
          })}
        >
          <MountGrid mounts={mounts} label={resultsTitle} onSelect={openMount} />
        </Box>
        {pageCount > 1 ? (
          <Pagination
            count={pageCount}
            page={Math.min(shownPage, pageCount)}
            onChange={(_event, next) => handlePageChange(next)}
            siblingCount={1}
            aria-label="Mount pages"
            sx={{ alignSelf: "center" }}
          />
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
        title="Mounts"
        documentTitle={documentTitle}
        icon={<FlightRoundedIcon />}
        description="Every mount in Blizzard's game data with its model render: filter by where it comes from and by faction, search by name, and open any mount for its description, requirements and every display variant."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {index && index.length > 0 ? (
              <Chip size="small" label={pluralize(index.length, "mount", "mounts")} />
            ) : null}
            {facets && facets.sources.length > 0 ? (
              <Chip size="small" label={pluralize(facets.sources.length, "source", "sources")} />
            ) : null}
          </>
        }
      />

      <MountFilters
        draft={draft}
        onDraftChange={setDraft}
        onSearch={handleSearch}
        searchInputRef={searchInputRef}
        minQueryLength={MIN_FUZZY_QUERY_LENGTH}
        sourceOptions={sourceOptions}
        sourcesError={facets ? null : facetsError}
        onRetrySources={() => void facetsQuery.refetch()}
        countsError={factionCountsQuery.data ? null : factionCountsError}
        onRetryCounts={() => void factionCountsQuery.refetch()}
        source={source}
        onSourceChange={handleSourceChange}
        factionOptions={factionOptions}
        faction={faction ?? ANY_FACTION}
        onFactionChange={handleFactionChange}
        sortOptions={sortOptions}
        sort={sort}
        onSortChange={handleSortChange}
        canClear={filtered}
        onClear={clearFilters}
        summary={summary}
        progress={results.fetching && (placeholder || results.loading)}
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
              {[orderNote[sort], placeholderNote, searchNote].filter(Boolean).join(" ")}
            </Typography>
          </Stack>
          {renderResults()}
        </Stack>
      </Paper>

      <MountSpotlight
        index={index}
        indexPending={results.index.isPending}
        // The results section reports the index's failure wherever the list
        // is built from it; a filtered list is not, so the spotlight does.
        indexError={mode === "filtered" ? results.indexError : null}
        onRetryIndex={() => void results.index.refetch()}
        onOpen={openMount}
      />

      <MountDialog
        open={mountId !== null}
        mountId={shownMountId}
        seed={dialogSeed}
        activeSource={source}
        onShowSource={showSource}
        onClose={closeMount}
      />
    </Stack>
  );
};

export default MountsPage;
