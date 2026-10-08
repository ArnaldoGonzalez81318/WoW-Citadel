import type { Theme } from "@mui/material/styles";

const MOTION_HOVER = "@media (hover: hover)";
const MOTION_HOVER_LIFT =
  "@media (hover: hover) and (prefers-reduced-motion: no-preference)";

/**
 * The outlined card every tile on the page uses: a stronger border and the
 * card glow on hover, a 2px lift only when motion is welcome, and the
 * primary ring (the dungeon and profession pickers' selected look) when
 * pressed.
 */
export const selectableCardSx =
  (selected = false) =>
  (theme: Theme) => ({
    position: "relative" as const,
    height: "100%",
    display: "flex",
    overflow: "hidden",
    borderColor: selected ? theme.palette.primary.main : undefined,
    boxShadow: selected ? `inset 0 0 0 1px ${theme.palette.primary.main}` : undefined,
    transition: theme.transitions.create(
      ["border-color", "box-shadow", "transform"],
      { duration: theme.wc.motion.base, easing: theme.wc.motion.easing },
    ),
    [MOTION_HOVER]: {
      "&:hover": {
        borderColor: selected
          ? theme.palette.primary.light
          : theme.palette.border.strong,
        boxShadow: selected
          ? `inset 0 0 0 1px ${theme.palette.primary.light}, ${theme.palette.glow.card}`
          : theme.palette.glow.card,
      },
    },
    [MOTION_HOVER_LIFT]: {
      "&:hover": { transform: "translateY(-2px)" },
    },
  });

/** The action area fills the card; MUI's grey focus wash is replaced by the theme's focus ring. */
export const cardActionAreaSx = {
  flex: 1,
  display: "flex",
  alignItems: "stretch",
  justifyContent: "flex-start",
  textAlign: "left",
  "& .MuiCardActionArea-focusHighlight": { display: "none" },
} as const;

/** Above the app header when a list scrolls its top into view. */
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
