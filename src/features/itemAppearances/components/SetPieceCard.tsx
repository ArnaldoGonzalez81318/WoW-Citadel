import { Box, Card, CardActionArea, Skeleton, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";

import AppearanceIcon from "@/features/itemAppearances/components/AppearanceIcon";
import { appearanceQuery } from "@/features/itemAppearances/hooks/appearanceQueries";
import { pluralize } from "@/features/itemAppearances/services/appearanceService";
import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/professions/components/cardStyles";
import useNearViewport from "@/hooks/useNearViewport";
import { mixins } from "@/theme";

/** Every piece card is this tall, so the loading list matches it. */
export const PIECE_CARD_HEIGHT = 104;

export type SetPieceCardProps = {
  appearanceId: number;
  /** 1-based, for the name of a piece whose record is missing. */
  position: number;
  onOpen: (appearanceId: number) => void;
};

const captionSx = {
  ...mixins.truncate,
  display: "block",
  m: 0,
  lineHeight: 1.6,
} as const;

/**
 * One piece of a set: its slot, the first item that wears the look (with
 * that item's icon), its armor or weapon type and how many other items
 * share it. Opens the piece's appearance over the set.
 */
const SetPieceCard = ({ appearanceId, position, onOpen }: SetPieceCardProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  // In a dialog: its lookups go ahead of the grid's (see appearanceQueries).
  const query = useQuery({ ...appearanceQuery(appearanceId, "dialog"), enabled: near });
  const appearance = query.data;
  const loading = query.isPending;
  const baseId = useId();
  const slotId = `${baseId}-slot`;
  const typeId = `${baseId}-type`;

  const [firstItem] = appearance?.items ?? [];
  const name = firstItem?.name ?? `Piece ${position}`;
  let slotLine: string;
  let typeLine: string;
  if (appearance === undefined) {
    slotLine = loading ? "" : "Details unavailable";
    typeLine = `Appearance ${appearanceId}`;
  } else if (appearance === null) {
    slotLine = "Not in Blizzard's data";
    typeLine = `Appearance ${appearanceId}`;
  } else {
    slotLine = appearance.slot?.name || "Slot unknown";
    const others = appearance.items.length - 1;
    typeLine = [
      appearance.itemSubclass?.name,
      others > 0 ? `+${pluralize(others, "more item", "more items")}` : undefined,
    ]
      .filter(Boolean)
      .join(" · ") || `Appearance ${appearanceId}`;
  }

  return (
    <Card ref={nearRef} variant="outlined" sx={selectableCardSx()}>
      <CardActionArea
        onClick={() => onOpen(appearanceId)}
        aria-label={`View ${name} appearance details`}
        aria-describedby={loading ? undefined : `${slotId} ${typeId}`}
        sx={{
          ...cardActionAreaSx,
          alignItems: "center",
          gap: 1.5,
          minHeight: PIECE_CARD_HEIGHT,
          px: 1.5,
          py: 1.25,
        }}
      >
        <AppearanceIcon
          appearance={appearance}
          loading={loading}
          fallbackLabel={name}
          priority="dialog"
        />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            id={slotId}
            variant="overline"
            component="span"
            color="text.secondary"
            sx={{ ...captionSx, lineHeight: 1.8 }}
          >
            {loading ? <Skeleton variant="text" width="35%" /> : slotLine}
          </Typography>
          {loading ? (
            <Typography variant="body2" component="span" sx={{ display: "block" }}>
              <Skeleton variant="text" width="80%" />
            </Typography>
          ) : (
            <Typography
              variant="body2"
              component="span"
              sx={{ ...mixins.lineClamp(2), fontWeight: 600, overflowWrap: "anywhere" }}
            >
              {name}
            </Typography>
          )}
          <Typography
            id={typeId}
            variant="caption"
            color="text.secondary"
            component="span"
            sx={captionSx}
          >
            {loading ? <Skeleton variant="text" width="50%" /> : typeLine}
          </Typography>
        </Box>
      </CardActionArea>
    </Card>
  );
};

export default SetPieceCard;
