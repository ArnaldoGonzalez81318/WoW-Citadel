import { createTheme } from "@mui/material/styles";

import { components } from "./components";
import { mixins, qualityColor } from "./mixins";
import { QUALITY_KEYS, palette, shape, tokens, transitions, wc } from "./tokens";
import { typography, typographyBase } from "./typography";

/*
 * Module augmentation (Palette surface/border/glow/quality, Theme.wc) lives in
 * ./tokens and is pulled in by this import; importing "@/theme" anywhere is
 * enough to make `theme.palette.surface.*` and `theme.wc.*` type-check.
 */

/**
 * Step 1: resolve palette, shape, breakpoints, transitions, the font stack
 * and the `wc` tokens so the type scale and component overrides can read them.
 */
const base = createTheme({
  palette,
  shape,
  transitions,
  typography: typographyBase,
  wc,
});

/**
 * Step 2: layer the type scale and component overrides on top. Dark-only,
 * no CSS variables.
 */
const theme = createTheme(base, {
  typography: typography(base),
  components: components(base),
  wc,
});

export default theme;

export { tokens, mixins, qualityColor, QUALITY_KEYS };
export { isQualityKey } from "./tokens";
export {
  focusRing,
  lineClamp,
  surface,
  truncate,
  visuallyHidden,
} from "./mixins";

export type {
  BorderTokens,
  GlowTokens,
  QualityKey,
  QualityTokens,
  SurfaceTokens,
  Tokens,
  WcColumnPreset,
  WcColumns,
  WcLayout,
  WcMotion,
  WcRadius,
  WcTokens,
} from "./tokens";
export type {
  FocusRingStyles,
  LineClampStyles,
  Mixins,
  SurfaceLevel,
  SurfaceStyles,
  TruncateStyles,
  VisuallyHiddenStyles,
} from "./mixins";
