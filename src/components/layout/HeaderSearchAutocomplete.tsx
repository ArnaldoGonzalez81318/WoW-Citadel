import { Box, Button, Grow, Paper, Popper, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useEffect, useMemo } from "react";

import MediaTile from "@/components/common/MediaTile";
import { EmptyState, InlineProgress } from "@/components/common/StateBlocks";
import type {
  HeaderSearchAutocompleteProps,
  SuggestionOption,
} from "@/components/layout/HeaderSearch";
import { useBlizzardSearch } from "@/features/search/hooks/useBlizzardSearch";
import { qualityColor } from "@/theme";

/** Suggestions shown per category (SEARCH order, first page only). */
const PER_CATEGORY = 4;
const POPPER_OFFSET = 6;
const VIEWPORT_MARGIN = 16;

type SuggestionGroup = {
  categoryId: string;
  categoryLabel: string;
  /** Flat index of the group's first option (for option ids / activeIndex). */
  startIndex: number;
  options: SuggestionOption[];
};

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
}: HeaderSearchAutocompleteProps): JSX.Element => {
  const theme = useTheme();
  // The parent already debounced the query; do not debounce again.
  const { categoryStates, isFetching, isAnyLoading } = useBlizzardSearch(
    query,
    { debounceMs: 0 },
  );

  const groups = useMemo(() => {
    const result: SuggestionGroup[] = [];
    let startIndex = 0;

    for (const state of categoryStates) {
      const options = state.data
        .slice(0, PER_CATEGORY)
        .map((item): SuggestionOption => ({
          id: `${state.category.id}-${item.id}`,
          name: item.name,
          categoryId: state.category.id,
          categoryLabel: state.category.label,
          subtitle: item.subtitle ?? item.typeLabel ?? item.tag,
          mediaUrl: item.mediaUrl,
          quality: item.quality,
        }));
      if (options.length > 0) {
        result.push({
          categoryId: state.category.id,
          categoryLabel: state.category.label,
          startIndex,
          options,
        });
        startIndex += options.length;
      }
    }

    return result;
  }, [categoryStates]);

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
  const trimmedQuery = query.trim();

  return (
    <Popper
      open={open && hasContent}
      anchorEl={anchorEl}
      placement="bottom-start"
      transition
      modifiers={[
        { name: "offset", options: { offset: [0, POPPER_OFFSET] } },
        { name: "preventOverflow", options: { padding: VIEWPORT_MARGIN } },
      ]}
      sx={{ zIndex: (t) => t.zIndex.modal + 1 }}
    >
      {({ TransitionProps }) => (
        <Grow
          {...TransitionProps}
          timeout={{ enter: 150, exit: 100 }}
          style={{ transformOrigin: "left top" }}
        >
          <Paper
            elevation={8}
            data-search-popup={listboxId}
            sx={{
              width: anchorEl?.clientWidth,
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

            {options.length === 0 && settled ? (
              <EmptyState
                compact
                title="No matches"
                description="Blizzard matches whole words: try the full word or another spelling"
                sx={{ m: 1 }}
              />
            ) : (
              <Box
                component="ul"
                role="listbox"
                id={listboxId}
                aria-label="Search suggestions"
                sx={{ listStyle: "none", m: 0, p: 1 }}
              >
                {groups.map((group) => (
                  <Box
                    component="li"
                    role="presentation"
                    key={group.categoryId}
                  >
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
            )}

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
