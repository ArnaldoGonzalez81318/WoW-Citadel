import { Box, Button, Grow, Paper, Popper, Typography } from "@mui/material";
import type { PopperProps } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useQueries } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";

import MediaTile from "@/components/common/MediaTile";
import { EmptyState, InlineProgress } from "@/components/common/StateBlocks";
import type {
  HeaderSearchAutocompleteProps,
  SuggestionOption,
} from "@/components/layout/HeaderSearch";
import { fetchItemMediaUrl } from "@/features/items/services/itemService";
import { useBlizzardSearch } from "@/features/search/hooks/useBlizzardSearch";
import type { SearchResult } from "@/features/search/types";
import { fetchSpellIcon } from "@/features/spells/services/spellService";
import { env } from "@/lib/env";
import { qualityColor } from "@/theme";

/** Suggestions shown per category (SEARCH order, first page only). */
const PER_CATEGORY = 4;
const POPPER_OFFSET = 6;
const VIEWPORT_MARGIN = 16;
const MEDIA_GC_TIME_MS = 24 * 60 * 60_000;

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

type MediaTarget = Pick<SearchResult, "id" | "kind">;
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

/** Search results carry no icon URL; items and spells resolve one lazily. */
const needsMedia = (result: SearchResult): boolean =>
  !result.mediaUrl && (result.kind === "item" || result.kind === "spell");

const mediaKeyFor = (categoryId: string, resultId: number): string =>
  `${categoryId}-${resultId}`;

/**
 * Grouped suggestion listbox for the header combobox. Only ever imported
 * dynamically by HeaderSearch: it pulls useBlizzardSearch (the
 * search-experience chunk) in, and the shell must not depend on that eagerly.
 *
 * The input keeps focus the whole time; this list is a sibling, so option
 * rows swallow mousedown to avoid stealing focus and the parent tracks the
 * active index for `aria-activedescendant`.
 */
const HeaderSearchAutocomplete = ({
  query,
  anchorEl,
  open,
  activeIndex,
  listboxId,
  onOptionsChange,
  onSelect,
  onHoverIndex,
  onVisibleChange,
}: HeaderSearchAutocompleteProps): JSX.Element => {
  const theme = useTheme();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  // The parent already debounced the query; do not debounce again.
  const { categoryStates, isFetching, isAnyLoading } = useBlizzardSearch(
    query,
    { debounceMs: 0 },
  );

  /** The (at most 4 per category) results the list will show. */
  const shown = useMemo(
    () =>
      categoryStates.map((state) => ({
        category: state.category,
        results: state.data.slice(0, PER_CATEGORY),
      })),
    [categoryStates],
  );

  /*
   * Icon fan-out for the shown items and spells, on the same query keys the
   * explorers and SearchResultGrid use (`["item-media", id, region]` /
   * `["spell-media-card", id, region]`), so the cache is shared both ways.
   */
  const mediaTargets = useMemo(
    () =>
      shown.flatMap(({ category, results }) =>
        results
          .filter(needsMedia)
          .map((result): MediaTarget & { key: string } => ({
            id: result.id,
            kind: result.kind,
            key: mediaKeyFor(category.id, result.id),
          })),
      ),
    [shown],
  );

  const mediaUrls = useQueries({
    queries: mediaTargets.map((target) => ({
      queryKey:
        target.kind === "item"
          ? (["item-media", target.id, env.region] as const)
          : (["spell-media-card", target.id, env.region] as const),
      queryFn: () =>
        target.kind === "item"
          ? fetchItemMediaUrl(target.id)
          : fetchSpellIcon(target.id),
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

    for (const { category, results } of shown) {
      const options = results.map((item): SuggestionOption => {
        const id = mediaKeyFor(category.id, item.id);
        return {
          id,
          name: item.name,
          categoryId: category.id,
          categoryLabel: category.label,
          subtitle: item.subtitle ?? item.typeLabel ?? item.tag,
          mediaUrl: item.mediaUrl ?? mediaByKey.get(id) ?? undefined,
          quality: item.quality,
        };
      });
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
  }, [shown, mediaByKey]);

  const options = useMemo(
    () => groups.flatMap((group) => group.options),
    [groups],
  );

  useEffect(() => {
    onOptionsChange(options);
  }, [options, onOptionsChange]);

  // Open once there is something to show: suggestions, or the settled
  // "No matches" answer. Blizzard matches whole words only ("thund" finds
  // nothing, "thunder" does), so that answer is worth showing.
  const settled = !isFetching && !isAnyLoading;
  const hasContent = options.length > 0 || settled;
  const visible = open && hasContent;
  const trimmedQuery = query.trim();

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
            <InlineProgress active={isFetching} label="Searching" />

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

            {options.length === 0 && settled ? (
              <EmptyState
                compact
                title="No matches"
                description="Blizzard matches whole words: try the full word or another spelling"
                sx={{ m: 1 }}
              />
            ) : null}

            {trimmedQuery.length > 0 ? (
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
