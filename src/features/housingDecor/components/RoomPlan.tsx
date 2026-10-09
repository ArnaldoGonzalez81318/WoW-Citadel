import { Box } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { SxProps, Theme } from "@mui/material/styles";
import { useId } from "react";

import type { Room, RoomSize } from "@/features/housingDecor/types";

/**
 * Relative scale per size word: a Large square fills the frame, a Tiny one
 * is half as wide. Blizzard publishes no dimensions, so only the order of
 * sizes is real.
 */
const SIZE_SCALE: Readonly<Record<RoomSize, number>> = {
  tiny: 0.46,
  small: 0.62,
  medium: 0.78,
  large: 0.94,
};

const octagonPoints = (radius: number): string =>
  Array.from({ length: 8 }, (_, index) => {
    const angle = ((22.5 + index * 45) * Math.PI) / 180;
    return `${(50 + radius * Math.cos(angle)).toFixed(2)},${(50 + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");

/** Stair treads across a run, from `top` to `bottom`. */
const treads = (x1: number, x2: number, top: number, bottom: number, step = 8): string =>
  Array.from({ length: Math.floor((bottom - top) / step) + 1 }, (_, index) => {
    const y = top + index * step;
    return `M ${x1} ${y} L ${x2} ${y}`;
  }).join(" ");

export type RoomPlanProps = {
  room: Pick<Room, "name" | "shape" | "size" | "hand">;
  sx?: SxProps<Theme>;
};

/**
 * A room drawn as a floor plan on graph paper, from what its name says:
 * the shape, the size word (relative only) and a stairwell's hand. Themed
 * rooms, whose names hold none of the shape words drawn here, get a plain
 * room with their initial. Decorative: the name is always beside it.
 */
const RoomPlan = ({ room, sx }: RoomPlanProps): JSX.Element => {
  const theme = useTheme();
  const gridId = `room-grid-${useId().replace(/:/g, "")}`;
  const themed = room.shape === "themed";
  const accent = themed ? theme.palette.secondary.main : theme.palette.primary.main;
  const stroke = themed ? theme.palette.secondary.light : theme.palette.primary.light;
  const fill = alpha(accent, 0.16);
  const wall = { fill, stroke, strokeWidth: 2, strokeLinejoin: "round" as const };
  const line = { fill: "none", stroke, strokeWidth: 1.25, strokeLinecap: "round" as const };
  const scale = room.size ? SIZE_SCALE[room.size] : 0.8;

  const renderShape = (): JSX.Element => {
    switch (room.shape) {
      case "square": {
        const side = 84 * scale;
        return <rect x={50 - side / 2} y={50 - side / 2} width={side} height={side} rx={1.5} {...wall} />;
      }
      case "octagon":
        return <polygon points={octagonPoints(46 * scale)} {...wall} />;
      case "circle":
        return <circle cx={50} cy={50} r={46 * scale} {...wall} />;
      case "t-shaped":
        return <polygon points="10,16 90,16 90,44 63,44 63,86 37,86 37,44 10,44" {...wall} />;
      case "l-shaped":
        return <polygon points="16,14 46,14 46,56 86,56 86,86 16,86" {...wall} />;
      case "cross":
        return (
          <polygon
            points="37,12 63,12 63,37 88,37 88,63 63,63 63,88 37,88 37,63 12,63 12,37 37,37"
            {...wall}
          />
        );
      case "hallway":
        return <rect x={8} y={38} width={84} height={24} rx={1.5} {...wall} />;
      case "closet":
        return <rect x={33} y={33} width={34} height={34} rx={1.5} {...wall} />;
      case "entry":
        return (
          <g>
            <rect x={22} y={24} width={56} height={46} fill={fill} />
            {/* The walls stop either side of the doorway. */}
            <path d="M 42 70 L 22 70 L 22 24 L 78 24 L 78 70 L 58 70" {...wall} fill="none" />
            <path d="M 50 92 L 50 76 M 44 82 L 50 76 L 56 82" {...line} />
          </g>
        );
      case "stairwell": {
        if (room.hand === undefined) {
          // A room with a flight in its corner ("Stairwell Room").
          return (
            <g>
              <rect x={12} y={12} width={76} height={76} rx={1.5} {...wall} />
              <rect x={16} y={16} width={22} height={48} fill="none" stroke={stroke} strokeWidth={1} />
              <path d={treads(16, 38, 24, 56)} {...line} />
            </g>
          );
        }
        const railX = room.hand === "left" ? 34 : 66;
        return (
          <g>
            <rect x={28} y={8} width={44} height={84} rx={1.5} {...wall} />
            <path d={treads(28, 72, 16, 84)} {...line} />
            {/* The arrow climbs along the side the name gives. */}
            <path
              d={`M ${railX} 86 L ${railX} 14 M ${railX - 5} 20 L ${railX} 14 L ${railX + 5} 20`}
              {...line}
              strokeWidth={2}
            />
          </g>
        );
      }
      case "plot": {
        const side = 84 * scale;
        return (
          <g>
            <rect
              x={50 - side / 2}
              y={50 - side / 2}
              width={side}
              height={side}
              fill={fill}
              stroke={stroke}
              strokeWidth={2}
              strokeDasharray="5 4"
            />
            <path d="M 38 60 L 38 46 L 50 36 L 62 46 L 62 60 Z" {...line} strokeWidth={2} />
          </g>
        );
      }
      default:
        return (
          <g>
            <rect x={14} y={14} width={72} height={72} rx={1.5} {...wall} />
            <text
              x={50}
              y={52}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={stroke}
              fontSize={34}
              fontWeight={700}
              fontFamily={theme.typography.fontFamily}
            >
              {room.name.trim().charAt(0).toLocaleUpperCase() || "?"}
            </text>
          </g>
        );
    }
  };

  return (
    <Box
      component="svg"
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      sx={[{ display: "block", width: "100%", height: "100%" }, ...(Array.isArray(sx) ? sx : [sx])]}
    >
      <defs>
        <pattern id={gridId} width="10" height="10" patternUnits="userSpaceOnUse">
          <path
            d="M 10 0 L 0 0 0 10"
            fill="none"
            stroke={alpha(theme.palette.text.secondary, 0.12)}
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect width="100" height="100" fill={`url(#${gridId})`} />
      {renderShape()}
    </Box>
  );
};

export default RoomPlan;
