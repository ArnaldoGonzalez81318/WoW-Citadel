import type { Theme } from "@mui/material/styles";

const MOTION_HOVER = "@media (hover: hover)";
const MOTION_HOVER_LIFT = "@media (hover: hover) and (prefers-reduced-motion: no-preference)";

/** The outlined card every grid here uses: a lift and glow on hover, none for reduced motion. */
export const cardSx = (minHeight: number) => (theme: Theme) => ({
  height: "100%",
  minHeight,
  display: "flex",
  overflow: "hidden",
  transition: theme.transitions.create(["border-color", "box-shadow", "transform"], {
    duration: theme.wc.motion.base,
    easing: theme.wc.motion.easing,
  }),
  [MOTION_HOVER]: {
    "&:hover": {
      borderColor: theme.palette.border.strong,
      boxShadow: theme.palette.glow.card,
    },
  },
  [MOTION_HOVER_LIFT]: {
    "&:hover": { transform: "translateY(-2px)" },
  },
});

/** The action area fills the card and lays its content out top to bottom. */
export const cardActionAreaSx = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  justifyContent: "flex-start",
  textAlign: "left",
  minWidth: 0,
  "& .MuiCardActionArea-focusHighlight": { display: "none" },
} as const;

/** Leaves the sticky app header clear when a section is scrolled to. */
export const scrollMarginSx = (theme: Theme) => ({
  scrollMarginTop: {
    xs: `${theme.wc.layout.headerHeight.xs + 16}px`,
    md: `${theme.wc.layout.headerHeight.md + 16}px`,
  },
});

/** A script focus target only, never a Tab stop: no ring needed. */
export const focusTargetSx = {
  m: 0,
  overflowWrap: "anywhere",
  "&:focus": { outline: "none" },
} as const;

/** Smooth unless the visitor asked for reduced motion. */
export const scrollToStart = (node: Element | null): void => {
  let reduced = false;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    // No matchMedia: the default (smooth) is fine.
  }
  node?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
};
