import { Box, Skeleton, ToggleButton, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import { useId } from "react";
import type { ReactNode } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import { lineClamp } from "@/theme";

export const THEME_TILE_COLS: GridColumns = { xs: 2, sm: 3, md: 4, lg: 6 };
/** Shorter on phones, where the tiles stack six rows deep. */
export const THEME_TILE_HEIGHT = { xs: 104, sm: 116 } as const;
export const THEME_TILE_GAP = 1;

export type ThemeTile = {
  value: string;
  label: string;
  /** "19 slot types"; null draws a skeleton (the count is still loading). */
  caption: string | null;
  /** This tile's share of the largest tile (0–1), drawn as a bar; null hides it. */
  share: number | null;
  icon: ReactNode;
  accent: (theme: Theme) => string;
  disabled?: boolean;
};

export type ThemeTilePickerProps = {
  /** Accessible name of the group ("Slot type themes"). */
  label: string;
  tiles: readonly ThemeTile[];
  /** The pressed tile; null presses none (while a search is shown). */
  value: string | null;
  onChange: (value: string) => void;
};

const tileSx = (accent: (theme: Theme) => string) => (theme: Theme) => {
  const color = accent(theme);
  return {
    position: "relative",
    overflow: "hidden",
    minWidth: 0,
    minHeight: THEME_TILE_HEIGHT,
    p: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "space-between",
    textAlign: "left",
    textTransform: "none",
    color: "text.secondary",
    border: `1px solid ${theme.palette.border.subtle}`,
    borderLeft: `3px solid ${alpha(color, 0.75)}`,
    borderRadius: `${theme.wc.radius.md}px`,
    background: `linear-gradient(135deg, ${alpha(color, 0.18)} 0%, ${alpha(color, 0.03)} 70%)`,
    "@media (hover: hover)": {
      "&:hover": {
        background: `linear-gradient(135deg, ${alpha(color, 0.28)} 0%, ${alpha(color, 0.07)} 70%)`,
      },
    },
    "&.Mui-selected, &.Mui-selected:hover": {
      color: "text.primary",
      borderColor: theme.palette.primary.main,
      borderLeftColor: color,
      boxShadow: `inset 0 0 0 1px ${theme.palette.primary.main}`,
      background: `linear-gradient(135deg, ${alpha(color, 0.34)} 0%, ${alpha(color, 0.1)} 70%)`,
    },
    "&.Mui-disabled": {
      borderLeftColor: alpha(color, 0.3),
    },
  };
};

const Tile = ({
  tile,
  selected,
  onSelect,
}: {
  tile: ThemeTile;
  selected: boolean;
  onSelect: (value: string) => void;
}): JSX.Element => {
  const detailsId = useId();
  return (
    <ToggleButton
      value={tile.value}
      selected={selected}
      disabled={tile.disabled}
      onChange={() => onSelect(tile.value)}
      // The label replaces the content; the count describes it.
      aria-label={tile.label}
      aria-describedby={tile.caption ? `${detailsId}-caption` : undefined}
      sx={tileSx(tile.accent)}
    >
      <Box
        component="span"
        sx={{ display: "flex", gap: 1, alignItems: "flex-start", px: 1.25, pt: 1.25, minWidth: 0 }}
      >
        <Box
          component="span"
          aria-hidden="true"
          sx={(theme) => ({
            display: "flex",
            flexShrink: 0,
            color: tile.accent(theme),
            "& svg": { fontSize: 20 },
          })}
        >
          {tile.icon}
        </Box>
        <Typography
          variant="subtitle2"
          component="span"
          sx={{ ...lineClamp(2), fontWeight: 600, lineHeight: 1.3, minWidth: 0 }}
        >
          {tile.label}
        </Typography>
      </Box>
      <Box component="span" sx={{ display: "block", px: 1.25, pb: 1.25, minWidth: 0 }}>
        {tile.caption ? (
          <Typography
            id={`${detailsId}-caption`}
            variant="caption"
            component="span"
            color="text.secondary"
            sx={{ display: "block", fontVariantNumeric: "tabular-nums" }}
          >
            {tile.caption}
          </Typography>
        ) : (
          <Skeleton variant="text" width="55%" sx={{ fontSize: "0.75rem" }} />
        )}
        <Box
          component="span"
          aria-hidden="true"
          sx={(theme) => ({
            display: "block",
            mt: 0.75,
            height: 4,
            borderRadius: `${theme.wc.radius.pill}px`,
            backgroundColor: alpha(theme.palette.common.white, 0.06),
            overflow: "hidden",
            visibility: tile.share === null ? "hidden" : "visible",
          })}
        >
          <Box
            component="span"
            sx={(theme) => ({
              display: "block",
              height: "100%",
              // A sliver for small shares, so a one never reads as a zero.
              width:
                (tile.share ?? 0) > 0
                  ? `max(${Math.round(Math.min(1, tile.share ?? 0) * 100)}%, 4px)`
                  : 0,
              borderRadius: "inherit",
              backgroundColor: alpha(tile.accent(theme), 0.85),
            })}
          />
        </Box>
      </Box>
    </ToggleButton>
  );
};

/**
 * Themes as colour-coded tiles, one pressed at a time: each is a toggle
 * button (a Tab stop with aria-pressed; Space or Enter picks it) with its
 * count and a bar sized against the largest tile, so the spread of the
 * data reads before anything is opened.
 */
const ThemeTilePicker = ({
  label,
  tiles,
  value,
  onChange,
}: ThemeTilePickerProps): JSX.Element => (
  <Box
    role="group"
    aria-label={label}
    sx={{ display: "grid", gap: THEME_TILE_GAP, ...gridTemplateColumnsSx(THEME_TILE_COLS) }}
  >
    {tiles.map((tile) => (
      <Tile key={tile.value} tile={tile} selected={tile.value === value} onSelect={onChange} />
    ))}
  </Box>
);

export default ThemeTilePicker;
