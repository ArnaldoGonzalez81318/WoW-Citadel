import { Box } from "@mui/material";
import { alpha, lighten } from "@mui/material/styles";

import { KindIcon } from "@/features/reputations/components/KindBadge";
import { accentColor } from "@/features/reputations/services/reputationPalette";
import type { AccentKey } from "@/features/reputations/services/reputationPalette";
import type { LadderKind } from "@/features/reputations/types";

const STOP_WORDS: ReadonlySet<string> = new Set(["the", "of", "and", "a", "an", "for", "de", "la", "le", "der", "die"]);

/**
 * "The War Within" -> "WW", "Keg Leg's Crew" -> "KL", "Midnight" -> "M".
 * Placeholder tags ("[PH] …") and small words are skipped.
 */
export const monogramOf = (name: string): string => {
  const words = name
    .replace(/\[[^\]]*\]/gu, " ")
    .split(/[\s\-–:]+/u)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((word) => word.length > 0);
  const significant = words.filter((word) => !STOP_WORDS.has(word.toLowerCase()));
  const picked = (significant.length > 0 ? significant : words).slice(0, 2);
  const letters = picked.map((word) => word.charAt(0).toLocaleUpperCase()).join("");
  return letters || "?";
};

export type FactionCrestProps = {
  name: string;
  accent: AccentKey;
  /** Adds the kind's icon as a small seal in the corner. */
  kind?: LadderKind;
  size?: number;
};

/**
 * Blizzard has no faction art, so each faction wears a crest made from its
 * data: its monogram on its group's colour, sealed with its ladder kind.
 * Decorative (the name and kind are always written beside it).
 */
const FactionCrest = ({
  name,
  accent,
  kind,
  size = 48,
}: FactionCrestProps): JSX.Element => {
  const seal = Math.round(size * 0.42);
  return (
    <Box
      aria-hidden="true"
      sx={(theme) => {
        const color = accentColor(theme, accent);
        return {
          position: "relative",
          flexShrink: 0,
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: `${theme.wc.radius.md}px`,
          border: `1px solid ${alpha(color, 0.55)}`,
          background: `linear-gradient(145deg, ${alpha(color, 0.38)} 0%, ${alpha(color, 0.1)} 60%, ${alpha(theme.palette.surface.base, 0.6)} 100%)`,
          boxShadow: `inset 0 1px 0 ${alpha(theme.palette.common.white, 0.08)}`,
          color: lighten(color, 0.35),
          fontWeight: 800,
          fontSize: size * 0.36,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          userSelect: "none",
        };
      }}
    >
      {monogramOf(name)}
      {kind ? (
        <Box
          sx={(theme) => ({
            position: "absolute",
            right: -seal * 0.3,
            bottom: -seal * 0.3,
            width: seal,
            height: seal,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            backgroundColor: theme.palette.surface.overlay,
            border: `1px solid ${theme.palette.border.default}`,
            color: theme.palette.text.secondary,
            "& svg": { fontSize: seal * 0.66 },
          })}
        >
          <KindIcon kind={kind} />
        </Box>
      ) : null}
    </Box>
  );
};

export default FactionCrest;
