import { Box, Skeleton, ToggleButton, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import { monogramOf } from "@/features/reputations/components/FactionCrest";
import { factionQuery } from "@/features/reputations/hooks/reputationQueries";
import {
  accentColor,
  groupAccentKey,
} from "@/features/reputations/services/reputationPalette";
import {
  KIND_LABEL,
  pluralize,
} from "@/features/reputations/services/reputationService";
import type { FactionRef } from "@/features/reputations/types";
import { lineClamp } from "@/theme";

/** Fourteen groups on US: two rows of seven on wide screens, never a lone tile. */
export const GROUP_TILE_COLS: GridColumns = { xs: 2, sm: 3, md: 4, lg: 7 };
/** Shorter on phones, where the fourteen tiles stack seven rows deep. */
export const GROUP_TILE_HEIGHT = { xs: 76, sm: 96 } as const;
export const GROUP_TILE_GAP = 1;

export type GroupTilePickerProps = {
  groups: readonly FactionRef[];
  /** The pressed group; null presses none (while a search is shown). */
  value: number | null;
  onChange: (groupId: number) => void;
};

const tileSx = (groupId: number) => (theme: Theme) => {
  const color = accentColor(theme, groupAccentKey(groupId));
  return {
    position: "relative",
    overflow: "hidden",
    minWidth: 0,
    minHeight: GROUP_TILE_HEIGHT,
    p: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "flex-end",
    textAlign: "left",
    textTransform: "none",
    color: "text.secondary",
    border: `1px solid ${theme.palette.border.subtle}`,
    borderLeft: `3px solid ${alpha(color, 0.75)}`,
    borderRadius: `${theme.wc.radius.md}px`,
    background: `linear-gradient(135deg, ${alpha(color, 0.2)} 0%, ${alpha(color, 0.04)} 70%)`,
    "& .tile-mark": {
      color: alpha(color, 0.12),
      transition: theme.transitions.create("color", {
        duration: theme.wc.motion.base,
        easing: theme.wc.motion.easing,
      }),
    },
    "@media (hover: hover)": {
      "&:hover": {
        background: `linear-gradient(135deg, ${alpha(color, 0.3)} 0%, ${alpha(color, 0.08)} 70%)`,
      },
      "&:hover .tile-mark": { color: alpha(color, 0.2) },
    },
    "&.Mui-selected, &.Mui-selected:hover": {
      color: "text.primary",
      borderColor: theme.palette.primary.main,
      borderLeftColor: color,
      boxShadow: `inset 0 0 0 1px ${theme.palette.primary.main}`,
      background: `linear-gradient(135deg, ${alpha(color, 0.36)} 0%, ${alpha(color, 0.1)} 70%)`,
    },
    "&.Mui-selected .tile-mark": { color: alpha(color, 0.26) },
  };
};

const GroupTile = ({
  group,
  selected,
  onSelect,
}: {
  group: FactionRef;
  selected: boolean;
  onSelect: (groupId: number) => void;
}): JSX.Element => {
  // Shares the group section's cache entry (the page loads every root anyway).
  const query = useQuery(factionQuery(group.id));
  const record = query.data;
  const name = record?.name ?? group.name;
  const detailsId = useId();

  let caption: string | null;
  if (record) {
    caption =
      record.children.length > 0
        ? pluralize(record.children.length, "faction", "factions")
        : `${KIND_LABEL[record.kind]} faction`;
  } else if (query.isError || record === null) {
    caption = "Details unavailable";
  } else {
    caption = null;
  }

  return (
    <ToggleButton
      value={group.id}
      selected={selected}
      onChange={() => onSelect(group.id)}
      // The label replaces the content; the count describes it.
      aria-label={name}
      aria-describedby={caption ? `${detailsId}-caption` : undefined}
      sx={tileSx(group.id)}
    >
      <Box
        className="tile-mark"
        aria-hidden="true"
        sx={{
          position: "absolute",
          right: -4,
          top: -10,
          fontSize: { xs: 52, sm: 64 },
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: "-0.04em",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {monogramOf(name)}
      </Box>
      <Box sx={{ position: "relative", px: 1.25, py: 1, minWidth: 0 }}>
        <Typography
          variant="subtitle2"
          component="span"
          sx={{ ...lineClamp(2), fontWeight: 600, lineHeight: 1.3 }}
        >
          {name}
        </Typography>
        {caption ? (
          <Typography
            id={`${detailsId}-caption`}
            variant="caption"
            component="span"
            color="text.secondary"
            sx={{ display: "block", mt: 0.25 }}
          >
            {caption}
          </Typography>
        ) : (
          <Skeleton variant="text" width="55%" sx={{ fontSize: "0.75rem" }} />
        )}
      </Box>
    </ToggleButton>
  );
};

/**
 * The root groups (the guild, each expansion, standalone factions) as
 * colour-coded tiles, one pressed at a time: each is a toggle button (a Tab
 * stop with aria-pressed; Space or Enter picks it), in Blizzard's order.
 */
const GroupTilePicker = ({
  groups,
  value,
  onChange,
}: GroupTilePickerProps): JSX.Element => (
  <Box
    role="group"
    aria-label="Reputation groups"
    sx={{ display: "grid", gap: GROUP_TILE_GAP, ...gridTemplateColumnsSx(GROUP_TILE_COLS) }}
  >
    {groups.map((group) => (
      <GroupTile
        key={group.id}
        group={group}
        selected={group.id === value}
        onSelect={onChange}
      />
    ))}
  </Box>
);

export default GroupTilePicker;
