import { Box, Card, CardActionArea, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { memo, useId } from "react";

import MediaTile from "@/components/common/MediaTile";
import { idTextSx } from "@/features/housingDecor/components/housingStyles";
import { decorIconQuery } from "@/features/housingDecor/hooks/housingQueries";
import { leadingWord } from "@/features/housingDecor/services/housingCatalog";
import type { DecorEntry, DecorItemSummary } from "@/features/housingDecor/types";
import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/professions/components/cardStyles";
import useNearViewport from "@/hooks/useNearViewport";
import { mixins, qualityColor } from "@/theme";

/** The icon's stage: the 56px icon (scaled up it blurs) centred in a quality glow. */
export const DECOR_STAGE_HEIGHT = 96;
/**
 * The text block: 12px padding above and below, two 20px lines of name
 * (reserved, so a row of cards lines up), a 4px gap and the 18px caption.
 * The loading grid adds it to the stage to match the cards.
 */
export const DECOR_TEXT_HEIGHT = 86;

export type DecorCardProps = {
  entry: DecorEntry;
  /**
   * The item behind the decor, once the page's batch has named it;
   * undefined while it loads, after it failed, or when Blizzard links none.
   */
  itemId: number | undefined;
  /** The page's batch is still on its first load (the icon is on its way). */
  linkPending: boolean;
  /** The item's quality, once the page's item search lands. */
  summary?: DecorItemSummary;
  onSelect: (entry: DecorEntry) => void;
};

/**
 * One decor: the icon of the item that adds it to the House Chest (the
 * API has no decor renders) on a stage glowing in the item's quality, its
 * name in that colour, and the quality and decor id beneath. The icon only
 * loads once the card nears the viewport; the whole card opens the dialog.
 */
const DecorCard = ({
  entry,
  itemId,
  linkPending,
  summary,
  onSelect,
}: DecorCardProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const iconQuery = useQuery({
    ...decorIconQuery(itemId ?? 0),
    enabled: near && itemId !== undefined,
  });
  const quality = summary?.quality;
  // The button's aria-label replaces its content, so the visible caption is
  // its description: the way to tell same-named decor apart by ear.
  const detailsId = useId();

  return (
    <Card ref={nearRef} variant="outlined" sx={selectableCardSx()}>
      <CardActionArea
        onClick={() => onSelect(entry)}
        aria-label={`View ${entry.name} details`}
        aria-describedby={detailsId}
        sx={{ ...cardActionAreaSx, flexDirection: "column" }}
      >
        <Box
          sx={(theme) => ({
            width: "100%",
            height: DECOR_STAGE_HEIGHT,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.palette.surface.sunken,
            backgroundImage: quality
              ? `radial-gradient(circle at 50% 50%, ${alpha(qualityColor(theme, quality), 0.22)} 0%, transparent 62%)`
              : "none",
            borderBottom: `1px solid ${theme.palette.border.subtle}`,
          })}
        >
          <MediaTile
            size={56}
            src={iconQuery.data ?? null}
            alt=""
            fallbackLabel={leadingWord(entry.name)}
            quality={quality}
            loading={linkPending || (itemId !== undefined && iconQuery.isPending)}
          />
        </Box>
        <Stack
          spacing={0.5}
          sx={{ p: 1.5, width: "100%", minWidth: 0, height: DECOR_TEXT_HEIGHT }}
        >
          {/* A heading may not sit inside the action area's <button>;
              its aria-label names the card instead. */}
          <Typography
            variant="subtitle2"
            component="span"
            sx={(theme) => ({
              ...mixins.lineClamp(2),
              lineHeight: "20px",
              minHeight: 40,
              hyphens: "auto",
              overflowWrap: "anywhere",
              color: quality ? qualityColor(theme, quality) : "text.primary",
            })}
          >
            {entry.name}
          </Typography>
          <Typography
            id={detailsId}
            variant="caption"
            color="text.secondary"
            component="span"
            sx={{ ...mixins.truncate, lineHeight: "18px", minWidth: 0 }}
          >
            {summary?.qualityName ? `${summary.qualityName} · ` : ""}
            <Box component="span" sx={idTextSx}>
              {`#${entry.id}`}
            </Box>
          </Typography>
        </Stack>
      </CardActionArea>
    </Card>
  );
};

export default memo(DecorCard);
