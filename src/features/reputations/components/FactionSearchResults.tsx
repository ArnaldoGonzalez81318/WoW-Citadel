import SearchOffRoundedIcon from "@mui/icons-material/SearchOffRounded";
import { Button, Pagination, Stack } from "@mui/material";
import { useMemo, useRef } from "react";

import SectionCard from "@/components/common/SectionCard";
import { EmptyState } from "@/components/common/StateBlocks";
import FactionGrid from "@/features/reputations/components/FactionGrid";
import type { FactionGridEntry } from "@/features/reputations/components/FactionGrid";
import { pathOf } from "@/features/reputations/hooks/useFactionParents";
import type { FactionParents } from "@/features/reputations/hooks/useFactionParents";
import { groupAccentKey } from "@/features/reputations/services/reputationPalette";
import { pluralize } from "@/features/reputations/services/reputationService";
import type { FactionRef } from "@/features/reputations/types";
import { MIN_FUZZY_QUERY_LENGTH } from "@/lib/fuzzyMatch";

export const SEARCH_PAGE_SIZE = 25;

export type FactionSearchResultsProps = {
  /** What was searched, trimmed. */
  query: string;
  /** Every match, best first. */
  results: readonly FactionRef[];
  /** 1-based, already clamped to the result pages. */
  page: number;
  pageCount: number;
  parents: FactionParents;
  rootIds: ReadonlySet<number>;
  onPageChange: (page: number) => void;
  onClear: () => void;
  onSelect: (faction: FactionRef) => void;
};

/**
 * Every faction whose name matches, across all groups, best match first
 * (typos and half-typed words included), 25 to a page. Each card shows
 * where its faction sits as far as the page knows the tree, and loads its
 * record only as it nears the viewport.
 */
const FactionSearchResults = ({
  query,
  results,
  page,
  pageCount,
  parents,
  rootIds,
  onPageChange,
  onClear,
  onSelect,
}: FactionSearchResultsProps): JSX.Element => {
  const listTopRef = useRef<HTMLDivElement>(null);
  const start = (page - 1) * SEARCH_PAGE_SIZE;
  const entries = useMemo<FactionGridEntry[]>(
    () =>
      results.slice(start, start + SEARCH_PAGE_SIZE).map((faction) => {
        const path = pathOf(faction.id, parents);
        const root = rootIds.has(faction.id);
        return {
          faction,
          accent: groupAccentKey(path[0]?.id ?? (root ? faction.id : undefined)),
          // An unknown parent leaves the line empty rather than guessing.
          pathLabel: root
            ? "Top-level group"
            : path.map((step) => step.name).join(" › "),
        };
      }),
    [results, start, parents, rootIds],
  );

  // A list is read from the top: a new page starts at its first faction.
  const handlePageChange = (next: number): void => {
    onPageChange(next);
    listTopRef.current?.scrollIntoView({ block: "start" });
  };

  const tooShort = query.length < MIN_FUZZY_QUERY_LENGTH;

  const renderBody = (): JSX.Element => {
    if (tooShort || results.length === 0) {
      return (
        <EmptyState
          compact
          icon={<SearchOffRoundedIcon />}
          title={tooShort ? "Type at least two letters" : `No factions match “${query}”`}
          description={
            tooShort
              ? "One letter matches nearly every faction; add another to narrow it down."
              : "Try a shorter name or a single word, or browse the groups above."
          }
        />
      );
    }
    return (
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
        <FactionGrid
          label={`Factions matching ${query}`}
          entries={entries}
          lazy
          onSelect={onSelect}
        />
        {pageCount > 1 ? (
          <Pagination
            count={pageCount}
            page={page}
            onChange={(_event, next) => handlePageChange(next)}
            siblingCount={1}
            aria-label="Search result pages"
            sx={{ alignSelf: "center" }}
          />
        ) : null}
      </Stack>
    );
  };

  return (
    <SectionCard
      title="Search results"
      description={
        !tooShort && results.length > 0
          ? `${pluralize(results.length, "faction", "factions")} across every group, best match first`
          : undefined
      }
      actions={
        <Button size="small" onClick={onClear}>
          Back to groups
        </Button>
      }
    >
      {renderBody()}
    </SectionCard>
  );
};

export default FactionSearchResults;
