import CottageRoundedIcon from "@mui/icons-material/CottageRounded";
import { Box, Card, CardActionArea, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useId } from "react";

import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/neighborhoods/components/cardStyles";
import { mapAccent } from "@/features/neighborhoods/config/neighborhoodMaps";
import type { Neighborhood } from "@/features/neighborhoods/types";
import { formatNumber } from "@/lib/format";
import { mixins } from "@/theme";

/** Every card is this tall (number line plus two lines of name), so the loading grid matches it. */
export const NEIGHBORHOOD_CARD_HEIGHT = 84;

export type NeighborhoodCardProps = {
  neighborhood: Neighborhood;
  onOpen: (neighborhood: Neighborhood) => void;
};

/**
 * One neighborhood on the register: a plot badge in its map's colour, its
 * number and its name (a numeric-code name in the monospace face, so it
 * reads as the code it is). Opens the neighborhood dialog.
 */
const NeighborhoodCard = ({ neighborhood, onOpen }: NeighborhoodCardProps): JSX.Element => {
  const metaId = useId();

  return (
    <Card variant="outlined" sx={selectableCardSx()}>
      <CardActionArea
        onClick={() => onOpen(neighborhood)}
        aria-label={`View ${neighborhood.name} details`}
        // The button's aria-label replaces its content, so the visible number
        // is its description: the only way to tell two "Stormholde"s apart by ear.
        aria-describedby={metaId}
        sx={{
          ...cardActionAreaSx,
          alignItems: "center",
          gap: 1.5,
          minHeight: NEIGHBORHOOD_CARD_HEIGHT,
          px: 1.5,
          py: 1.25,
        }}
      >
        <Box
          aria-hidden="true"
          sx={(theme) => {
            const accent = mapAccent(theme, neighborhood.mapId);
            return {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              width: 40,
              height: 40,
              borderRadius: `${theme.wc.radius.sm}px`,
              color: accent,
              backgroundColor: alpha(accent, 0.14),
              border: `1px solid ${alpha(accent, 0.4)}`,
              "& svg": { fontSize: 22 },
            };
          }}
        >
          <CottageRoundedIcon />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            id={metaId}
            variant="caption"
            color="text.secondary"
            component="span"
            sx={{ display: "block", fontVariantNumeric: "tabular-nums" }}
          >
            {`No. ${formatNumber(neighborhood.id)}${neighborhood.nameIsCode ? " · name code" : ""}`}
          </Typography>
          <Typography
            variant="subtitle2"
            component="span"
            sx={(theme) => ({
              ...mixins.lineClamp(2),
              fontFamily: neighborhood.nameIsCode ? theme.wc.fontMono : undefined,
            })}
          >
            {neighborhood.name}
          </Typography>
        </Box>
      </CardActionArea>
    </Card>
  );
};

export default NeighborhoodCard;
