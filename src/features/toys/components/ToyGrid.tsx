import { Box } from "@mui/material";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import { LoadingSkeleton } from "@/components/common/StateBlocks";
import ToyCard, { TOY_CARD_HEIGHT } from "@/features/toys/components/ToyCard";
import { TOY_PAGE_SIZE } from "@/features/toys/services/toyService";
import type { ToyRef } from "@/features/toys/types";

/** Two across even at 320px (a 56px icon and a two-line name fit in under 120px); six on wide screens. */
export const TOY_COLS: GridColumns = { xs: 2, sm: 3, md: 4, lg: 6 };
export const TOY_GAP_PX = 12;

export const ToyGridSkeleton = ({
  count = TOY_PAGE_SIZE,
  label = "Loading toys",
}: {
  count?: number;
  label?: string;
}): JSX.Element => (
  <LoadingSkeleton
    variant="grid"
    columns={TOY_COLS}
    itemHeight={TOY_CARD_HEIGHT}
    count={count}
    gap={TOY_GAP_PX}
    label={label}
  />
);

export type ToyGridProps = {
  toys: ToyRef[];
  /** Accessible name of the list. */
  label: string;
  onOpen: (toy: ToyRef) => void;
};

const ToyGrid = ({ toys, label, onOpen }: ToyGridProps): JSX.Element => (
  <Box
    component="ul"
    // Safari drops the list role from a list-style:none list without it.
    role="list"
    aria-label={label}
    sx={{
      display: "grid",
      gap: `${TOY_GAP_PX}px`,
      listStyle: "none",
      m: 0,
      p: 0,
      ...gridTemplateColumnsSx(TOY_COLS),
    }}
  >
    {toys.map((toy) => (
      <Box component="li" key={toy.id} sx={{ minWidth: 0 }}>
        <ToyCard toy={toy} onOpen={onOpen} />
      </Box>
    ))}
  </Box>
);

export default ToyGrid;
