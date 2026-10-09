import { Box } from "@mui/material";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import { LoadingSkeleton } from "@/components/common/StateBlocks";
import EssenceCard, {
  ESSENCE_CARD_HEIGHT,
} from "@/features/azeriteEssences/components/EssenceCard";
import {
  classCountOf,
  rolesOf,
} from "@/features/azeriteEssences/services/azeriteEssenceService";
import type {
  EssenceSummary,
  RoleType,
  Specialization,
} from "@/features/azeriteEssences/types";

export const ESSENCE_COLS: GridColumns = { xs: 1, sm: 2, md: 3, xl: 4 };
const GRID_GAP_PX = 16;

export type EssenceGridProps = {
  /** Accessible name of the list ("Tank essences"). */
  label: string;
  essences: readonly EssenceSummary[];
  specs: ReadonlyMap<number, Specialization>;
  roleNames: Record<RoleType, string>;
  /** The spec records are still loading: cards hold a place for their roles. */
  rolesPending?: boolean;
  onSelect: (essence: EssenceSummary) => void;
};

/**
 * Essence cards as a list, so screen readers announce how many there are.
 * Keyed by essence id, so a card keeps its instance (and its in-flight
 * record) when a search re-ranks it.
 */
const EssenceGrid = ({
  label,
  essences,
  specs,
  roleNames,
  rolesPending = false,
  onSelect,
}: EssenceGridProps): JSX.Element => (
  <Box
    component="ul"
    // Safari drops the list role from a list-style:none list without it.
    role="list"
    aria-label={label}
    sx={{
      display: "grid",
      gap: `${GRID_GAP_PX}px`,
      listStyle: "none",
      margin: 0,
      padding: 0,
      ...gridTemplateColumnsSx(ESSENCE_COLS),
    }}
  >
    {essences.map((essence) => (
      <Box component="li" key={essence.id} sx={{ minWidth: 0 }}>
        <EssenceCard
          essence={essence}
          roles={rolesOf(essence, specs)}
          roleNames={roleNames}
          classCount={classCountOf(essence, specs)}
          rolesPending={rolesPending}
          onSelect={onSelect}
        />
      </Box>
    ))}
  </Box>
);

/** Skeleton cells the size of the cards, in the grid's own columns. */
export const EssenceGridSkeleton = ({
  count,
  label,
}: {
  count: number;
  label: string;
}): JSX.Element => (
  <LoadingSkeleton
    variant="grid"
    columns={ESSENCE_COLS}
    itemHeight={ESSENCE_CARD_HEIGHT}
    count={count}
    gap={GRID_GAP_PX}
    label={label}
  />
);

export default EssenceGrid;
