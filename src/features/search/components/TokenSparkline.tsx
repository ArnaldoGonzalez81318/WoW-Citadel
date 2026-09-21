import { Box, alpha, useTheme } from "@mui/material";
import { useMemo } from "react";

import type { TokenHistoryPoint } from "@/features/search/hooks/useWowTokenHistory";
import { COPPER_PER_GOLD, formatNumber } from "@/lib/format";

export interface TokenSparklineProps {
  /** Oldest first. Needs at least two points to draw a line. */
  points: TokenHistoryPoint[];
  height?: number;
}

const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 32;
/** Keeps the stroke off the top/bottom edges of the viewBox. */
const Y_PADDING = 2;

const toGold = (copper: number): string =>
  formatNumber(Math.floor(copper / COPPER_PER_GOLD));

const toCoordinates = (
  points: TokenHistoryPoint[],
): Array<{ x: number; y: number }> => {
  if (points.length === 0) {
    return [];
  }
  const prices = points.map((point) => point.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min;
  const usable = VIEW_HEIGHT - Y_PADDING * 2;
  const step = points.length > 1 ? VIEW_WIDTH / (points.length - 1) : 0;

  return points.map((point, index) => {
    const ratio = range > 0 ? (point.price - min) / range : 0.5;
    return {
      x: points.length > 1 ? index * step : VIEW_WIDTH / 2,
      y: Y_PADDING + (1 - ratio) * usable,
    };
  });
};

/**
 * Inline SVG price trend: a gold line over a faint gold area. Colours come
 * from the theme; the SVG stretches to its container and keeps a 1.5px line.
 */
const TokenSparkline = ({
  points,
  height = 64,
}: TokenSparklineProps): JSX.Element => {
  const theme = useTheme();
  const coordinates = useMemo(() => toCoordinates(points), [points]);

  const linePoints = coordinates
    .map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const areaPath =
    coordinates.length > 1
      ? `M${coordinates[0].x.toFixed(2)},${VIEW_HEIGHT} L${coordinates
          .map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`)
          .join(" L")} L${coordinates[coordinates.length - 1].x.toFixed(2)},${VIEW_HEIGHT} Z`
      : "";

  const first = points[0]?.price;
  const last = points[points.length - 1]?.price;
  const label =
    typeof first === "number" && typeof last === "number"
      ? `Token price ${toGold(first)} to ${toGold(last)} gold across ${formatNumber(points.length)} samples`
      : "Token price history";

  return (
    <Box
      component="svg"
      role="img"
      aria-label={label}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="none"
      sx={{ display: "block", width: "100%", height, overflow: "visible" }}
    >
      {areaPath ? (
        <path d={areaPath} fill={alpha(theme.palette.secondary.main, 0.12)} />
      ) : null}
      {linePoints ? (
        <polyline
          points={linePoints}
          fill="none"
          stroke={theme.palette.secondary.main}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </Box>
  );
};

export default TokenSparkline;
