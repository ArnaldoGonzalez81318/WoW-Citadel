import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { SearchField } from "@/components/common/ExplorerFilterBar";
import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import SectionCard from "@/components/common/SectionCard";
import {
  EmptyState,
  ErrorState,
  LiveStatus,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import RecipeTile, {
  RECIPE_TILE_HEIGHT,
} from "@/features/professions/components/RecipeTile";
import {
  formatSkillRange,
  pluralize,
} from "@/features/professions/services/professionService";
import type {
  RecipeRef,
  SkillTier,
  SkillTierSummary,
} from "@/features/professions/types";
import type { SearchParamsRecordSetter } from "@/hooks/useSearchParamState";
import { formatNumber } from "@/lib/format";
import { matchesTypedName } from "@/lib/nameSearch";

export const RECIPE_PAGE_SIZE = 25;
const RECIPE_COLS: GridColumns = { xs: 1, sm: 2, lg: 3 };
const RECIPE_GAP_PX = 12;
/** The Select's value for "every category" (the URL leaves `category` out). */
const ALL_CATEGORIES = "__all__";

export type RecipeBrowserParams = {
  category: string;
  q: string;
  page: string;
};

export type RecipeBrowserProps = {
  tier: SkillTierSummary;
  query: UseQueryResult<SkillTier | null>;
  /** From the URL: "" for every category. */
  category: string;
  /** From the URL, trimmed. */
  search: string;
  /** From the URL, 1-based (may be past the end until the effect below fixes it). */
  page: number;
  setParams: SearchParamsRecordSetter<RecipeBrowserParams>;
  onOpenRecipe: (recipe: RecipeRef) => void;
};

type Entry = { recipe: RecipeRef; category: string };
type EntryGroup = { category: string; entries: Entry[] };

/** The page's recipes in runs of one category each, for one heading per run. */
const groupByCategory = (entries: Entry[]): EntryGroup[] => {
  const groups: EntryGroup[] = [];
  entries.forEach((entry) => {
    const last = groups[groups.length - 1];
    if (last && last.category === entry.category) {
      last.entries.push(entry);
    } else {
      groups.push({ category: entry.category, entries: [entry] });
    }
  });
  return groups;
};

const countBy = (entries: Entry[]): Map<string, number> => {
  const counts = new Map<string, number>();
  entries.forEach((entry) =>
    counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1),
  );
  return counts;
};

const EMPTY_ENTRIES: Entry[] = [];

/**
 * One expansion's recipe book: a name filter and a category picker over
 * every recipe, 25 to a page under their category headings. A book runs to
 * ~300 recipes; each tile loads its own icon as it nears the viewport.
 */
