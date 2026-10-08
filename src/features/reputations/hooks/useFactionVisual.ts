import { alpha, useTheme } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";

import { ladderQuery } from "@/features/reputations/hooks/reputationQueries";
import {
  accentColor,
  ladderColors,
  renownColors,
} from "@/features/reputations/services/reputationPalette";
import type { AccentKey } from "@/features/reputations/services/reputationPalette";
import {
  KIND_TITLE,
  ladderSummary,
  pluralize,
  renownSummary,
} from "@/features/reputations/services/reputationService";
import type { Faction } from "@/features/reputations/types";

/** A folder's strip shows one block per child, up to this many. */
const MAX_GROUP_BLOCKS = 24;

export type FactionVisual = {
  /** The strip's colours, lowest step first; null while its ladder loads. */
  colors: string[] | null;
  /** "8 standings · Hated to Exalted", "40 renown levels · 52 rewards", "9 factions". */
  summary: string;
};

/**
 * What a card or row draws for one faction: its ladder (fetched only for
 * standard and friendship factions, and only when `enabled`), the strip's
 * colours and a one-line summary. Ladder 0 is shared by every standard
 * faction, so a whole grid of them costs one ladder request.
 */
export const useFactionVisual = (
  faction: Faction | null | undefined,
  accent: AccentKey,
  enabled: boolean,
  /** The faction record failed: draw a plain bar, not a skeleton that never resolves. */
  failed = false,
): FactionVisual => {
  const theme = useTheme();
  const ladderId = faction?.ladderId ?? null;
  const ladder = useQuery({
    ...ladderQuery(ladderId ?? 0),
    enabled: enabled && ladderId !== null,
  });

  const neutral = [theme.palette.border.strong];
  if (!faction) {
    return { colors: faction === null || failed ? neutral : null, summary: "" };
  }

  switch (faction.kind) {
    case "renown":
      return {
        colors:
          faction.renownLevels.length > 0
            ? renownColors(theme, faction.renownLevels.length)
            : neutral,
        summary: renownSummary(faction.renownLevels),
      };
    case "group": {
      const blocks = Math.min(Math.max(faction.children.length, 1), MAX_GROUP_BLOCKS);
      return {
        colors: Array.from({ length: blocks }, () => alpha(accentColor(theme, accent), 0.6)),
        summary: pluralize(faction.children.length, "faction", "factions"),
      };
    }
    case "standard":
    case "friendship": {
      if (ladder.data) {
        return {
          colors: ladder.data.tiers.length > 0 ? ladderColors(theme, ladder.data) : neutral,
          summary: ladderSummary(faction.kind, ladder.data),
        };
      }
      // Still loading (or not yet near the viewport): the kind stands in.
      // A failed or missing ladder draws a plain bar rather than a skeleton
      // that would never resolve.
      const settled =
        faction.ladderId === null || ladder.isError || ladder.data === null;
      return {
        colors: settled ? neutral : null,
        summary: KIND_TITLE[faction.kind],
      };
    }
    default:
      return { colors: neutral, summary: KIND_TITLE.none };
  }
};
