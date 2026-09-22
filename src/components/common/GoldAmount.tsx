import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ElementType } from "react";

import { formatCopper, formatNumber, splitCopper } from "@/lib/format";
import { toSxArray } from "@/lib/sx";
import { visuallyHidden } from "@/theme";

export type GoldAmountSize = "small" | "medium" | "large";

export type GoldAmountProps = {
  /** Amount in copper (Blizzard's unit). `null`/`undefined` renders an em dash. */
  copper: number | null | undefined;
  size?: GoldAmountSize;
  /** Omit zero units ("12g" instead of "12g 0s 0c"). */
  trim?: boolean;
  component?: ElementType;
  sx?: SxProps<Theme>;
};

type CoinUnit = "gold" | "silver" | "copper";

const UNIT_SUFFIX: Record<CoinUnit, string> = {
  gold: "g",
  silver: "s",
  copper: "c",
};

const FONT_SIZE: Record<GoldAmountSize, string> = {
  small: "0.75rem",
  medium: "0.875rem",
  large: "1.125rem",
};

const coinColor = (theme: Theme, unit: CoinUnit): string => {
  if (unit === "gold") {
    return theme.palette.secondary.main;
  }
  if (unit === "silver") {
    return theme.palette.text.secondary;
  }
  return theme.palette.warning.dark;
};

/**
 * Currency with coin colours: gold (secondary), silver (text.secondary),
 * copper (warning.dark). Screen readers get the long form ("12 gold 34 silver").
 */
const GoldAmount = ({
  copper,
  size = "medium",
  trim = true,
  component = "span",
  sx,
}: GoldAmountProps): JSX.Element => {
  const hasValue = typeof copper === "number" && Number.isFinite(copper);
  const parts = splitCopper(copper);

  const units: Array<{ unit: CoinUnit; amount: number }> = [
    { unit: "gold", amount: parts.gold },
    { unit: "silver", amount: parts.silver },
    { unit: "copper", amount: parts.copper },
  ];
  const shown = trim ? units.filter(({ amount }) => amount > 0) : units;
  const visible = shown.length > 0 ? shown : [units[2]];

  return (
    <Box
      component={component}
      sx={[
        {
          display: "inline-flex",
          alignItems: "baseline",
          gap: "0.35em",
          fontSize: FONT_SIZE[size],
          fontWeight: 500,
          lineHeight: 1.4,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        },
        ...toSxArray(sx),
      ]}
    >
      {hasValue ? (
        <>
          <Box component="span" sx={visuallyHidden}>
            {formatCopper(copper, { style: "long", trim })}
          </Box>
          <Box component="span" aria-hidden="true" sx={{ display: "contents" }}>
            {parts.negative ? <span>-</span> : null}
            {visible.map(({ unit, amount }) => (
              <Box
                key={unit}
                component="span"
                sx={(theme) => ({ color: coinColor(theme, unit) })}
              >
                {formatNumber(amount)}
                <Box
                  component="span"
                  sx={{ fontSize: "0.8em", fontWeight: 400, marginLeft: "0.1em" }}
                >
                  {UNIT_SUFFIX[unit]}
                </Box>
              </Box>
            ))}
          </Box>
        </>
      ) : (
        <Box component="span" sx={{ color: "text.secondary" }}>
          —
        </Box>
      )}
    </Box>
  );
};

export default GoldAmount;
