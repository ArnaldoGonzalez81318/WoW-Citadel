import { Box } from "@mui/material";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import { LoadingSkeleton } from "@/components/common/StateBlocks";
import FactionCard, {
  FACTION_CARD_HEIGHT,
  FACTION_CARD_PATH_HEIGHT,
} from "@/features/reputations/components/FactionCard";
import type { AccentKey } from "@/features/reputations/services/reputationPalette";
import type { FactionRef } from "@/features/reputations/types";

export const FACTION_COLS: GridColumns = { xs: 1, sm: 2, md: 3, lg: 4 };
const GRID_GAP_PX = 16;

export type FactionGridEntry = {
  faction: FactionRef;
  accent: AccentKey;
  /** See FactionCard's `pathLabel`. */
  pathLabel?: string;
};

export type FactionGridProps = {
  /** Accessible name of the list ("Midnight factions"). */
  label: string;
  entries: readonly FactionGridEntry[];
  lazy?: boolean;
  onSelect: (faction: FactionRef) => void;
};

/**
 * Keys by faction id, so a card keeps its instance when a re-ranked search
 * moves it: a remount would drop the last observer of its in-flight record,
 * which aborts the request, and fetch it all over again. Blizzard can list a
 * faction twice; only the repeats get a suffix.
 */
const keysOf = (entries: readonly FactionGridEntry[]): string[] => {
  const seen = new Map<number, number>();
  return entries.map((entry) => {
    const id = entry.faction.id;
    const repeat = seen.get(id) ?? 0;
    seen.set(id, repeat + 1);
    return repeat === 0 ? String(id) : `${id}-${repeat}`;
  });
};

/** Faction cards as a list, so screen readers announce how many there are. */
const FactionGrid = ({
  label,
  entries,
  lazy = false,
  onSelect,
}: FactionGridProps): JSX.Element => {
  const keys = keysOf(entries);
  return (
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
        ...gridTemplateColumnsSx(FACTION_COLS),
      }}
    >
      {entries.map((entry, index) => (
        <Box component="li" key={keys[index]} sx={{ minWidth: 0 }}>
          <FactionCard
            faction={entry.faction}
            accent={entry.accent}
            pathLabel={entry.pathLabel}
            lazy={lazy}
            onSelect={onSelect}
          />
        </Box>
      ))}
    </Box>
  );
};

export type FactionGridSkeletonProps = {
  count: number;
  label: string;
  /** Cells for cards with a path line (search results). */
  withPath?: boolean;
};

/** Skeleton cells the size of the cards, in the grid's own columns. */
export const FactionGridSkeleton = ({
  count,
  label,
  withPath = false,
}: FactionGridSkeletonProps): JSX.Element => (
  <LoadingSkeleton
    variant="grid"
    columns={FACTION_COLS}
    itemHeight={FACTION_CARD_HEIGHT + (withPath ? FACTION_CARD_PATH_HEIGHT : 0)}
    count={count}
    gap={GRID_GAP_PX}
    label={label}
  />
);

export default FactionGrid;
