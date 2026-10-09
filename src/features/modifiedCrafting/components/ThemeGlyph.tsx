import type { SvgIconComponent } from "@mui/icons-material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import ConstructionRoundedIcon from "@mui/icons-material/ConstructionRounded";
import DiamondRoundedIcon from "@mui/icons-material/DiamondRounded";
import HandymanRoundedIcon from "@mui/icons-material/HandymanRounded";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import QuestionMarkRoundedIcon from "@mui/icons-material/QuestionMarkRounded";
import ScienceRoundedIcon from "@mui/icons-material/ScienceRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import UpgradeRoundedIcon from "@mui/icons-material/UpgradeRounded";
import { Box } from "@mui/material";
import { alpha } from "@mui/material/styles";

import { themeAccentColor } from "@/features/modifiedCrafting/services/slotThemes";
import type { SlotThemeId } from "@/features/modifiedCrafting/services/slotThemes";

export const THEME_ICONS: Readonly<Record<SlotThemeId, SvgIconComponent>> = {
  embellishment: AutoAwesomeRoundedIcon,
  "item-level": UpgradeRoundedIcon,
  "secondary-stats": TuneRoundedIcon,
  "profession-stats": HandymanRoundedIcon,
  finishing: AutoFixHighRoundedIcon,
  sockets: DiamondRoundedIcon,
  pvp: ShieldRoundedIcon,
  dyes: PaletteRoundedIcon,
  reagents: ScienceRoundedIcon,
  test: ConstructionRoundedIcon,
  unnamed: QuestionMarkRoundedIcon,
};

export type ThemeGlyphProps = {
  theme: SlotThemeId;
  /** Square size in px. */
  size?: number;
};

/**
 * A theme's icon on a tile of its colour: the slot type's picture when no
 * reagent icon is known (sockets have no items) or while one loads.
 * Decorative: the theme is always named in text beside it.
 */
const ThemeGlyph = ({ theme: themeId, size = 40 }: ThemeGlyphProps): JSX.Element => {
  const Icon = THEME_ICONS[themeId];
  return (
    <Box
      aria-hidden="true"
      sx={(theme) => {
        const color = themeAccentColor(theme, themeId);
        return {
          width: size,
          height: size,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: `${theme.wc.radius.sm}px`,
          color,
          border: `1px solid ${alpha(color, 0.4)}`,
          background: `linear-gradient(135deg, ${alpha(color, 0.24)} 0%, ${alpha(color, 0.06)} 100%)`,
          "& svg": { fontSize: Math.round(size * 0.55) },
        };
      }}
    >
      <Icon />
    </Box>
  );
};

export default ThemeGlyph;
