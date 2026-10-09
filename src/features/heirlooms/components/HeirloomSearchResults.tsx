import SearchOffRoundedIcon from "@mui/icons-material/SearchOffRounded";
import { Button, Pagination, Stack } from "@mui/material";
import { useRef, useState } from "react";

import { EmptyState, LiveStatus } from "@/components/common/StateBlocks";
import HeirloomGrid from "@/features/heirlooms/components/HeirloomGrid";
import type { HeirloomGridEntry } from "@/features/heirlooms/components/HeirloomGrid";
import { scrollMarginSx } from "@/features/heirlooms/components/heirloomStyles";
import { pluralize } from "@/features/heirlooms/services/heirloomService";
import type { HeirloomRef } from "@/features/heirlooms/types";
import { formatNumber } from "@/lib/format";

export const SEARCH_PAGE_SIZE = 24;

export type HeirloomSearchResultsProps = {
  /** What was searched, trimmed. */
  query: string;
  /** One letter ranks nothing: say so instead of "no match". */
  tooShort: boolean;
  /** Every match that passes the filters, best first. */
  items: readonly HeirloomGridEntry[];
  /** Filters are set (the empty state offers to clear them). */
  filtered: boolean;
  ceiling: number;
  onClearFilters: () => void;
  onSelect: (entry: HeirloomRef) => void;
};

/**
 * Every heirloom whose name matches, best match first (typos and
 * half-typed words included), 24 to a page. The ranking runs over the
 * index, so results show while the records are still loading; their cards
 * fill in as each record lands. Mount it with a `key` per search and
 * filters, so the page starts over.
 */
const HeirloomSearchResults = ({
  query,
  tooShort,
  items,
  filtered,
  ceiling,
  onClearFilters,
  onSelect,
}: HeirloomSearchResultsProps): JSX.Element => {
  const [page, setPage] = useState(1);
  const listTopRef = useRef<HTMLDivElement>(null);
  const pageCount = Math.max(1, Math.ceil(items.length / SEARCH_PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * SEARCH_PAGE_SIZE;
  const shown = items.slice(start, start + SEARCH_PAGE_SIZE);

  if (tooShort || items.length === 0) {
    return (
      <EmptyState
        compact
        // The query is echoed in the title: one long run of letters must
        // wrap rather than push a phone-width page sideways.
        sx={{ overflowWrap: "anywhere" }}
        icon={<SearchOffRoundedIcon />}
        title={tooShort ? "Type at least two letters" : `No heirlooms match “${query}”`}
        description={
          tooShort
            ? "One letter matches nearly every heirloom; add another to narrow it down."
            : filtered
              ? "Nothing by that name passes these filters. Clear them, or try a shorter name."
              : "Try a shorter name or a single word, or browse the slots instead."
        }
        action={
          !tooShort && filtered ? (
            <Button variant="outlined" size="small" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : undefined
        }
      />
    );
  }

  // A list is read from the top: a new page starts at its first card.
  const handlePageChange = (next: number): void => {
    setPage(next);
    listTopRef.current?.scrollIntoView({ block: "start" });
  };

  return (
    <Stack spacing={2.5} ref={listTopRef} sx={scrollMarginSx}>
      {pageCount > 1 ? (
        <LiveStatus sx={{ typography: "caption" }}>
          {`Showing ${formatNumber(start + 1)}–${formatNumber(start + shown.length)} of ${pluralize(items.length, "match", "matches")}`}
        </LiveStatus>
      ) : null}
      <HeirloomGrid
        label={`Heirlooms matching ${query}`}
        items={shown}
        ceiling={ceiling}
        onSelect={onSelect}
      />
      {pageCount > 1 ? (
        <Pagination
          count={pageCount}
          page={current}
          onChange={(_event, next) => handlePageChange(next)}
          siblingCount={1}
          aria-label="Search result pages"
          sx={{ alignSelf: "center" }}
        />
      ) : null}
    </Stack>
  );
};

export default HeirloomSearchResults;
