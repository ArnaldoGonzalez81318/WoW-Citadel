import { Box } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";

import { mapAccent } from "@/features/neighborhoods/config/neighborhoodMaps";

export type MapBannerProps = {
  mapId: number;
  /** The map's glyph, drawn large in its accent. */
  icon: ReactNode;
  /** Brighter plots and glow for the pressed card. */
  active?: boolean;
};

const PLOT_COLUMNS = 9;
const PLOT_ROWS = 4;

/**
 * Which plots glow: a fixed pattern per map, so a banner looks the same on
 * every visit (and the two maps' banners differ) instead of re-rolling.
 */
const litPlots = (mapId: number): boolean[] =>
  Array.from(
    { length: PLOT_COLUMNS * PLOT_ROWS },
    (_, index) => (index * 7 + mapId * 5) % 11 < 4,
  );

/**
 * A map's banner. Blizzard's API has no art for neighborhoods, so this is a
 * drawing: rows of house plots seen at an angle under a wash of the map's
 * faction colour, with the map's glyph. Pure decoration (the card names the
 * map), hidden from assistive tech.
 */
const MapBanner = ({ mapId, icon, active = false }: MapBannerProps): JSX.Element => {
  const plots = litPlots(mapId);
  return (
    <Box
      aria-hidden="true"
      sx={(theme) => {
        const accent = mapAccent(theme, mapId);
        return {
          position: "relative",
          width: "100%",
          aspectRatio: "3 / 1",
          flexShrink: 0,
          overflow: "hidden",
          backgroundColor: theme.palette.surface.sunken,
          backgroundImage: [
            `radial-gradient(120% 160% at 0% 0%, ${alpha(accent, active ? 0.5 : 0.36)} 0%, transparent 55%)`,
            `radial-gradient(90% 120% at 100% 100%, ${alpha(accent, 0.16)} 0%, transparent 60%)`,
          ].join(", "),
          borderBottom: `1px solid ${theme.palette.border.subtle}`,
        };
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "60%",
          width: "74%",
          aspectRatio: `${PLOT_COLUMNS} / ${PLOT_ROWS}`,
          transform:
            "translate(-50%, -50%) perspective(480px) rotateX(52deg) rotateZ(-14deg)",
          display: "grid",
          gridTemplateColumns: `repeat(${PLOT_COLUMNS}, minmax(0, 1fr))`,
          gap: "clamp(3px, 1vw, 8px)",
        }}
      >
        {plots.map((lit, index) => (
          <Box
            key={index}
            sx={(theme) => {
              const accent = mapAccent(theme, mapId);
              return {
                borderRadius: "2px",
                backgroundColor: lit
                  ? alpha(accent, active ? 0.7 : 0.5)
                  : alpha(theme.palette.text.primary, 0.05),
                border: `1px solid ${alpha(accent, lit ? 0.75 : 0.2)}`,
                boxShadow: lit ? `0 0 12px ${alpha(accent, 0.4)}` : "none",
              };
            }}
          />
        ))}
      </Box>
      <Box
        sx={(theme) => ({
          position: "absolute",
          left: "6%",
          bottom: "12%",
          display: "flex",
          color: mapAccent(theme, mapId),
          filter: `drop-shadow(0 4px 12px ${alpha(theme.palette.background.default, 0.8)})`,
          "& svg": { fontSize: "clamp(32px, 9vw, 56px)" },
        })}
      >
        {icon}
      </Box>
    </Box>
  );
};

export default MapBanner;
