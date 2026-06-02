import { Box, useMediaQuery, useTheme } from "@mui/material";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

type VirtualizedCardGridColumns = {
  xs: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
};

type VirtualizedCardGridProps<T> = {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  getItemKey: (item: T, index: number) => string | number;
  itemHeight?: number;
  gap?: number;
  overscanRows?: number;
  minItemsBeforeVirtualize?: number;
  columns?: VirtualizedCardGridColumns;
  onVisibleRangeChange?: (range: VisibleRange) => void;
};

type VisibleRange = {
  start: number;
  end: number;
};

const VirtualizedCardGrid = <T,>({
  items,
  renderItem,
  getItemKey,
  itemHeight = 430,
  gap = 24,
  overscanRows = 2,
  minItemsBeforeVirtualize = 30,
  columns: columnConfig,
  onVisibleRangeChange,
}: VirtualizedCardGridProps<T>): JSX.Element => {
  const theme = useTheme();
  const smUp = useMediaQuery(theme.breakpoints.up("sm"));
  const mdUp = useMediaQuery(theme.breakpoints.up("md"));
  const lgUp = useMediaQuery(theme.breakpoints.up("lg"));
  const xlUp = useMediaQuery(theme.breakpoints.up("xl"));
  const resolvedColumns = useMemo<VirtualizedCardGridColumns>(
    () => ({
      xs: 1,
      sm: 1,
      md: 2,
      lg: 3,
      xl: 3,
      ...columnConfig,
    }),
    [columnConfig],
  );
  const columns = xlUp
    ? (resolvedColumns.xl ??
      resolvedColumns.lg ??
      resolvedColumns.md ??
      resolvedColumns.sm ??
      resolvedColumns.xs)
    : lgUp
      ? (resolvedColumns.lg ??
        resolvedColumns.md ??
        resolvedColumns.sm ??
        resolvedColumns.xs)
      : mdUp
        ? (resolvedColumns.md ?? resolvedColumns.sm ?? resolvedColumns.xs)
        : smUp
          ? (resolvedColumns.sm ?? resolvedColumns.xs)
          : resolvedColumns.xs;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [visibleRange, setVisibleRange] = useState<VisibleRange>({
    start: 0,
    end: 0,
  });

  const totalRows = Math.ceil(items.length / columns);
  const shouldVirtualize = items.length >= minItemsBeforeVirtualize;

  useEffect(() => {
    if (!shouldVirtualize) {
      setVisibleRange({ start: 0, end: items.length });
      return;
    }

    let frameId = 0;

    const updateVisibleRange = () => {
      frameId = 0;

      const node = containerRef.current;
      if (!node) {
        return;
      }

      const rect = node.getBoundingClientRect();
      const containerTop = window.scrollY + rect.top;
      const viewportTop = window.scrollY;
      const viewportBottom = viewportTop + window.innerHeight;
      const rowStride = itemHeight + gap;
      const firstVisibleRow = Math.min(
        totalRows,
        Math.max(
          0,
          Math.floor((viewportTop - containerTop) / rowStride) - overscanRows,
        ),
      );
      const lastVisibleRow = Math.max(
        firstVisibleRow,
        Math.min(
          totalRows,
          Math.ceil((viewportBottom - containerTop) / rowStride) + overscanRows,
        ),
      );

      setVisibleRange({
        start: firstVisibleRow * columns,
        end: Math.min(items.length, lastVisibleRow * columns),
      });
    };

    const scheduleUpdate = () => {
      if (frameId) {
        return;
      }

      frameId = window.requestAnimationFrame(updateVisibleRange);
    };

    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [
    columns,
    gap,
    itemHeight,
    items.length,
    overscanRows,
    shouldVirtualize,
    totalRows,
  ]);

  const visibleItems = shouldVirtualize
    ? items.slice(visibleRange.start, visibleRange.end)
    : items;

  useEffect(() => {
    onVisibleRangeChange?.(
      shouldVirtualize ? visibleRange : { start: 0, end: items.length },
    );
  }, [items.length, onVisibleRangeChange, shouldVirtualize, visibleRange]);

  const startRow = shouldVirtualize
    ? Math.floor(visibleRange.start / columns)
    : 0;
  const renderedRows = Math.ceil(visibleItems.length / columns);
  const totalContentHeight =
    totalRows * itemHeight + Math.max(0, totalRows - 1) * gap;
  const renderedHeight =
    renderedRows * itemHeight + Math.max(0, renderedRows - 1) * gap;
  const topSpacerHeight = shouldVirtualize
    ? Math.min(
        startRow * (itemHeight + gap),
        Math.max(0, totalContentHeight - renderedHeight),
      )
    : 0;
  const bottomSpacerHeight = shouldVirtualize
    ? Math.max(0, totalContentHeight - topSpacerHeight - renderedHeight)
    : 0;

  const gridTemplateColumns = useMemo(
    () => `repeat(${columns}, minmax(0, 1fr))`,
    [columns],
  );

  return (
    <Box ref={containerRef}>
      {topSpacerHeight > 0 ? <Box sx={{ height: topSpacerHeight }} /> : null}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns,
          gap: `${gap}px`,
        }}
      >
        {visibleItems.map((item, index) => {
          const actualIndex = shouldVirtualize
            ? visibleRange.start + index
            : index;

          return (
            <Box
              key={getItemKey(item, actualIndex)}
              sx={{ height: itemHeight, overflow: "hidden" }}
            >
              {renderItem(item, actualIndex)}
            </Box>
          );
        })}
      </Box>
      {bottomSpacerHeight > 0 ? (
        <Box sx={{ height: bottomSpacerHeight }} />
      ) : null}
    </Box>
  );
};

export default VirtualizedCardGrid;
