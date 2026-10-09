import { Box, Card, CardActionArea, Skeleton, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";

import AppearanceIcon from "@/features/itemAppearances/components/AppearanceIcon";
import { CARD_HEIGHT } from "@/features/itemAppearances/components/appearanceLayout";
import {
  appearanceQuery,
  setQuery,
} from "@/features/itemAppearances/hooks/appearanceQueries";
import { pluralize } from "@/features/itemAppearances/services/appearanceService";
import type { SetGroup } from "@/features/itemAppearances/types";
import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/professions/components/cardStyles";
import useNearViewport from "@/hooks/useNearViewport";
import { mixins } from "@/theme";

export type SetCardProps = {
  group: SetGroup;
  onSelect: (group: SetGroup) => void;
};

const captionSx = {
  ...mixins.truncate,
  display: "block",
  m: 0,
  lineHeight: 1.6,
} as const;

/**
 * One set name, shown by its newest set (the one the grid sorts it by, and
 * the one it opens): the icon of that set's first piece, the name, the item
 * type Blizzard records for that piece with the piece count, and how many
 * sets share the name. As the card nears the viewport it loads the set, then
 * its first piece, then that piece's icon (see setQuery); a set opened from
 * the card reads the same cache entries.
 */
const SetCard = ({ group, onSelect }: SetCardProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const setId = group.newestId;
  const setResult = useQuery({ ...setQuery(setId), enabled: near });
  const set = setResult.data;
  const firstPieceId = set?.appearanceIds[0];
  // Ahead of the next cards' sets, so the top row finishes first.
  const pieceResult = useQuery({
    ...appearanceQuery(firstPieceId ?? 0, "followUp"),
    enabled: firstPieceId !== undefined,
  });
  const piece = firstPieceId !== undefined ? pieceResult.data : null;
  // The button's aria-label replaces its content, so the visible lines are
  // its description.
  const baseId = useId();
  const typeId = `${baseId}-type`;
  const idsId = `${baseId}-ids`;

  const setLoading = setResult.isPending;
  const pieceLoading = firstPieceId !== undefined && pieceResult.isPending;
  let typeLine: JSX.Element | string;
  if (setLoading) {
    typeLine = <Skeleton variant="text" width="60%" />;
  } else if (set === undefined) {
    typeLine = "Details unavailable";
  } else if (set === null) {
    typeLine = "Not in Blizzard's set data";
  } else {
    const pieces = pluralize(set.appearanceIds.length, "piece", "pieces");
    const type = piece?.itemSubclass?.name;
    typeLine = pieceLoading ? (
      <Skeleton variant="text" width="60%" />
    ) : (
      [type, pieces].filter(Boolean).join(" · ")
    );
  }
  const idsLine =
    group.ids.length > 1
      ? `${pluralize(group.ids.length, "version", "versions")} · set ${setId}`
      : `Set ${setId}`;

  return (
    <Card ref={nearRef} variant="outlined" sx={selectableCardSx()}>
      <CardActionArea
        onClick={() => onSelect(group)}
        aria-label={`View ${group.name} set details`}
        aria-describedby={setLoading || pieceLoading ? idsId : `${typeId} ${idsId}`}
        sx={{
          ...cardActionAreaSx,
          alignItems: "center",
          gap: 1.5,
          minHeight: CARD_HEIGHT,
          px: 1.5,
          py: 1.25,
        }}
      >
        <AppearanceIcon
          appearance={piece}
          loading={setLoading || pieceLoading}
          fallbackLabel={group.name}
        />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          {/* A heading may not sit inside the action area's <button>;
              its aria-label names the card instead. */}
          <Typography
            variant="body2"
            component="span"
            sx={{ ...mixins.lineClamp(2), fontWeight: 600, overflowWrap: "anywhere" }}
          >
            {group.name}
          </Typography>
          <Typography
            id={typeId}
            variant="caption"
            color="text.secondary"
            component="span"
            sx={captionSx}
          >
            {typeLine}
          </Typography>
          <Typography
            id={idsId}
            variant="caption"
            color="text.secondary"
            component="span"
            sx={{ ...captionSx, fontVariantNumeric: "tabular-nums" }}
          >
            {idsLine}
          </Typography>
        </Box>
      </CardActionArea>
    </Card>
  );
};

export default SetCard;
