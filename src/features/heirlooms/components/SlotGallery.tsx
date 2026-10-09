import { Box, Skeleton, Stack, Typography } from "@mui/material";
import { useId, useMemo } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import { HEIRLOOM_CARD_HEIGHT } from "@/features/heirlooms/components/HeirloomCard";
import HeirloomGrid, {
  GRID_GAP_PX,
  HEIRLOOM_COLS,
} from "@/features/heirlooms/components/HeirloomGrid";
import type { HeirloomGridEntry } from "@/features/heirlooms/components/HeirloomGrid";
import { scrollMarginSx } from "@/features/heirlooms/components/heirloomStyles";
import type { SlotGroup } from "@/features/heirlooms/services/heirloomCatalog";
import { pluralize } from "@/features/heirlooms/services/heirloomService";
import type { HeirloomRef } from "@/features/heirlooms/types";
import { formatNumber } from "@/lib/format";

export type SlotGalleryProps = {
  groups: readonly SlotGroup[];
  ceiling: number;
  onSelect: (entry: HeirloomRef) => void;
};

/** "Cloth 2, Leather 4, Mail 4, Plate 4": the slot's types, in card order. */
const typeBreakdown = (group: SlotGroup): string => {
  const counts = new Map<string, number>();
  group.heirlooms.forEach((heirloom) => {
    if (heirloom.typeName) {
      counts.set(heirloom.typeName, (counts.get(heirloom.typeName) ?? 0) + 1);
    }
  });
  // One type for the whole slot (Bow, Shield) says nothing the cards don't.
  return counts.size > 1
    ? [...counts.entries()].map(([name, count]) => `${name} ${formatNumber(count)}`).join(", ")
    : "";
};

const SlotSection = ({
  group,
  ceiling,
  onSelect,
}: {
  group: SlotGroup;
  ceiling: number;
  onSelect: (entry: HeirloomRef) => void;
}): JSX.Element => {
  const headingId = useId();
  const items = useMemo<HeirloomGridEntry[]>(
    () =>
      group.heirlooms.map((heirloom) => ({
        entry: { id: heirloom.id, name: heirloom.name },
        heirloom,
      })),
    [group.heirlooms],
  );
  const breakdown = typeBreakdown(group);
  return (
    <Box component="section" aria-labelledby={headingId} sx={scrollMarginSx}>
      <Stack
        direction="row"
        flexWrap="wrap"
        useFlexGap
        columnGap={1.5}
        rowGap={0.25}
        alignItems="baseline"
        sx={(theme) => ({
          mb: 1.5,
          pb: 1,
          minWidth: 0,
          borderBottom: `1px solid ${theme.palette.border.subtle}`,
        })}
      >
        <Typography id={headingId} variant="h6" component="h3" sx={{ m: 0 }}>
          {group.label}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="span">
          {pluralize(group.heirlooms.length, "heirloom", "heirlooms")}
          {breakdown ? ` · ${breakdown}` : ""}
        </Typography>
      </Stack>
      <HeirloomGrid
        label={`${group.label} heirlooms`}
        items={items}
        ceiling={ceiling}
        onSelect={onSelect}
      />
    </Box>
  );
};

/**
 * The collection by slot (armor head to legs, back and jewellery, then
 * weapons and off hands), each slot an h3 with its count and type mix over
 * a grid of cards. It is one long atlas rather than pages: every record is
 * in hand by now, and only the icons load, as each card nears the viewport.
 */
const SlotGallery = ({ groups, ceiling, onSelect }: SlotGalleryProps): JSX.Element => (
  <Stack spacing={4}>
    {groups.map((group) => (
      <SlotSection key={group.key} group={group} ceiling={ceiling} onSelect={onSelect} />
    ))}
  </Stack>
);

const SKELETON_SECTIONS = [8, 4] as const;

/**
 * Two slot sections' worth, shaped like the gallery: a heading line over a
 * grid of card-height cells. One status region for the whole of it.
 */
export const SlotGallerySkeleton = ({ label }: { label: string }): JSX.Element => (
  <Stack role="status" aria-label={label} aria-busy="true" spacing={4}>
    {SKELETON_SECTIONS.map((count, index) => (
      <Box key={index}>
        <Skeleton variant="text" width={180} sx={{ fontSize: "1.25rem", mb: 1.5 }} />
        <Box
          sx={{ display: "grid", gap: `${GRID_GAP_PX}px`, ...gridTemplateColumnsSx(HEIRLOOM_COLS) }}
        >
          {Array.from({ length: count }, (_, cell) => (
            <Skeleton
              key={cell}
              variant="rectangular"
              sx={(theme) => ({
                height: HEIRLOOM_CARD_HEIGHT,
                borderRadius: `${theme.wc.radius.lg}px`,
              })}
            />
          ))}
        </Box>
      </Box>
    ))}
  </Stack>
);

export default SlotGallery;
