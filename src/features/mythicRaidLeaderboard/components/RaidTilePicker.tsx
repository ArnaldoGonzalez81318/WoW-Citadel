import { Box, ToggleButton, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import MediaTile from "@/components/common/MediaTile";
import { raidJournalQuery } from "@/features/mythicRaidLeaderboard/hooks/hallOfFameQueries";
import type { HallOfFameRaid } from "@/features/mythicRaidLeaderboard/types";
import { truncate } from "@/theme";

export type RaidTilePickerProps = {
  /** Newest first: the first one is featured as the latest Hall of Fame. */
  raids: readonly HallOfFameRaid[];
  value: string;
  onChange: (raidSlug: string) => void;
};

/*
 * Nine raids, the newest featured at twice the size: 2×2 cells plus eight
 * single ones make twelve, which fill 3, 4 and 6 columns without a hole.
 * On phones (two columns) the featured tile is one full-width row instead,
 * since a 2×2 block there would have no small tiles beside it to give its
 * rows a height.
 */
const TILE_COLS: GridColumns = { xs: 2, sm: 3, md: 4, lg: 6 };

const tileSx = (featured: boolean) => (theme: Theme) => ({
  p: 0,
  minWidth: 0,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  justifyContent: "flex-start",
  textTransform: "none",
  color: "text.secondary",
  border: `1px solid ${theme.palette.border.subtle}`,
  borderRadius: `${theme.wc.radius.md}px`,
  ...(featured ? { gridColumn: "span 2", gridRow: { sm: "span 2" } } : {}),
  "& .tile-art": {
    opacity: 0.55,
    transition: theme.transitions.create("opacity", {
      duration: theme.wc.motion.base,
      easing: theme.wc.motion.easing,
    }),
  },
  "@media (hover: hover)": {
    "&:hover .tile-art": { opacity: 0.85 },
  },
  "&.Mui-selected, &.Mui-selected:hover": {
    color: "text.primary",
    borderColor: theme.palette.primary.main,
    boxShadow: `inset 0 0 0 1px ${theme.palette.primary.main}`,
    backgroundColor: theme.palette.action.selected,
  },
  "&.Mui-selected .tile-art": { opacity: 1 },
});

/**
 * The featured art fills whatever height its two rows leave above the
 * caption (from sm up); everywhere else the art keeps the tile's 2:1 shape.
 */
const featuredArtSx = {
  position: "relative",
  width: "100%",
  aspectRatio: { xs: "2 / 1", sm: "auto" },
  flex: { sm: "1 1 auto" },
  minHeight: { sm: 96 },
} as const;

const featuredArtFillSx = {
  position: { xs: "relative", sm: "absolute" },
  inset: 0,
  width: "100%",
  height: "100%",
} as const;

const RaidTile = ({
  raid,
  featured,
  selected,
  onSelect,
}: {
  raid: HallOfFameRaid;
  featured: boolean;
  selected: boolean;
  onSelect: (raidSlug: string) => void;
}): JSX.Element => {
  // Shares the raid overview's cache entry: the selected raid costs nothing twice.
  const query = useQuery(raidJournalQuery(raid.journalInstanceId));
  const name = query.data?.name ?? raid.name;
  const expansion = query.data?.expansion ?? raid.expansion;
  const detailsId = useId();

  const art = (
    <MediaTile
      size="fill"
      aspect="2 / 1"
      src={query.data?.imageUrl ?? undefined}
      alt=""
      fallbackLabel={name}
      loading={query.isPending}
    />
  );

  return (
    <ToggleButton
      value={raid.slug}
      selected={selected}
      onChange={() => onSelect(raid.slug)}
      // The label replaces the content; the expansion (and the badge) describe it.
      aria-label={name}
      aria-describedby={featured ? `${detailsId}-expansion ${detailsId}-badge` : `${detailsId}-expansion`}
      sx={tileSx(featured)}
    >
      {featured ? (
        <Box sx={featuredArtSx}>
          {/* Only the art dims while unselected; the badge stays legible. */}
          <Box className="tile-art" sx={featuredArtFillSx}>
            {art}
          </Box>
          <Box
            component="span"
            id={`${detailsId}-badge`}
            sx={(theme) => ({
              position: "absolute",
              top: 8,
              left: 8,
              px: 1,
              py: 0.25,
              typography: "caption",
              fontWeight: 600,
              color: theme.palette.secondary.main,
              backgroundColor: alpha(theme.palette.surface.base, 0.82),
              border: `1px solid ${theme.palette.border.gold}`,
              borderRadius: `${theme.wc.radius.pill}px`,
            })}
          >
            Latest Hall of Fame
          </Box>
        </Box>
      ) : (
        <Box className="tile-art" sx={{ width: "100%", aspectRatio: "2 / 1", flexShrink: 0 }}>
          {art}
        </Box>
      )}
      <Box sx={{ px: featured ? 1.5 : 1, py: featured ? 1 : 0.75, minWidth: 0, textAlign: "left" }}>
        <Typography
          variant={featured ? "subtitle1" : "caption"}
          component="span"
          sx={{ ...truncate, display: "block", fontWeight: 600, lineHeight: 1.4 }}
        >
          {name}
        </Typography>
        <Typography
          id={`${detailsId}-expansion`}
          variant="caption"
          component="span"
          color="text.secondary"
          sx={{ ...truncate, display: "block" }}
        >
          {expansion}
        </Typography>
      </Box>
    </ToggleButton>
  );
};

/**
 * Every raid with a Hall of Fame as art tiles, one pressed at a time:
 * each is a toggle button (a Tab stop with aria-pressed; Space or Enter
 * picks it), newest first.
 */
const RaidTilePicker = ({ raids, value, onChange }: RaidTilePickerProps): JSX.Element => (
  <Box
    role="group"
    aria-label="Raid"
    sx={{ display: "grid", gap: 1, ...gridTemplateColumnsSx(TILE_COLS) }}
  >
    {raids.map((raid, index) => (
      <RaidTile
        key={raid.slug}
        raid={raid}
        featured={index === 0}
        selected={raid.slug === value}
        onSelect={onChange}
      />
    ))}
  </Box>
);

export default RaidTilePicker;
