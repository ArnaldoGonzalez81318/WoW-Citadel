import { Box } from "@mui/material";
import type { ReactNode, Ref } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import { LoadingSkeleton } from "@/components/common/StateBlocks";

export const CARD_COLS: GridColumns = { xs: 1, sm: 2, md: 3, lg: 4 };
const GRID_GAP_PX = 16;

export type CardGridProps<T> = {
  /** Accessible name of the list ("Embellishments slot types"). */
  label: string;
  entries: readonly T[];
  /**
   * A stable key per entry (its id), so a card keeps its instance when the
   * list re-sorts: a remount would drop the last observer of its in-flight
   * record, which aborts the request, and fetch it all over again.
   */
  keyOf: (entry: T) => string | number;
  render: (entry: T) => ReactNode;
  listRef?: Ref<HTMLUListElement>;
};

/** Cards as a list, so screen readers announce how many there are. */
const CardGrid = <T,>({ label, entries, keyOf, render, listRef }: CardGridProps<T>): JSX.Element => (
  <Box
    ref={listRef}
    component="ul"
    // Safari drops the list role from a list-style:none list without it.
    role="list"
    aria-label={label}
    sx={{
      display: "grid",
      gap: `${GRID_GAP_PX}px`,
      listStyle: "none",
      m: 0,
      p: 0,
      ...gridTemplateColumnsSx(CARD_COLS),
    }}
  >
    {entries.map((entry) => (
      <Box component="li" key={keyOf(entry)} sx={{ minWidth: 0 }}>
        {render(entry)}
      </Box>
    ))}
  </Box>
);

export type CardGridSkeletonProps = {
  count: number;
  itemHeight: number;
  label: string;
};

/** Skeleton cells the size of the cards, in the grid's own columns. */
export const CardGridSkeleton = ({ count, itemHeight, label }: CardGridSkeletonProps): JSX.Element => (
  <LoadingSkeleton
    variant="grid"
    columns={CARD_COLS}
    itemHeight={itemHeight}
    count={count}
    gap={GRID_GAP_PX}
    label={label}
  />
);

export default CardGrid;
