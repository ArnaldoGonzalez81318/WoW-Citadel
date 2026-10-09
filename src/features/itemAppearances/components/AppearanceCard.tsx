import { Box, Card, CardActionArea, Skeleton, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";

import AppearanceIcon from "@/features/itemAppearances/components/AppearanceIcon";
import { CARD_HEIGHT } from "@/features/itemAppearances/components/appearanceLayout";
import { appearanceQuery } from "@/features/itemAppearances/hooks/appearanceQueries";
import { pluralize } from "@/features/itemAppearances/services/appearanceService";
import type { AppearanceHit } from "@/features/itemAppearances/types";
import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/professions/components/cardStyles";
import useNearViewport from "@/hooks/useNearViewport";
import { mixins } from "@/theme";

export type AppearanceCardProps = {
  hit: AppearanceHit;
  /** The slot's name when the hit carries none (a page from the slot's id list). */
  fallbackSlotName?: string;
  onSelect: (appearanceId: number) => void;
};

const captionSx = {
  ...mixins.truncate,
  display: "block",
  m: 0,
  lineHeight: 1.6,
} as const;

/**
 * One look, named after the first item that wears it (appearances have no
 * name of their own): that item's icon, the slot and armor or weapon type,
 * and how many items share the look. The record behind them loads as the
 * card nears the viewport (see appearanceQuery); the dialog reads the same
 * cache entry.
 */
const AppearanceCard = ({ hit, fallbackSlotName, onSelect }: AppearanceCardProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const query = useQuery({ ...appearanceQuery(hit.id), enabled: near });
  const appearance = query.data;
  const loading = query.isPending;
  const baseId = useId();
  const typeId = `${baseId}-type`;
  const itemsId = `${baseId}-items`;

  const [firstItem] = appearance?.items ?? [];
  const title = firstItem?.name ?? `Appearance ${hit.id}`;
  const slot = hit.slot?.name || appearance?.slot?.name || fallbackSlotName;

  let typeLine: JSX.Element | string;
  let itemsLine: JSX.Element | string;
  if (loading) {
    typeLine = <Skeleton variant="text" width="55%" />;
    itemsLine = <Skeleton variant="text" width="40%" />;
  } else if (appearance === undefined) {
    typeLine = slot ?? "Details unavailable";
    itemsLine = `Details unavailable · #${hit.id}`;
  } else if (appearance === null) {
    typeLine = slot ?? "Unknown slot";
    itemsLine = `Not in Blizzard's data · #${hit.id}`;
  } else {
    typeLine = [slot, appearance.itemSubclass?.name].filter(Boolean).join(" · ") || "Slot unknown";
    const others = appearance.items.length - 1;
    const shared = others > 0 ? `+${pluralize(others, "more item", "more items")}` : "1 item";
    itemsLine =
      appearance.items.length === 0 ? `No items listed · #${hit.id}` : `${shared} · #${hit.id}`;
  }

  return (
    <Card ref={nearRef} variant="outlined" sx={selectableCardSx()}>
      <CardActionArea
        onClick={() => onSelect(hit.id)}
        aria-label={
          firstItem
            ? `View ${firstItem.name} appearance details`
            : `View appearance ${hit.id} details`
        }
        aria-describedby={loading ? undefined : `${typeId} ${itemsId}`}
        sx={{
          ...cardActionAreaSx,
          alignItems: "center",
          gap: 1.5,
          minHeight: CARD_HEIGHT,
          px: 1.5,
          py: 1.25,
        }}
      >
        <AppearanceIcon appearance={appearance} loading={loading} fallbackLabel={title} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
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
              {title}
            </Typography>
          )}
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
            id={itemsId}
            variant="caption"
            color="text.secondary"
            component="span"
            sx={{ ...captionSx, fontVariantNumeric: "tabular-nums" }}
          >
            {itemsLine}
          </Typography>
        </Box>
      </CardActionArea>
    </Card>
  );
};

export default AppearanceCard;
