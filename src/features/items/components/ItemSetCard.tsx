import { Box, Card, CardActionArea, Skeleton, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";

import MediaTile from "@/components/common/MediaTile";
import { itemIconQuery, itemSetQuery } from "@/features/items/hooks/itemQueries";
import { pluralize } from "@/features/items/services/itemService";
import type { ItemSetSummary, NamedRef } from "@/features/items/types";
import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/professions/components/cardStyles";
import useNearViewport from "@/hooks/useNearViewport";
import { formatNumber } from "@/lib/format";
import { mixins, visuallyHidden } from "@/theme";

/** Icons per card: a tier set's five pieces mostly fit; older sets show "+3". */
const PIECE_ICONS = 4;
/** Padding, two reserved lines of name, the icon row and the caption. */
export const SET_CARD_HEIGHT = 146;

const PieceIcon = ({ piece }: { piece: NamedRef }): JSX.Element => {
  const iconQuery = useQuery(itemIconQuery(piece.id));
  return (
    <MediaTile
      size={40}
      src={iconQuery.data ?? null}
      alt=""
      fallbackLabel={piece.name}
      loading={iconQuery.isPending}
    />
  );
};

export type ItemSetCardProps = {
  set: ItemSetSummary;
  onSelect: (set: ItemSetSummary) => void;
};

/**
 * One item set: its name, the icons of its first pieces and how many pieces
 * and bonuses it has. The set's record (and then its icons) loads once the
 * card nears the viewport; the whole card opens the set in the dialog.
 */
const ItemSetCard = ({ set, onSelect }: ItemSetCardProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const query = useQuery({ ...itemSetQuery(set.id), enabled: near });
  const record = query.data ?? undefined;
  const captionId = useId();
  const pieces = record?.pieces ?? [];
  const shown = pieces.slice(0, PIECE_ICONS);
  const extra = pieces.length - shown.length;

  let caption: JSX.Element | string;
  if (record) {
    caption = `${pluralize(pieces.length, "piece", "pieces")} · ${pluralize(
      record.bonuses.length,
      "bonus",
      "bonuses",
    )}`;
  } else if (query.data === null) {
    caption = "No details listed";
  } else if (query.isError) {
    caption = "Details unavailable";
  } else {
    caption = <Skeleton variant="text" width="55%" sx={{ fontSize: "0.75rem" }} />;
  }

  return (
    <Card ref={nearRef} variant="outlined" sx={[selectableCardSx(), { minHeight: SET_CARD_HEIGHT }]}>
      <CardActionArea
        onClick={() => onSelect(set)}
        aria-label={`View ${set.name} set`}
        aria-describedby={captionId}
        sx={{ ...cardActionAreaSx, flexDirection: "column", alignItems: "stretch", gap: 1, p: 1.5 }}
      >
        <Typography
          variant="subtitle2"
          component="span"
          title={set.name}
          sx={{ ...mixins.lineClamp(2), minHeight: "2.6em", lineHeight: 1.3, fontWeight: 600 }}
        >
          {set.name}
        </Typography>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minHeight: 40 }}>
          {record
            ? shown.map((piece) => <PieceIcon key={piece.id} piece={piece} />)
            : query.isPending
              ? Array.from({ length: PIECE_ICONS }, (_, index) => (
                  <Skeleton key={index} variant="rounded" width={40} height={40} />
                ))
              : null}
          {extra > 0 ? (
            <Typography
              variant="caption"
              color="text.secondary"
              component="span"
              aria-hidden="true"
              sx={{ pl: 0.5, fontVariantNumeric: "tabular-nums" }}
            >
              {`+${formatNumber(extra)}`}
            </Typography>
          ) : null}
        </Stack>
        <Typography id={captionId} variant="caption" color="text.secondary" component="span">
          {caption}
          <Box component="span" sx={visuallyHidden}>
            {`, item set ${set.id}`}
          </Box>
        </Typography>
      </CardActionArea>
    </Card>
  );
};

export default ItemSetCard;
