import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import SearchOffRoundedIcon from "@mui/icons-material/SearchOffRounded";
import { Box, Button, Chip, Pagination, Stack } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import ActiveFilterChips from "@/features/items/components/ActiveFilterChips";
import type { ActiveFilter } from "@/features/items/components/ActiveFilterChips";
import ItemClassTiles, {
  ItemClassTilesSkeleton,
} from "@/features/items/components/ItemClassTiles";
import ItemExplorerDialog from "@/features/items/components/ItemExplorerDialog";
import type { DialogSubject } from "@/features/items/components/ItemExplorerDialog";
import ItemFilters from "@/features/items/components/ItemFilters";
import ItemGrid, { ItemGridSkeleton } from "@/features/items/components/ItemGrid";
import ItemSetsSection from "@/features/items/components/ItemSetsSection";
import SubclassPicker from "@/features/items/components/SubclassPicker";
import {
  itemClassDetailQuery,
  itemClassIndexQuery,
  itemRecordQuery,
  itemSearchQuery,
  itemSetIndexQuery,
  itemSetQuery,
} from "@/features/items/hooks/itemQueries";
import useStickyError from "@/features/items/hooks/useStickyError";
import {
  ITEM_PAGE_SIZE,
  QUALITY_LABEL,
  SLOT_GROUPS,
  SORT_OPTIONS,
  WEAPON_CLASS_ID,
  classTakesSlots,
  describeLevelRange,
  findSlotGroup,
  formatLevelParam,
  hasLevelRange,
  orderClassTiles,
  parseLevelRange,
  parseQuality,
  parseSort,
  slotFitsClass,
} from "@/features/items/services/itemCatalog";
import { pluralize } from "@/features/items/services/itemService";
import type {
  ItemClassSummary,
  ItemLevelRange,
  ItemSearchCriteria,
  ItemSetSummary,
  ItemSort,
  ItemSubclassSummary,
  ItemSummary,
} from "@/features/items/types";
import type { QualityKey } from "@/theme";
import useNearViewport from "@/hooks/useNearViewport";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

/*
 * `q` is also what the search results page links here with
 * ("/category/items?q=thunderfury"), so it stays the name parameter.
 */
const URL_DEFAULTS = {
  q: "",
  class: "",
  subclass: "",
  quality: "",
  slot: "",
  ilvl: "",
  sort: "",
  page: "",
  item: "",
  set: "",
  setq: "",
  setpage: "",
};

/** Blizzard's search needs a whole word; one letter is never one worth sending. */
const MIN_QUERY_LENGTH = 2;
const EMPTY_CLASSES: ItemClassSummary[] = [];
const EMPTY_SUBCLASSES: ItemSubclassSummary[] = [];
const NO_LEVEL: ItemLevelRange = { min: null, max: null };
const RESULTS_ID = "item-results";
/**
 * Weapon lists 21 subclasses, the most of any class, and loads slowest (its
 * duplicate names take six more requests): its placeholder sketches them all.
 */
const WEAPON_SUBCLASS_ESTIMATE = 21;

/** Class and subclass ids start at 0 (Consumable, Explosives and Devices). */
const parseIndex = (value: string): number | null => {
  if (!/^\d{1,6}$/.test(value)) {
    return null;
  }
  return Number(value);
};

const parseId = (value: string): number | null => {
  const id = parseIndex(value);
  return id !== null && id > 0 ? id : null;
};

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
 * Items: Blizzard's item database as an explorer. Every item class is a
 * tile; the search under it filters by name, class and subclass, quality,
 * equipment slot and item level, sorted newest first (the landing view),
 * by item level or by name, 24 quality-framed cards to a page. Any item
 * opens in a dialog with its in-game tooltip, drawn from Blizzard's
 * preview, and its set's pieces. Below, every item set with its pieces and
 * bonuses. Filters, page, sort and the open item or set live in the URL.
 *
 * A page costs one search request (each hit is the whole item record) plus
 * an icon per card as it nears the viewport; the class tiles' icons are 19
 * more, and the set index only loads once its section is scrolled near.
 */
