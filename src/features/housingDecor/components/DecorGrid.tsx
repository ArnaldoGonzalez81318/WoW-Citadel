import { Box } from "@mui/material";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import { LoadingSkeleton } from "@/components/common/StateBlocks";
import DecorCard, {
  DECOR_STAGE_HEIGHT,
  DECOR_TEXT_HEIGHT,
} from "@/features/housingDecor/components/DecorCard";
import { DECOR_PAGE_SIZE } from "@/features/housingDecor/services/housingCatalog";
import type { DecorEntry, DecorItemSummary } from "@/features/housingDecor/types";

/** Two across even at 320px: an icon card reads at ~140px, and a page of 24 stays short. */
export const DECOR_COLS: GridColumns = { xs: 2, sm: 3, md: 4, lg: 6 };
const GRID_GAP_PX = 12;
/** Stage, text block and the card's 1px borders. */
const CARD_HEIGHT = DECOR_STAGE_HEIGHT + DECOR_TEXT_HEIGHT + 2;

export const DecorGridSkeleton = ({
  count = DECOR_PAGE_SIZE,
  label = "Loading decor",
}: {
  count?: number;
  label?: string;
}): JSX.Element => (
  <LoadingSkeleton
    variant="grid"
    columns={DECOR_COLS}
    itemHeight={CARD_HEIGHT}
    count={count}
    gap={GRID_GAP_PX}
    label={label}
  />
);

export type DecorGridProps = {
  entries: readonly DecorEntry[];
  /** Accessible name of the list. */
  label: string;
  /** Decor id -> item id, once the page's batch lands. */
  itemIds: ReadonlyMap<number, number | undefined> | undefined;
  linkPending: boolean;
  /** Item id -> quality, once the page's item search lands. */
  summaries: ReadonlyMap<number, DecorItemSummary> | undefined;
  onSelect: (entry: DecorEntry) => void;
};

const DecorGrid = ({
  entries,
  label,
  itemIds,
  linkPending,
  summaries,
  onSelect,
}: DecorGridProps): JSX.Element => (
  <Box
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
      ...gridTemplateColumnsSx(DECOR_COLS),
    }}
  >
    {entries.map((entry) => {
      const itemId = itemIds?.get(entry.id);
      return (
        <Box component="li" key={entry.id} sx={{ minWidth: 0 }}>
          <DecorCard
            entry={entry}
            itemId={itemId}
            linkPending={linkPending}
            summary={itemId !== undefined ? summaries?.get(itemId) : undefined}
            onSelect={onSelect}
          />
        </Box>
      );
    })}
  </Box>
);

export default DecorGrid;
