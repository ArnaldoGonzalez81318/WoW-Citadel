import {
  Box,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import { useState } from "react";

import MediaTile from "@/components/common/MediaTile";
import RatingRange from "@/features/pvpTiers/components/RatingRange";
import type {
  PvpTierIcon,
  PvpTierIcons,
} from "@/features/pvpTiers/hooks/usePvpTierIcons";
import { rowIconTier } from "@/features/pvpTiers/services/tierLadder";
import type { PvpTierMatrix as PvpTierMatrixData } from "@/features/pvpTiers/types";
import { focusRing, visuallyHidden } from "@/theme";

export type PvpTierMatrixProps = {
  matrix: PvpTierMatrixData;
  /** The bracket shown in the ladder above: its column is tinted to match. */
  selectedType: string | null;
  /** Some tiers failed to load, so an empty cell may be missing rather than unlisted. */
  incomplete: boolean;
  /** Icons by tier id: each row shows its `rowIconTier`'s. */
  icons: PvpTierIcons;
  /**
   * Id for the table's caption, which names the scroller. Not the section
   * title: the section is already a region with that name, and two nested
   * regions with one name read as a duplicate landmark.
   */
  captionId: string;
};

/**
 * Rendered heights, for the page's skeleton: a body row is the 40px emblem
 * plus the theme's 10px cell padding above and below and a 1px rule; the
 * header is one overline line (11px × 1.5) with the same padding and rule.
 */
export const MATRIX_ROW_HEIGHT = 61;
export const MATRIX_HEAD_HEIGHT = 37.5;

const RANK_COLUMN_WIDTH = 176;
const RANGE_COLUMN_MIN_WIDTH = 112;

/** Opaque, with an edge, so the brackets scrolling beneath it read as passing under. */
const stickyColumnSx = (theme: Theme) => ({
  backgroundColor: theme.palette.background.paper,
  boxShadow: `inset -1px 0 0 ${theme.palette.border.subtle}`,
});

/** The selected bracket's column, echoing the switcher above. */
const selectedColumnSx = (theme: Theme) => ({
  backgroundColor: alpha(theme.palette.primary.main, 0.08),
});

/**
 * A row's emblem. Switching brackets points the row at another tier whose
 * icon has to load, but Blizzard gives a rank the same icon in every
 * bracket, so the previous one stays up meanwhile instead of blinking to a
 * skeleton. Rows are keyed by rank, so this state follows the rank.
 */
const RankIcon = ({
  icon,
  name,
}: {
  icon: PvpTierIcon | undefined;
  name: string;
}): JSX.Element => {
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const url = icon?.url ?? null;
  if (url !== null && url !== lastUrl) {
    setLastUrl(url);
  }
  const loading = icon?.loading ?? false;

  return (
    <MediaTile
      size={40}
      src={loading ? lastUrl : url}
      alt=""
      fallbackLabel={name}
      loading={loading && lastUrl === null}
    />
  );
};

/**
 * Ranks down the side, brackets across the top, each cell the rank's range
 * in that bracket. A cell whose range differs from the rest of its row is
 * marked (in gold, with a hidden note for screen readers). The rank column
 * stays put while the brackets scroll sideways on narrow screens; the
 * scroller takes focus so a keyboard can scroll it too.
 */
const PvpTierMatrix = ({
  matrix,
  selectedType,
  incomplete,
  icons,
  captionId,
}: PvpTierMatrixProps): JSX.Element => (
  <TableContainer
    role="region"
    aria-labelledby={captionId}
    tabIndex={0}
    sx={(theme) => ({
      overflowX: "auto",
      minWidth: 0,
      "&:focus-visible": focusRing(theme, true),
    })}
  >
    <Table
      size="small"
      sx={{
        minWidth: RANK_COLUMN_WIDTH + matrix.brackets.length * RANGE_COLUMN_MIN_WIDTH,
      }}
    >
      <Box component="caption" id={captionId} sx={visuallyHidden}>
        Rating range of each rank in every bracket
      </Box>
      <TableHead>
        <TableRow>
          <TableCell
            scope="col"
            sx={(theme) => ({
              position: "sticky",
              left: 0,
              zIndex: 2,
              width: RANK_COLUMN_WIDTH,
              ...stickyColumnSx(theme),
            })}
          >
            Rank
          </TableCell>
          {matrix.brackets.map((bracket) => {
            const selected = bracket.type === selectedType;
            return (
              <TableCell
                key={bracket.type}
                scope="col"
                sx={(theme) => ({
                  minWidth: RANGE_COLUMN_MIN_WIDTH,
                  whiteSpace: "nowrap",
                  ...(selected
                    ? {
                        ...selectedColumnSx(theme),
                        color: theme.palette.primary.light,
                        boxShadow: `inset 0 -2px 0 ${theme.palette.primary.main}`,
                      }
                    : {}),
                })}
              >
                {bracket.label}
              </TableCell>
            );
          })}
        </TableRow>
      </TableHead>
      <TableBody>
        {matrix.rows.map((row) => {
          const iconTier = rowIconTier(row, selectedType);
          return (
            <TableRow key={row.key}>
              <TableCell
                component="th"
                scope="row"
                sx={(theme) => ({
                  position: "sticky",
                  left: 0,
                  zIndex: 1,
                  width: RANK_COLUMN_WIDTH,
                  ...stickyColumnSx(theme),
                })}
              >
                <Stack
                  direction="row"
                  spacing={1.25}
                  alignItems="center"
                  sx={{ minWidth: 0 }}
                >
                  <RankIcon
                    icon={iconTier ? icons.get(iconTier.id) : undefined}
                    name={row.name}
                  />
                  <Typography
                    variant="body2"
                    component="span"
                    sx={{ fontWeight: 700, overflowWrap: "anywhere" }}
                  >
                    {row.name}
                  </Typography>
                </Stack>
              </TableCell>
              {matrix.brackets.map((bracket) => {
                const tier = row.cells.get(bracket.type);
                const differs = row.outliers.has(bracket.type);
                const selected = bracket.type === selectedType;
                return (
                  <TableCell
                    key={bracket.type}
                    sx={(theme) => ({
                      whiteSpace: "nowrap",
                      typography: "body2",
                      color: differs
                        ? theme.palette.secondary.light
                        : theme.palette.text.primary,
                      fontWeight: differs ? 700 : undefined,
                      ...(selected ? selectedColumnSx(theme) : {}),
                    })}
                  >
                    {tier ? (
                      <>
                        <RatingRange tier={tier} />
                        {differs ? (
                          <Box component="span" sx={visuallyHidden}>
                            {" (differs from the other brackets)"}
                          </Box>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <Box
                          component="span"
                          aria-hidden="true"
                          sx={{ color: "text.secondary" }}
                        >
                          —
                        </Box>
                        <Box component="span" sx={visuallyHidden}>
                          {incomplete ? "Not loaded" : "Not listed"}
                        </Box>
                      </>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </TableContainer>
);

export default PvpTierMatrix;
