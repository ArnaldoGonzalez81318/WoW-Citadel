/**
 * Layout maths for `ResultCard`, kept in a value-only module so the card
 * component file exports nothing but components (Fast Refresh boundary).
 * Grids and skeletons import `getResultCardHeight` from here.
 */

export type ResultCardLayout = "auto" | "row" | "compact" | "tile";

export type ResolvedResultCardLayout = Exclude<ResultCardLayout, "auto">;

export const RESULT_CARD_HEIGHTS = {
  row: 96,
  compact: 124,
  tileBase: 128,
} as const;

export const DEFAULT_MEDIA_HEIGHT = 160;

/**
 * Fixed height of a card for a layout, for grid cells and skeletons.
 * `auto` is measured as a tile (the tallest possibility).
 */
export const getResultCardHeight = (
  layout: ResultCardLayout,
  mediaHeight: number = DEFAULT_MEDIA_HEIGHT,
): number => {
  if (layout === "row") {
    return RESULT_CARD_HEIGHTS.row;
  }
  if (layout === "compact") {
    return RESULT_CARD_HEIGHTS.compact;
  }
  return mediaHeight + RESULT_CARD_HEIGHTS.tileBase;
};

const SMALL_ICON_PATTERN = /\/icons\/56\//;

/** `auto` → row for 56px icons or no media, tile for artwork. */
export const resolveResultCardLayout = (
  layout: ResultCardLayout,
  result: { mediaUrl?: string | null },
): ResolvedResultCardLayout => {
  if (layout !== "auto") {
    return layout;
  }
  if (!result.mediaUrl || SMALL_ICON_PATTERN.test(result.mediaUrl)) {
    return "row";
  }
  return "tile";
};
