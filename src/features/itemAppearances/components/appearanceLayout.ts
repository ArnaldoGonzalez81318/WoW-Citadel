import type { Theme } from "@mui/material/styles";

import type { GridColumns } from "@/components/common/gridColumns";

/** Set and appearance cards: one column on phones, up to four on wide screens. */
export const CARD_COLS: GridColumns = { xs: 1, sm: 2, md: 3, lg: 4 };
export const CARD_GAP_PX = 12;
/**
 * Every card is this tall (the 56px icon, two lines of name and two caption
 * lines), so a row never jumps as records land and the loading grid matches.
 */
export const CARD_HEIGHT = 112;

/** Ids in the URL are positive integers; anything else is ignored. */
export const parseId = (value: string): number | null => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

/** Clears the sticky app header when a section is scrolled to. */
export const scrollMarginSx = (theme: Theme) => ({
  scrollMarginTop: {
    xs: `${theme.wc.layout.headerHeight.xs + 16}px`,
    md: `${theme.wc.layout.headerHeight.md + 16}px`,
  },
});
