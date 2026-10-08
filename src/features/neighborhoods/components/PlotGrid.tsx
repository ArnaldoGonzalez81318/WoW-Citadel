import { Box, Skeleton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";

import { mapAccent } from "@/features/neighborhoods/config/neighborhoodMaps";
import type { RegisterSlot } from "@/features/neighborhoods/hooks/useNeighborhoodRecords";
import { NUMBERS_PER_PAGE } from "@/features/neighborhoods/services/neighborhoodService";
import { formatNumber } from "@/lib/format";

const SIDE = Math.sqrt(NUMBERS_PER_PAGE);
const CELL_PX = 14;
const GAP_PX = 3;
export const PLOT_GRID_PX = SIDE * CELL_PX + (SIDE - 1) * GAP_PX;

type PlotKind = "here" | "elsewhere" | "unfounded" | "unknown";

const kindOf = (slot: RegisterSlot, newest: number | undefined): PlotKind => {
  if (slot.record) {
    return "here";
  }
  if (slot.record === null) {
    // Past the newest number nothing exists yet; below it, a miss is (almost
    // always) a neighborhood on another map, since the numbers have no gaps.
    return newest !== undefined && slot.number > newest ? "unfounded" : "elsewhere";
  }
  return "unknown";
};

const cellSx = (kind: PlotKind, mapId: number) => (theme: Theme) => {
  const accent = mapAccent(theme, mapId);
  switch (kind) {
    case "here":
      return {
        backgroundColor: alpha(accent, 0.85),
        border: `1px solid ${accent}`,
        boxShadow: `0 0 8px ${alpha(accent, 0.35)}`,
      };
    case "elsewhere":
      return {
        backgroundColor: alpha(theme.palette.text.primary, 0.06),
        border: `1px solid ${theme.palette.border.strong}`,
      };
    case "unfounded":
      return {
        backgroundColor: "transparent",
        border: `1px dashed ${theme.palette.border.default}`,
      };
    default:
      return {
        backgroundColor: "transparent",
        border: `1px dashed ${theme.palette.warning.main}`,
      };
  }
};

const Swatch = ({ kind, mapId }: { kind: PlotKind; mapId: number }): JSX.Element => (
  <Box
    component="span"
    aria-hidden="true"
    sx={[
      { display: "inline-block", width: 10, height: 10, borderRadius: "2px", flexShrink: 0 },
      cellSx(kind, mapId),
    ]}
  />
);

export type PlotGridProps = {
  /** The page's 25 numbers; null while they are first being checked. */
  slots: RegisterSlot[] | null;
  mapId: number;
  mapName: string;
  /** The region's newest number, when known: later numbers are not founded yet. */
  newest: number | undefined;
};

/**
 * The register page as a block of 25 plots, one per number in reading
 * order: lit where the number is a neighborhood on this map, grey where it
 * is on another, dashed where nobody has founded it yet. The drawing is
 * decoration; the legend beside it says the same in words, with counts.
 */
const PlotGrid = ({ slots, mapId, mapName, newest }: PlotGridProps): JSX.Element => {
  const counts: Record<PlotKind, number> = { here: 0, elsewhere: 0, unfounded: 0, unknown: 0 };
  const kinds = slots?.map((slot) => kindOf(slot, newest)) ?? [];
  kinds.forEach((kind) => {
    counts[kind] += 1;
  });

  const legend: Array<{ kind: PlotKind; label: string }> = [
    { kind: "here", label: `${formatNumber(counts.here)} in ${mapName}` },
    // "Elsewhere", not "on another map": only this map was asked.
    { kind: "elsewhere", label: `${formatNumber(counts.elsewhere)} elsewhere` },
  ];
  if (counts.unfounded > 0) {
    legend.push({ kind: "unfounded", label: `${formatNumber(counts.unfounded)} not founded yet` });
  }
  if (counts.unknown > 0) {
    legend.push({ kind: "unknown", label: `${formatNumber(counts.unknown)} could not be checked` });
  }

  return (
    <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
      {slots ? (
        <Box
          aria-hidden="true"
          sx={{
            display: "grid",
            gridTemplateColumns: `repeat(${SIDE}, ${CELL_PX}px)`,
            gap: `${GAP_PX}px`,
            flexShrink: 0,
          }}
        >
          {slots.map((slot, index) => (
            <Box
              key={slot.number}
              sx={[{ width: CELL_PX, height: CELL_PX, borderRadius: "3px" }, cellSx(kinds[index], mapId)]}
            />
          ))}
        </Box>
      ) : (
        <Skeleton variant="rounded" width={PLOT_GRID_PX} height={PLOT_GRID_PX} sx={{ flexShrink: 0 }} />
      )}
      {slots ? (
        <Stack component="ul" role="list" aria-label="This page's numbers" spacing={0.5} sx={{ listStyle: "none", m: 0, p: 0, minWidth: 0 }}>
          {legend.map((entry) => (
            <Stack
              key={entry.kind}
              component="li"
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ minWidth: 0 }}
            >
              <Swatch kind={entry.kind} mapId={mapId} />
              <Typography
                variant="caption"
                color="text.secondary"
                component="span"
                sx={{ minWidth: 0, overflowWrap: "anywhere", fontVariantNumeric: "tabular-nums" }}
              >
                {entry.label}
              </Typography>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0, maxWidth: 200 }}>
          <Skeleton variant="text" width="80%" sx={{ fontSize: "0.75rem" }} />
          <Skeleton variant="text" width="65%" sx={{ fontSize: "0.75rem" }} />
        </Stack>
      )}
    </Stack>
  );
};

export default PlotGrid;
