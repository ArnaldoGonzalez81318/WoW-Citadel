import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

import { formatNumber } from "@/lib/format";
import { visuallyHidden } from "@/theme";

export type BarListEntry = {
  key: string;
  label: ReactNode;
  count: number;
  /** A second line under the label (a zone's local time). */
  detail?: ReactNode;
};

export type BarListProps = {
  /** Accessible name of the list ("Population tiers in EU"). */
  label: string;
  entries: readonly BarListEntry[];
  /** What the shares are of: every bar's length is `count / total`. */
  total: number;
  /** Spoken after each count: ["realm", "realms"]. */
  unit: readonly [singular: string, plural: string];
};

/** "42%", or "<1%" for a sliver that would otherwise read as nothing. */
const formatShare = (count: number, total: number): string => {
  if (total <= 0) {
    return "—";
  }
  const share = count / total;
  return share > 0 && share < 0.01
    ? "<1%"
    : formatNumber(share, { style: "percent" });
};

/**
 * A ranked breakdown as labelled bars: one hue, each bar as long as its
 * share of the whole, with the count and share written out beside it so
 * nothing rests on the bar alone (the bars are hidden from screen readers).
 */
const BarList = ({ label, entries, total, unit }: BarListProps): JSX.Element => (
  <Box
    component="ul"
    // Safari drops the list role from a list-style:none list without it.
    role="list"
    aria-label={label}
    sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1.25 }}
  >
    {entries.map((entry) => {
      const share = total > 0 ? Math.min(1, entry.count / total) : 0;
      return (
        <Box
          component="li"
          key={entry.key}
          sx={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            columnGap: 1.5,
            rowGap: 0.5,
            alignItems: "baseline",
            minWidth: 0,
          }}
        >
          <Typography
            variant="body2"
            component="span"
            sx={{ minWidth: 0, overflowWrap: "anywhere" }}
          >
            {entry.label}
          </Typography>
          <Typography
            variant="body2"
            component="span"
            color="text.secondary"
            sx={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}
          >
            <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>
              {formatNumber(entry.count)}
            </Box>
            <Box component="span" sx={visuallyHidden}>
              {` ${entry.count === 1 ? unit[0] : unit[1]},`}
            </Box>
            <Box component="span" aria-hidden="true">
              {" · "}
            </Box>
            {formatShare(entry.count, total)}
          </Typography>
          {entry.detail ? (
            <Typography
              variant="caption"
              component="span"
              color="text.secondary"
              sx={{ gridColumn: "1 / -1", fontVariantNumeric: "tabular-nums" }}
            >
              {entry.detail}
            </Typography>
          ) : null}
          <Box
            aria-hidden="true"
            sx={(theme) => ({
              gridColumn: "1 / -1",
              height: 6,
              borderRadius: `${theme.wc.radius.pill}px`,
              backgroundColor: theme.palette.surface.inset,
              overflow: "hidden",
            })}
          >
            <Box
              sx={(theme) => ({
                height: "100%",
                width: `${share * 100}%`,
                // A sliver still shows as a dot, so "<1%" has a mark.
                minWidth: share > 0 ? 6 : 0,
                borderRadius: `${theme.wc.radius.pill}px`,
                backgroundColor: theme.palette.primary.main,
              })}
            />
          </Box>
        </Box>
      );
    })}
  </Box>
);

export default BarList;
