import { Box } from "@mui/material";

import { GRID_PRESETS, gridTemplateColumnsSx } from "@/components/common/gridColumns";
import HeirloomCard from "@/features/heirlooms/components/HeirloomCard";
import type { Heirloom, HeirloomRef } from "@/features/heirlooms/types";

/** One card across on phones, five on the widest screens (the shared "tiles" preset). */
export const HEIRLOOM_COLS = GRID_PRESETS.tiles;
export const GRID_GAP_PX = 12;

export type HeirloomGridEntry = {
  entry: HeirloomRef;
  heirloom: Heirloom | null | undefined;
  failed?: boolean;
};

export type HeirloomGridProps = {
  /** Accessible name of the list ("Shoulder heirlooms"). */
  label: string;
  items: readonly HeirloomGridEntry[];
  ceiling: number;
  onSelect: (entry: HeirloomRef) => void;
};

/** Heirloom cards as a list, so screen readers announce how many there are. */
const HeirloomGrid = ({ label, items, ceiling, onSelect }: HeirloomGridProps): JSX.Element => (
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
      ...gridTemplateColumnsSx(HEIRLOOM_COLS),
    }}
  >
    {items.map((item) => (
      // Keyed by heirloom id, so a card keeps its instance (and its icon
      // request) when a filter or a re-ranked search moves it.
      <Box component="li" key={item.entry.id} sx={{ minWidth: 0 }}>
        <HeirloomCard
          entry={item.entry}
          heirloom={item.heirloom}
          failed={item.failed}
          ceiling={ceiling}
          onSelect={onSelect}
        />
      </Box>
    ))}
  </Box>
);

export default HeirloomGrid;
