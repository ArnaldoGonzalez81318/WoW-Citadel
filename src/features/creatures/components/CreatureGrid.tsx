import { Box } from "@mui/material";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import { LoadingSkeleton } from "@/components/common/StateBlocks";
import CreatureCard, {
  CREATURE_CARD_TEXT_HEIGHT,
} from "@/features/creatures/components/CreatureCard";
import { CREATURE_PAGE_SIZE } from "@/features/creatures/services/creatureService";
import type { Creature } from "@/features/creatures/types";

/** Two across even at 320px: a render reads at ~130px, and a page of 24 stays short. */
export const CREATURE_COLS: GridColumns = { xs: 2, sm: 3, md: 4, lg: 6 };
const GRID_GAP_PX = 12;

/**
 * Skeleton cells shaped like the cards: the 4:3 render is three quarters of
 * the cell's width, plus the card's text block and its 1px borders, so the
 * grid does not jump at any breakpoint.
 */
const cardCellSx = {
  "& > .MuiSkeleton-root": { height: "auto" },
  "& > .MuiSkeleton-root::before": {
    content: '""',
    display: "block",
    paddingTop: `calc(75% + ${CREATURE_CARD_TEXT_HEIGHT + 2}px)`,
  },
};

export const CreatureGridSkeleton = ({
  count = CREATURE_PAGE_SIZE,
  label = "Loading creatures",
}: {
  count?: number;
  label?: string;
}): JSX.Element => (
  <LoadingSkeleton
    variant="grid"
    columns={CREATURE_COLS}
    count={count}
    gap={GRID_GAP_PX}
    label={label}
    sx={cardCellSx}
  />
);

export type CreatureGridProps = {
  creatures: Creature[];
  /** Accessible name of the list. */
  label: string;
  onSelect: (creature: Creature) => void;
};

const CreatureGrid = ({ creatures, label, onSelect }: CreatureGridProps): JSX.Element => (
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
      ...gridTemplateColumnsSx(CREATURE_COLS),
    }}
  >
    {creatures.map((creature) => (
      <Box component="li" key={creature.id} sx={{ minWidth: 0 }}>
        <CreatureCard creature={creature} onSelect={onSelect} />
      </Box>
    ))}
  </Box>
);

export default CreatureGrid;
