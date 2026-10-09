import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { useMemo } from "react";

import GoldAmount from "@/components/common/GoldAmount";
import PriceChange from "@/features/wowToken/components/PriceChange";
import { formatDateTime, previousPoint } from "@/features/wowToken/services/tokenStats";
import type { TokenHistoryPoint } from "@/features/wowToken/types";
import { focusRing, visuallyHidden } from "@/theme";

export type HistoryTableProps = {
  /** The plotted prices, oldest first. */
  points: readonly TokenHistoryPoint[];
  /** The region's whole history, for the first row's change. */
  history: readonly TokenHistoryPoint[];
  caption: string;
  id?: string;
};

/** Tall enough for about eight rows; the rest scroll inside the table. */
const MAX_HEIGHT = 380;

/**
 * Every plotted price, newest first, with its change from the price
 * before: the chart's values without needing a pointer. At most 200 rows
 * (the storage cap), scrolling inside their own box with a sticky header.
 */
const HistoryTable = ({ points, history, caption, id }: HistoryTableProps): JSX.Element => {
  const rows = useMemo(
    () =>
      [...points].reverse().map((point) => ({
        point,
        previous: previousPoint(history, point.t),
      })),
    [points, history],
  );

  return (
    <TableContainer
      id={id}
      // Scrollable, so it must be reachable from the keyboard; the caption names it.
      tabIndex={0}
      role="region"
      aria-label={caption}
      sx={(theme) => ({
        maxHeight: MAX_HEIGHT,
        border: `1px solid ${theme.palette.border.subtle}`,
        borderRadius: `${theme.wc.radius.md}px`,
        "&:focus-visible": focusRing(theme),
      })}
    >
      <Table size="small" stickyHeader sx={{ minWidth: 300 }}>
        <Box component="caption" sx={visuallyHidden}>
          {caption}
        </Box>
        <TableHead>
          <TableRow>
            <TableCell scope="col">Published</TableCell>
            <TableCell scope="col" align="right">
              Price
            </TableCell>
            <TableCell scope="col" align="right">
              Change
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(({ point, previous }) => (
            <TableRow key={point.t}>
              <TableCell
                component="th"
                scope="row"
                sx={{ fontWeight: 400, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}
              >
                <time dateTime={new Date(point.t).toISOString()}>{formatDateTime(point.t)}</time>
              </TableCell>
              <TableCell align="right">
                <GoldAmount copper={point.price} />
              </TableCell>
              <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                {previous ? (
                  <PriceChange from={previous.price} to={point.price} size="small" percentOnly />
                ) : (
                  <Box component="span" sx={{ color: "text.secondary" }}>
                    First stored
                  </Box>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default HistoryTable;
