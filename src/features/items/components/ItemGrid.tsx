import { Box } from "@mui/material";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import { LoadingSkeleton } from "@/components/common/StateBlocks";
import ItemCard, { ITEM_CARD_HEIGHT } from "@/features/items/components/ItemCard";
import { ITEM_PAGE_SIZE } from "@/features/items/services/itemCatalog";
import type { ItemSummary } from "@/features/items/types";

/** One card per row on phones (a long name needs the width), four on wide screens. */
export const ITEM_COLS: GridColumns = { xs: 1, sm: 2, md: 3, lg: 4 };
const GRID_GAP_PX = 12;

export const ItemGridSkeleton = ({
  count = ITEM_PAGE_SIZE,
  label = "Loading items",
}: {
  count?: number;
  label?: string;
}): JSX.Element => (
  <LoadingSkeleton
    variant="grid"
    columns={ITEM_COLS}
    itemHeight={ITEM_CARD_HEIGHT}
    count={count}
    gap={GRID_GAP_PX}
    label={label}
  />
);

export type ItemGridProps = {
  items: ItemSummary[];
  /** Accessible name of the list. */
  label: string;
  onSelect: (item: ItemSummary) => void;
};

const ItemGrid = ({ items, label, onSelect }: ItemGridProps): JSX.Element => (
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
      ...gridTemplateColumnsSx(ITEM_COLS),
    }}
  >
    {items.map((item) => (
      <Box component="li" key={item.id} sx={{ minWidth: 0 }}>
        <ItemCard item={item} onSelect={onSelect} />
      </Box>
    ))}
  </Box>
);

export default ItemGrid;
