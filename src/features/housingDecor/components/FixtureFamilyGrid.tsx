import { Box, Card, CardActionArea, Stack, Typography } from "@mui/material";
import { memo, useId } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import FixtureKindTile from "@/features/housingDecor/components/FixtureKindTile";
import SectionedGridSkeleton from "@/features/housingDecor/components/SectionedGridSkeleton";
import {
  FIXTURE_KIND_SINGULAR,
  familyCountLabel,
} from "@/features/housingDecor/services/housingCatalog";
import type { FixtureFamily } from "@/features/housingDecor/types";
import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/professions/components/cardStyles";
import { mixins } from "@/theme";

export const FAMILY_COLS: GridColumns = { xs: 1, sm: 2, md: 3, lg: 4 };
const GRID_GAP_PX = 12;
/**
 * 12px padding around a name line, the caption and two lines of variants:
 * most cards' height, so a row lines up and the loading grid matches it.
 */
export const FAMILY_CARD_HEIGHT = 112;

/** What a card says under the count: its variants, or that its hooks are inside. */
const detailLine = (family: FixtureFamily): string | null => {
  if (family.hasVariants) {
    return family.members
      .map((member) => member.variant)
      .filter((variant): variant is string => variant !== null)
      .join(" · ");
  }
  // Bases and roofs are where Blizzard's records put hook points (not on
  // every one: a Plated Roof can have none).
  if ((family.kind === "base" || family.kind === "roof") && family.members.length > 1) {
    return "Open to compare their hook points";
  }
  return null;
};

const FixtureFamilyCard = memo(
  ({
    family,
    onSelect,
  }: {
    family: FixtureFamily;
    onSelect: (family: FixtureFamily) => void;
  }): JSX.Element => {
    const detailsId = useId();
    const detail = detailLine(family);
    return (
      <Card variant="outlined" sx={selectableCardSx()}>
        <CardActionArea
          onClick={() => onSelect(family)}
          aria-label={`View ${family.name}`}
          aria-describedby={detail ? `${detailsId}-count ${detailsId}-detail` : `${detailsId}-count`}
          sx={{ ...cardActionAreaSx, gap: 1.5, p: 1.5, minHeight: FAMILY_CARD_HEIGHT }}
        >
          <FixtureKindTile kind={family.kind} />
          <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="subtitle2"
              component="span"
              sx={{ ...mixins.lineClamp(2), overflowWrap: "anywhere" }}
            >
              {family.name}
            </Typography>
            <Typography
              id={`${detailsId}-count`}
              variant="caption"
              color="text.secondary"
              component="span"
            >
              {`${FIXTURE_KIND_SINGULAR[family.kind]} · ${familyCountLabel(family)}`}
            </Typography>
            {detail ? (
              <Typography
                id={`${detailsId}-detail`}
                variant="caption"
                color="text.secondary"
                component="span"
                sx={{ ...mixins.lineClamp(2), opacity: 0.85 }}
              >
                {detail}
              </Typography>
            ) : null}
          </Stack>
        </CardActionArea>
      </Card>
    );
  },
);
FixtureFamilyCard.displayName = "FixtureFamilyCard";

export type FixtureFamilyGridProps = {
  families: readonly FixtureFamily[];
  /** Accessible name of the list. */
  label: string;
  onSelect: (family: FixtureFamily) => void;
};

/** Fixture families as a list of cards, so screen readers announce how many there are. */
const FixtureFamilyGrid = ({ families, label, onSelect }: FixtureFamilyGridProps): JSX.Element => (
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
      ...gridTemplateColumnsSx(FAMILY_COLS),
    }}
  >
    {families.map((family) => (
      <Box component="li" key={family.key} sx={{ minWidth: 0 }}>
        <FixtureFamilyCard family={family} onSelect={onSelect} />
      </Box>
    ))}
  </Box>
);

/** Kind sections loading: headed sections of cards, the shape of what replaces them. */
export const FixtureKindsSkeleton = ({
  sections,
  label = "Loading fixtures",
}: {
  /** Cards in each kind section. */
  sections: readonly number[];
  label?: string;
}): JSX.Element => (
  <SectionedGridSkeleton
    sections={sections}
    columns={FAMILY_COLS}
    itemHeight={FAMILY_CARD_HEIGHT + 2}
    gap={GRID_GAP_PX}
    label={label}
  />
);

export default FixtureFamilyGrid;
