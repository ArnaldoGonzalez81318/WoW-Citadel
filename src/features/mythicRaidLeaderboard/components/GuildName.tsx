import { Box, Link, Typography } from "@mui/material";
import type { TypographyProps } from "@mui/material";

import { guildArmoryUrl } from "@/features/mythicRaidLeaderboard/services/hallOfFameService";
import type { HallOfFameEntry } from "@/features/mythicRaidLeaderboard/types";
import { truncate, visuallyHidden } from "@/theme";

export type GuildNameProps = {
  entry: HallOfFameEntry;
  variant?: TypographyProps["variant"];
};

/**
 * A guild's name, linking to its official armory page where one exists
 * (every region but China). Inline-block, so only the name is a click
 * target, not the empty width of its grid cell.
 */
const GuildName = ({ entry, variant = "subtitle2" }: GuildNameProps): JSX.Element => {
  const href = guildArmoryUrl(entry);
  const sx = {
    ...truncate,
    display: "inline-block",
    maxWidth: "100%",
    verticalAlign: "top",
    fontWeight: 600,
  };

  if (!href) {
    return (
      <Typography component="span" variant={variant} sx={sx}>
        {entry.guild.name}
      </Typography>
    );
  }
  return (
    <Link href={href} target="_blank" rel="noreferrer" variant={variant} underline="hover" sx={sx}>
      {entry.guild.name}
      <Box component="span" sx={visuallyHidden}>
        {" "}(armory, opens in a new tab)
      </Box>
    </Link>
  );
};

export default GuildName;
