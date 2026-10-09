import { Box, Button, ButtonBase, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { useId, useMemo } from "react";
import { Link as RouterLink } from "react-router-dom";

import DetailDialog from "@/components/common/DetailDialog";
import { EmptyState } from "@/components/common/StateBlocks";
import { idTextSx } from "@/features/housingDecor/components/housingStyles";
import { roomCaption } from "@/features/housingDecor/components/RoomGrid";
import RoomPlan from "@/features/housingDecor/components/RoomPlan";
import { roomsQuery } from "@/features/housingDecor/hooks/housingQueries";
import useHeldFailure from "@/features/housingDecor/hooks/useHeldFailure";
import {
  ROOM_SHAPE_LABEL,
  roomQualifier,
  siblingRooms,
} from "@/features/housingDecor/services/housingCatalog";
import type { Room } from "@/features/housingDecor/types";
import { focusRing } from "@/theme";

export type RoomDialogProps = {
  /** Whether the dialog is showing; `roomId` stays set through the close transition. */
  open: boolean;
  /** The room to show (the last one opened). */
  roomId: number | null;
  /** A sibling was picked (the page replaces its URL entry). */
  onSelect: (roomId: number) => void;
  onClose: () => void;
};

/** The raw room record, in the API workbench (catalog slug and endpoint id). */
const workbenchUrl = (roomId: number): string =>
  `/api-explorer/housing-decor?${new URLSearchParams({
    endpoint: "room",
    roomId: String(roomId),
  }).toString()}`;

/** A sibling room as a toggle: its little plan and what tells it apart. */
const SiblingButton = ({
  room,
  selected,
  onSelect,
}: {
  room: Room;
  selected: boolean;
  onSelect: (roomId: number) => void;
}): JSX.Element => (
  <ButtonBase
    onClick={() => onSelect(room.id)}
    aria-pressed={selected}
    aria-label={room.name}
    sx={(theme) => ({
      width: 96,
      flexDirection: "column",
      gap: 0.5,
      p: 1,
      borderRadius: `${theme.wc.radius.md}px`,
      border: `1px solid ${selected ? theme.palette.primary.main : theme.palette.border.subtle}`,
      boxShadow: selected ? `inset 0 0 0 1px ${theme.palette.primary.main}` : "none",
      backgroundColor: selected ? alpha(theme.palette.primary.main, 0.08) : theme.palette.surface.inset,
      "@media (hover: hover)": {
        "&:hover": { borderColor: selected ? theme.palette.primary.light : theme.palette.border.strong },
      },
      "&.Mui-focusVisible": focusRing(theme),
    })}
  >
    <RoomPlan room={room} sx={{ width: 56, height: 56 }} />
    <Typography
      variant="caption"
      component="span"
      aria-hidden="true"
      sx={{ textAlign: "center", lineHeight: 1.3, overflowWrap: "anywhere" }}
    >
      {/* The circle rooms have no size word: their names tell them apart. */}
      {roomQualifier(room) ?? room.name}
    </Typography>
  </ButtonBase>
);

/**
 * A room: its floor plan large (the page's drawing of its name), its shape,
 * size and id, and, for a plain shape, its other sizes to step through.
 * Blizzard's room records hold only an id and a name, so there is nothing
 * else to load.
 */
const RoomDialog = ({ open, roomId, onSelect, onClose }: RoomDialogProps): JSX.Element => {
  const enabled = roomId !== null;
  const query = useQuery({ ...roomsQuery(), enabled });
  const failure = useHeldFailure(query);
  const rooms = query.data;
  const room = rooms?.find((entry) => entry.id === roomId);
  const notFound = enabled && rooms !== undefined && room === undefined;
  const siblings = useMemo(
    () => (rooms && room ? siblingRooms(rooms, room) : []),
    [rooms, room],
  );
  const siblingsHeadingId = useId();

  const rows = room
    ? [
        {
          label: "Shape",
          value: room.shape === "themed" ? "Unknown" : ROOM_SHAPE_LABEL[room.shape],
        },
        // The bracketed words are a size for most rooms, a hand for stairwells.
        ...(roomQualifier(room)
          ? [{ label: room.size ? "Size" : "Variant", value: roomQualifier(room) }]
          : []),
        {
          label: "Room ID",
          value: (
            <Box component="span" sx={idTextSx}>
              {room.id}
            </Box>
          ),
        },
      ]
    : [];

  const renderBody = (): JSX.Element | null => {
    if (notFound) {
      return (
        <EmptyState
          compact
          title="Room not found"
          description={`Blizzard's room search has no room #${roomId ?? ""}.`}
        />
      );
    }
    if (!room) {
      return null;
    }
    return (
      <Stack spacing={2.5}>
        <Box
          sx={{
            display: "grid",
            gap: 2.5,
            gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 5fr) minmax(0, 6fr)" },
            alignItems: "start",
          }}
        >
          <Box
            sx={(theme) => ({
              width: "100%",
              maxWidth: { xs: 280, sm: "none" },
              justifySelf: "center",
              aspectRatio: "1 / 1",
              p: 1.5,
              borderRadius: `${theme.wc.radius.md}px`,
              border: `1px solid ${theme.palette.border.subtle}`,
              backgroundColor: theme.palette.surface.sunken,
            })}
          >
            <RoomPlan room={room} />
          </Box>
          <Stack spacing={1.5}>
            <Box
              component="dl"
              sx={{
                display: "grid",
                gridTemplateColumns: "minmax(96px, max-content) minmax(0, 1fr)",
                columnGap: 2,
                rowGap: 1.25,
                m: 0,
              }}
            >
              {rows.map((row) => (
                <Box key={row.label} sx={{ display: "contents" }}>
                  <Typography
                    component="dt"
                    variant="caption"
                    sx={{ color: "text.secondary", fontWeight: 500, alignSelf: "center" }}
                  >
                    {row.label}
                  </Typography>
                  <Typography
                    component="dd"
                    variant="body2"
                    sx={{ m: 0, minWidth: 0, overflowWrap: "anywhere", alignSelf: "center" }}
                  >
                    {row.value}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
              {room.shape === "themed"
                ? "Blizzard's room record holds only the id and the name, and this name has none of the shape words this page draws, so the plan is a plain room with its initial."
                : "Blizzard's room record holds only the id and the name. The shape and size are read from the English name, and the plan is this page's drawing of it, sized relative to its siblings rather than to scale."}
            </Typography>
          </Stack>
        </Box>

        {siblings.length > 1 ? (
          <Box component="section" aria-labelledby={siblingsHeadingId}>
            <Typography id={siblingsHeadingId} variant="overline" component="h3" sx={{ m: 0, mb: 0.75 }}>
              {`Every ${ROOM_SHAPE_LABEL[room.shape].toLowerCase()} room`}
            </Typography>
            <Stack
              component="ul"
              role="list"
              aria-labelledby={siblingsHeadingId}
              direction="row"
              flexWrap="wrap"
              useFlexGap
              gap={1}
              sx={{ listStyle: "none", m: 0, p: 0 }}
            >
              {siblings.map((sibling) => (
                <Box component="li" key={sibling.id}>
                  <SiblingButton room={sibling} selected={sibling.id === room.id} onSelect={onSelect} />
                </Box>
              ))}
            </Stack>
          </Box>
        ) : null}
      </Stack>
    );
  };

  return (
    <DetailDialog
      open={open && enabled}
      onClose={onClose}
      title={room?.name ?? (roomId !== null ? `Room #${roomId}` : "")}
      subtitle={room ? roomCaption(room) : undefined}
      maxWidth="md"
      loading={enabled && query.isPending && !failure.failed}
      error={failure.failed ? failure.error : undefined}
      onRetry={failure.retry}
      errorContext="rooms"
      actions={
        roomId !== null ? (
          <Button component={RouterLink} to={workbenchUrl(roomId)} size="small">
            Open in API workbench
          </Button>
        ) : null
      }
    >
      {renderBody()}
    </DetailDialog>
  );
};

export default RoomDialog;
