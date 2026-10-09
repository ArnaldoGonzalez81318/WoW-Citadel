import { Box } from "@mui/material";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import { LoadingSkeleton } from "@/components/common/StateBlocks";
import MountCard, { MOUNT_CARD_TEXT_HEIGHT } from "@/features/mounts/components/MountCard";
import { MOUNT_PAGE_SIZE } from "@/features/mounts/services/mountService";
import type { MountSummary } from "@/features/mounts/types";

/** Two across even at 320px (a render still reads at ~120px); four on wide screens keeps the renders big. */
export const MOUNT_COLS: GridColumns = { xs: 2, sm: 3, lg: 4 };
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
    paddingTop: `calc(75% + ${MOUNT_CARD_TEXT_HEIGHT + 2}px)`,
  },
};

export const MountGridSkeleton = ({
  count = MOUNT_PAGE_SIZE,
  label = "Loading mounts",
}: {
  count?: number;
  label?: string;
}): JSX.Element => (
  <LoadingSkeleton
    variant="grid"
    columns={MOUNT_COLS}
    count={count}
    gap={GRID_GAP_PX}
    label={label}
    sx={cardCellSx}
  />
);

export type MountGridProps = {
  mounts: MountSummary[];
  /** Accessible name of the list. */
  label: string;
  onSelect: (mount: MountSummary) => void;
};

const MountGrid = ({ mounts, label, onSelect }: MountGridProps): JSX.Element => (
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
      ...gridTemplateColumnsSx(MOUNT_COLS),
    }}
  >
    {mounts.map((mount) => (
      <Box component="li" key={mount.id} sx={{ minWidth: 0 }}>
        <MountCard mount={mount} onSelect={onSelect} />
      </Box>
    ))}
  </Box>
);

export default MountGrid;
