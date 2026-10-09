import CheckroomRoundedIcon from "@mui/icons-material/CheckroomRounded";
import { Box, Button, Pagination, Stack } from "@mui/material";
import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import ItemSetCard, { SET_CARD_HEIGHT } from "@/features/items/components/ItemSetCard";
import useStickyError from "@/features/items/hooks/useStickyError";
import { pluralize } from "@/features/items/services/itemService";
import type { ItemSetSummary } from "@/features/items/types";
import type { SearchParamsRecordSetter } from "@/hooks/useSearchParamState";
import { formatNumber } from "@/lib/format";
import { MIN_FUZZY_QUERY_LENGTH, rankByName } from "@/lib/fuzzyMatch";

/** Twelve cards: 1, 2, 3 and 4 columns all end on a full row. */
const SET_PAGE_SIZE = 12;
const SET_COLS: GridColumns = { xs: 1, sm: 2, md: 3, lg: 4 };
const GRID_GAP_PX = 12;
const EMPTY: ItemSetSummary[] = [];

export type ItemSetParams = {
  setq: string;
  setpage: string;
};

export type ItemSetsSectionProps = {
  /** The set index (enabled by the page once this section nears the viewport). */
  indexQuery: UseQueryResult<ItemSetSummary[]>;
  /** From the URL. */
  search: string;
  page: string;
  setParams: SearchParamsRecordSetter<ItemSetParams>;
  onSelect: (set: ItemSetSummary) => void;
};