const ItemsPage = ({
  eyebrow = "Collectibles & Gear",
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const [params, setParams] = useSearchParamsRecord(URL_DEFAULTS);
  const navigate = useNavigate();

  /* ---------------- Classes ---------------- */

  const classIndexQuery = useQuery(itemClassIndexQuery());
  const classIndexError = useStickyError("item-class-index", classIndexQuery);
  const classes = classIndexQuery.data ?? EMPTY_CLASSES;
  const tiles = useMemo(() => orderClassTiles(classes), [classes]);

  /* ---------------- Criteria (URL first; unknown values fall back to "any") ---------------- */

  const name = params.q.trim();
  const tooShort = name.length > 0 && name.length < MIN_QUERY_LENGTH;
  const requestedClass = parseIndex(params.class);
  // Trusted until the index says otherwise, so a shared link starts loading at once.
  const classId =
    requestedClass !== null &&
    (!classIndexQuery.isSuccess || classes.some((entry) => entry.id === requestedClass))
      ? requestedClass
      : null;

  const classDetailQuery = useQuery({
    ...itemClassDetailQuery(classId ?? 0),
    enabled: classId !== null,
  });
  const classDetailError = useStickyError(`item-class-${classId ?? "none"}`, classDetailQuery);
  const subclasses =
    classId !== null ? (classDetailQuery.data?.subclasses ?? EMPTY_SUBCLASSES) : EMPTY_SUBCLASSES;
  const requestedSubclass = classId !== null ? parseIndex(params.subclass) : null;
  const subclassId =
    requestedSubclass !== null &&
    (!classDetailQuery.isSuccess || subclasses.some((entry) => entry.id === requestedSubclass))
      ? requestedSubclass
      : null;

  const quality = parseQuality(params.quality);
  const requestedSlot = findSlotGroup(params.slot || null);
  const slot = requestedSlot && slotFitsClass(requestedSlot, classId) ? requestedSlot.key : null;
  const parsedLevel = useMemo(() => parseLevelRange(params.ilvl), [params.ilvl]);
  const levelMin = parsedLevel?.min ?? null;
  const levelMax = parsedLevel?.max ?? null;
  const level = useMemo<ItemLevelRange>(
    () => (levelMin === null && levelMax === null ? NO_LEVEL : { min: levelMin, max: levelMax }),
    [levelMin, levelMax],
  );
  const sort: ItemSort = parseSort(params.sort) ?? "newest";
  const page = Math.max(1, parseId(params.page) ?? 1);

  // Drop what the page cannot use (a typo, an old link, a subclass the class
  // no longer lists) so the address always describes the results on screen.
  useEffect(() => {
    const patch: Partial<Record<keyof typeof URL_DEFAULTS, string | null>> = {};
    if (tooShort) {
      patch.q = null;
    }
    if (
      params.class !== "" &&
      classId === null &&
      (requestedClass === null || classIndexQuery.isSuccess)
    ) {
      patch.class = null;
      patch.subclass = null;
    }
    if (
      params.subclass !== "" &&
      subclassId === null &&
      (requestedSubclass === null || classDetailQuery.isSuccess || classId === null)
    ) {
      patch.subclass = null;
    }
    if (params.quality !== "" && quality === null) {
      patch.quality = null;
    }
    // A slot the class cannot hold waits for the index to confirm the class.
    if (
      params.slot !== "" &&
      slot === null &&
      (requestedSlot === undefined || classIndexQuery.isSuccess)
    ) {
      patch.slot = null;
    }
    if (params.ilvl !== "") {
      // A malformed range is dropped; a reversed one is written the right way round.
      const canonical = parsedLevel ? formatLevelParam(parsedLevel) : null;
      if (canonical !== params.ilvl) {
        patch.ilvl = canonical;
      }
    }
    if (params.sort !== "" && parseSort(params.sort) === null) {
      patch.sort = null;
    }
    if (params.page !== "" && parseId(params.page) === null) {
      patch.page = null;
    }
    if (params.item !== "" && parseId(params.item) === null) {
      patch.item = null;
    }
    if (params.set !== "" && parseId(params.set) === null) {
      patch.set = null;
    }
    if (Object.keys(patch).length > 0) {
      setParams(patch, { replace: true });
    }
  }, [
    params.class,
    params.subclass,
    params.quality,
    params.slot,
    params.ilvl,
    params.sort,
    params.page,
    params.item,
    params.set,
    tooShort,
    classId,
    requestedClass,
    classIndexQuery.isSuccess,
    subclassId,
    requestedSubclass,
    classDetailQuery.isSuccess,
    quality,
    slot,
    requestedSlot,
    parsedLevel,
    setParams,
  ]);

  const criteria = useMemo<ItemSearchCriteria>(
    () => ({
      name: tooShort ? "" : name,
      classId,
      subclassId,
      quality,
      slot,
      level,
      sort,
    }),
    [tooShort, name, classId, subclassId, quality, slot, level, sort],
  );
  const hasFilters =
    criteria.name !== "" ||
    classId !== null ||
    quality !== null ||
    slot !== null ||
    hasLevelRange(level);

  /* ---------------- Search ---------------- */

  const searchQuery = useQuery({
    ...itemSearchQuery(criteria, page),
    // The last page stays up (dimmed) while the next one loads, instead of
    // the grid collapsing to skeletons on every page or filter change.
    placeholderData: keepPreviousData,
  });
  // Placeholder data only stands in for results that are on screen: after a
  // failed search (an error block, no cards), the next one shows skeletons,
  // not the results from before the failure under its own title.
  const shownResultsRef = useRef(false);
  const data =
    !searchQuery.isPlaceholderData || shownResultsRef.current ? searchQuery.data : undefined;
  useEffect(() => {
    shownResultsRef.current = data !== undefined;
  });
  const placeholder = searchQuery.isPlaceholderData && data !== undefined;
  const searchError = useStickyError(`${JSON.stringify(criteria)}|${page}`, {
    data: searchQuery.isPlaceholderData ? undefined : searchQuery.data,
    error: searchQuery.error,
    errorUpdateCount: searchQuery.errorUpdateCount,
    isFetching: searchQuery.isFetching,
    refetch: searchQuery.refetch,
  });
  const pageCount = data?.pageCount ?? 0;

  // A page past the end (a narrower search, an old link) falls back to the
  // last one; Blizzard reports pageCount 0 for no matches, which is page 1.
  useEffect(() => {
    if (!data || placeholder || page <= 1) {
      return;
    }
    const last = Math.max(1, data.pageCount);
    if (page > last) {
      setParams({ page: last > 1 ? String(last) : null }, { replace: true });
    }
  }, [data, placeholder, page, setParams]);

  /* ---------------- Search field draft (keystrokes stay local; the URL gets the debounced value) ---------------- */

  const [draft, setDraft] = useState(params.q);
  const emittedRef = useRef(params.q);
  useEffect(() => {
    // The URL changed on its own (Back, a chip, Browse from the dialog): adopt it.
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

  const selectClass = useCallback(
    (next: number | null): void => {
      const keepSlot = requestedSlot !== undefined && slotFitsClass(requestedSlot, next);
      setParams({
        class: next === null ? null : String(next),
        subclass: null,
        slot: keepSlot ? requestedSlot.key : null,
        page: null,
      });
    },
    [requestedSlot, setParams],
  );
  const selectSubclass = (next: number | null): void =>
    setParams({ subclass: next === null ? null : String(next), page: null });
  const selectQuality = (next: QualityKey | null): void =>
    setParams({ quality: next, page: null });
  const selectSlot = (next: string | null): void => setParams({ slot: next, page: null });
  // Typed values replace the entry, like the name: Back leaves the page, not a keystroke.
  const selectLevel = (next: ItemLevelRange): void =>
    setParams({ ilvl: formatLevelParam(next), page: null }, { replace: true });
  const selectSort = (next: ItemSort): void =>
    setParams({ sort: next === "newest" ? null : next, page: null });

  const clearAll = (): void => {
    emittedRef.current = "";
    setDraft("");
    setParams({
      q: null,
      class: null,
      subclass: null,
      quality: null,
      slot: null,
      ilvl: null,
      page: null,
    });
  };

  // With no class picked, the disabled detail observer still holds class 0's
  // cached record (Consumable): its name must not head every item.
  const className =
    classId === null
      ? undefined
      : (classes.find((entry) => entry.id === classId)?.name ??
        classDetailQuery.data?.name ??
        `Class #${classId}`);
  const subclassName = subclasses.find((entry) => entry.id === subclassId)?.name;
  const slotGroup = findSlotGroup(slot);

  const activeFilters: ActiveFilter[] = [];
  if (criteria.name) {
    activeFilters.push({
      key: "q",
      label: `Name: ${criteria.name}`,
      onRemove: () => {
        emittedRef.current = "";
        setDraft("");
        setParams({ q: null, page: null });
      },
    });
  }
  if (classId !== null && className) {
    activeFilters.push({
      key: "class",
      label: className,
      onRemove: () => selectClass(null),
    });
  }
  if (subclassId !== null) {
    activeFilters.push({
      key: "subclass",
      label: subclassName ?? `Type #${subclassId}`,
      onRemove: () => selectSubclass(null),
    });
  }
  if (quality) {
    activeFilters.push({
      key: "quality",
      label: QUALITY_LABEL[quality],
      onRemove: () => selectQuality(null),
    });
  }
  if (slotGroup) {
    activeFilters.push({
      key: "slot",
      label: slotGroup.label,
      onRemove: () => selectSlot(null),
    });
  }
  if (hasLevelRange(level)) {
    activeFilters.push({
      key: "ilvl",
      label: describeLevelRange(level),
      onRemove: () => selectLevel(NO_LEVEL),
    });
  }

  const slotGroups = useMemo(
    () =>
      classTakesSlots(classId)
        ? SLOT_GROUPS.filter((group) => slotFitsClass(group, classId))
        : [],
    [classId],
  );

  // After "Browse" in the dialog: bring the results into view with focus on
  // their heading, so the next Tab continues in what just appeared.
  const resultsRef = useRef<HTMLDivElement>(null);
  const focusResultsRef = useRef(false);
  // After a tile pick whose results start below the fold (phones, where the
  // filters sit between; laptops, under the tile grid): bring them up. Focus
  // goes with them, or the next Tab would scroll back to a tile off screen.
  // A pick whose results are already in view leaves focus on the tile.
  const revealResultsRef = useRef(false);
  useEffect(() => {
    const showResults = (): void => {
      scrollToTop(resultsRef.current);
      // SectionCard names its h2 `${id}-title` and keeps no ref to it.
      const heading = document.getElementById(`${RESULTS_ID}-title`);
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    };
    if (focusResultsRef.current) {
      focusResultsRef.current = false;
      revealResultsRef.current = false;
      showResults();
      return;
    }
    if (revealResultsRef.current) {
      revealResultsRef.current = false;
      const top = resultsRef.current?.getBoundingClientRect().top;
      if (top !== undefined && top > window.innerHeight * 0.75) {
        showResults();
      }
    }
  }, [classId, subclassId]);
  const pickClassTile = (next: number | null): void => {
    revealResultsRef.current = true;
    selectClass(next);
  };

  /* ---------------- Dialog (an item or a set) ---------------- */

  const itemId = parseId(params.item);
  const setId = itemId === null ? parseId(params.set) : null;
  const subject = useMemo<DialogSubject | null>(
    () =>
      itemId !== null
        ? { kind: "item", id: itemId }
        : setId !== null
          ? { kind: "set", id: setId }
          : null,
    [itemId, setId],
  );
  // The subject outlives the URL param so the dialog never blanks while closing.
  const [shownSubject, setShownSubject] = useState<DialogSubject | null>(subject);
  if (
    subject !== null &&
    (shownSubject === null || subject.kind !== shownSubject.kind || subject.id !== shownSubject.id)
  ) {
    setShownSubject(subject);
  }
  // Opened by a click on this page (a history entry we pushed), not a shared link.
  const openedHereRef = useRef(false);
  useEffect(() => {
    if (subject === null) {
      openedHereRef.current = false;
    }
  }, [subject]);

  const openItem = useCallback(
    (item: ItemSummary): void => {
      openedHereRef.current = true;
      setParams({ item: String(item.id), set: null });
    },
    [setParams],
  );
  const openSet = useCallback(
    (set: ItemSetSummary): void => {
      openedHereRef.current = true;
      setParams({ set: String(set.id), item: null });
    },
    [setParams],
  );
  // Walking inside the dialog replaces its history entry, so one Back (or
  // closing) always leaves the dialog, however far it walked.
  const walk = useCallback(
    (next: DialogSubject): void => {
      setParams(
        next.kind === "item"
          ? { item: String(next.id), set: null }
          : { set: String(next.id), item: null },
        { replace: true },
      );
    },
    [setParams],
  );
  // Closing a dialog this page opened steps back over its history entry, so
  // Back after closing leaves the page instead of reopening the item.
  const closeDialog = useCallback((): void => {
    if (openedHereRef.current) {
      openedHereRef.current = false;
      navigate(-1);
      return;
    }
    setParams({ item: null, set: null }, { replace: true });
  }, [navigate, setParams]);
  // The dialog's entry becomes the class list, so Back returns to the
  // results the item was opened from.
  const browseFromDialog = useCallback(
    (nextClass: number, nextSubclass: number | null): void => {
      openedHereRef.current = false;
      focusResultsRef.current = true;
      emittedRef.current = "";
      setDraft("");
      setParams(
        {
          item: null,
          set: null,
          class: String(nextClass),
          subclass: nextSubclass === null ? null : String(nextSubclass),
          q: null,
          quality: null,
          slot: null,
          ilvl: null,
          page: null,
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const dialogItemId = shownSubject?.kind === "item" ? shownSubject.id : null;
  const itemSeed = useMemo(
    () => data?.items.find((item) => item.id === dialogItemId),
    [data, dialogItemId],
  );

  /* ---------------- Item sets ---------------- */

  const [setsRef, setsNear] = useNearViewport<HTMLDivElement>();
  const setIndexQuery = useQuery({
    ...itemSetIndexQuery(),
    enabled: setsNear || params.setq !== "" || params.setpage !== "",
  });
  const setCount = setIndexQuery.data?.length ?? 0;
  const dialogSetId = shownSubject?.kind === "set" ? shownSubject.id : null;
  const dialogSetName =
    dialogSetId !== null
      ? setIndexQuery.data?.find((set) => set.id === dialogSetId)?.name
      : undefined;

  // Reads (never fetches) the open record, for the tab title.
  const openRecord = useQuery({ ...itemRecordQuery(itemId ?? 0), enabled: false });
  const openSetRecord = useQuery({ ...itemSetQuery(setId ?? 0), enabled: false });

  /* ---------------- Labels ---------------- */

  const items = data?.items ?? [];
  const sortOption = SORT_OPTIONS.find((option) => option.value === sort) ?? SORT_OPTIONS[0];

  let resultsTitle = "Items";
  if (criteria.name) {
    resultsTitle = `Items named “${criteria.name}”`;
  } else if (className && subclassName) {
    resultsTitle = `${className}: ${subclassName}`;
  } else if (className) {
    resultsTitle = className;
  } else if (!hasFilters && sort === "newest") {
    resultsTitle = "Newest items";
  }

  const summary = ((): string | undefined => {
    if (!data || placeholder) {
      return searchError.error !== undefined ? "Couldn't load items" : "Searching items…";
    }
    if (items.length === 0) {
      // A page past the end is being stepped back (see above), not empty.
      return page > Math.max(1, data.pageCount) ? "Searching items…" : "No items matched";
    }
    if (data.narrowed && data.total !== undefined) {
      return data.capped
        ? `${pluralize(data.total, "item", "items")} among the closest 100 names; finish the last word for every match`
        : pluralize(data.total, "item", "items");
    }
    if (data.total !== undefined) {
      return pluralize(data.total, "item", "items");
    }
    const first = (data.page - 1) * ITEM_PAGE_SIZE + 1;
    const last = first + items.length - 1;
    return `Showing ${formatNumber(first)}–${formatNumber(last)} · page ${formatNumber(data.page)} of ${formatNumber(data.pageCount)}${
      data.capped ? " (Blizzard pages through the first 1,000 matches)" : ""
    }`;
  })();

  const openName =
    itemId !== null
      ? (openRecord.data?.name ?? (itemSeed?.id === itemId ? itemSeed.name : undefined))
      : setId !== null
        ? (openSetRecord.data?.name ?? dialogSetName)
        : undefined;
  let documentTitle = "Items";
  if (openName) {
    documentTitle = `${openName} · Items`;
  } else if (criteria.name) {
    documentTitle = `${criteria.name} · Items`;
  } else if (className) {
    documentTitle = `${subclassName ?? className} · Items`;
  }

  /* ---------------- Paging ---------------- */

  // A grid is read from the top: a new page starts at its first card.
  const handlePageChange = (next: number): void => {
    setParams({ page: next > 1 ? String(next) : null });
    resultsRef.current?.scrollIntoView({ block: "start" });
  };

  /* ---------------- Render ---------------- */

  const renderResults = (): JSX.Element => {
    if (searchError.error !== undefined) {
      return (
        <ErrorState
          error={searchError.error}
          context="items"
          onRetry={searchError.retry}
          retryLabel={searchError.retrying ? "Retrying…" : "Retry"}
        />
      );
    }
    // Loading, or a page past the end that the effect above is stepping back from.
    if (!data || (items.length === 0 && (placeholder || page > Math.max(1, pageCount)))) {
      return <ItemGridSkeleton label="Loading items" />;
    }
    if (items.length === 0) {
      return (
        <EmptyState
          icon={<SearchOffRoundedIcon />}
          title={
            criteria.name
              ? `No items named “${criteria.name}”${activeFilters.length > 1 ? " with these filters" : ""}`
              : "No items match these filters"
          }
          description={
            criteria.name
              ? "Blizzard matches whole words only: check the spelling and finish every word (“Thunderfury”, not “Thunderf”)."
              : className && !subclassName && activeFilters.length === 1
                ? `Blizzard's item search lists no ${className} items.`
                : "Try fewer filters or a wider item level range."
          }
          action={
            activeFilters.length > 0 ? (
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  clearAll();
                  searchInputRef.current?.focus();
                }}
              >
                Clear all filters
              </Button>
            ) : undefined
          }
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
          <ItemGrid items={items} label={resultsTitle} onSelect={openItem} />
        </Box>
        {pageCount > 1 ? (
          <Pagination
            count={pageCount}
            page={Math.min(page, pageCount)}
            onChange={(_event, next) => handlePageChange(next)}
            siblingCount={1}
            aria-label="Item pages"
            sx={{ alignSelf: "center" }}
          />
        ) : null}
      </Stack>
    );
  };

  const renderClasses = (): JSX.Element => {
    if (classIndexError.error !== undefined) {
      return (
        <ErrorState
          compact
          error={classIndexError.error}
          context="item classes"
          onRetry={classIndexError.retry}
          retryLabel={classIndexError.retrying ? "Retrying…" : "Retry"}
        />
      );
    }
    if (classIndexQuery.data === undefined) {
      return <ItemClassTilesSkeleton />;
    }
    if (tiles.length === 0) {
      return (
        <EmptyState
          compact
          icon={<Inventory2RoundedIcon />}
          title="No item classes listed"
          description="Blizzard returned an empty item class index for this region; the search below still covers every item."
        />
      );
    }
    return <ItemClassTiles tiles={tiles} value={classId} onChange={pickClassTile} />;
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
        title="Items"
        documentTitle={documentTitle}
        icon={<Inventory2RoundedIcon />}
        description="Blizzard's item database: browse by class, filter by quality, slot and item level, and open any item for its in-game tooltip, stats and set. Below, every item set with its pieces and bonuses."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {classes.length > 0 ? (
              <Chip size="small" label={pluralize(classes.length, "item class", "item classes")} />
            ) : null}
            {setCount > 0 ? (
              <Chip size="small" label={pluralize(setCount, "item set", "item sets")} />
            ) : null}
          </>
        }
      />

      <SectionCard title="Item classes" padding="compact">
        {renderClasses()}
      </SectionCard>

      <ItemFilters
        draft={draft}
        onDraftChange={setDraft}
        onSearch={handleSearch}
        searchInputRef={searchInputRef}
        quality={quality}
        onQualityChange={selectQuality}
        slotGroups={slotGroups}
        slot={slot}
        onSlotChange={selectSlot}
        level={level}
        onLevelChange={selectLevel}
        sort={sort}
        onSortChange={selectSort}
        subclasses={
          classId !== null && className ? (
            <SubclassPicker
              className={className}
              subclasses={subclasses}
              loading={classDetailQuery.isPending && classDetailError.error === undefined}
              error={classDetailError.error !== undefined}
              retrying={classDetailError.retrying}
              onRetry={classDetailError.retry}
              value={subclassId}
              onChange={selectSubclass}
              placeholderCount={
                classId === WEAPON_CLASS_ID ? WEAPON_SUBCLASS_ESTIMATE : undefined
              }
            />
          ) : null
        }
        activeFilters={
          <ActiveFilterChips
            filters={activeFilters}
            onClearAll={clearAll}
            fallbackFocusRef={searchInputRef}
          />
        }
        summary={summary}
        progress={searchQuery.isFetching && (placeholder || !data)}
      />

      <Box ref={resultsRef} sx={scrollMarginSx}>
        <SectionCard
          id={RESULTS_ID}
          title={resultsTitle}
          description={`Sorted ${sortOption.description}. Blizzard's item search pages through the first 1,000 matches of any filter; narrow it to reach the rest.`}
        >
          {renderResults()}
        </SectionCard>
      </Box>

      <Box ref={setsRef}>
        <ItemSetsSection
          indexQuery={setIndexQuery}
          search={params.setq}
          page={params.setpage}
          setParams={setParams}
          onSelect={openSet}
        />
      </Box>

      <ItemExplorerDialog
        open={subject !== null}
        subject={shownSubject}
        itemSeed={itemSeed}
        setName={dialogSetName}
        onWalk={walk}
        onBrowse={browseFromDialog}
        activeClassId={classId}
        activeSubclassId={subclassId}
        onClose={closeDialog}
      />
    </Stack>
  );
};

export default ItemsPage;
