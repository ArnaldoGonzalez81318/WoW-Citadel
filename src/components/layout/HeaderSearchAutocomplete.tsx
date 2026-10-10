import CloudOffRounded from "@mui/icons-material/CloudOffRounded";
import { Box, Button, Grow, Paper, Popper, Typography } from "@mui/material";
import type { PopperProps } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import MediaTile from "@/components/common/MediaTile";
import { EmptyState, InlineProgress } from "@/components/common/StateBlocks";
import type {
  HeaderSearchAutocompleteProps,
  SuggestionOption,
  SuggestionStatus,
} from "@/components/search/SearchCombobox";
import { itemKeys } from "@/features/items/services/itemService";
import type { CatalogKind } from "@/features/search/catalog/catalogSources";
import type { SearchCategoryConfig } from "@/features/search/categories";
import { useBlizzardSearch } from "@/features/search/hooks/useBlizzardSearch";
import { useCatalogSuggestions } from "@/features/search/hooks/useCatalogSuggestions";
import type { CatalogSuggestion } from "@/features/search/hooks/useCatalogSuggestions";
import { resultMediaQuery } from "@/features/search/services/resultMedia";
import type { ResultMediaQuery } from "@/features/search/services/resultMedia";
import type { SearchResult } from "@/features/search/types";
import { qualityColor } from "@/theme";

/** Suggestions shown per category (SEARCH order, first page only). */
const PER_CATEGORY = 4;
const POPPER_OFFSET = 6;
const VIEWPORT_MARGIN = 16;
const MEDIA_GC_TIME_MS = 24 * 60 * 60_000;

/**
 * What a catalogue row is, for someone scanning the list. The catalogue holds
 * nothing but names, so this stands in for the type line the live results
 * carry — and it is the only thing separating a toy from an item under the
 * Items header, or a battle pet from a creature.
 */
const KIND_SUBTITLE: Record<CatalogKind, string> = {
  item: "Legendary or artifact item",
  mount: "Mount",
  toy: "Toy",
  pet: "Battle pet",
};

/**
 * Sizes the panel from Popper's own measured reference rect: no layout read
 * during a React render, and it follows resizes while the list is open.
 */
const POPPER_MODIFIERS: NonNullable<PopperProps["modifiers"]> = [
  { name: "offset", options: { offset: [0, POPPER_OFFSET] } },
  { name: "preventOverflow", options: { padding: VIEWPORT_MARGIN } },
  {
    name: "sameWidth",
    enabled: true,
    phase: "beforeWrite",
    requires: ["computeStyles"],
    fn: ({ state }) => {
      state.styles.popper.width = `${state.rects.reference.width}px`;
    },
  },
];

type SuggestionGroup = {
  categoryId: string;
  categoryLabel: string;
  /** Flat index of the group's first option (for option ids / activeIndex). */
  startIndex: number;
  options: SuggestionOption[];
};

/**
 * One row before its icon has resolved. A catalogue name and a live result for
 * the same name are a single row: `live` is how the icon, the quality tint and
 * the real type line reach a row the catalogue put on screen first.
 */
type SuggestionRow = {
  /**
   * Fixed for the row's lifetime — a catalogue row keeps its own id when
   * `live` arrives, so the keyboard highlight the parent follows by id is not
   * dropped mid-search.
   */
  id: string;
  name: string;
  subtitle?: string;
  live?: SearchResult;
  /**
   * The catalogue entry's item id, for catalogue `item` rows only (a toy's id
   * is a toy id, a mount's a mount id — neither keys an item icon). Lets a
   * row read an icon the cache already holds; never a request of its own.
   */
  catalogItemId?: number;
};

type ShownCategory = {
  category: SearchCategoryConfig;
  rows: SuggestionRow[];
};

/** Shared so a term the live half has not reached never allocates an array. */
const NO_LIVE_RESULTS: SearchResult[] = [];

