import { decomposeColor, recomposeColor } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";

import { STANDARD_LADDER_ID } from "@/features/reputations/services/reputationService";
import type { LadderKind, StandingLadder } from "@/features/reputations/types";
import type { QualityKey } from "@/theme";

/*
 * Every colour here is derived from theme tokens (the theme is the only
 * place allowed raw values): the standing colours follow the game's own
 * reputation bar (red while hated, orange, yellow at Neutral, then greens),
 * friendship ladders take the friendly half of that ramp, renown climbs from
 * the brand blue to gold, and each expansion group gets an accent of its own.
 */

type PaletteKey = "primary" | "secondary" | "success" | "warning" | "error" | "info";
export type AccentKey = PaletteKey | QualityKey;

const PALETTE_KEYS: ReadonlySet<string> = new Set([
  "primary",
  "secondary",
  "success",
  "warning",
  "error",
  "info",
]);

export const accentColor = (theme: Theme, key: AccentKey): string =>
  PALETTE_KEYS.has(key)
    ? theme.palette[key as PaletteKey].main
    : theme.palette.quality[key as QualityKey];

/**
 * Each root group's accent, chosen for the expansion's look (Legion's fel,
 * Wrath's frost, Pandaria's jade). Faction ids are the game's own, the same
 * in every region; a group Blizzard adds later falls back to `FALLBACK_ACCENTS`.
 */
const GROUP_ACCENTS: Readonly<Record<number, AccentKey>> = {
  1169: "primary", // Guild
  2698: "epic", // Midnight: the Void
  2569: "legendary", // The War Within: earthen amber
  2506: "error", // Dragonflight: the red flight
  2593: "artifact", // Keg Leg's Crew: sun-bleached sails
  2414: "heirloom", // Shadowlands: anima
  2104: "rare", // Battle for Azeroth: the tides
  1834: "uncommon", // Legion: fel
  1444: "warning", // Warlords of Draenor: iron and fire
  1245: "success", // Mists of Pandaria: jade
  1162: "error", // Cataclysm: Deathwing's fire
  1097: "info", // Wrath of the Lich King: frost
  980: "epic", // The Burning Crusade: Outland's sky
  1118: "secondary", // Classic: old gold
};

const FALLBACK_ACCENTS: readonly AccentKey[] = [
  "primary",
  "secondary",
  "epic",
  "success",
  "heirloom",
  "legendary",
];

export const groupAccentKey = (groupId: number | undefined): AccentKey => {
  if (groupId === undefined) {
    return "primary";
  }
  return GROUP_ACCENTS[groupId] ?? FALLBACK_ACCENTS[groupId % FALLBACK_ACCENTS.length];
};

/* ------------------------------------------------------------------ */
/* Ramps                                                               */
/* ------------------------------------------------------------------ */

/** `from` blended toward `to` by `amount` (0–1), channel by channel. */
const mix = (from: string, to: string, amount: number): string => {
  const left = decomposeColor(from).values;
  const right = decomposeColor(to).values;
  const values = [0, 1, 2].map((channel) =>
    Math.round(left[channel] + (right[channel] - left[channel]) * amount),
  ) as [number, number, number];
  return recomposeColor({ type: "rgb", values });
};

/** The colour at `position` (0–1) along evenly spaced `stops`. */
const along = (stops: readonly string[], position: number): string => {
  if (stops.length === 1) {
    return stops[0];
  }
  const clamped = Math.min(1, Math.max(0, position));
  const scaled = clamped * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(scaled));
  return mix(stops[index], stops[index + 1], scaled - index);
};

/** `count` colours spread evenly along `stops` (the last one is the top). */
const spread = (stops: readonly string[], count: number): string[] =>
  Array.from({ length: count }, (_, index) =>
    along(stops, count === 1 ? 1 : index / (count - 1)),
  );

/** Hated, Hostile, Unfriendly, Neutral, Friendly, Honored, Revered, Exalted. */
const standardColors = (theme: Theme): string[] => [
  theme.palette.error.dark,
  theme.palette.error.main,
  theme.palette.quality.legendary,
  theme.palette.secondary.main,
  theme.palette.success.dark,
  theme.palette.success.main,
  theme.palette.success.light,
  theme.palette.quality.uncommon,
];

/** Neutral's yellow up to Exalted's green: friendship ladders start at zero. */
const friendlyStops = (theme: Theme): string[] => [
  theme.palette.secondary.main,
  theme.palette.success.dark,
  theme.palette.success.main,
  theme.palette.success.light,
  theme.palette.quality.uncommon,
];

const renownStops = (theme: Theme): string[] => [
  theme.palette.primary.dark,
  theme.palette.primary.main,
  theme.palette.primary.light,
  theme.palette.secondary.main,
];

/**
 * One colour per standing, lowest first. The standard ladder uses the
 * game's eight colours by position; any other ladder (or a standard one of
 * an unexpected length) spreads the friendly ramp over its ranks.
 */
export const ladderColors = (theme: Theme, ladder: StandingLadder): string[] => {
  const count = ladder.tiers.length;
  const standard = standardColors(theme);
  if (ladder.id === STANDARD_LADDER_ID && count === standard.length) {
    return standard;
  }
  return spread(friendlyStops(theme), count);
};

/** One colour per renown level, lowest first, gold at the top. */
export const renownColors = (theme: Theme, count: number): string[] =>
  spread(renownStops(theme), count);

/** The colour a ladder kind is badged with (chips, crests, legends). */
export const kindColor = (theme: Theme, kind: LadderKind): string => {
  switch (kind) {
    case "standard":
      return theme.palette.success.main;
    case "friendship":
      return theme.palette.secondary.main;
    case "renown":
      return theme.palette.primary.light;
    default:
      return theme.palette.text.secondary;
  }
};

/** Alliance blue, Horde red; anything else stays neutral. */
export const sideColor = (theme: Theme, sideType: string): string => {
  if (sideType === "ALLIANCE") {
    return theme.palette.primary.light;
  }
  if (sideType === "HORDE") {
    return theme.palette.error.light;
  }
  return theme.palette.text.secondary;
};
