import type { Theme } from "@mui/material/styles";

/** Leaves the sticky app header clear when a section is scrolled to. */
export const scrollMarginSx = (theme: Theme) => ({
  scrollMarginTop: {
    xs: `${theme.wc.layout.headerHeight.xs + 16}px`,
    md: `${theme.wc.layout.headerHeight.md + 16}px`,
  },
});
