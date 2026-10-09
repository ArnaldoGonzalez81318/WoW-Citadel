import { Box, Card, CardActionArea, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { memo, useId } from "react";

import MediaTile from "@/components/common/MediaTile";
import { itemIconQuery } from "@/features/items/hooks/itemQueries";
import { itemTypeLine } from "@/features/items/services/itemService";
import type { ItemSummary } from "@/features/items/types";
import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/professions/components/cardStyles";
import useNearViewport from "@/hooks/useNearViewport";
import { formatNumber } from "@/lib/format";
import { mixins, qualityColor, visuallyHidden } from "@/theme";

/**
 * 12px padding, two reserved lines of name, two of details and the gap
 * between them, plus the borders. The loading grid uses it to match.
 */
export const ITEM_CARD_HEIGHT = 110;

/** Blizzard's slot for anything that is not worn; a card says nothing then. */
const NON_EQUIP = "NON_EQUIP";

/** "Item level 219 · Head"; an item level of 1 (cosmetics, housing) says nothing. */
export const levelSlotLine = (item: Pick<ItemSummary, "level" | "slot">): string =>
  [
    item.level !== undefined && item.level > 1 ? `Item level ${formatNumber(item.level)}` : undefined,
    item.slot && item.slot.type !== NON_EQUIP ? item.slot.name : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

/** A wash of the item's quality colour from the icon side, like a loot frame. */
const qualityWashSx = (quality: string | undefined) => (theme: Theme) =>
  quality
    ? {
        backgroundImage: `linear-gradient(100deg, ${alpha(qualityColor(theme, quality), 0.14)} 0%, ${alpha(
          qualityColor(theme, quality),
          0.03,
        )} 45%, transparent 75%)`,
      }
    : {};

export type ItemCardProps = {
  item: ItemSummary;
  onSelect: (item: ItemSummary) => void;
};

/**
 * One item: its icon in a quality-tinted frame, its name in its quality's
 * colour, then item level, slot and type. The icon loads once the card
 * nears the viewport; the whole card opens the tooltip dialog. Memoised:
 * search pages are structurally shared, so a page change only re-renders
 * the cards that changed.
 */
const ItemCard = memo(({ item, onSelect }: ItemCardProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const iconQuery = useQuery({ ...itemIconQuery(item.id), enabled: near });
  // The button's aria-label replaces its content, so the visible details are
  // its description (and the only way to tell namesakes apart by ear).
  const detailsId = useId();
  const levelLine = levelSlotLine(item);
  const typeLine = itemTypeLine(item);

  return (
    <Card
      ref={nearRef}
      variant="outlined"
      sx={[selectableCardSx(), qualityWashSx(item.quality), { minHeight: ITEM_CARD_HEIGHT }]}
    >
      <CardActionArea
        onClick={() => onSelect(item)}
        aria-label={`View ${item.name} details`}
        aria-describedby={detailsId}
        sx={{ ...cardActionAreaSx, gap: 1.5, p: 1.5 }}
      >
        <MediaTile
          size={56}
          src={iconQuery.data ?? null}
          alt=""
          fallbackLabel={item.name}
          quality={item.quality}
          loading={iconQuery.isPending}
        />
        <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
          {/* A heading may not sit inside the action area's <button>;
              its aria-label names the card instead. */}
          <Typography
            variant="subtitle2"
            component="span"
            title={item.name}
            sx={(theme) => ({
              ...mixins.lineClamp(2),
              minHeight: "2.6em",
              lineHeight: 1.3,
              fontWeight: 600,
              color: qualityColor(theme, item.quality),
              overflowWrap: "anywhere",
            })}
          >
            {item.name}
          </Typography>
          <Typography
            id={detailsId}
            variant="caption"
            color="text.secondary"
            component="span"
            sx={{ display: "block", minWidth: 0, fontVariantNumeric: "tabular-nums" }}
          >
            {item.qualityName ? (
              <Box component="span" sx={visuallyHidden}>
                {`${item.qualityName}, `}
              </Box>
            ) : null}
            {levelLine ? (
              <Box component="span" sx={{ ...mixins.truncate, display: "block" }}>
                {levelLine}
              </Box>
            ) : null}
            {typeLine ? (
              <Box component="span" sx={{ ...mixins.truncate, display: "block" }}>
                {levelLine ? (
                  <Box component="span" sx={visuallyHidden}>
                    {", "}
                  </Box>
                ) : null}
                {typeLine}
              </Box>
            ) : null}
            <Box component="span" sx={visuallyHidden}>
              {`, item ${item.id}`}
            </Box>
          </Typography>
        </Stack>
      </CardActionArea>
    </Card>
  );
});
ItemCard.displayName = "ItemCard";

export default ItemCard;
