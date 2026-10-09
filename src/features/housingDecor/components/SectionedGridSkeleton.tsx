import { Box, Skeleton, Stack } from "@mui/material";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";

export type SectionedGridSkeletonProps = {
  /** Cards in each section, in order. */
  sections: readonly number[];
  /** The same columns, card height and gap as the grids it stands in for. */
  columns: GridColumns;
  itemHeight: number;
  gap: number;
  /** Whether each section heading carries a line of description under it. */
  described?: boolean;
  /** Announced by the status region. */
  label: string;
};

/**
 * Headed sections of skeleton cards, for a list that loads as headed
 * sections (fixture kinds, room groups): the swap keeps its shape. One
 * status region for the lot, so a screen reader hears "loading" once.
 */
const SectionedGridSkeleton = ({
  sections,
  columns,
  itemHeight,
  gap,
  described = false,
  label,
}: SectionedGridSkeletonProps): JSX.Element => (
  <Stack spacing={3} role="status" aria-label={label} aria-busy="true" aria-live="polite">
    {sections.map((count, sectionIndex) => (
      <Box key={sectionIndex} aria-hidden="true">
        <Stack spacing={0.25} sx={{ mb: 1.25 }}>
          <Skeleton variant="text" width={180} sx={{ fontSize: "1rem" }} />
          {described ? <Skeleton variant="text" width="55%" sx={{ fontSize: "0.875rem" }} /> : null}
        </Stack>
        <Box sx={{ display: "grid", gap: `${gap}px`, ...gridTemplateColumnsSx(columns) }}>
          {Array.from({ length: count }, (_, index) => (
            <Skeleton
              key={index}
              variant="rectangular"
              sx={(theme) => ({
                width: "100%",
                height: itemHeight,
                borderRadius: `${theme.wc.radius.lg}px`,
              })}
            />
          ))}
        </Box>
      </Box>
    ))}
  </Stack>
);

export default SectionedGridSkeleton;
