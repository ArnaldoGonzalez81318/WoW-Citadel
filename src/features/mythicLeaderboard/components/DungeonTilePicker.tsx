import { Box, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import MediaTile from "@/components/common/MediaTile";
import { keystoneDungeonQuery } from "@/features/mythicKeystone/hooks/keystoneQueries";
import type { KeystoneDungeonSummary } from "@/features/mythicKeystone/types";
import { mixins } from "@/theme";

export type DungeonTilePickerProps = {
  dungeons: KeystoneDungeonSummary[];
  value: number | null;
  onChange: (dungeonId: number) => void;
};

/** The art shares the Mythic Keystone Dungeons page's cache entry. */
const TileArt = ({ dungeon }: { dungeon: KeystoneDungeonSummary }): JSX.Element => {
  const query = useQuery(keystoneDungeonQuery(dungeon.id));
  return (
    <Box sx={{ width: "100%", aspectRatio: "2 / 1" }}>
      <MediaTile
        size="fill"
        aspect="2 / 1"
        src={query.data?.imageUrl ?? undefined}
        alt=""
        fallbackLabel={dungeon.name}
        loading={query.isPending}
      />
    </Box>
  );
};

/**
 * This season's dungeons as art tiles, one pressed at a time (a toggle-button
 * group: each tile is a Tab stop with aria-pressed; Space or Enter picks it).
 */
const DungeonTilePicker = ({
  dungeons,
  value,
  onChange,
}: DungeonTilePickerProps): JSX.Element => (
  <ToggleButtonGroup
    exclusive
    value={value}
    onChange={(_event, next: number | null) => {
      // Pressing the selected tile again would clear it; a board always has a dungeon.
      if (next !== null) {
        onChange(next);
      }
    }}
    aria-label="Dungeon"
    sx={(theme) => ({
      display: "grid",
      gridTemplateColumns: {
        xs: "repeat(2, minmax(0, 1fr))",
        sm: "repeat(4, minmax(0, 1fr))",
        lg: "repeat(8, minmax(0, 1fr))",
      },
      gap: 1,
      "& .MuiToggleButtonGroup-grouped": {
        // Undo the group's joined-edge styling: these are separate tiles.
        margin: 0,
        border: `1px solid ${theme.palette.border.subtle}`,
        borderRadius: `${theme.wc.radius.md}px !important`,
      },
    })}
  >
    {dungeons.map((dungeon) => (
      <ToggleButton
        key={dungeon.id}
        value={dungeon.id}
        aria-label={dungeon.name}
        sx={(theme) => ({
          p: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          textTransform: "none",
          color: "text.secondary",
          "& .tile-art": { opacity: 0.55, transition: theme.transitions.create("opacity") },
          "&:hover .tile-art": { opacity: 0.85 },
          "&.Mui-selected": {
            color: "text.primary",
            borderColor: `${theme.palette.primary.main} !important`,
            boxShadow: `inset 0 0 0 1px ${theme.palette.primary.main}`,
          },
          "&.Mui-selected .tile-art": { opacity: 1 },
        })}
      >
        <Box className="tile-art">
          <TileArt dungeon={dungeon} />
        </Box>
        <Typography
          variant="caption"
          component="span"
          sx={{ ...mixins.truncate, display: "block", px: 1, py: 0.75, textAlign: "left" }}
        >
          {dungeon.name}
        </Typography>
      </ToggleButton>
    ))}
  </ToggleButtonGroup>
);

export default DungeonTilePicker;
