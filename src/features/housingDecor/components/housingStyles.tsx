import CastleRoundedIcon from "@mui/icons-material/CastleRounded";
import DoorFrontRoundedIcon from "@mui/icons-material/DoorFrontRounded";
import FireplaceRoundedIcon from "@mui/icons-material/FireplaceRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import HouseSidingRoundedIcon from "@mui/icons-material/HouseSidingRounded";
import RoofingRoundedIcon from "@mui/icons-material/RoofingRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import WindowRoundedIcon from "@mui/icons-material/WindowRounded";
import type { Theme } from "@mui/material/styles";
import type { ReactElement } from "react";

import type { FixtureKind } from "@/features/housingDecor/types";
import type { QualityKey } from "@/theme";

/** Above the app header when a section scrolls its top into view. */
export const scrollMarginSx = (theme: Theme) => ({
  scrollMarginTop: {
    xs: `${theme.wc.layout.headerHeight.xs + 16}px`,
    md: `${theme.wc.layout.headerHeight.md + 16}px`,
  },
});

/** Smooth unless the visitor asked for reduced motion. */
export const scrollToTop = (node: Element | null): void => {
  let reduced = false;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    // No matchMedia: the default (smooth) is fine.
  }
  node?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
};

type PaletteKey = "primary" | "secondary" | "success" | "warning" | "error" | "info";
type AccentKey = PaletteKey | QualityKey;

const PALETTE_KEYS: ReadonlySet<string> = new Set([
  "primary",
  "secondary",
  "success",
  "warning",
  "error",
  "info",
]);

/** A theme colour by palette or quality key (the theme is the only place with raw values). */
export const accentColor = (theme: Theme, key: AccentKey): string =>
  PALETTE_KEYS.has(key)
    ? theme.palette[key as PaletteKey].main
    : theme.palette.quality[key as QualityKey];

/**
 * Each fixture kind's accent and glyph. Blizzard publishes no fixture art,
 * so a kind's tile is the page's own; the colours only tell kinds apart.
 */
export const FIXTURE_KIND_STYLE: Readonly<
  Record<FixtureKind, { accent: AccentKey; icon: ReactElement }>
> = {
  base: { accent: "secondary", icon: <HouseSidingRoundedIcon /> },
  roof: { accent: "legendary", icon: <RoofingRoundedIcon /> },
  dormer: { accent: "artifact", icon: <RoofingRoundedIcon /> },
  window: { accent: "rare", icon: <WindowRoundedIcon /> },
  fortification: { accent: "info", icon: <ShieldRoundedIcon /> },
  door: { accent: "success", icon: <DoorFrontRoundedIcon /> },
  tower: { accent: "epic", icon: <CastleRoundedIcon /> },
  chimney: { accent: "warning", icon: <FireplaceRoundedIcon /> },
  unnamed: { accent: "poor", icon: <HelpOutlineRoundedIcon /> },
};

/** A monospace id ("#28350"), digits aligned. */
export const idTextSx = (theme: Theme) => ({
  fontFamily: theme.wc.fontMono,
  fontVariantNumeric: "tabular-nums",
});