/** One row whose artwork still has to be fetched, keyed by row id. */
type MediaTarget = { key: string; query: ResultMediaQuery };
type MediaUrl = string | null | undefined;
type MediaMap = Map<string, MediaUrl>;

/**
 * Module-level and returning a plain array on purpose: react-query re-runs
 * an inline `combine` on every render and can only structurally share plain
 * objects and arrays, so an inline combiner (or a `Map` result) would hand
 * back a new value each render, `options` would follow, and the
 * `onOptionsChange` effect would re-render the parent without end.
 */
const combineMediaUrls = (results: UseQueryResult<MediaUrl>[]): MediaUrl[] =>
  results.map((result) => result.data);

const mediaKeyFor = (categoryId: string, resultId: number): string =>
  `${categoryId}-${resultId}`;

const liveSubtitle = (result: SearchResult): string | undefined =>
  result.subtitle ?? result.typeLabel ?? result.tag;

/**
 * One category's rows: the catalogue's matches first — they are instant and
 * they match half-typed names — then the live results that are not already on
 * screen, capped the same as before.
 *
 * Names are compared case-insensitively, so a name both halves know appears
 * once: it keeps the catalogue's position (and so its option id) and takes the
 * live result's icon, quality and type line as they arrive.
 */
const mergeRows = (
  categoryId: string,
  local: readonly CatalogSuggestion[],
  live: readonly SearchResult[],
): SuggestionRow[] => {
  const liveByName = new Map<string, SearchResult>();
  live.forEach((result) => {
    const key = result.name.toLowerCase();
    if (!liveByName.has(key)) {
      liveByName.set(key, result);
    }
  });

  const rows: SuggestionRow[] = [];
  const used = new Set<string>();

  // Two catalogue sources can hold one name (a toy that is also an item), and
  // both land in the same category.
  for (const suggestion of local) {
    if (rows.length >= PER_CATEGORY) {
      break;
    }
    const key = suggestion.name.toLowerCase();
    if (used.has(key)) {
      continue;
    }
    used.add(key);

    const twin = liveByName.get(key);
    rows.push({
      id: suggestion.id,
      name: suggestion.name,
      subtitle:
        (twin ? liveSubtitle(twin) : undefined) ??
        KIND_SUBTITLE[suggestion.kind],
      live: twin,
      catalogItemId:
        suggestion.kind === "item" ? suggestion.entryId : undefined,
    });
  }

  for (const result of live) {
    if (rows.length >= PER_CATEGORY) {
      break;
    }
    const key = result.name.toLowerCase();
    if (used.has(key)) {
      continue;
    }
    used.add(key);

    rows.push({
      id: mediaKeyFor(categoryId, result.id),
      name: result.name,
      subtitle: liveSubtitle(result),
      live: result,
    });
  }

  return rows;
};

/**
 * Grouped suggestion listbox for SearchCombobox (header field, search dialog
 * and home hero). Only ever imported dynamically by SearchCombobox: it pulls
 * in useBlizzardSearch, which ships with categories.ts and searchService in
 * the shared useBlizzardSearch-*.js chunk, and the shell must not depend on
 * that eagerly.
 *
 * Each group is two halves merged: the local catalogue, which answers a
 * half-typed or misspelled name from memory, and the live search, which knows
 * everything but only matches whole, correctly spelled words. The catalogue
 * goes first because it is already there.
 *
 * The input keeps focus the whole time; this list is a sibling, so option
 * rows swallow mousedown to avoid stealing focus and the parent tracks the
 * active index for `aria-activedescendant`.
 */
