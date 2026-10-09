import { Box, ButtonBase, Chip, Skeleton, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import MediaTile from "@/components/common/MediaTile";
import { levelSlotLine } from "@/features/items/components/ItemCard";
import { itemIconQuery, itemRecordQuery } from "@/features/items/hooks/itemQueries";
import { itemTypeLine } from "@/features/items/services/itemService";
import type { NamedRef } from "@/features/items/types";
import useNearViewport from "@/hooks/useNearViewport";
import { focusRing, qualityColor } from "@/theme";

const rowSx = {
  display: "flex",
  alignItems: "center",
  gap: 1.5,
  width: "100%",
  minWidth: 0,
  minHeight: 56,
  px: 1.25,
  py: 0.75,
  textAlign: "left",
} as const;

const PieceRow = ({
  piece,
  current,
  onOpen,
}: {
  piece: NamedRef;
  current: boolean;
  onOpen: (piece: NamedRef) => void;
}): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLLIElement>();
  const recordQuery = useQuery({ ...itemRecordQuery(piece.id), enabled: near });
  const iconQuery = useQuery({ ...itemIconQuery(piece.id), enabled: near });
  const record = recordQuery.data ?? undefined;

  let details: ReactNode;
  if (record) {
    details = [levelSlotLine(record), itemTypeLine(record)].filter(Boolean).join(" · ") || null;
  } else if (recordQuery.data === null) {
    details = "No item record";
  } else if (recordQuery.isError) {
    details = "Details unavailable";
  } else {
    details = <Skeleton variant="text" width="60%" sx={{ fontSize: "0.75rem" }} />;
  }

  const content = (
    <>
      <MediaTile
        size={40}
        src={iconQuery.data ?? null}
        alt=""
        fallbackLabel={piece.name}
        quality={record?.quality}
        loading={iconQuery.isPending}
      />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="body2"
          component="span"
          sx={(theme) => ({
            display: "block",
            fontWeight: 600,
            overflowWrap: "anywhere",
            color: qualityColor(theme, record?.quality),
          })}
        >
          {record?.name ?? piece.name}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          component="span"
          sx={{ display: "block", overflowWrap: "anywhere" }}
        >
          {details}
        </Typography>
      </Box>
      {current ? <Chip size="small" label="This item" sx={{ flexShrink: 0 }} /> : null}
    </>
  );

  return (
    <Box
      component="li"
      ref={nearRef}
      sx={(theme) => ({
        minWidth: 0,
        borderRadius: `${theme.wc.radius.md}px`,
        border: `1px solid ${current ? theme.palette.primary.main : theme.palette.border.subtle}`,
        backgroundColor: theme.palette.surface.inset,
        overflow: "hidden",
      })}
    >
      {current ? (
        <Box aria-current="true" sx={rowSx}>
          {content}
        </Box>
      ) : (
        <ButtonBase
          onClick={() => onOpen(piece)}
          sx={(theme) => ({
            ...rowSx,
            justifyContent: "flex-start",
            "@media (hover: hover)": {
              "&:hover": { backgroundColor: theme.palette.action.hover },
            },
            "&.Mui-focusVisible": focusRing(theme, true),
          })}
        >
          {content}
        </ButtonBase>
      )}
    </Box>
  );
};

export type ItemPieceListProps = {
  pieces: readonly NamedRef[];
  /** The item the list is shown for, marked and not a link to itself. */
  currentItemId?: number;
  /** Accessible name of the list (the id of its visible heading). */
  labelledBy: string;
  onOpen: (piece: NamedRef) => void;
};

/**
 * A set's pieces, each with its icon, its name in its quality's colour and
 * its slot and item level (from its own record, loaded as the row nears
 * the viewport, six at a time). Each opens that item in the dialog.
 */
const ItemPieceList = ({
  pieces,
  currentItemId,
  labelledBy,
  onOpen,
}: ItemPieceListProps): JSX.Element => (
  <Box
    component="ul"
    role="list"
    aria-labelledby={labelledBy}
    sx={{
      listStyle: "none",
      m: 0,
      p: 0,
      display: "grid",
      gap: 1,
      gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
    }}
  >
    {pieces.map((piece) => (
      <PieceRow
        key={piece.id}
        piece={piece}
        current={piece.id === currentItemId}
        onOpen={onOpen}
      />
    ))}
  </Box>
);

export default ItemPieceList;
