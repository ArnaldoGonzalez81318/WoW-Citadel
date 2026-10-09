import SearchOffRoundedIcon from "@mui/icons-material/SearchOffRounded";
import { Button, Stack, Typography } from "@mui/material";
import { forwardRef, useEffect, useRef, useState } from "react";

import { EmptyState } from "@/components/common/StateBlocks";
import CardGrid from "@/features/modifiedCrafting/components/CardGrid";
import CategoryCard from "@/features/modifiedCrafting/components/CategoryCard";
import type { AcceptedCount } from "@/features/modifiedCrafting/components/CategoryCard";
import ResultsSection from "@/features/modifiedCrafting/components/ResultsSection";
import SlotTypeCard from "@/features/modifiedCrafting/components/SlotTypeCard";
import { pluralize } from "@/features/modifiedCrafting/services/modifiedCraftingService";
import type { SlotThemeId } from "@/features/modifiedCrafting/services/slotThemes";
import type { CategoryGroup, SlotTypeRef } from "@/features/modifiedCrafting/types";
import { formatNumber } from "@/lib/format";

/** Cards per list before "Show more", and per press of it. */
export const SEARCH_STEP = 12;

export type SearchResultsProps = {
  /** What was searched, trimmed. */
  query: string;
  /** Too short to rank (one letter that is not an id). */
  tooShort: boolean;
  slots: readonly SlotTypeRef[];
  categories: readonly CategoryGroup[];
  themeOf: ReadonlyMap<number, SlotThemeId>;
  acceptedOf: (group: CategoryGroup) => AcceptedCount;
  acceptedMax: number;
  onClear: () => void;
  onOpenSlot: (slot: SlotTypeRef) => void;
  onOpenCategory: (group: CategoryGroup) => void;
  /** False when that list failed to load, so it was not searched at all. */
  slotsSearched: boolean;
  categoriesSearched: boolean;
};

const slotsNote = (searched: boolean): string =>
  searched ? "No slot type name matches." : "Slot types were not searched: their list did not load.";

const categoriesNote = (searched: boolean): string =>
  searched
    ? "No category name matches."
    : "Categories were not searched: their list did not load.";

const MoreButton = ({
  shown,
  total,
  noun,
  onMore,
}: {
  shown: number;
  total: number;
  noun: string;
  onMore: () => void;
}): JSX.Element | null =>
  shown < total ? (
    <Button size="small" onClick={onMore} sx={{ alignSelf: "center" }}>
      {`Show ${formatNumber(Math.min(SEARCH_STEP, total - shown))} more ${noun} (${formatNumber(total - shown)} left)`}
    </Button>
  ) : null;

/**
 * Slot types and categories whose names match, best match first (an id
 * typed as digits leads its list), each list twelve cards at a time.
 */
const SearchResults = forwardRef<HTMLHeadingElement, SearchResultsProps>(
  (
    {
      query,
      tooShort,
      slots,
      categories,
      themeOf,
      acceptedOf,
      acceptedMax,
      onClear,
      onOpenSlot,
      onOpenCategory,
      slotsSearched,
      categoriesSearched,
    },
    headingRef,
  ) => {
    // A new search starts both lists short again. Reset here rather than by
    // remounting, so cards that stay in the results keep their in-flight
    // requests (a remount would abort them and start over).
    const [limits, setLimits] = useState({ query, slots: SEARCH_STEP, categories: SEARCH_STEP });
    if (limits.query !== query) {
      setLimits({ query, slots: SEARCH_STEP, categories: SEARCH_STEP });
    }
    const slotLimit = limits.query === query ? limits.slots : SEARCH_STEP;
    const categoryLimit = limits.query === query ? limits.categories : SEARCH_STEP;

    // "Show more" moves focus to the first card it revealed, so the button
    // vanishing after the last batch never drops focus, and the next Tab
    // continues where the new cards start.
    const slotListRef = useRef<HTMLUListElement>(null);
    const categoryListRef = useRef<HTMLUListElement>(null);
    const revealRef = useRef<{ list: "slots" | "categories"; index: number } | null>(null);
    useEffect(() => {
      const pending = revealRef.current;
      if (!pending) {
        return;
      }
      revealRef.current = null;
      const list = pending.list === "slots" ? slotListRef.current : categoryListRef.current;
      list?.children[pending.index]?.querySelector<HTMLElement>("button")?.focus();
    });
    const showMore = (list: "slots" | "categories"): void => {
      revealRef.current = { list, index: list === "slots" ? slotLimit : categoryLimit };
      setLimits((current) => ({ ...current, [list]: current[list] + SEARCH_STEP }));
    };
    const empty = tooShort || (slots.length === 0 && categories.length === 0);

    return (
      <ResultsSection
        ref={headingRef}
        title="Search results"
        description={
          empty
            ? undefined
            : `${pluralize(slots.length, "slot type", "slot types")} and ${pluralize(categories.length, "category name", "category names")} match “${query}”, best match first.`
        }
        actions={
          <Button size="small" onClick={onClear}>
            Clear search
          </Button>
        }
      >
        {empty ? (
          <EmptyState
            compact
            icon={<SearchOffRoundedIcon />}
            title={tooShort ? "Type at least two letters" : `Nothing matches “${query}”`}
            description={
              tooShort
                ? "One letter matches nearly every name; add another, or type an id."
                : "Try a shorter name or a single word, or an id such as 709."
            }
          />
        ) : (
          <Stack spacing={3}>
            {slots.length > 0 ? (
              <Stack spacing={1.5}>
                <Typography variant="overline" component="h3" sx={{ m: 0 }}>
                  {`Slot types · ${formatNumber(slots.length)}`}
                </Typography>
                <CardGrid
                  listRef={slotListRef}
                  label={`Slot types matching ${query}`}
                  entries={slots.slice(0, slotLimit)}
                  keyOf={(slot) => slot.id}
                  render={(slot) => (
                    <SlotTypeCard
                      slot={slot}
                      theme={themeOf.get(slot.id) ?? "reagents"}
                      showTheme
                      onSelect={onOpenSlot}
                    />
                  )}
                />
                <MoreButton
                  shown={slotLimit}
                  total={slots.length}
                  noun="slot types"
                  onMore={() => showMore("slots")}
                />
              </Stack>
            ) : null}
            {categories.length > 0 ? (
              <Stack spacing={1.5}>
                <Typography variant="overline" component="h3" sx={{ m: 0 }}>
                  {`Categories · ${formatNumber(categories.length)}`}
                </Typography>
                <CardGrid
                  listRef={categoryListRef}
                  label={`Categories matching ${query}`}
                  entries={categories.slice(0, categoryLimit)}
                  keyOf={(group) => group.key}
                  render={(group) => (
                    <CategoryCard
                      group={group}
                      accepted={acceptedOf(group)}
                      acceptedMax={acceptedMax}
                      onSelect={onOpenCategory}
                    />
                  )}
                />
                <MoreButton
                  shown={categoryLimit}
                  total={categories.length}
                  noun="categories"
                  onMore={() => showMore("categories")}
                />
              </Stack>
            ) : null}
            {slots.length === 0 || categories.length === 0 ? (
              <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
                {slots.length === 0 ? slotsNote(slotsSearched) : categoriesNote(categoriesSearched)}
              </Typography>
            ) : null}
          </Stack>
        )}
      </ResultsSection>
    );
  },
);

SearchResults.displayName = "SearchResults";

export default SearchResults;
