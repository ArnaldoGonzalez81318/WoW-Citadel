import { useLayoutEffect, useState } from "react";

import { useGridColumns } from "@/components/common/gridColumns";
import type { GridColumns, GridPresetKey } from "@/components/common/gridColumns";
import { DEFAULT_MEDIA_HEIGHT } from "@/components/common/resultCardLayout";

export type TileMediaHeightOptions = {
  /** Grid gap in px; must match the grid's `gap`. */
  gap?: number;
  /** Artwork width divided by height; 16:9 by default. */
  aspectRatio?: number;
  /** Horizontal px a cell loses to the card's own borders (1px each side). */
  inset?: number;
  /** Height used until the container has been measured. */
  fallback?: number;
  /** Floor for very narrow cells, so a tile never collapses to a strip. */
  minHeight?: number;
};

export type TileMediaHeight = {
  /** Attach to the element whose width the grid fills. */
  ref: (node: HTMLElement | null) => void;
  /**
   * Artwork height that makes every tile's media box `aspectRatio` at the
   * current cell width. Pass it as ResultCard `mediaHeight` and derive the
   * grid's `itemHeight` from it with `getResultCardHeight("tile", mediaHeight)`.
   */
  mediaHeight: number;
};

const DEFAULT_ASPECT_RATIO = 16 / 9;
const DEFAULT_GAP = 16;
const DEFAULT_INSET = 2;
const DEFAULT_MIN_HEIGHT = 96;

/** Media height for one tile in a `columns`-wide grid filling `containerWidth`. */
export const tileMediaHeightFor = (
  containerWidth: number,
  columns: number,
  {
    gap = DEFAULT_GAP,
    aspectRatio = DEFAULT_ASPECT_RATIO,
    inset = DEFAULT_INSET,
    minHeight = DEFAULT_MIN_HEIGHT,
  }: Omit<TileMediaHeightOptions, "fallback"> = {},
): number => {
  const cellWidth = (containerWidth - gap * (columns - 1)) / columns;
  const mediaWidth = cellWidth - inset;
  return Math.max(minHeight, Math.round(mediaWidth / aspectRatio));
};

/**
 * Virtualised grids need one fixed cell height, so a tile's artwork cannot
 * be sized by `aspect-ratio` alone: this measures the grid's container,
 * divides it by the active column count and returns the artwork height that
 * keeps the media box at `aspectRatio`. The height is an integer (no
 * sub-pixel rows) and changes only when the container or breakpoint does.
 */
export const useTileMediaHeight = (
  columns: GridColumns | GridPresetKey,
  {
    gap = DEFAULT_GAP,
    aspectRatio = DEFAULT_ASPECT_RATIO,
    inset = DEFAULT_INSET,
    fallback = DEFAULT_MEDIA_HEIGHT,
    minHeight = DEFAULT_MIN_HEIGHT,
  }: TileMediaHeightOptions = {},
): TileMediaHeight => {
  const columnCount = useGridColumns(columns);
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    if (!node) {
      return undefined;
    }

    const measure = (): void => {
      const next = node.getBoundingClientRect().width;
      setWidth((previous) => (Math.abs(previous - next) < 0.5 ? previous : next));
    };

    // Synchronous first measurement: the first paint already has the right height.
    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  const mediaHeight =
    width > 0
      ? tileMediaHeightFor(width, columnCount, {
          gap,
          aspectRatio,
          inset,
          minHeight,
        })
      : fallback;

  return { ref: setNode, mediaHeight };
};

export default useTileMediaHeight;
