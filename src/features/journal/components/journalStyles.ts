import type { Theme } from "@mui/material/styles";

/** The outlined section every journal panel uses (SectionCard's look, with room for art). */
export const panelSx = (theme: Theme) => ({
  position: "relative" as const,
  overflow: "hidden",
  minWidth: 0,
  borderRadius: `${theme.wc.radius.lg}px`,
  borderColor: theme.palette.border.default,
});

/** Leaves the sticky app header clear when a panel is scrolled to. */
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

/**
 * Skeleton cells shaped like art cards: the art's aspect ratio of the
 * cell's width plus the card's text block, so the grid does not jump at any
 * breakpoint when the cards land. `artRatio` is height over width (0.5 for
 * the 2:1 zone tiles, 1 for the square creature renders).
 */
export const artCellSx = (artRatio: number, textHeight: number) => ({
  "& > .MuiSkeleton-root": { height: "auto" },
  "& > .MuiSkeleton-root::before": {
    content: '""',
    display: "block",
    paddingTop: `calc(${artRatio * 100}% + ${textHeight}px)`,
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