const RecipeBrowser = ({
  tier,
  query,
  category,
  search,
  page,
  setParams,
  onOpenRecipe,
}: RecipeBrowserProps): JSX.Element => {
  const data = query.data ?? null;
  const categoryLabelId = useId();
  const headingBaseId = useId();

  /* ---------------- Search draft (keystrokes stay local; the URL gets the debounced value) ---------------- */

  const [draft, setDraft] = useState(search);
  const emittedRef = useRef(search);
  useEffect(() => {
    // The URL changed on its own (back button, another profession): adopt it.
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

  /* ---------------- Filtering and paging ---------------- */

  const entries = useMemo(
    () =>
      data
        ? data.categories.flatMap((group) =>
            group.recipes.map((recipe) => ({ recipe, category: group.name })),
          )
        : EMPTY_ENTRIES,
    [data],
  );
  const categoryCounts = useMemo(() => countBy(entries), [entries]);
  // Legion and Battle for Azeroth list each rank as its own same-name recipe.
  const duplicateNames = useMemo(() => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    entries.forEach(({ recipe }) => {
      if (seen.has(recipe.name)) {
        duplicates.add(recipe.name);
      }
      seen.add(recipe.name);
    });
    return duplicates;
  }, [entries]);

  const activeCategory = categoryCounts.has(category) ? category : "";
  const filtered = useMemo(
    () =>
      entries.filter(
        (entry) =>
          (activeCategory === "" || entry.category === activeCategory) &&
          (search === "" || matchesTypedName(entry.recipe.name, search)),
      ),
    [entries, activeCategory, search],
  );
  const filteredCounts = useMemo(() => countBy(filtered), [filtered]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / RECIPE_PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const start = (currentPage - 1) * RECIPE_PAGE_SIZE;
  const groups = useMemo(
    () => groupByCategory(filtered.slice(start, start + RECIPE_PAGE_SIZE)),
    [filtered, start],
  );

  // A category this book does not have (an old link) falls back to all of them.
  useEffect(() => {
    if (data && category !== "" && !categoryCounts.has(category)) {
      setParams({ category: null, page: null }, { replace: true });
    }
  }, [data, category, categoryCounts, setParams]);

  // A page past the end (a narrower filter, a smaller book) falls back to the last one.
  useEffect(() => {
    if (data && page > pageCount) {
      setParams({ page: pageCount > 1 ? String(pageCount) : null }, { replace: true });
    }
  }, [data, page, pageCount, setParams]);

  // A list is read from the top: a new page starts at its first recipe.
  const listTopRef = useRef<HTMLDivElement>(null);
  const handlePageChange = (next: number): void => {
    setParams({ page: next > 1 ? String(next) : null });
    listTopRef.current?.scrollIntoView({ block: "start" });
  };

  const clearFilters = (): void => {
    emittedRef.current = "";
    setDraft("");
    setParams({ q: null, category: null, page: null }, { replace: true });
  };

  /* ---------------- Labels ---------------- */

  const description = data
    ? [
        formatSkillRange(data.minimumSkill, data.maximumSkill),
        data.categories.length > 0
          ? pluralize(data.categories.length, "category", "categories")
          : undefined,
        pluralize(data.recipeCount, "recipe", "recipes"),
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  const end = Math.min(start + RECIPE_PAGE_SIZE, filtered.length);
  const range = `${formatNumber(start + 1)}–${formatNumber(end)}`;
  const narrowed = filtered.length < entries.length;
  let summary: string;
  if (filtered.length === 0) {
    summary = "No matching recipes";
  } else if (narrowed) {
    summary = `${formatNumber(filtered.length)} of ${pluralize(entries.length, "recipe", "recipes")} match${pageCount > 1 ? ` · showing ${range}` : ""}`;
  } else {
    summary =
      pageCount > 1
        ? `Showing ${range} of ${pluralize(entries.length, "recipe", "recipes")}`
        : pluralize(entries.length, "recipe", "recipes");
  }

  /* ---------------- Render ---------------- */

  const renderBody = (): JSX.Element => {
    if (query.isPending) {
      return (
        <Stack spacing={2}>
          <Stack direction="row" flexWrap="wrap" useFlexGap gap={1.5}>
            <Skeleton variant="rounded" height={40} sx={{ flex: "1 1 240px" }} />
            <Skeleton variant="rounded" height={40} sx={{ flex: "1 1 200px", maxWidth: { sm: 320 } }} />
          </Stack>
          <Skeleton variant="text" width={140} sx={{ fontSize: "0.875rem" }} />
          <LoadingSkeleton
            variant="grid"
            columns={RECIPE_COLS}
            itemHeight={RECIPE_TILE_HEIGHT}
            count={12}
            gap={RECIPE_GAP_PX}
            label={`Loading ${tier.name} recipes`}
          />
        </Stack>
      );
    }
    if (query.isError && !data) {
      return (
        <ErrorState
          compact
          error={query.error}
          context={`${tier.name} recipes`}
          onRetry={() => void query.refetch()}
        />
      );
    }
    if (!data) {
      return (
        <EmptyState
          compact
          icon={<MenuBookRoundedIcon />}
          title={`No recipe book for ${tier.name}`}
          description="Blizzard has no record of this skill tier."
        />
      );
    }
    if (entries.length === 0) {
      return (
        <EmptyState
          compact
          icon={<MenuBookRoundedIcon />}
          title={`No recipes in ${tier.name}`}
          description="Blizzard lists no recipes for this skill tier. Older gathering and fishing tiers often have none; try a newer expansion."
        />
      );
    }

    return (
      <Stack spacing={2.5}>
        <Stack direction="row" flexWrap="wrap" useFlexGap gap={1.5} alignItems="center">
          <SearchField
            size="small"
            label={`Filter ${tier.name} recipes by name`}
            placeholder="Filter recipes"
            value={draft}
            onChange={setDraft}
            onDebouncedChange={handleSearch}
            sx={{ minWidth: { xs: 0, sm: 240 } }}
          />
          <FormControl size="small" sx={{ flex: "1 1 200px", minWidth: 0, maxWidth: { sm: 320 } }}>
            <InputLabel id={categoryLabelId}>Category</InputLabel>
            <Select
              labelId={categoryLabelId}
              label="Category"
              value={activeCategory === "" ? ALL_CATEGORIES : activeCategory}
              onChange={(event) => {
                const next = String(event.target.value);
                setParams({
                  category: next === ALL_CATEGORIES ? null : next,
                  page: null,
                });
              }}
            >
              <MenuItem value={ALL_CATEGORIES}>
                {`All categories (${formatNumber(entries.length)})`}
              </MenuItem>
              {Array.from(categoryCounts, ([name, count]) => (
                <MenuItem key={name} value={name}>
                  {`${name} (${formatNumber(count)})`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <LiveStatus
            sx={{
              flex: { xs: "1 1 100%", md: "0 1 auto" },
              minWidth: 0,
              marginLeft: { md: "auto" },
              overflowWrap: "anywhere",
            }}
          >
            {summary}
          </LiveStatus>
        </Stack>

        {filtered.length === 0 ? (
          <EmptyState
            compact
            // Only a name filter can empty the list: every listed category has recipes.
            title={`No recipes match “${search}”`}
            description={
              activeCategory
                ? `Nothing in ${activeCategory} matches. Clear the filters to see all ${pluralize(entries.length, "recipe", "recipes")}.`
                : "Try a shorter or different name, or another expansion."
            }
            action={
              <Button variant="outlined" size="small" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <Stack
            spacing={2.5}
            ref={listTopRef}
            sx={(theme) => ({
              scrollMarginTop: {
                xs: `${theme.wc.layout.headerHeight.xs + 16}px`,
                md: `${theme.wc.layout.headerHeight.md + 16}px`,
              },
            })}
          >
            {groups.map((group, index) => {
              const headingId = `${headingBaseId}-${index}`;
              const shown = filteredCounts.get(group.category) ?? group.entries.length;
              return (
                <Stack key={`${currentPage}-${index}-${group.category}`} spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="baseline" sx={{ minWidth: 0 }}>
                    <Typography
                      id={headingId}
                      variant="subtitle1"
                      component="h3"
                      sx={{ m: 0, minWidth: 0, overflowWrap: "anywhere" }}
                    >
                      {group.category}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="span" sx={{ flexShrink: 0 }}>
                      {pluralize(shown, "recipe", "recipes")}
                    </Typography>
                  </Stack>
                  <Box
                    component="ul"
                    role="list"
                    aria-labelledby={headingId}
                    sx={{
                      display: "grid",
                      gap: `${RECIPE_GAP_PX}px`,
                      listStyle: "none",
                      m: 0,
                      p: 0,
                      ...gridTemplateColumnsSx(RECIPE_COLS),
                    }}
                  >
                    {group.entries.map((entry, position) => (
                      <Box component="li" key={`${entry.recipe.id}-${position}`} sx={{ minWidth: 0 }}>
                        <RecipeTile
                          recipe={entry.recipe}
                          showRank={duplicateNames.has(entry.recipe.name)}
                          onOpen={onOpenRecipe}
                        />
                      </Box>
                    ))}
                  </Box>
                </Stack>
              );
            })}
            {pageCount > 1 ? (
              <Pagination
                count={pageCount}
                page={currentPage}
                onChange={(_event, next) => handlePageChange(next)}
                siblingCount={1}
                aria-label="Recipe pages"
                sx={{ alignSelf: "center" }}
              />
            ) : null}
          </Stack>
        )}
      </Stack>
    );
  };

  return (
    <SectionCard title={tier.name} description={description}>
      {renderBody()}
    </SectionCard>
  );
};

export default RecipeBrowser;
