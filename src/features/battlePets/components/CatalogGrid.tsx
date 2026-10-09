import { Box, Skeleton } from "@mui/material";
import type { ReactNode } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import { LoadingSkeleton } from "@/components/common/StateBlocks";
import { ABILITY_CARD_HEIGHT } from "@/features/battlePets/components/AbilityCard";
import { PET_CARD_SHAPE } from "@/features/battlePets/components/PetCard";
import { CATALOG_PAGE_SIZE } from "@/features/battlePets/services/battlePetService";
import type { CatalogKind, IndexEntry } from "@/features/battlePets/types";

/** Two pet cards across even at 320px; 24 to a page ends on a full row at 2, 3, 4 and 6. */
const PET_COLS: GridColumns = { xs: 2, sm: 3, md: 4, lg: 6 };
/** Ability cards are wide rows: 1, 2, 3 and 4 across all divide 24. */
const ABILITY_COLS: GridColumns = { xs: 1, sm: 2, md: 3, lg: 4 };
const GRID_GAP_PX = 12;

/*
 * A loading cell's shape: a pet card's height follows its width (a 4:3
 * render over the text block), so its cell takes it from a percentage
 * padding; an ability card is a fixed-height row.
 */
const CELL_SHAPE = {
  pet: {
    height: "auto",
    "&::before": { content: '""', display: "block", paddingTop: PET_CARD_SHAPE },
  },
  ability: { height: ABILITY_CARD_HEIGHT },
} satisfies Record<CatalogKind, object>;

const COLUMNS: Readonly<Record<CatalogKind, GridColumns>> = {
  pet: PET_COLS,
  ability: ABILITY_COLS,
};

export const CatalogGridSkeleton = ({
  kind,
  count = CATALOG_PAGE_SIZE,
  label,
}: {
  kind: CatalogKind;
  count?: number;
  label: string;
}): JSX.Element => (
  <LoadingSkeleton
    variant="grid"
    columns={COLUMNS[kind]}
    count={count}
    gap={GRID_GAP_PX}
    label={label}
    sx={{ "& > .MuiSkeleton-root": CELL_SHAPE[kind] }}
  />
);

export type CatalogGridProps = {
  kind: CatalogKind;
  entries: readonly IndexEntry[];
  /** Cells still being looked for (a family scan): shown as placeholders after the cards. */
  pending: number;
  /** Accessible name of the list. */
  label: string;
  renderCard: (entry: IndexEntry) => ReactNode;
};

/**
 * One page of cards as a list. While a family scan is still finding this
 * page's matches, the cells it has not found yet stay as placeholders, so
 * the grid fills in place instead of growing under the visitor.
 */
const CatalogGrid = ({ kind, entries, pending, label, renderCard }: CatalogGridProps): JSX.Element => (
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
      ...gridTemplateColumnsSx(COLUMNS[kind]),
    }}
  >
    {entries.map((entry) => (
      <Box component="li" key={entry.id} sx={{ minWidth: 0 }}>
        {renderCard(entry)}
      </Box>
    ))}
    {Array.from({ length: pending }, (_, index) => (
      // Decorative: the page's progress line says what is still loading.
      <Box component="li" key={`pending-${index}`} aria-hidden="true" sx={{ minWidth: 0 }}>
        <Skeleton
          variant="rectangular"
          sx={[
            (theme) => ({ width: "100%", borderRadius: `${theme.wc.radius.lg}px` }),
            CELL_SHAPE[kind],
          ]}
        />
      </Box>
    ))}
  </Box>
);

export default CatalogGrid;
