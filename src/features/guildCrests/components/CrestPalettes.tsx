import CheckRounded from "@mui/icons-material/CheckRounded";
import { Box, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useId } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import { swatchInk } from "@/features/guildCrests/services/guildCrestService";
import type { CrestColor } from "@/features/guildCrests/types";
import { formatNumber } from "@/lib/format";

/** gridTemplateColumnsSx clamps to 8 columns, so 8 is the most this can say. */
export const PALETTE_COLS: GridColumns = { xs: 3, sm: 4, md: 6, lg: 8 };
/**
 * An entry's height for the loading skeleton: borders (3) + swatch (44) +
 * padding (12) + a one-line name (18) + two caption lines (35) + gaps (4).
 */
export const PALETTE_CELL_HEIGHT = 116;
/** The palettes' sizes as Blizzard lists them today, for the loading skeleton. */
export const PALETTE_SKELETON_COUNTS = [17, 17, 51] as const;

export type CrestPalette = {
  key: string;
  title: string;
  colors: CrestColor[];
  /** The colour this slot of the crest uses now, marked "In use". */
  selectedId: number | null;
};

const PaletteEntry = ({
  color,
  inUse,
}: {
  color: CrestColor;
  inUse: boolean;
}): JSX.Element => (
  <Box
    component="li"
    sx={(theme) => ({
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      borderRadius: `${theme.wc.radius.md}px`,
      border: `1px solid ${inUse ? theme.palette.border.gold : theme.palette.border.subtle}`,
      backgroundColor: theme.palette.surface.inset,
    })}
  >
    <Box
      aria-hidden="true"
      sx={{
        position: "relative",
        height: 44,
        backgroundColor: color.hex,
        borderBottom: `1px solid ${alpha("#ffffff", 0.12)}`,
      }}
    >
      {inUse ? (
        <CheckRounded
          sx={{
            position: "absolute",
            top: 6,
            right: 6,
            fontSize: 18,
            color: swatchInk(color),
          }}
        />
      ) : null}
    </Box>
    <Stack spacing={0.25} sx={{ px: 1, py: 0.75, minWidth: 0 }}>
      <Typography
        component="span"
        variant="body2"
        sx={{ fontWeight: 600, lineHeight: 1.3, overflowWrap: "anywhere" }}
      >
        {color.name}
      </Typography>
      <Typography
        component="span"
        variant="caption"
        sx={(theme) => ({ fontFamily: theme.wc.fontMono, color: "text.secondary" })}
      >
        {color.hex}
      </Typography>
      <Typography component="span" variant="caption" color="text.secondary">
        {`ID ${color.id}`}
        {inUse ? (
          <Box component="span" sx={{ color: "secondary.main", fontWeight: 600 }}>
            {" · In use"}
          </Box>
        ) : null}
      </Typography>
    </Stack>
  </Box>
);

const PaletteGroup = ({ palette }: { palette: CrestPalette }): JSX.Element => {
  const headingId = useId();
  return (
    <Stack spacing={1.25}>
      <Stack direction="row" spacing={1} alignItems="baseline">
        <Typography id={headingId} variant="subtitle1" component="h3" sx={{ m: 0 }}>
          {palette.title}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="span">
          {formatNumber(palette.colors.length)}
        </Typography>
      </Stack>
      {palette.colors.length === 0 ? (
        <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
          Blizzard lists no colours in this palette.
        </Typography>
      ) : (
        <Box
          component="ul"
          role="list"
          aria-labelledby={headingId}
          sx={{
            display: "grid",
            gap: 1,
            listStyle: "none",
            m: 0,
            p: 0,
            ...gridTemplateColumnsSx(PALETTE_COLS),
          }}
        >
          {palette.colors.map((color) => (
            <PaletteEntry
              key={color.id}
              color={color}
              inUse={color.id === palette.selectedId}
            />
          ))}
        </Box>
      )}
    </Stack>
  );
};

/**
 * Every colour of the three crest palettes as Blizzard lists them, with the
 * ones the crest uses marked: a reference beside the designer's swatches,
 * with the values (hex, id) an API user needs.
 */
const CrestPalettes = ({ palettes }: { palettes: CrestPalette[] }): JSX.Element => (
  <Stack spacing={3}>
    {palettes.map((palette) => (
      <PaletteGroup key={palette.key} palette={palette} />
    ))}
  </Stack>
);

export default CrestPalettes;
