import type { SvgIconComponent } from "@mui/icons-material";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import CasinoRoundedIcon from "@mui/icons-material/CasinoRounded";
import CelebrationRoundedIcon from "@mui/icons-material/CelebrationRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import ExploreRoundedIcon from "@mui/icons-material/ExploreRounded";
import HandymanRoundedIcon from "@mui/icons-material/HandymanRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import ShoppingCartRoundedIcon from "@mui/icons-material/ShoppingCartRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import StyleRoundedIcon from "@mui/icons-material/StyleRounded";
import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

import type { TypedRef } from "@/features/mounts/types";
import { factionColor } from "@/features/pvpSeasons/components/FactionTag";
import { toSxArray } from "@/lib/sx";

/** A glyph per source code; the localized name always sits beside it. */
const SOURCE_ICONS: Readonly<Record<string, SvgIconComponent>> = {
  VENDOR: StorefrontRoundedIcon,
  DROP: CasinoRoundedIcon,
  ACHIEVEMENT: EmojiEventsRoundedIcon,
  QUEST: AssignmentRoundedIcon,
  TRADINGPOST: LocalOfferRoundedIcon,
  PETSTORE: ShoppingCartRoundedIcon,
  PROMOTION: CampaignRoundedIcon,
  WORLDEVENT: CelebrationRoundedIcon,
  PROFESSION: HandymanRoundedIcon,
  TCG: StyleRoundedIcon,
  DISCOVERY: ExploreRoundedIcon,
};

/**
 * Decorative: the source's name is always rendered next to it. `className`
 * is passed through because Chip clones its `icon` with `MuiChip-icon`, which
 * carries the chip's icon size and spacing.
 */
export const SourceIcon = ({
  type,
  fontSize = "small",
  sx,
  className,
}: {
  type: string | undefined;
  fontSize?: "inherit" | "small" | "medium";
  sx?: SxProps<Theme>;
  className?: string;
}): JSX.Element => {
  const Icon = (type ? SOURCE_ICONS[type] : undefined) ?? HelpOutlineRoundedIcon;
  return (
    <Icon
      aria-hidden
      className={className}
      fontSize={fontSize}
      sx={[{ flexShrink: 0 }, ...toSxArray(sx)]}
    />
  );
};

const isColoredFaction = (type: string): type is "ALLIANCE" | "HORDE" =>
  type === "ALLIANCE" || type === "HORDE";

/**
 * The faction's localized name behind a dot in its colour (FactionTag's
 * look, with Blizzard's own name for the faction rather than English).
 */
export const MountFactionTag = ({
  faction,
  id,
  sx,
}: {
  faction: TypedRef;
  id?: string;
  sx?: SxProps<Theme>;
}): JSX.Element => (
  <Box
    component="span"
    id={id}
    sx={[
      { display: "inline-flex", alignItems: "center", gap: 0.75, minWidth: 0, whiteSpace: "nowrap" },
      ...toSxArray(sx),
    ]}
  >
    <Box
      component="span"
      aria-hidden="true"
      sx={(theme) => ({
        width: 8,
        height: 8,
        borderRadius: "50%",
        flexShrink: 0,
        bgcolor: isColoredFaction(faction.type)
          ? factionColor(theme, faction.type)
          : theme.palette.text.secondary,
      })}
    />
    {faction.name}
  </Box>
);
