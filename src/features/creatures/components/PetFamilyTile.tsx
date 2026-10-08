import { Card, CardActionArea, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import MediaTile from "@/components/common/MediaTile";
import { creatureFamilyIconQuery } from "@/features/creatures/hooks/creatureQueries";
import type { CreatureFamily } from "@/features/creatures/types";
import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/professions/components/cardStyles";
import useNearViewport from "@/hooks/useNearViewport";
import { mixins } from "@/theme";

/**
 * Every tile is this tall (two lines of name), so the loading grid can match
 * it: stacked on phones, where two columns leave ~115px a tile, and a single
 * row from `sm` up.
 */
export const FAMILY_TILE_HEIGHT = { xs: 112, sm: 64 } as const;

export type PetFamilyTileProps = {
  family: CreatureFamily;
  selected: boolean;
  onSelect: (familyId: number) => void;
};

/**
 * One creature family: its icon and name. A toggle button (aria-pressed) in
 * a set of them: the pressed tile is the family the creature results are
 * filtered to. The icon loads once the tile nears the viewport, and not at
 * all for a family Blizzard has no icon for.
 */
const PetFamilyTile = ({ family, selected, onSelect }: PetFamilyTileProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const iconQuery = useQuery({
    ...creatureFamilyIconQuery(family.id),
    enabled: near && family.hasIcon,
  });

  return (
    <Card ref={nearRef} variant="outlined" sx={selectableCardSx(selected)}>
      {/* The name is the button's own text, so it needs no aria-label. */}
      <CardActionArea
        onClick={() => onSelect(family.id)}
        aria-pressed={selected}
        sx={{
          ...cardActionAreaSx,
          flexDirection: { xs: "column", sm: "row" },
          alignItems: "center",
          textAlign: { xs: "center", sm: "left" },
          gap: { xs: 0.75, sm: 1.25 },
          minHeight: FAMILY_TILE_HEIGHT,
          px: 1.25,
          py: 1,
        }}
      >
        <MediaTile
          size={40}
          src={iconQuery.data ?? null}
          alt=""
          fallbackLabel={family.name}
          loading={family.hasIcon && iconQuery.isPending}
        />
        {/* A long name ("Water Strider") wraps and hyphenates rather than
            losing its end to an ellipsis. */}
        <Typography
          variant="body2"
          component="span"
          sx={{
            ...mixins.lineClamp(2),
            minWidth: 0,
            maxWidth: "100%",
            hyphens: "auto",
            fontSize: { xs: "0.8125rem", sm: "0.875rem" },
            fontWeight: selected ? 700 : 500,
            color: selected ? "primary.light" : "text.primary",
          }}
        >
          {family.name}
        </Typography>
      </CardActionArea>
    </Card>
  );
};

export default PetFamilyTile;
