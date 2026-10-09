import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import { Box, Skeleton, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import MediaTile from "@/components/common/MediaTile";
import { itemIconQuery } from "@/features/items/hooks/itemQueries";
import type { ClassTile } from "@/features/items/services/itemCatalog";
import { mixins } from "@/theme";

/** The "All items" tile's value (class ids are numeric strings). */
const ALL = "all";
/**
 * Tile width on the strip; wider screens get a grid. Either way a label gets
 * about 96px or more, room for the longest word ("Miscellaneous") and for
 * "Item Enhancement" on two lines.
 */
const STRIP_TILE_WIDTH = 168;
export const CLASS_TILE_HEIGHT = 58;
/** Nineteen classes on US, plus "All items". */
const SKELETON_COUNT = 20;

/*
 * Twenty tiles would stack seven rows deep on a tablet, so phones and
 * tablets get one scrolling row; wider screens a grid of five rows at most,
 * with columns no narrower than the strip's tiles.
 */
const gridSx = {
  display: { xs: "flex", md: "grid" },
  gridTemplateColumns: {
    md: "repeat(4, minmax(0, 1fr))",
    lg: "repeat(6, minmax(0, 1fr))",
    xl: "repeat(8, minmax(0, 1fr))",
  },
  gap: 1,
  minWidth: 0,
  maxWidth: "100%",
  overflowX: { xs: "auto", md: "visible" },
  scrollSnapType: { xs: "x proximity", md: "none" },
  // Room for the focus ring and a scrollbar on the strip.
  paddingBottom: { xs: 1, md: 0 },
  paddingTop: { xs: 0.25, md: 0 },
} as const;

const TileIcon = ({ tile }: { tile: ClassTile }): JSX.Element => {
  const iconQuery = useQuery({
    ...itemIconQuery(tile.iconItemId ?? 0),
    enabled: tile.iconItemId !== undefined,
  });
  return (
    <MediaTile
      size={40}
      src={iconQuery.data ?? null}
      alt=""
      fallbackLabel={tile.name}
      loading={tile.iconItemId !== undefined && iconQuery.isPending}
    />
  );
};

export const ItemClassTilesSkeleton = (): JSX.Element => (
  <Box role="status" aria-label="Loading item classes" aria-busy sx={gridSx}>
    {Array.from({ length: SKELETON_COUNT }, (_, index) => (
      <Skeleton
        key={index}
        variant="rounded"
        sx={{
          flex: { xs: `0 0 ${STRIP_TILE_WIDTH}px`, md: "initial" },
          height: CLASS_TILE_HEIGHT,
        }}
      />
    ))}
  </Box>
);

export type ItemClassTilesProps = {
  tiles: readonly ClassTile[];
  /** The pressed class; null presses "All items". */
  value: number | null;
  onChange: (classId: number | null) => void;
};

/**
 * Every item class as a tile with an icon, one pressed at a time (a toggle
 * button group: each tile is a Tab stop with aria-pressed). Pressing the
 * pressed class again goes back to every item.
 */
const ItemClassTiles = ({ tiles, value, onChange }: ItemClassTilesProps): JSX.Element => {
  const stripRef = useRef<HTMLDivElement>(null);

  // On the strip, bring the pressed tile into view (a shared link may
  // name one far along the row). Only the strip scrolls, never the page.
  useEffect(() => {
    const strip = stripRef.current;
    const pressed = strip?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!strip || !pressed || strip.scrollWidth <= strip.clientWidth) {
      return;
    }
    strip.scrollLeft = Math.max(
      0,
      pressed.offsetLeft - (strip.clientWidth - pressed.offsetWidth) / 2,
    );
  }, [value, tiles.length]);

  return (
    <ToggleButtonGroup
      ref={stripRef}
      exclusive
      value={value === null ? ALL : String(value)}
      onChange={(_event, next: string | null) => {
        if (next === null) {
          // The pressed tile again: a class goes back to every item; "All" stays.
          if (value !== null) {
            onChange(null);
          }
          return;
        }
        onChange(next === ALL ? null : Number(next));
      }}
      aria-label="Item class"
      sx={(theme) => ({
        ...gridSx,
        // The tiles' offsetLeft (see the effect above) is measured from here.
        position: "relative",
        "& .MuiToggleButtonGroup-grouped": {
          // Undo the group's joined-edge styling: these are separate tiles.
          margin: 0,
          border: `1px solid ${theme.palette.border.subtle}`,
          borderRadius: `${theme.wc.radius.md}px !important`,
        },
      })}
    >
      {[{ id: null, name: "All items" } as const, ...tiles].map((tile) => (
        <ToggleButton
          key={tile.id ?? ALL}
          value={tile.id === null ? ALL : String(tile.id)}
          sx={(theme) => ({
            flex: { xs: `0 0 ${STRIP_TILE_WIDTH}px`, md: "initial" },
            scrollSnapAlign: "start",
            minWidth: 0,
            minHeight: CLASS_TILE_HEIGHT,
            justifyContent: "flex-start",
            gap: 1.25,
            padding: "8px 10px",
            textTransform: "none",
            textAlign: "left",
            color: "text.secondary",
            "&.Mui-selected, &.Mui-selected:hover": {
              color: "text.primary",
              borderColor: `${theme.palette.primary.main} !important`,
              boxShadow: `inset 0 0 0 1px ${theme.palette.primary.main}`,
            },
          })}
        >
          {tile.id === null ? (
            <Box
              aria-hidden="true"
              sx={(theme) => ({
                width: 40,
                height: 40,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: `${theme.wc.radius.sm}px`,
                border: `1px solid ${theme.palette.border.subtle}`,
                backgroundColor: theme.palette.surface.sunken,
                color: theme.palette.secondary.main,
              })}
            >
              <Inventory2RoundedIcon fontSize="small" />
            </Box>
          ) : (
            <TileIcon tile={tile} />
          )}
          {/* A longer localized name can still clamp: hovering shows it whole. */}
          <Typography
            variant="body2"
            component="span"
            title={tile.name}
            sx={{ ...mixins.lineClamp(2), fontWeight: 600, lineHeight: 1.25, minWidth: 0 }}
          >
            {tile.name}
          </Typography>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
};

export default ItemClassTiles;
