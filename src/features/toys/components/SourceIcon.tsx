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
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import PetsRoundedIcon from "@mui/icons-material/PetsRounded";
import ShoppingCartRoundedIcon from "@mui/icons-material/ShoppingCartRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import StyleRoundedIcon from "@mui/icons-material/StyleRounded";
import type { SxProps, Theme } from "@mui/material/styles";

import { toSxArray } from "@/lib/sx";

/** A glyph per source code; the localized name always sits beside it. */
const SOURCE_ICONS: Readonly<Record<string, SvgIconComponent>> = {
  VENDOR: StorefrontRoundedIcon,
  DROP: CasinoRoundedIcon,
  OTHER: MoreHorizRoundedIcon,
  WORLDEVENT: CelebrationRoundedIcon,
  QUEST: AssignmentRoundedIcon,
  PROFESSION: HandymanRoundedIcon,
  ACHIEVEMENT: EmojiEventsRoundedIcon,
  PROMOTION: CampaignRoundedIcon,
  PETSTORE: ShoppingCartRoundedIcon,
  WILDPET: PetsRoundedIcon,
  TRADINGPOST: LocalOfferRoundedIcon,
  TCG: StyleRoundedIcon,
  DISCOVERY: ExploreRoundedIcon,
};

export type SourceIconProps = {
  type: string | undefined;
  fontSize?: "inherit" | "small" | "medium";
  /** A Chip's `icon` styles its icon through the class it adds. */
  className?: string;
  sx?: SxProps<Theme>;
};

/** Decorative: the source's name is always rendered next to it. */
const SourceIcon = ({ type, fontSize = "small", className, sx }: SourceIconProps): JSX.Element => {
  const Icon = (type ? SOURCE_ICONS[type] : undefined) ?? HelpOutlineRoundedIcon;
  return (
    <Icon
      aria-hidden
      fontSize={fontSize}
      className={className}
      sx={[{ flexShrink: 0 }, ...toSxArray(sx)]}
    />
  );
};

export default SourceIcon;
