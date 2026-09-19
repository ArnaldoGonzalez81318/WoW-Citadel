import { alpha } from "@mui/material/styles";
import type { PaletteOptions } from "@mui/material/styles";

/**
 * Design tokens for the "Arcane Ledger" direction.
 *
 * This is the only file in the app allowed to spell out raw colour values;
 * everything else reads `theme.palette.*` / `theme.wc.*` or derives a tint
 * with `alpha()`.
 */

export const QUALITY_KEYS = [
  "poor",
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "artifact",
  "heirloom",
] as const;

export type QualityKey = (typeof QUALITY_KEYS)[number];

export const isQualityKey = (value: unknown): value is QualityKey =>
  typeof value === "string" &&
  (QUALITY_KEYS as readonly string[]).includes(value);

export type SurfaceTokens = {
  base: string;
  sunken: string;
  raised: string;
  overlay: string;
  popover: string;
  inset: string;
};

export type BorderTokens = {
  subtle: string;
  default: string;
  strong: string;
  gold: string;
};

export type GlowTokens = {
  primary: string;
  gold: string;
  card: string;
  popover: string;
};

export type QualityTokens = Record<QualityKey, string>;

export type WcRadius = {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  pill: number;
};

export type WcMotion = {
  fast: number;
  base: number;
  slow: number;
  easing: string;
};

export type WcResponsiveValue = {
  xs: number;
  md: number;
};

export type WcLayout = {
  headerHeight: WcResponsiveValue;
  gutter: WcResponsiveValue;
  sectionGap: WcResponsiveValue;
  touchTarget: number;
  iconTile: number;
};

export type WcColumnPreset = {
  xs: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
};

export type WcColumns = {
  tiles: WcColumnPreset;
  rows: WcColumnPreset;
  compact: WcColumnPreset;
};

export type WcTokens = {
  radius: WcRadius;
  motion: WcMotion;
  layout: WcLayout;
  columns: WcColumns;
  fontMono: string;
};

declare module "@mui/material/styles" {
  interface Palette {
    surface: SurfaceTokens;
    border: BorderTokens;
    glow: GlowTokens;
    quality: QualityTokens;
  }

  interface PaletteOptions {
    surface?: Partial<SurfaceTokens>;
    border?: Partial<BorderTokens>;
    glow?: Partial<GlowTokens>;
    quality?: Partial<QualityTokens>;
  }

  interface Theme {
    wc: WcTokens;
  }

  interface ThemeOptions {
    wc?: WcTokens;
  }
}

/* Brand hues (the only two) */
export const PRIMARY = "#1e9be9";
export const GOLD = "#f5c045";

/* Channels every tint is derived from */
export const BLUE_GREY = "#5e92cd"; // rgb(94, 146, 205): borders, divider, hover
export const SHADOW_INK = "#020610"; // rgb(2, 6, 16): shadows and backdrops
export const WHITE = "#ffffff";

const surface: SurfaceTokens = {
  base: "#040813",
  sunken: "#070c18",
  raised: "#0b1220",
  overlay: "#111a2e",
  popover: "#162139",
  inset: alpha(WHITE, 0.04),
};

const border: BorderTokens = {
  subtle: alpha(BLUE_GREY, 0.12),
  default: alpha(BLUE_GREY, 0.2),
  strong: alpha(BLUE_GREY, 0.36),
  gold: alpha(GOLD, 0.32),
};

const glow: GlowTokens = {
  primary: `0 0 0 4px ${alpha(PRIMARY, 0.22)}`,
  gold: `0 0 0 4px ${alpha(GOLD, 0.22)}`,
  card: `0 12px 32px ${alpha(SHADOW_INK, 0.45)}`,
  popover: `0 16px 40px ${alpha(SHADOW_INK, 0.6)}`,
};

/* WoW item quality colours, tuned for dark surfaces */
const quality: QualityTokens = {
  poor: "#9d9d9d",
  common: "#f2f5ff",
  uncommon: "#1eff00",
  rare: "#4da3ff",
  epic: "#c07dff",
  legendary: "#ff8a1f",
  artifact: "#e6cc80",
  heirloom: "#33d1ff",
};

export const palette: PaletteOptions = {
  mode: "dark",
  primary: {
    main: PRIMARY,
    light: "#5cbcff",
    dark: "#0f6fb0",
    contrastText: "#04101c",
  },
  secondary: {
    main: GOLD,
    light: "#ffd76b",
    dark: "#c9951f",
    contrastText: "#1c1300",
  },
  error: {
    main: "#f0625d",
    light: "#ff8c85",
    dark: "#b8403b",
  },
  warning: {
    main: "#f5a524",
    light: "#ffc35c",
    dark: "#b77812",
  },
  info: {
    main: "#5cbcff",
    light: "#8ed1ff",
    dark: "#2b8ad1",
  },
  success: {
    main: "#3ecf8e",
    light: "#6fe3ad",
    dark: "#22995f",
  },
  background: {
    default: surface.base,
    paper: surface.raised,
  },
  text: {
    primary: "#f2f5ff",
    secondary: "#a7b1cf",
    disabled: "#6b7592",
  },
  divider: alpha(BLUE_GREY, 0.16),
  action: {
    hover: alpha(BLUE_GREY, 0.08),
    selected: alpha(PRIMARY, 0.16),
    focus: alpha(PRIMARY, 0.24),
    disabledBackground: alpha(WHITE, 0.06),
  },
  surface,
  border,
  glow,
  quality,
};

export const wc: WcTokens = {
  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    pill: 999,
  },
  motion: {
    fast: 120,
    base: 180,
    slow: 260,
    easing: "cubic-bezier(0.2, 0, 0, 1)",
  },
  layout: {
    headerHeight: { xs: 56, md: 64 },
    gutter: { xs: 2, md: 3 },
    sectionGap: { xs: 4, md: 5 },
    touchTarget: 44,
    iconTile: 56,
  },
  columns: {
    tiles: { xs: 1, sm: 2, md: 3, lg: 4, xl: 5 },
    rows: { xs: 1, md: 2, xl: 3 },
    compact: { xs: 2, sm: 3, md: 4, lg: 6, xl: 8 },
  },
  fontMono: "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
};

export const transitions = {
  duration: {
    shortest: wc.motion.fast,
    shorter: 150,
    short: wc.motion.base,
    standard: wc.motion.base,
    complex: wc.motion.slow,
    enteringScreen: wc.motion.base,
    leavingScreen: wc.motion.fast,
  },
  easing: {
    easeInOut: wc.motion.easing,
    easeOut: wc.motion.easing,
    easeIn: wc.motion.easing,
    sharp: wc.motion.easing,
  },
};

export const shape = {
  borderRadius: wc.radius.md,
};

export const tokens = {
  palette,
  wc,
  transitions,
  shape,
  quality,
  surface,
  border,
  glow,
} as const;

export type Tokens = typeof tokens;
