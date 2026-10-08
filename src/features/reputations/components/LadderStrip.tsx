import { Box, Skeleton } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

import { toSxArray } from "@/lib/sx";

/** Past this many steps a strip is one gradient: 80 two-pixel slivers read as noise. */
const MAX_SEGMENTS = 40;

export type LadderStripProps = {
  /** One colour per step, lowest first; null while the ladder loads. */
  colors: readonly string[] | null;
  height?: number;
  sx?: SxProps<Theme>;
};

/**
 * A ladder at a glance: one segment per standing, rank or renown level in
 * its colour, split by 2px of surface so equal neighbours stay countable.
 * Decorative: whatever shows it also states the ladder in words.
 */
const LadderStrip = ({ colors, height = 6, sx }: LadderStripProps): JSX.Element => {
  if (colors === null) {
    return (
      <Skeleton
        variant="rounded"
        aria-hidden="true"
        height={height}
        sx={[{ width: "100%", borderRadius: `${height / 2}px` }, ...toSxArray(sx)]}
      />
    );
  }

  if (colors.length > MAX_SEGMENTS) {
    const stops = colors
      .map((color, index) => `${color} ${((index / (colors.length - 1)) * 100).toFixed(1)}%`)
      .join(", ");
    return (
      <Box
        aria-hidden="true"
        sx={[
          {
            width: "100%",
            height,
            borderRadius: `${height / 2}px`,
            background: `linear-gradient(90deg, ${stops})`,
          },
          ...toSxArray(sx),
        ]}
      />
    );
  }

  return (
    <Box
      aria-hidden="true"
      sx={[
        {
          display: "flex",
          gap: colors.length > 20 ? "1px" : "2px",
          width: "100%",
          height,
        },
        ...toSxArray(sx),
      ]}
    >
      {colors.map((color, index) => (
        <Box
          key={index}
          sx={{
            flex: "1 1 0",
            minWidth: 0,
            backgroundColor: color,
            // Rounded data ends only: the inner joins stay square.
            borderTopLeftRadius: index === 0 ? height / 2 : 0,
            borderBottomLeftRadius: index === 0 ? height / 2 : 0,
            borderTopRightRadius: index === colors.length - 1 ? height / 2 : 0,
            borderBottomRightRadius: index === colors.length - 1 ? height / 2 : 0,
          }}
        />
      ))}
    </Box>
  );
};

export default LadderStrip;
