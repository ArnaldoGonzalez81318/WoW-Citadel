import type { Theme } from "@mui/material/styles";

import { factionColor } from "@/features/pvpSeasons/components/FactionTag";
import type { PvpFaction } from "@/features/pvpSeasons/types";

/*
 * Blizzard's map records hold an id and a name, nothing else. Which side a
 * map is for comes from the game: Founder's Point is the Alliance's
 * neighborhood, Razorwind Shores the Horde's. Keyed by map id, which is the
 * same in every region (US, EU, KR and TW all list 1 and 2); a map Blizzard
 * adds later simply has no faction and takes the primary accent.
 */
const MAP_FACTIONS: Readonly<Record<number, PvpFaction>> = {
  1: "ALLIANCE",
  2: "HORDE",
};

export const mapFaction = (mapId: number): PvpFaction | undefined =>
  MAP_FACTIONS[mapId];

/** The map's tint for banners, badges and the block strip: its faction's colour. */
export const mapAccent = (theme: Theme, mapId: number): string => {
  const faction = mapFaction(mapId);
  return faction ? factionColor(theme, faction) : theme.palette.primary.main;
};
