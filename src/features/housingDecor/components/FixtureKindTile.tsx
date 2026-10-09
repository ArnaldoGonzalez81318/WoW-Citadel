import { Box } from "@mui/material";
import { alpha } from "@mui/material/styles";

import {
  FIXTURE_KIND_STYLE,
  accentColor,
} from "@/features/housingDecor/components/housingStyles";
import type { FixtureKind } from "@/features/housingDecor/types";

export type FixtureKindTileProps = {
  kind: FixtureKind;
  size?: 40 | 56 | 72;
};

/**
 * A fixture kind's glyph on a tile in its accent: Blizzard publishes no
 * fixture art, so this stands in for one (decorative; the name is beside it).
 */
const FixtureKindTile = ({ kind, size = 56 }: FixtureKindTileProps): JSX.Element => {
  const style = FIXTURE_KIND_STYLE[kind];
  return (
    <Box
      aria-hidden="true"
      sx={(theme) => {
        const color = accentColor(theme, style.accent);
        return {
          width: size,
          height: size,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: `${theme.wc.radius.md}px`,
          color,
          border: `1px solid ${alpha(color, 0.4)}`,
          background: `linear-gradient(135deg, ${alpha(color, 0.22)} 0%, ${alpha(color, 0.05)} 80%)`,
          "& svg": { fontSize: Math.round(size * 0.5) },
        };
      }}
    >
      {style.icon}
    </Box>
  );
};

export default FixtureKindTile;
