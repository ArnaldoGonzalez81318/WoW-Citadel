import { Box } from "@mui/material";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FocusEvent, ReactNode } from "react";

import { GRID_PRESETS, useGridColumns } from "@/components/common/gridColumns";
import type { GridColumns, GridPresetKey } from "@/components/common/gridColumns";
import { getResultCardHeight } from "@/components/common/ResultCard";

export type VisibleRange = {
  /** Index of the first rendered item (inclusive). */
  start: number;
  /** Index after the last rendered item (exclusive). */
  end: number;
};

export type VirtualizedCardGridProps<T> = {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  getItemKey: (item: T, index: number) => string | number;
  /**
   * Fixed cell height in px; pass `getResultCardHeight(layout)` for
   * ResultCard grids. Defaults to the tile height until callers migrate.
   */
  itemHeight?: number;
  /** A preset key (`tiles` / `rows` / `compact`) or an explicit column map. */
  columns?: GridColumns | GridPresetKey;
  gap?: number;
  overscanRows?: number;
  /** Below this count every item is rendered (no window maths). */
  minItemsBeforeVirtualize?: number;
  onVisibleRangeChange?: (range: VisibleRange) => void;
  "aria-label"?: string;
  /** Rendered instead of the grid when `items` is empty. */
  emptyState?: ReactNode;
};

/** Set on every cell so focus tracking can read the item index off the DOM. */
const DATA_INDEX_ATTRIBUTE = "data-grid-index";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const sameRange = (a: VisibleRange, b: VisibleRange): boolean =>
  a.start === b.start && a.end === b.end;

const clampRange = (range: VisibleRange, length: number): VisibleRange => {
  const end = clamp(range.end, 0, length);
  const start = clamp(range.start, 0, end);
  return start === range.start && end === range.end ? range : { start, end };
};

/**
 * Number of items that fit the viewport plus overscan, used before the
 * first measurement so the initial commit already paints cards.
 */
const estimateInitialRange = (
  length: number,
  columns: number,
  rowStride: number,
  overscanRows: number,
): VisibleRange => {
  const viewportHeight =
    typeof window !== "undefined" ? window.innerHeight : 0;
  const rows = Math.ceil(viewportHeight / rowStride) + overscanRows + 1;
  return { start: 0, end: Math.min(length, columns * rows) };
};

/**
 * Window-scrolled virtual grid with fixed-height cells. Renders a contiguous
 * block of rows around the viewport with spacer elements above and below,
 * exposes list semantics and keeps the focused card mounted.
 */
