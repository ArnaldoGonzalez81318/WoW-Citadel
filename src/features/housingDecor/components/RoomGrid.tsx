import { Box, Card, CardActionArea, Stack, Typography } from "@mui/material";
import { memo, useId } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import { idTextSx } from "@/features/housingDecor/components/housingStyles";
import RoomPlan from "@/features/housingDecor/components/RoomPlan";
import SectionedGridSkeleton from "@/features/housingDecor/components/SectionedGridSkeleton";
import {
  ROOM_SHAPE_LABEL,
  roomQualifier,
} from "@/features/housingDecor/services/housingCatalog";
import type { Room } from "@/features/housingDecor/types";
import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/professions/components/cardStyles";
import { mixins } from "@/theme";

export const ROOM_COLS: GridColumns = { xs: 2, sm: 3, md: 4, lg: 6 };
const GRID_GAP_PX = 12;
const STAGE_HEIGHT = 112;
/** 12px padding, two 20px lines of name, a 4px gap and the 18px caption. */
const TEXT_HEIGHT = 86;

/** "Square · Small", "Themed room". */
export const roomCaption = (room: Room): string => {
  if (room.shape === "themed") {
    return "Themed room";
  }
  const qualifier = roomQualifier(room);
  return qualifier ? `${ROOM_SHAPE_LABEL[room.shape]} · ${qualifier}` : ROOM_SHAPE_LABEL[room.shape];
};

const RoomCard = memo(
  ({ room, onSelect }: { room: Room; onSelect: (room: Room) => void }): JSX.Element => {
    const detailsId = useId();
    return (
      <Card variant="outlined" sx={selectableCardSx()}>
        <CardActionArea
          onClick={() => onSelect(room)}
          aria-label={`View ${room.name}`}
          aria-describedby={detailsId}
          sx={{ ...cardActionAreaSx, flexDirection: "column" }}
        >
          <Box
            sx={(theme) => ({
              width: "100%",
              height: STAGE_HEIGHT,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              py: 1,
              backgroundColor: theme.palette.surface.sunken,
              borderBottom: `1px solid ${theme.palette.border.subtle}`,
            })}
          >
            <RoomPlan room={room} sx={{ width: STAGE_HEIGHT - 16, height: STAGE_HEIGHT - 16 }} />
          </Box>
          <Stack spacing={0.5} sx={{ p: 1.5, width: "100%", minWidth: 0, height: TEXT_HEIGHT }}>
            <Typography
              variant="subtitle2"
              component="span"
              sx={{ ...mixins.lineClamp(2), lineHeight: "20px", minHeight: 40, overflowWrap: "anywhere" }}
            >
              {room.name}
            </Typography>
            <Typography
              id={detailsId}
              variant="caption"
              color="text.secondary"
              component="span"
              sx={{ ...mixins.truncate, lineHeight: "18px", minWidth: 0 }}
            >
              {`${roomCaption(room)} · `}
              <Box component="span" sx={idTextSx}>
                {`#${room.id}`}
              </Box>
            </Typography>
          </Stack>
        </CardActionArea>
      </Card>
    );
  },
);
RoomCard.displayName = "RoomCard";

export type RoomGridProps = {
  rooms: readonly Room[];
  /** Accessible name of the list. */
  label: string;
  onSelect: (room: Room) => void;
};

const RoomGrid = ({ rooms, label, onSelect }: RoomGridProps): JSX.Element => (
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
      ...gridTemplateColumnsSx(ROOM_COLS),
    }}
  >
    {rooms.map((room) => (
      <Box component="li" key={room.id} sx={{ minWidth: 0 }}>
        <RoomCard room={room} onSelect={onSelect} />
      </Box>
    ))}
  </Box>
);

/** Room groups loading: headed sections of cards, the shape of what replaces them. */
export const RoomGroupsSkeleton = ({
  sections,
  label = "Loading rooms",
}: {
  /** Cards in each group. */
  sections: readonly number[];
  label?: string;
}): JSX.Element => (
  <SectionedGridSkeleton
    sections={sections}
    columns={ROOM_COLS}
    itemHeight={STAGE_HEIGHT + TEXT_HEIGHT + 2}
    gap={GRID_GAP_PX}
    described
    label={label}
  />
);

export default RoomGrid;
