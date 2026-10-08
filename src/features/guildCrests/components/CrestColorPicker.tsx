import CheckRounded from "@mui/icons-material/CheckRounded";
import { Box, ButtonBase, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";

import { swatchInk } from "@/features/guildCrests/services/guildCrestService";
import type { CrestColor } from "@/features/guildCrests/types";
import { COARSE_POINTER } from "@/theme";

export type CrestColorPickerProps = {
  /** Id of the visible heading that names the group ("Background colour"). */
  labelledBy: string;
  colors: CrestColor[];
  value: number | null;
  onChange: (colorId: number) => void;
};

/** "Dark crimson, #670021": the swatch's name and its tooltip. */
export const colorLabel = (color: CrestColor): string => `${color.name}, ${color.hex}`;

/**
 * The swatch grid's columns, shared with the designer's loading skeleton so
 * the skeleton is the loaded grid's shape. auto-fill rather than a column
 * map: the grid sits in a column whose width the preview beside it sets.
 */
export const SWATCH_GRID_SX = {
  gridTemplateColumns: "repeat(auto-fill, minmax(36px, 1fr))",
  // A 44px tap target per swatch on touch screens.
  [COARSE_POINTER]: {
    gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))",
  },
} as const;

/**
 * One palette as a wrapping grid of swatch buttons, one pressed at a time
 * (aria-pressed, like the explorers' filter chips). Each swatch is named by
 * its approximate colour name and hex; the tooltip shows the same text, so
 * it does not also describe the button.
 */
const CrestColorPicker = ({
  labelledBy,
  colors,
  value,
  onChange,
}: CrestColorPickerProps): JSX.Element => (
  <Box
    role="group"
    aria-labelledby={labelledBy}
    sx={{
      display: "grid",
      // Room for the focus ring, drawn outside the pressed swatch's gold ring.
      gap: 1,
      ...SWATCH_GRID_SX,
    }}
  >
    {colors.map((color) => {
      const pressed = color.id === value;
      const label = colorLabel(color);
      return (
        <Tooltip key={color.id} title={label} arrow disableInteractive>
          <ButtonBase
            aria-pressed={pressed}
            aria-label={label}
            onClick={() => onChange(color.id)}
            sx={(theme) => ({
              width: "100%",
              aspectRatio: "1 / 1",
              borderRadius: `${theme.wc.radius.sm}px`,
              backgroundColor: color.hex,
              // A hairline so black and navy swatches still read on the dark card.
              border: `1px solid ${alpha("#ffffff", 0.18)}`,
              color: swatchInk(color),
              transition: theme.transitions.create(["box-shadow", "transform"], {
                duration: theme.wc.motion.fast,
              }),
              boxShadow: pressed
                ? `0 0 0 2px ${theme.palette.background.paper}, 0 0 0 4px ${theme.palette.secondary.main}`
                : "none",
              "@media (hover: hover)": {
                "&:hover": {
                  boxShadow: pressed
                    ? `0 0 0 2px ${theme.palette.background.paper}, 0 0 0 4px ${theme.palette.secondary.main}`
                    : `0 0 0 2px ${theme.palette.border.strong}`,
                },
              },
              "&.Mui-focusVisible": { outlineOffset: 5 },
            })}
          >
            {pressed ? <CheckRounded aria-hidden="true" sx={{ fontSize: 20 }} /> : null}
          </ButtonBase>
        </Tooltip>
      );
    })}
  </Box>
);

export default CrestColorPicker;
