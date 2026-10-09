import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import DragHandleRoundedIcon from "@mui/icons-material/DragHandleRounded";
import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ElementType } from "react";

import GoldAmount from "@/components/common/GoldAmount";
import { changeRatio, formatSignedPercent } from "@/features/wowToken/services/tokenStats";
import { toSxArray } from "@/lib/sx";
import { visuallyHidden } from "@/theme";

export type PriceChangeProps = {
  /** Earlier price in copper. */
  from: number;
  /** Later price in copper. */
  to: number;
  size?: "small" | "medium";
  /** Leaves out the gold difference (tight spots). */
  percentOnly?: boolean;
  component?: ElementType;
  sx?: SxProps<Theme>;
};

/**
 * "↑ +1.2% (+3,500g)". The direction is a glyph for sight and a word for
 * screen readers, never colour alone; neither direction is tinted good or
 * bad, since a dearer token is bad news for a buyer and good news for a
 * seller.
 */
const PriceChange = ({
  from,
  to,
  size = "medium",
  percentOnly = false,
  component = "span",
  sx,
}: PriceChangeProps): JSX.Element => {
  const delta = to - from;
  const ratio = changeRatio(from, to);
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const Icon =
    direction === "up"
      ? ArrowUpwardRoundedIcon
      : direction === "down"
        ? ArrowDownwardRoundedIcon
        : DragHandleRoundedIcon;

  return (
    <Box
      component={component}
      sx={[
        {
          display: "inline-flex",
          alignItems: "center",
          flexWrap: "wrap",
          columnGap: 0.5,
          m: 0,
          fontSize: size === "small" ? "0.8125rem" : "0.9375rem",
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          color: "text.primary",
        },
        ...toSxArray(sx),
      ]}
    >
      <Icon
        aria-hidden="true"
        sx={{ fontSize: size === "small" ? 16 : 18, color: "text.secondary" }}
      />
      <Box component="span" sx={visuallyHidden}>
        {direction === "up" ? "Up " : direction === "down" ? "Down " : "Unchanged "}
      </Box>
      {direction === "flat" ? (
        <span>0%</span>
      ) : (
        <>
          {ratio !== null ? <span>{formatSignedPercent(ratio)}</span> : null}
          {percentOnly ? null : (
            <Box
              component="span"
              sx={{ display: "inline-flex", alignItems: "baseline", color: "text.secondary", fontWeight: 400 }}
            >
              <span aria-hidden="true">(</span>
              <Box component="span" aria-hidden="true">
                {delta > 0 ? "+" : "−"}
              </Box>
              <Box component="span" sx={visuallyHidden}>
                by
              </Box>
              <GoldAmount copper={Math.abs(delta)} size={size === "small" ? "small" : "medium"} />
              <span aria-hidden="true">)</span>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default PriceChange;
