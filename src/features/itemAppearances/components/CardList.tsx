import { Box } from "@mui/material";
import type { Key, ReactNode } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import { LoadingSkeleton } from "@/components/common/StateBlocks";
import {
  CARD_COLS,
  CARD_GAP_PX,
  CARD_HEIGHT,
} from "@/features/itemAppearances/components/appearanceLayout";

/** Skeleton cells the height of the cards (their 1px borders included), in the same columns. */
export const CardListSkeleton = ({
  count,
  label,
}: {
  count: number;
  label: string;
}): JSX.Element => (
  <LoadingSkeleton
    variant="grid"
    columns={CARD_COLS}
    itemHeight={CARD_HEIGHT + 2}
    count={count}
    gap={CARD_GAP_PX}
    label={label}
  />
);

export type CardListProps<T> = {
  /** Accessible name of the list. */
  label: string;
  items: readonly T[];
  getKey: (item: T) => Key;
  renderItem: (item: T) => ReactNode;
};

/** Cards as a list, so screen readers announce how many there are. */
const CardList = <T,>({ label, items, getKey, renderItem }: CardListProps<T>): JSX.Element => (
  <Box
    component="ul"
    // Safari drops the list role from a list-style:none list without it.
    role="list"
    aria-label={label}
    sx={{
      display: "grid",
      gap: `${CARD_GAP_PX}px`,
      listStyle: "none",
      m: 0,
      p: 0,
      ...gridTemplateColumnsSx(CARD_COLS),
    }}
  >
    {items.map((item) => (
      <Box component="li" key={getKey(item)} sx={{ minWidth: 0 }}>
        {renderItem(item)}
      </Box>
    ))}
  </Box>
);

export default CardList;
