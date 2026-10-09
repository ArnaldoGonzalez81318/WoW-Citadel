import { Box } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";

export type CountBarProps = {
  value: number;
  /** The largest value in the set the bar is compared against. */
  max: number;
  color: (theme: Theme) => string;
  height?: number;
};

/**
 * A thin horizontal bar, `value` against `max`. Decorative: the number it
 * draws is always written beside it.
 */
const CountBar = ({ value, max, color, height = 4 }: CountBarProps): JSX.Element => {
  const share = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={(theme) => ({
        display: "block",
        height,
        borderRadius: `${theme.wc.radius.pill}px`,
        backgroundColor: alpha(theme.palette.common.white, 0.06),
        overflow: "hidden",
      })}
    >
      <Box
        component="span"
        sx={(theme) => ({
          display: "block",
          height: "100%",
          // A sliver for small values, so a one never reads as a zero.
          width: value > 0 ? `max(${Math.round(share * 100)}%, 4px)` : 0,
          borderRadius: "inherit",
          backgroundColor: alpha(color(theme), 0.85),
        })}
      />
    </Box>
  );
};

export default CountBar;
