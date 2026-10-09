import CelebrationRoundedIcon from "@mui/icons-material/CelebrationRounded";
import ExploreRoundedIcon from "@mui/icons-material/ExploreRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import type { SvgIconProps } from "@mui/material";

/**
 * A glyph per Blizzard source type (the record's `source.type`): a shop for
 * vendors, a compass for drops (found out in the world), a check for
 * quests, confetti for world events. Decorative: the source's name is
 * always written beside it.
 */
const SourceIcon = ({
  sourceKey,
  ...props
}: SvgIconProps & { sourceKey: string }): JSX.Element => {
  switch (sourceKey) {
    case "vendor":
      return <StorefrontRoundedIcon aria-hidden="true" {...props} />;
    case "drop":
      return <ExploreRoundedIcon aria-hidden="true" {...props} />;
    case "quest":
      return <TaskAltRoundedIcon aria-hidden="true" {...props} />;
    case "worldevent":
      return <CelebrationRoundedIcon aria-hidden="true" {...props} />;
    default:
      return <MoreHorizRoundedIcon aria-hidden="true" {...props} />;
  }
};

export default SourceIcon;