const VirtualizedCardGrid = <T,>({
  items,
  renderItem,
  getItemKey,
  itemHeight = getResultCardHeight("tile"),
  columns: columnsProp = GRID_PRESETS.tiles,
  gap = 16,
  overscanRows = 2,
  minItemsBeforeVirtualize = 40,
  onVisibleRangeChange,
  "aria-label": ariaLabel,
  emptyState,
}: VirtualizedCardGridProps<T>): JSX.Element | null => {
  const columns = useGridColumns(columnsProp);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const focusedIndexRef = useRef<number | null>(null);
  const callbackRef = useRef(onVisibleRangeChange);
  callbackRef.current = onVisibleRangeChange;

  const length = items.length;
  const rowStride = itemHeight + gap;
  const totalRows = Math.ceil(length / columns);
  const shouldVirtualize = length >= minItemsBeforeVirtualize;

  const [virtualRange, setVirtualRange] = useState<VisibleRange>(() =>
    estimateInitialRange(length, columns, rowStride, overscanRows),
  );

  const fullRange = useMemo<VisibleRange>(
    () => ({ start: 0, end: length }),
    [length],
  );

  const visibleRange = shouldVirtualize
    ? clampRange(virtualRange, length)
    : fullRange;
  const { start, end } = visibleRange;

  const updateVisibleRange = useCallback((): void => {
    const node = containerRef.current;
    if (!node || totalRows === 0) {
      return;
    }

    const { top } = node.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const lastRowIndex = Math.max(0, totalRows - 1);

    // Rows are `rowStride` apart from the container's top edge.
    let firstRow = clamp(
      Math.floor(-top / rowStride) - overscanRows,
      0,
      lastRowIndex,
    );
    // Exclusive end row.
    let endRow = clamp(
      Math.ceil((viewportHeight - top) / rowStride) + overscanRows,
      firstRow + 1,
      totalRows,
    );

    // Keep a focused card mounted while it is one row outside the window;
    // the block stays contiguous so the spacer maths holds.
    const focused = focusedIndexRef.current;
    if (focused !== null && focused < length) {
      const focusedRow = Math.floor(focused / columns);
      if (focusedRow === firstRow - 1) {
        firstRow -= 1;
      } else if (focusedRow === endRow) {
        endRow += 1;
      }
    }

    const next: VisibleRange = {
      start: firstRow * columns,
      end: Math.min(length, endRow * columns),
    };

    setVirtualRange((prev) => (sameRange(prev, next) ? prev : next));
  }, [columns, length, overscanRows, rowStride, totalRows]);

  useLayoutEffect(() => {
    if (!shouldVirtualize) {
      return undefined;
    }

    let frameId = 0;

    const scheduleUpdate = (): void => {
      if (frameId) {
        return;
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        updateVisibleRange();
      });
    };

    // Synchronous first measurement: no blank frame on mount or layout change.
    updateVisibleRange();

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    // Content above the grid changing height (filters, banners, images)
    // moves the grid without a scroll event; the document and the container
    // resize instead.
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(scheduleUpdate)
        : null;
    observer?.observe(document.documentElement);
    const node = containerRef.current;
    if (node) {
      observer?.observe(node);
    }

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      observer?.disconnect();
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [shouldVirtualize, updateVisibleRange]);

  // A focused card that scrolled out of the window was unmounted, dropping
  // focus to <body>; park it on the container so Tab continues from the grid.
  useLayoutEffect(() => {
    const focused = focusedIndexRef.current;
    if (focused === null || !shouldVirtualize) {
      return;
    }
    if (
      (focused < start || focused >= end) &&
      document.activeElement === document.body
    ) {
      focusedIndexRef.current = null;
      containerRef.current?.focus({ preventScroll: true });
    }
  }, [start, end, shouldVirtualize]);

  useEffect(() => {
    callbackRef.current?.({ start, end });
  }, [start, end]);

  const handleFocus = useCallback((event: FocusEvent<HTMLDivElement>): void => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>(
      `[${DATA_INDEX_ATTRIBUTE}]`,
    );
    const value = cell?.getAttribute(DATA_INDEX_ATTRIBUTE);
    focusedIndexRef.current = value === null || value === undefined
      ? null
      : Number(value);
  }, []);

  const handleBlur = useCallback((event: FocusEvent<HTMLDivElement>): void => {
    const next = event.relatedTarget as Node | null;
    if (!next || !event.currentTarget.contains(next)) {
      focusedIndexRef.current = null;
    }
  }, []);

  if (length === 0) {
    return emptyState === undefined || emptyState === null ? null : (
      <>{emptyState}</>
    );
  }

  const visibleItems = items.slice(start, end);
  const startRow = Math.floor(start / columns);
  const renderedRows = Math.ceil(visibleItems.length / columns);
  const totalContentHeight =
    totalRows * itemHeight + Math.max(0, totalRows - 1) * gap;
  const renderedHeight =
    renderedRows * itemHeight + Math.max(0, renderedRows - 1) * gap;
  const topSpacerHeight = shouldVirtualize
    ? Math.min(startRow * rowStride, Math.max(0, totalContentHeight - renderedHeight))
    : 0;
  const bottomSpacerHeight = shouldVirtualize
    ? Math.max(0, totalContentHeight - topSpacerHeight - renderedHeight)
    : 0;

  return (
    <Box
      ref={containerRef}
      tabIndex={-1}
      onFocus={handleFocus}
      onBlur={handleBlur}
      sx={{ outline: "none", minWidth: 0, width: "100%" }}
    >
      {topSpacerHeight > 0 ? (
        <Box aria-hidden="true" sx={{ height: topSpacerHeight }} />
      ) : null}
      <Box
        role="list"
        aria-label={ariaLabel}
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: `${gap}px`,
        }}
      >
        {visibleItems.map((item, offset) => {
          const actualIndex = start + offset;
          return (
            <Box
              key={getItemKey(item, actualIndex)}
              role="listitem"
              aria-setsize={length}
              aria-posinset={actualIndex + 1}
              data-grid-index={actualIndex}
              sx={{
                height: itemHeight,
                minWidth: 0,
                display: "flex",
                alignItems: "stretch",
              }}
            >
              {renderItem(item, actualIndex)}
            </Box>
          );
        })}
      </Box>
      {bottomSpacerHeight > 0 ? (
        <Box aria-hidden="true" sx={{ height: bottomSpacerHeight }} />
      ) : null}
    </Box>
  );
};

export default VirtualizedCardGrid;
