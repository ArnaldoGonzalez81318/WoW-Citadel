import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import FamilyRestroomRoundedIcon from "@mui/icons-material/FamilyRestroomRounded";
import { Box, Button, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import HeirloomDialog from "@/features/heirlooms/components/HeirloomDialog";
import HeirloomFilters from "@/features/heirlooms/components/HeirloomFilters";
import type { HeirloomGridEntry } from "@/features/heirlooms/components/HeirloomGrid";
import HeirloomSearchResults from "@/features/heirlooms/components/HeirloomSearchResults";
import { scrollMarginSx } from "@/features/heirlooms/components/heirloomStyles";
import NewestShowcase, {
  SHOWCASE_COLS,
  SHOWCASE_COUNT,
} from "@/features/heirlooms/components/NewestShowcase";
import type { ShowcaseEntry } from "@/features/heirlooms/components/NewestShowcase";
import SlotGallery, { SlotGallerySkeleton } from "@/features/heirlooms/components/SlotGallery";
import { useHeirloomCatalog } from "@/features/heirlooms/hooks/useHeirloomCatalog";
import {
  buildFacets,
  buildTypeIndex,
  groupBySlot,
  hasFilters,
  matchesFilters,
  newestFirst,
} from "@/features/heirlooms/services/heirloomCatalog";
import type { FilterKey, HeirloomFilters as Filters } from "@/features/heirlooms/services/heirloomCatalog";
import { STAT_ORDER, pluralize } from "@/features/heirlooms/services/heirloomService";
import type { Heirloom, HeirloomRef, StatKey } from "@/features/heirlooms/types";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import {
  MIN_FUZZY_QUERY_LENGTH,
  normalizeForSearch,
  rankByName,
} from "@/lib/fuzzyMatch";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

const URL_DEFAULTS = {
  q: "",
  slot: "",
  type: "",
  stat: "",
  source: "",
  heirloom: "",
};

/** A showcase tile's height plus its 1px borders, for the loading grid. */
const SHOWCASE_TILE_CELL = 178;

const parseId = (value: string): number | null => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const parseStat = (value: string): StatKey | null =>
  (STAT_ORDER as readonly string[]).includes(value) ? (value as StatKey) : null;

/** "52 of 134 heirlooms": a determinate bar while the collection loads. */
const LoadProgress = ({ done, total }: { done: number; total: number }): JSX.Element => {
  const value = total > 0 ? Math.round((done / total) * 100) : 0;
  const text = `Loading heirloom records: ${formatNumber(done)} of ${formatNumber(total)}`;
  return (
    <Stack spacing={0.75}>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
        {text}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={value}
        aria-label="Loading heirloom records"
        aria-valuetext={text}
        sx={(theme) => ({ height: 4, borderRadius: `${theme.wc.radius.pill}px` })}
      />
    </Stack>
  );
};

/**
 * Heirlooms: Blizzard's heirloom collection as an atlas by slot. Every
 * heirloom is a card with its icon, slot and type, its upgrade ladder as
 * bars and item level range, and its source; the latest additions lead the
 * page. Search by name, filter by slot, armor or weapon type, primary stat
 * and source; open any heirloom for its tooltip at each upgrade level, a
 * table of every level's stats and where to get it. Search, filters and the
 * open heirloom all live in the URL.
 *
 * The page loads the index and then every record (134 on US, six at a time,
 * newest first, with progress shown): slot, type, stats and source only come
 * with each record, and grouping needs them all. Icons load as cards near
 * the viewport.
 */
const HeirloomsPage = ({
  eyebrow = "Collectibles & Gear",
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const [params, setParams] = useSearchParamsRecord(URL_DEFAULTS);
  const navigate = useNavigate();
  // A shared link's heirloom jumps the loading queue. Read once: the order
  // is the queue, and changing it mid-load would only reshuffle the list.
  const [priorityId] = useState(() => parseId(params.heirloom));
  const catalog = useHeirloomCatalog(priorityId);
  const { entries, records, failedIds, missingIds } = catalog;
  const index = catalog.index.data;

  const loaded = useMemo(
    () =>
      entries
        .map((entry) => records.get(entry.id))
        .filter((heirloom): heirloom is Heirloom => heirloom !== undefined),
    [entries, records],
  );
  const typeIndex = useMemo(() => buildTypeIndex(loaded), [loaded]);
  const ceiling = useMemo(
    () => loaded.reduce((top, heirloom) => Math.max(top, heirloom.maxItemLevel ?? 0), 0),
    [loaded],
  );
  const maxLevel = useMemo(
    () => loaded.reduce((top, heirloom) => Math.max(top, heirloom.maxCharacterLevel ?? 0), 0),
    [loaded],
  );
  const nameById = useMemo(
    () => new Map(entries.map((entry) => [entry.id, entry.name])),
    [entries],
  );

  /* ---------------- Failures (each banner keeps its Retry while retrying) ---------------- */

  // A refetch of the index after it failed puts it back to pending with no
  // error; it is still the failed index being retried, not a first load, so
  // its error (and the focused Retry button) stay put meanwhile.
  const indexFirstLoad = catalog.index.isPending && catalog.index.errorUpdateCount === 0;
  const [lastIndexError, setLastIndexError] = useState<Error | null>(null);
  if (catalog.index.error !== null && catalog.index.error !== lastIndexError) {
    setLastIndexError(catalog.index.error);
  }
  const indexError = !index && !indexFirstLoad ? (catalog.index.error ?? lastIndexError) : null;
  const indexRetrying = catalog.index.isFetching;

  const [lastRecordError, setLastRecordError] = useState<Error | null>(null);
  if (catalog.error !== null && catalog.error !== lastRecordError) {
    setLastRecordError(catalog.error);
  }
  const recordError = catalog.error ?? lastRecordError;
  // Back on the page with records that failed on an earlier visit:
  // react-query fetches them again on mount, so they count as failed with
  // no error this visit has seen. They are loading like any other record
  // until they land or fail again (which brings the banner).
  const awaitingRetry = catalog.retrying && recordError === null;
  const recordsLoading = !catalog.settled || awaitingRetry;

  /* ---------------- Filters (URL first; unknown values fall back to "any") ---------------- */

  // Record-based values are trusted until the whole collection is in (a
  // shared link filters as soon as its records land); after that, a value
  // no heirloom carries reads as "any" while the effect below drops it.
  const known = useMemo(
    () => ({
      slots: new Set(loaded.map((heirloom) => heirloom.slot)),
      sources: new Set(loaded.map((heirloom) => heirloom.source.key)),
    }),
    [loaded],
  );
  const complete = catalog.complete;
  const requestedStat = parseStat(params.stat);
  const filters = useMemo<Filters>(() => {
    const trusted = (value: string, values: ReadonlySet<string>): string | null =>
      value !== "" && (!complete || values.has(value)) ? value : null;
    // A type key read through the index: one-handed axes ("2-0") and
    // two-handed ones ("2-1") are one "Axe" option, keyed by the lower.
    const canonicalType = params.type ? typeIndex.get(params.type) : undefined;
    return {
      slot: trusted(params.slot, known.slots),
      type: canonicalType ?? (params.type !== "" && !complete ? params.type : null),
      stat: requestedStat,
      source: trusted(params.source, known.sources),
    };
  }, [params.slot, params.type, params.source, requestedStat, typeIndex, known, complete]);
  const filtering = hasFilters(filters);
  const facets = useMemo(
    () => buildFacets(loaded, filters, typeIndex),
    [loaded, filters, typeIndex],
  );

  // Drop what the page cannot use (a typo, an old link, a slot this region
  // lacks) so the address always describes what is on screen. Record-based
  // values wait for the whole collection: until then they may still match.
  useEffect(() => {
    const patch: Partial<Record<keyof typeof URL_DEFAULTS, string | null>> = {};
    if (params.stat !== "" && requestedStat === null) {
      patch.stat = null;
    }
    if (params.heirloom !== "" && parseId(params.heirloom) === null) {
      patch.heirloom = null;
    }
    if (complete) {
      if (params.slot !== "" && filters.slot === null) {
        patch.slot = null;
      }
      // An unknown type goes; a known one is rewritten to its option's key.
      if (params.type !== "" && filters.type !== params.type) {
        patch.type = filters.type;
      }
      if (params.source !== "" && filters.source === null) {
        patch.source = null;
      }
    }
    if (Object.keys(patch).length > 0) {
      setParams(patch, { replace: true });
    }
  }, [
    params.stat,
    params.heirloom,
    params.slot,
    params.type,
    params.source,
    requestedStat,
    complete,
    filters.slot,
    filters.type,
    filters.source,
    setParams,
  ]);

  const handleFilterChange = useCallback(
    (key: FilterKey, value: string | null): void => {
      setParams({ [key]: value });
    },
    [setParams],
  );

  // Every Clear button disappears with what it cleared; focus moves to the
  // search field rather than falling back to the top of the document.
  const searchInputRef = useRef<HTMLInputElement>(null);
  const clearFilters = useCallback((): void => {
    setParams({ slot: null, type: null, stat: null, source: null });
    searchInputRef.current?.focus();
  }, [setParams]);

  /* ---------------- Search (keystrokes stay local; the URL gets the debounced value) ---------------- */

  const search = params.q.trim();
  const searching = search !== "";
  const tooShort = searching && normalizeForSearch(search).length < MIN_FUZZY_QUERY_LENGTH;
  const [draft, setDraft] = useState(params.q);
  const emittedRef = useRef(search);
  useEffect(() => {
    // The URL changed on its own (back button, a shared link): adopt it.
    if (search !== emittedRef.current) {
      emittedRef.current = search;
      setDraft(search);
    }
  }, [search]);
  const handleSearch = useCallback(
    (value: string): void => {
      const next = value.trim();
      emittedRef.current = next;
      setParams({ q: next || null }, { replace: true });
    },
    [setParams],
  );
  const clearSearch = useCallback((): void => {
    emittedRef.current = "";
    setDraft("");
    setParams({ q: null }, { replace: true });
  }, [setParams]);
  const backToSlots = useCallback((): void => {
    clearSearch();
    searchInputRef.current?.focus();
  }, [clearSearch]);

  const statusOf = useCallback(
    (entry: HeirloomRef): HeirloomGridEntry => ({
      entry,
      heirloom: records.get(entry.id) ?? (missingIds.has(entry.id) ? null : undefined),
      failed: failedIds.has(entry.id) && !awaitingRetry,
    }),
    [records, missingIds, failedIds, awaitingRetry],
  );

  // Ranked over the index (names only), so a search answers at once; a
  // match whose record has not landed shows as loading, unless a filter is
  // set, which only a record can pass (see searchPending).
  const searchItems = useMemo<HeirloomGridEntry[]>(() => {
    if (!searching || tooShort) {
      return [];
    }
    return rankByName(entries, search, (entry) => entry.name, entries.length)
      .map(statusOf)
      .filter((item) =>
        item.heirloom ? matchesFilters(item.heirloom, filters, typeIndex) : !filtering,
      );
  }, [searching, tooShort, entries, search, statusOf, filters, typeIndex, filtering]);
  // With a filter set, the matches so far are not the answer (often none,
  // which would read "No heirlooms match" and offer to clear valid
  // filters): the results wait for every record, as the gallery does.
  const searchPending = searching && !tooShort && filtering && recordsLoading;

  /* ---------------- Groups and the newest ---------------- */

  const matching = useMemo(
    () => loaded.filter((heirloom) => matchesFilters(heirloom, filters, typeIndex)),
    [loaded, filters, typeIndex],
  );
  const groups = useMemo(() => groupBySlot(matching, facets), [matching, facets]);
  const showcase = useMemo<ShowcaseEntry[]>(
    () =>
      newestFirst(entries)
        .slice(0, SHOWCASE_COUNT)
        .map((entry) => {
          const status = statusOf(entry);
          return { entry, heirloom: status.heirloom, failed: status.failed ?? false };
        }),
    [entries, statusOf],
  );

  /* ---------------- Heirloom dialog ---------------- */

  const heirloomId = parseId(params.heirloom);
  // The id outlives the URL param so the dialog never blanks while closing.
  const [shownId, setShownId] = useState<number | null>(heirloomId);
  if (heirloomId !== null && heirloomId !== shownId) {
    setShownId(heirloomId);
  }
  // The card that opened it, for its name until the record loads.
  const [opened, setOpened] = useState<HeirloomRef | null>(null);
  // Opened by a click on this page (a history entry we pushed), not a shared link.
  const openedHereRef = useRef(false);
  useEffect(() => {
    if (heirloomId === null) {
      openedHereRef.current = false;
    }
  }, [heirloomId]);

  const openHeirloom = useCallback(
    (entry: HeirloomRef): void => {
      openedHereRef.current = true;
      setOpened(entry);
      setParams({ heirloom: String(entry.id) });
    },
    [setParams],
  );
  // Closing a dialog this page opened steps back over its history entry, so
  // Back after closing leaves the page instead of reopening the heirloom.
  const closeHeirloom = useCallback((): void => {
    if (openedHereRef.current) {
      openedHereRef.current = false;
      navigate(-1);
      return;
    }
    setParams({ heirloom: null }, { replace: true });
  }, [navigate, setParams]);

  /* ---------------- Labels ---------------- */

  const total = entries.length;
  const slotOption = facets.slots.find((option) => option.value === filters.slot);
  let summary: string | undefined;
  if (indexFirstLoad) {
    summary = "Loading heirlooms…";
  } else if (!index) {
    summary = undefined;
  } else if (searching) {
    if (tooShort) {
      summary = "Type at least two letters";
    } else if (filtering && recordsLoading) {
      // Static while the records land: a live region recounting with each
      // one would talk over everything (the filters need every record).
      summary = "Filtering as the records load…";
    } else if (searchItems.length === 0) {
      summary = "No matching heirlooms";
    } else {
      summary = `${formatNumber(searchItems.length)} of ${pluralize(total, "heirloom", "heirlooms")} match`;
    }
  } else if (recordsLoading) {
    // Static for the same reason: a count to 134 would be announced 134 times.
    summary = `Loading ${pluralize(total, "heirloom", "heirlooms")}…`;
  } else if (filtering) {
    summary = `Showing ${formatNumber(matching.length)} of ${pluralize(total, "heirloom", "heirlooms")}`;
  } else {
    summary = `${pluralize(loaded.length, "heirloom", "heirlooms")} in ${pluralize(groups.length, "slot", "slots")}`;
  }

  const openName =
    heirloomId !== null ? (records.get(heirloomId)?.name ?? nameById.get(heirloomId)) : undefined;
  let documentTitle = "Heirlooms";
  if (openName) {
    documentTitle = `${openName} · Heirlooms`;
  } else if (searching) {
    documentTitle = "Search · Heirlooms";
  } else if (slotOption) {
    documentTitle = `${slotOption.label} · Heirlooms`;
  }

  /* ---------------- Render ---------------- */

  const renderGallery = (): JSX.Element => {
    if (!index) {
      return indexError ? (
        <ErrorState
          error={indexError}
          context="heirlooms"
          onRetry={() => {
            // A press while the retry is in flight is ignored rather than restarting it.
            if (!indexRetrying) {
              void catalog.index.refetch();
            }
          }}
          retryLabel={indexRetrying ? "Retrying…" : "Retry"}
        />
      ) : (
        <SlotGallerySkeleton label="Loading heirlooms" />
      );
    }
    if (total === 0) {
      return (
        <EmptyState
          compact
          icon={<FamilyRestroomRoundedIcon />}
          title="No heirlooms listed"
          description="Blizzard returned an empty heirloom index for this region."
        />
      );
    }
    if (recordsLoading) {
      return (
        <Stack spacing={2.5}>
          <LoadProgress
            done={catalog.settledCount + (awaitingRetry ? 0 : catalog.failedCount)}
            total={total}
          />
          <SlotGallerySkeleton label="Loading heirlooms" />
        </Stack>
      );
    }
    const banner =
      catalog.failedCount > 0 && recordError ? (
        <ErrorState
          compact
          error={recordError}
          title={`${pluralize(catalog.failedCount, "heirloom", "heirlooms")} could not be loaded`}
          context="these heirlooms"
          onRetry={catalog.retryFailed}
          retryLabel={catalog.retrying ? "Retrying…" : "Retry"}
        />
      ) : null;
    let body: JSX.Element;
    if (loaded.length === 0) {
      body = (
        <EmptyState
          compact
          icon={<FamilyRestroomRoundedIcon />}
          title="No heirloom records"
          description={
            catalog.failedCount > 0
              ? "None of the heirloom records could be loaded."
              : "Blizzard has no record for any heirloom in its index."
          }
        />
      );
    } else if (groups.length === 0) {
      body = (
        <EmptyState
          icon={<FamilyRestroomRoundedIcon />}
          title="No heirlooms match these filters"
          description="Each filter's menu counts what it would leave with the others applied; clear them and start again."
          action={
            <Button variant="outlined" size="small" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      );
    } else {
      body = <SlotGallery groups={groups} ceiling={ceiling} onSelect={openHeirloom} />;
    }
    return (
      <Stack spacing={2.5}>
        {banner}
        {body}
      </Stack>
    );
  };

  const renderShowcase = (): JSX.Element | null => {
    // A landing view only: with a search or filter set it would sit above
    // the very results it does not belong to.
    if (searching || filtering || (index && total === 0) || indexError) {
      return null;
    }
    return (
      <SectionCard
        title="Latest additions"
        icon={<AutoAwesomeRoundedIcon />}
        description="Highest heirloom ids first. The API gives no dates, but its ids have so far grown as heirlooms were added, so these are most likely the newest."
      >
        {index ? (
          <NewestShowcase items={showcase} onSelect={openHeirloom} />
        ) : (
          <LoadingSkeleton
            variant="grid"
            columns={SHOWCASE_COLS}
            itemHeight={SHOWCASE_TILE_CELL}
            count={SHOWCASE_COUNT}
            gap={12}
            label="Loading the latest heirlooms"
          />
        )}
      </SectionCard>
    );
  };

  const galleryTitle = slotOption ? `${slotOption.label} heirlooms` : "Heirlooms by slot";

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
        title="Heirlooms"
        documentTitle={documentTitle}
        icon={<FamilyRestroomRoundedIcon />}
        description="Every heirloom in Blizzard's collection: warband gear whose stats scale with a character's level. Browse by slot, filter by armor or weapon type, primary stat and source, and open any heirloom for its stats at each upgrade level and where to get it."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {total > 0 ? (
              <Chip size="small" label={pluralize(total, "heirloom", "heirlooms")} />
            ) : null}
            {!recordsLoading && facets.slots.length > 0 ? (
              <Chip size="small" label={pluralize(facets.slots.length, "slot", "slots")} />
            ) : null}
            {!recordsLoading && maxLevel > 0 ? (
              <Chip
                size="small"
                variant="outlined"
                // The highest level any fully upgraded heirloom's requirement line names.
                label={`Scales to level ${formatNumber(maxLevel)}`}
              />
            ) : null}
          </>
        }
      />

      <HeirloomFilters
        draft={draft}
        onDraftChange={setDraft}
        onSearch={handleSearch}
        onClearSearch={clearSearch}
        searchInputRef={searchInputRef}
        searchDisabled={indexError !== null}
        searchPlaceholder={total > 0 ? `Search ${formatNumber(total)} heirlooms` : "Search heirlooms"}
        facets={facets}
        filters={filters}
        facetsReady={!recordsLoading}
        onFilterChange={handleFilterChange}
        canClear={filtering}
        onClear={clearFilters}
        summary={summary}
        progress={Boolean(index) && recordsLoading}
      />

      {renderShowcase()}

      <Box sx={scrollMarginSx}>
        {searching ? (
          <SectionCard
            title="Search results"
            description={
              !tooShort && !searchPending && searchItems.length > 0
                ? `Best match first, across every slot${filtering ? ", with the filters applied" : ""}.`
                : undefined
            }
            actions={
              <Button size="small" onClick={backToSlots}>
                Back to slots
              </Button>
            }
          >
            {index && !searchPending ? (
              <HeirloomSearchResults
                key={`${search}|${filters.slot}|${filters.type}|${filters.stat}|${filters.source}`}
                query={search}
                tooShort={tooShort}
                items={searchItems}
                filtered={filtering}
                ceiling={ceiling}
                onClearFilters={clearFilters}
                onSelect={openHeirloom}
              />
            ) : (
              renderGallery()
            )}
          </SectionCard>
        ) : (
          <SectionCard
            title={galleryTitle}
            description="Armor from head to legs, then back and jewellery, then weapons and off hands; within a slot, by armor or weapon type. Each card's bars are its upgrade ladder: one per upgrade level, as tall as its item level."
          >
            {renderGallery()}
          </SectionCard>
        )}
      </Box>

      <HeirloomDialog
        open={heirloomId !== null}
        heirloomId={shownId}
        fallbackName={
          shownId === null
            ? undefined
            : (nameById.get(shownId) ?? (opened?.id === shownId ? opened.name : undefined))
        }
        onClose={closeHeirloom}
      />
    </Stack>
  );
};

export default HeirloomsPage;
