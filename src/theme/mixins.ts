import type { Theme } from "@mui/material/styles";

import { isQualityKey } from "./tokens";
import type { SurfaceTokens } from "./tokens";

/**
 * Small style helpers shared by every component. They return plain style
 * objects so they can be spread into `sx`, `styled()` or theme overrides.
 */

export type FocusRingStyles = {
  outline: string;
  outlineOffset: number;
};

export const focusRing = (theme: Theme, inset = false): FocusRingStyles => ({
  outline: `2px solid ${theme.palette.primary.light}`,
  outlineOffset: inset ? -2 : 2,
});

export type LineClampStyles = {
  display: "-webkit-box";
  WebkitLineClamp: number;
  WebkitBoxOrient: "vertical";
  overflow: "hidden";
  wordBreak: "break-word";
};

export const lineClamp = (lines: number): LineClampStyles => ({
  display: "-webkit-box",
  WebkitLineClamp: Math.max(1, Math.floor(lines)),
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  wordBreak: "break-word",
});

export type TruncateStyles = {
  overflow: "hidden";
  textOverflow: "ellipsis";
  whiteSpace: "nowrap";
};

export const truncate: TruncateStyles = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export type SurfaceLevel = keyof SurfaceTokens;

export type SurfaceStyles = {
  backgroundColor: string;
  border: string;
};

const SUBTLE_BORDER_LEVELS: ReadonlySet<SurfaceLevel> = new Set<SurfaceLevel>([
  "base",
  "sunken",
  "inset",
]);

/**
 * Opaque surface at the given level with the matching 1px border:
 * raised / overlay / popover use `border.default`, the recessed levels
 * (base / sunken / inset) use `border.subtle`.
 */
export const surface = (
  theme: Theme,
  level: SurfaceLevel = "raised",
): SurfaceStyles => ({
  backgroundColor: theme.palette.surface[level],
  border: `1px solid ${
    SUBTLE_BORDER_LEVELS.has(level)
      ? theme.palette.border.subtle
      : theme.palette.border.default
  }`,
});

export type VisuallyHiddenStyles = {
  border: 0;
  clip: string;
  clipPath: string;
  height: string;
  margin: string;
  overflow: "hidden";
  padding: 0;
  position: "absolute";
  whiteSpace: "nowrap";
  width: string;
};

/** Standard clip pattern: removed from layout but still read by assistive tech. */
export const visuallyHidden: VisuallyHiddenStyles = {
  border: 0,
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: "1px",
  margin: "-1px",
  overflow: "hidden",
  padding: 0,
  position: "absolute",
  whiteSpace: "nowrap",
  width: "1px",
};

/** Item-quality colour for a WoW quality key; `text.primary` when unknown. */
export const qualityColor = (
  theme: Theme,
  quality?: string | null,
): string => {
  const key = typeof quality === "string" ? quality.toLowerCase() : quality;
  return isQualityKey(key)
    ? theme.palette.quality[key]
    : theme.palette.text.primary;
};

export const mixins = {
  focusRing,
  lineClamp,
  truncate,
  surface,
  visuallyHidden,
} as const;

export type Mixins = typeof mixins;
