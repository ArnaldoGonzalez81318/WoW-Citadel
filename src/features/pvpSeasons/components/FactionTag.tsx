import { Box } from "@mui/material";
import type { Theme } from "@mui/material/styles";

import type { PvpFaction } from "@/features/pvpSeasons/types";

export const FACTION_LABELS: Readonly<Record<PvpFaction, string>> = {
  ALLIANCE: "Alliance",
  HORDE: "Horde",
};

/** Alliance blue and Horde red, as the game draws them; always next to the name, never alone. */
export const factionColor = (theme: Theme, faction: PvpFaction): string =>
  faction === "ALLIANCE" ? theme.palette.info.main : theme.palette.error.main;

/** A faction's name behind a dot in its colour (the dot is decoration; the name is the content). */
const FactionTag = ({ faction }: { faction: PvpFaction }): JSX.Element => (
  <Box
    component="span"
    sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, whiteSpace: "nowrap" }}
  >
    <Box
      component="span"
      aria-hidden="true"
      sx={(theme) => ({
        width: 8,
        height: 8,
        borderRadius: "50%",
        flexShrink: 0,
        bgcolor: factionColor(theme, faction),
      })}
    />
    {FACTION_LABELS[faction]}
  </Box>
);

export default FactionTag;