const parsePage = (value: string): number | null => {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : null;
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

/**
 * Every item set Blizzard lists (tier sets, PvP sets, crafted and older
 * sets), newest first, twelve to a page. The name search ranks the whole
 * index here (Blizzard has no set search), forgiving typos and half-typed
 * words. Search and page live in the URL (`setq`, `setpage`).
 */
const ItemSetsSection = ({
  indexQuery,
  search,
  page: pageParam,
  setParams,
  onSelect,
}: ItemSetsSectionProps): JSX.Element => {
  const sets = indexQuery.data ?? EMPTY;
  const indexError = useStickyError("item-set-index", indexQuery);
  const query = search.trim();
  const searching = query.length >= MIN_FUZZY_QUERY_LENGTH;

  /* ---------------- Search draft (keystrokes stay local; the URL gets the debounced value) ---------------- */

  const [draft, setDraft] = useState(search);
  const emittedRef = useRef(search);
  useEffect(() => {
    // The URL changed on its own (Back): adopt it.
    if (search !== emittedRef.current) {
      emittedRef.current = search;
      setDraft(search);
    }
  }, [search]);
  const handleSearch = useCallback(
    (value: string): void => {
      const next = value.trim();
      emittedRef.current = next;
      setParams({ setq: next || null, setpage: null }, { replace: true });
    },
    [setParams],
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const clearSearch = (): void => {
    emittedRef.current = "";
    setDraft("");
    setParams({ setq: null, setpage: null }, { replace: true });
    inputRef.current?.focus();
  };

  /* ---------------- Results and paging ---------------- */

  const results = useMemo(
    () => (searching ? rankByName(sets, query, (set) => set.name, sets.length) : sets),
    [sets, query, searching],
  );
  const pageCount = Math.max(1, Math.ceil(results.length / SET_PAGE_SIZE));
  const page = Math.min(parsePage(pageParam) ?? 1, pageCount);
  const start = (page - 1) * SET_PAGE_SIZE;
  const shown = results.slice(start, start + SET_PAGE_SIZE);

  // A page past the end (a narrower search) or a malformed one falls back
  // to the page on screen, once the index can say which that is.
  useEffect(() => {
    if (pageParam === "" || indexQuery.data === undefined) {
      return;
    }
    const next = page > 1 ? String(page) : null;
    if ((next ?? "") !== pageParam) {
      setParams({ setpage: next }, { replace: true });
    }
  }, [pageParam, page, indexQuery.data, setParams]);

  const listTopRef = useRef<HTMLDivElement>(null);
  const changePage = (next: number): void => {
    setParams({ setpage: next > 1 ? String(next) : null });
    scrollToTop(listTopRef.current);
  };

  /* ---------------- Render ---------------- */

  let summary: string | undefined;
  if (indexQuery.data !== undefined && sets.length > 0) {
    const range =
      pageCount > 1
        ? ` · showing ${formatNumber(start + 1)}–${formatNumber(start + shown.length)}`
        : "";
    summary = searching
      ? results.length > 0
        ? `${formatNumber(results.length)} of ${pluralize(sets.length, "set", "sets")} match${range}`
        : "No matching sets"
      : `${pluralize(sets.length, "set", "sets")}, newest first${range}`;
  }

  const renderBody = (): JSX.Element => {
    if (indexError.error !== undefined) {
      return (
        <ErrorState
          error={indexError.error}
          context="item sets"
          onRetry={indexError.retry}
          retryLabel={indexError.retrying ? "Retrying…" : "Retry"}
        />
      );
    }
    if (indexQuery.data === undefined) {
      return (
        <LoadingSkeleton
          variant="grid"
          columns={SET_COLS}
          itemHeight={SET_CARD_HEIGHT}
          count={SET_PAGE_SIZE}
          gap={GRID_GAP_PX}
          label="Loading item sets"
        />
      );
    }
    if (sets.length === 0) {
      return (
        <EmptyState
          compact
          icon={<CheckroomRoundedIcon />}
          title="No item sets listed"
          description="Blizzard returned an empty item set index for this region."
        />
      );
    }
    if (results.length === 0) {
      return (
        <EmptyState
          compact
          icon={<CheckroomRoundedIcon />}
          title={`No item sets match “${query}”`}
          description="Check the spelling, or try one word of the set's name."
          action={
            <Button variant="outlined" size="small" onClick={clearSearch}>
              Clear search
            </Button>
          }
        />
      );
    }
    return (
      <Stack spacing={2.5}>
        <Box
          component="ul"
          role="list"
          aria-label={searching ? `Item sets matching “${query}”` : "Item sets, newest first"}
          sx={{
            display: "grid",
            gap: `${GRID_GAP_PX}px`,
            listStyle: "none",
            m: 0,
            p: 0,
            ...gridTemplateColumnsSx(SET_COLS),
          }}
        >
          {shown.map((set) => (
            <Box component="li" key={set.id} sx={{ minWidth: 0 }}>
              <ItemSetCard set={set} onSelect={onSelect} />
            </Box>
          ))}
        </Box>
        {pageCount > 1 ? (
          <Pagination
            count={pageCount}
            page={page}
            onChange={(_event, next) => changePage(next)}
            siblingCount={0}
            aria-label="Item set pages"
            sx={{ alignSelf: "center" }}
          />
        ) : null}
      </Stack>
    );
  };

  return (
    <SectionCard
      title="Item sets"
      icon={<CheckroomRoundedIcon />}
      description="Tier sets, PvP sets and every other set Blizzard lists, newest first (by set id). Open one for its pieces and set bonuses."
    >
      <Stack
        spacing={2}
        ref={listTopRef}
        sx={(theme) => ({
          scrollMarginTop: {
            xs: `${theme.wc.layout.headerHeight.xs + 16}px`,
            md: `${theme.wc.layout.headerHeight.md + 16}px`,
          },
        })}
      >
        <Stack direction="row" flexWrap="wrap" useFlexGap gap={1.5} alignItems="center">
          <SearchField
            size="small"
            label="Search item sets by name"
            placeholder={sets.length > 0 ? `Search ${formatNumber(sets.length)} item sets` : "Search item sets"}
            value={draft}
            onChange={setDraft}
            onDebouncedChange={handleSearch}
            onClear={clearSearch}
            inputRef={inputRef}
            disabled={indexError.error !== undefined}
            sx={{ minWidth: { xs: 0, sm: 240 }, maxWidth: { md: 420 } }}
          />
          {summary ? (
            <LiveStatus sx={{ flex: { xs: "1 1 100%", md: "0 1 auto" }, ml: { md: "auto" } }}>
              {summary}
            </LiveStatus>
          ) : null}
        </Stack>
        {renderBody()}
      </Stack>
    </SectionCard>
  );
};

export default ItemSetsSection;
