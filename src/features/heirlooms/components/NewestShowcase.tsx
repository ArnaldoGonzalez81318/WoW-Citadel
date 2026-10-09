import { Box, Card, CardActionArea, Skeleton, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import MediaTile from "@/components/common/MediaTile";
import { heirloomIconQuery } from "@/features/heirlooms/hooks/heirloomQueries";
import { itemLevelRange, slotLine } from "@/features/heirlooms/services/heirloomService";
import type { Heirloom, HeirloomRef } from "@/features/heirlooms/types";
import IconBackdrop from "@/features/professions/components/IconBackdrop";
import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/professions/components/cardStyles";
import { lineClamp, qualityColor, truncate } from "@/theme";

/** Six across on wide screens, never a lone tile: 2 × 3, 3 × 2, 6 × 1. */
export const SHOWCASE_COLS: GridColumns = { xs: 2, sm: 3, lg: 6 };
export const SHOWCASE_COUNT = 6;
const SHOWCASE_TILE_HEIGHT = 176;

export type ShowcaseEntry = {
  entry: HeirloomRef;
  heirloom: Heirloom | null | undefined;
  failed: boolean;
};

const ShowcaseTile = ({
  item,
  onSelect,
}: {
  item: ShowcaseEntry;
  onSelect: (entry: HeirloomRef) => void;
}): JSX.Element => {
  const { entry, heirloom, failed } = item;
  const itemId = heirloom?.itemId ?? 0;
  // Six tiles at the top of the page: no reason to wait for the viewport.
  const iconQuery = useQuery({ ...heirloomIconQuery(itemId), enabled: itemId > 0 });
  const icon = iconQuery.data ?? null;
  const name = heirloom?.name ?? entry.name;
  const detailsId = useId();
  const range = heirloom ? itemLevelRange(heirloom) : null;

  let caption: string | null = null;
  if (heirloom) {
    caption = slotLine(heirloom) || heirloom.source.name;
  } else if (heirloom === null) {
    caption = "Not in Blizzard's game data";
  } else if (failed) {
    caption = "Details unavailable";
  }

  return (
    <Card variant="outlined" sx={selectableCardSx()}>
      <IconBackdrop src={icon} opacity={0.45} sx={{ inset: "1px", borderRadius: "inherit" }} />
      <CardActionArea
        onClick={() => onSelect({ id: entry.id, name })}
        aria-label={`View ${name} details`}
        aria-describedby={
          caption === null
            ? undefined
            : range
              ? `${detailsId}-caption ${detailsId}-range`
              : `${detailsId}-caption`
        }
        sx={{ ...cardActionAreaSx, flexDirection: "column", alignItems: "center" }}
      >
        <Stack
          spacing={1}
          alignItems="center"
          sx={{
            position: "relative",
            p: 1.5,
            pt: 2,
            width: "100%",
            minWidth: 0,
            minHeight: SHOWCASE_TILE_HEIGHT,
            textAlign: "center",
          }}
        >
          <MediaTile
            size={56}
            src={icon}
            alt=""
            fallbackLabel={name}
            quality="heirloom"
            loading={heirloom === undefined ? !failed : itemId > 0 && iconQuery.isPending}
          />
          <Typography
            variant="subtitle2"
            component="span"
            title={name}
            sx={(theme) => ({
              ...lineClamp(2),
              minHeight: "2.7em",
              lineHeight: 1.35,
              color: qualityColor(theme, "heirloom"),
            })}
          >
            {name}
          </Typography>
          {caption !== null ? (
            <Box sx={{ width: "100%", minWidth: 0 }}>
              <Typography
                id={`${detailsId}-caption`}
                variant="caption"
                color="text.secondary"
                component="span"
                sx={{ ...truncate, display: "block" }}
              >
                {caption}
              </Typography>
              {range ? (
                <Typography
                  id={`${detailsId}-range`}
                  variant="caption"
                  color="text.secondary"
                  component="span"
                  sx={{ ...truncate, display: "block" }}
                >
                  {`Item level ${range}`}
                </Typography>
              ) : null}
            </Box>
          ) : (
            <Box sx={{ width: "100%" }}>
              <Skeleton variant="text" width="70%" sx={{ mx: "auto", fontSize: "0.75rem" }} />
              <Skeleton variant="text" width="50%" sx={{ mx: "auto", fontSize: "0.75rem" }} />
            </Box>
          )}
        </Stack>
      </CardActionArea>
    </Card>
  );
};

export type NewestShowcaseProps = {
  items: readonly ShowcaseEntry[];
  onSelect: (entry: HeirloomRef) => void;
};

/**
 * The latest additions to the collection as tiles: each icon over a blurred
 * copy of itself, the name, slot and item level range. Their records are
 * the first the page asks for, so the tiles fill in before the rest of the
 * collection has loaded.
 */
const NewestShowcase = ({ items, onSelect }: NewestShowcaseProps): JSX.Element => (
  <Box
    component="ul"
    role="list"
    aria-label="Latest heirlooms"
    sx={{
      display: "grid",
      gap: "12px",
      listStyle: "none",
      m: 0,
      p: 0,
      ...gridTemplateColumnsSx(SHOWCASE_COLS),
    }}
  >
    {items.map((item) => (
      <Box component="li" key={item.entry.id} sx={{ minWidth: 0 }}>
        <ShowcaseTile item={item} onSelect={onSelect} />
      </Box>
    ))}
  </Box>
);

export default NewestShowcase;