const HeaderSearchAutocomplete = ({
  query,
  typedQuery,
  anchorEl,
  open,
  activeIndex,
  listboxId,
  onOptionsChange,
  onSelect,
  onHoverIndex,
  onVisibleChange,
  onStatusChange,
}: HeaderSearchAutocompleteProps): JSX.Element => {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  // The parent already debounced the query; do not debounce again.
  const {
    categoryStates,
    isFetching,
    isAnyLoading,
    query: liveQuery,
  } = useBlizzardSearch(query, { debounceMs: 0 });

  /*
   * The catalogue is only worth holding while this list can be used, and this
   * list is mounted only while the combobox is open — so mounting is the
   * signal: a megabyte of names is never downloaded for a visitor who never
   * opens the search.
   */
  const { suggestions: localSuggestions, ready: catalogReady } =
    useCatalogSuggestions(typedQuery);

  /*
   * The catalogue answers every keystroke and the live half only answers the
   * debounced one, so between the two `categoryStates` still holds the
   * previous term's results. They are held back until the live half catches
   * up rather than shown under text they do not match.
   */
  const liveIsCurrent = liveQuery === typedQuery.trim();

  /** The (at most 4 per category) rows the list will show. */
  const shown = useMemo<ShownCategory[]>(
    () =>
      categoryStates.map((state) => ({
        category: state.category,
        rows: mergeRows(
          state.category.id,
          localSuggestions.filter(
            (suggestion) => suggestion.categoryId === state.category.id,
          ),
          liveIsCurrent ? state.data : NO_LIVE_RESULTS,
        ),
      })),
    [categoryStates, localSuggestions, liveIsCurrent],
  );

  /*
   * Artwork fan-out for the shown rows, on the query keys `resultMedia.ts`
   * hands out — the explorers' and SearchResultGrid's own
   * (`itemKeys.media(id)`, `spellKeys.icon(id)`,
   * `creatureDisplayKeys.render(displayId)`) — so an icon or render loaded on
   * any of those surfaces is loaded here too. At most four rows per category,
   * and only rows the live half has already answered for, so the list never
   * spends a request on a keystroke of its own. Keyed by row id, so a
   * catalogue row picks up the artwork of the live result that confirmed it.
   */
  const mediaTargets = useMemo<MediaTarget[]>(() => {
    const targets: MediaTarget[] = [];
    shown.forEach(({ rows }) => {
      rows.forEach((row) => {
        const query = row.live ? resultMediaQuery(row.live) : undefined;
        if (query) {
          targets.push({ key: row.id, query });
        }
      });
    });
    return targets;
  }, [shown]);

  const mediaUrls = useQueries({
    queries: mediaTargets.map((target) => ({
      queryKey: target.query.queryKey,
      queryFn: target.query.queryFn,
      retry: false,
      staleTime: Infinity,
      gcTime: MEDIA_GC_TIME_MS,
    })),
    combine: combineMediaUrls,
  });

  // Rebuilt only when a target or a resolved icon changes (`mediaUrls` is
  // structurally shared by react-query), so `groups` stays referentially
  // stable across unrelated renders.
  const mediaByKey = useMemo<MediaMap>(
    () =>
      new Map(
        mediaTargets.map((target, index) => [target.key, mediaUrls[index]]),
      ),
    [mediaTargets, mediaUrls],
  );

  const groups = useMemo(() => {
    const result: SuggestionGroup[] = [];
    let startIndex = 0;

    /**
     * A catalogue item row's icon when the cache already holds it (the Items
     * explorer, an earlier search, this list a moment ago). A read, never a
     * fetch: the catalogue must not cost a request per keystroke. A miss
     * leaves MediaTile's letter until the live twin answers.
     */
    const cachedItemIcon = (row: SuggestionRow): string | undefined => {
      if (row.catalogItemId === undefined) {
        return undefined;
      }
      const cached = queryClient.getQueryData<string | null>(
        itemKeys.media(row.catalogItemId),
      );
      return cached ?? undefined;
    };

    for (const { category, rows } of shown) {
      // A catalogue row has no quality of its own; it stays undefined until
      // the live twin answers, which MediaTile renders as the initial-letter
      // tile rather than a broken image.
      const options = rows.map(
        (row): SuggestionOption => ({
          id: row.id,
          name: row.name,
          categoryId: category.id,
          categoryLabel: category.label,
          subtitle: row.subtitle,
          mediaUrl:
            row.live?.mediaUrl ??
            mediaByKey.get(row.id) ??
            cachedItemIcon(row),
          quality: row.live?.quality,
        }),
      );
      if (options.length > 0) {
        result.push({
          categoryId: category.id,
          categoryLabel: category.label,
          startIndex,
          options,
        });
        startIndex += options.length;
      }
    }

    return result;
  }, [shown, mediaByKey, queryClient]);

  const options = useMemo(
    () => groups.flatMap((group) => group.options),
    [groups],
  );

  useEffect(() => {
    onOptionsChange(options);
  }, [options, onOptionsChange]);

  /*
   * Open once there is something to show: suggestions, or the settled
   * "No matches" answer.
   *
   * The catalogue settles on a clock of its own, so a live half that comes
   * back empty is not yet an answer: without `catalogReady` a cold visitor
   * would be told "No matches" a moment before the names that match arrive.
   * A catalogue match needs no such wait — `options` is already non-empty, so
   * the panel opens on the keystroke that produced it, live queries or not.
   *
   * `liveIsCurrent` is the same guarantee for the debounce window: a search
   * that has not been asked for the typed text yet cannot be reported as
   * having found nothing.
   */
  const settled = !isFetching && !isAnyLoading && catalogReady && liveIsCurrent;
  const hasContent = options.length > 0 || settled;
  // One failed category makes "No matches" a guess, not an answer.
  const anyError = categoryStates.some((state) => state.isError);
  const status: SuggestionStatus =
    options.length > 0
      ? "results"
      : !settled
        ? "loading"
        : anyError
          ? "error"
          : "empty";

  useEffect(() => {
    onStatusChange(status);
  }, [status, onStatusChange]);
  useEffect(() => () => onStatusChange("idle"), [onStatusChange]);

  /*
   * Stay up while a refined term loads. useQueries matches observers by query
   * hash (@tanstack/query-core 5.90), so keepPreviousData never carries rows
   * across terms and `options` drops to [] on every new term; without this
   * the panel would close and reopen on each pause. No stale rows are shown:
   * just the progress bar and the footer until the new rows arrive.
   */
  const [keepOpen, setKeepOpen] = useState(false);
  const visible = open && (hasContent || keepOpen);
  useEffect(() => {
    setKeepOpen(visible);
  }, [visible]);
  // The typed text, since that is what Enter would submit.
  const trimmedQuery = typedQuery.trim();

  /* The listbox is in the DOM exactly while the Popper is open. */
  useEffect(() => {
    onVisibleChange(visible);
  }, [visible, onVisibleChange]);
  useEffect(() => () => onVisibleChange(false), [onVisibleChange]);

  /* Keep the keyboard-highlighted option inside the scrolling panel. */
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!visible || !scroller || activeIndex < 0) {
      return;
    }
    const option = scroller.querySelector<HTMLElement>(
      `[id="${listboxId}-opt-${activeIndex}"]`,
    );
    if (!option) {
      return;
    }
    const panel = scroller.getBoundingClientRect();
    const row = option.getBoundingClientRect();
    if (row.top < panel.top) {
      scroller.scrollTop -= panel.top - row.top;
    } else if (row.bottom > panel.bottom) {
      scroller.scrollTop += row.bottom - panel.bottom;
    }
  }, [visible, activeIndex, listboxId]);

  return (
    <Popper
      open={visible}
      anchorEl={anchorEl}
      placement="bottom-start"
      transition
      modifiers={POPPER_MODIFIERS}
      sx={{ zIndex: (t) => t.zIndex.modal + 1 }}
    >
      {({ TransitionProps }) => (
        <Grow
          {...TransitionProps}
          timeout={{ enter: 150, exit: 100 }}
          style={{ transformOrigin: "left top" }}
        >
          <Paper
            ref={scrollerRef}
            elevation={8}
            data-search-popup={listboxId}
            sx={{
              minWidth: 280,
              maxWidth: "calc(100vw - 32px)",
              maxHeight: "min(60vh, 480px)",
              overflowY: "auto",
              overscrollBehavior: "contain",
              bgcolor: "surface.popover",
              border: `1px solid ${theme.palette.border.default}`,
              borderRadius: `${theme.wc.radius.lg}px`,
              boxShadow: theme.palette.glow.popover,
            }}
          >
            {/* Also while the live half is still a debounce behind the text. */}
            <InlineProgress
              active={isFetching || !liveIsCurrent}
              label="Searching"
            />

            {/* Always present while open so aria-controls never dangles; empty on "No matches". */}
            <Box
              component="ul"
              role="listbox"
              id={listboxId}
              aria-label="Search suggestions"
              sx={{ listStyle: "none", m: 0, p: options.length > 0 ? 1 : 0 }}
            >
              {groups.map((group) => (
                <Box component="li" role="presentation" key={group.categoryId}>
                  <Typography
                    component="div"
                    variant="overline"
                    color="text.secondary"
                    sx={{ px: 1.5, pt: 1, pb: 0.5 }}
                  >
                    {group.categoryLabel}
                  </Typography>
                  <Box
                    component="ul"
                    role="group"
                    aria-label={group.categoryLabel}
                    sx={{ listStyle: "none", m: 0, p: 0 }}
                  >
                    {group.options.map((option, offset) => {
                      const optionIndex = group.startIndex + offset;
                      const selected = optionIndex === activeIndex;

                      return (
                        <Box
                          component="li"
                          role="option"
                          key={option.id}
                          id={`${listboxId}-opt-${optionIndex}`}
                          aria-selected={selected}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => onSelect(option)}
                          onMouseMove={() => {
                            if (activeIndex !== optionIndex) {
                              onHoverIndex(optionIndex);
                            }
                          }}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.5,
                            minHeight: theme.wc.layout.touchTarget,
                            px: 1.5,
                            py: 0.75,
                            borderRadius: `${theme.wc.radius.sm}px`,
                            cursor: "pointer",
                            bgcolor: selected
                              ? "action.selected"
                              : "transparent",
                            transition: theme.transitions.create(
                              "background-color",
                              {
                                duration: theme.wc.motion.fast,
                                easing: theme.wc.motion.easing,
                              },
                            ),
                          }}
                        >
                          <MediaTile
                            size={40}
                            src={option.mediaUrl}
                            alt=""
                            fallbackLabel={option.name}
                            quality={option.quality}
                          />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography
                              variant="body2"
                              noWrap
                              sx={{
                                color: option.quality
                                  ? qualityColor(theme, option.quality)
                                  : "text.primary",
                                fontWeight: 500,
                              }}
                            >
                              {option.name}
                            </Typography>
                            {option.subtitle ? (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                noWrap
                                sx={{ display: "block" }}
                              >
                                {option.subtitle}
                              </Typography>
                            ) : null}
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              ))}
            </Box>

            {status === "error" ? (
              <EmptyState
                compact
                icon={<CloudOffRounded />}
                title="Couldn't load suggestions"
                description="Press Enter to open the results page"
                sx={{ m: 1 }}
              />
            ) : null}

            {status === "empty" ? (
              <EmptyState
                compact
                title="No matches"
                description="Partial names find famous items, mounts, toys and pets; spells and other items need a whole word"
                sx={{ m: 1 }}
              />
            ) : null}

            {/* A settled empty answer could only lead to four empty tabs. */}
            {trimmedQuery.length > 0 && status !== "empty" ? (
              <Box
                sx={{
                  borderTop: `1px solid ${theme.palette.border.subtle}`,
                  p: 1,
                }}
              >
                <Button
                  variant="text"
                  size="small"
                  fullWidth
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() =>
                    onSelect({ id: "see-all", name: trimmedQuery })
                  }
                  sx={{ justifyContent: "flex-start" }}
                >
                  {`See all results for “${trimmedQuery}”`}
                </Button>
              </Box>
            ) : null}
          </Paper>
        </Grow>
      )}
    </Popper>
  );
};

export default HeaderSearchAutocomplete;
